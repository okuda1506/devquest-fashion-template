import { ArrowRight, Boxes, CircleDollarSign, ClipboardList, RefreshCw, Truck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { orderLabels, yen, type Product } from '@thread/shared';
import { useAdminList } from './admin-data';
import { dayCountOptions, orderDate, shortDate, summarizeOrders, type DayCount } from './dashboard-data';
import type { AdminOrder } from './manage-orders';
import { OrderChart } from './order-chart';
import './dashboard.css';

const lowStockLimit = 3;
/** 受注一覧の絞り込み条件を URL に変換する */
const orderHref = (query: Record<string, string>) => '/orders?' + new URLSearchParams(query);
/** 補充対象の商品 ID を在庫一覧の検索条件に設定する */
const inventoryHref = (id: string) => '/inventory?' + new URLSearchParams({ q: id });

/** ダッシュボードの各集計を一貫したパネルで表示する */
function DataPanel({ loading, error, children }: { loading: boolean; error: string; children: ReactNode }) {
    if (loading)
        return (
            <p className="dashboard-empty" role="status">
                読み込み中…
            </p>
        );
    if (error) return <p className="dashboard-empty">データを取得できませんでした。</p>;
    return children;
}

/** 受注推移・発送状況・補充対象を店舗管理向けに表示する */
export function Dashboard() {
    const token = useOutletContext<string>();
    const products = useAdminList<Product>('/admin/products', token);
    const orders = useAdminList<AdminOrder>('/admin/orders', token);
    const [period, setPeriod] = useState<DayCount>(7);
    const stats = summarizeOrders(orders.items, period);
    const waiting = orders.items.filter((order) => order.status === 'PLACED').length;
    const lowStock = products.items
        .filter((product) => product.isPublished && product.stock <= lowStockLimit)
        .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, 'ja'));
    const cards = [
        {
            label: '受注金額',
            value: yen(stats.revenue),
            hint: `直近 ${period} 日間`,
            to: '/orders',
            data: orders,
            Icon: CircleDollarSign
        },
        {
            label: '受注数',
            value: `${stats.orders} 件`,
            hint: `直近 ${period} 日間`,
            to: '/orders',
            data: orders,
            Icon: ClipboardList
        },
        {
            label: '発送待ち',
            value: `${waiting} 件`,
            hint: '全期間の受付済み注文',
            to: orderHref({ status: 'PLACED' }),
            data: orders,
            Icon: Truck
        },
        {
            label: '要補充',
            value: `${lowStock.length} 商品`,
            hint: `公開中・在庫 ${lowStockLimit} 点以下`,
            to: '/inventory',
            data: products,
            Icon: Boxes
        }
    ];
    const pendingPercent = stats.orders ? (stats.pending / stats.orders) * 100 : 0;

    return (
        <section className="dashboard" aria-labelledby="dashboard-title">
            <div className="dashboard-heading">
                <div>
                    <h1 id="dashboard-title">ダッシュボード</h1>
                    <p>
                        {shortDate.format(stats.days[0].date)} –{' '}
                        {shortDate.format(stats.days[stats.days.length - 1].date)}（日本時間）
                    </p>
                </div>
                <div className="dashboard-controls">
                    <div className="dashboard-options" role="group" aria-label="集計期間">
                        {dayCountOptions.map((days) => (
                            <button
                                type="button"
                                key={days}
                                aria-pressed={period === days}
                                onClick={() => setPeriod(days)}
                            >
                                直近{days}日
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="admin-secondary dashboard-refresh"
                        disabled={orders.loading || products.loading}
                        onClick={() => {
                            products.refresh();
                            orders.refresh();
                        }}
                    >
                        <RefreshCw size={15} aria-hidden="true" /> 更新
                    </button>
                </div>
            </div>
            {(products.loadError || orders.loadError) && (
                <p role="alert">一部の集計を取得できませんでした。「更新」から再試行できます。</p>
            )}
            <div className="dashboard-metrics">
                {cards.map(({ label, to, data, value, hint, Icon }) => (
                    <Link className="dashboard-metric" to={to} key={label}>
                        <span className="dashboard-metric-label">{label}</span>
                        <span className="dashboard-metric-icon">
                            <Icon size={16} aria-hidden="true" />
                        </span>
                        <strong>{data.loading ? '…' : data.loadError ? '—' : value}</strong>
                        <small>{hint}</small>
                        <ArrowRight className="dashboard-metric-arrow" size={15} aria-hidden="true" />
                    </Link>
                ))}
            </div>
            <div className="dashboard-charts">
                <section className="dashboard-panel" aria-labelledby="trend-title">
                    <h2 id="trend-title">日別の受注推移</h2>
                    <DataPanel loading={orders.loading} error={orders.loadError}>
                        {stats.orders ? (
                            <OrderChart days={stats.days} />
                        ) : (
                            <p className="dashboard-empty">この期間に受注はありません。</p>
                        )}
                    </DataPanel>
                </section>
                <section className="dashboard-panel" aria-labelledby="status-title">
                    <h2 id="status-title">受注ステータス</h2>
                    <DataPanel loading={orders.loading} error={orders.loadError}>
                        <div
                            className="dashboard-donut"
                            style={{
                                backgroundImage: stats.orders
                                    ? `conic-gradient(var(--dashboard-pending) 0 ${pendingPercent}%, var(--dashboard-shipped) ${pendingPercent}% 100%)`
                                    : undefined
                            }}
                            aria-hidden="true"
                        >
                            <div>
                                <strong>{stats.orders}</strong>
                                <span>合計受注</span>
                            </div>
                        </div>
                        <dl className="dashboard-legend">
                            <div>
                                <dt>
                                    <i className="pending" />
                                    発送待ち
                                </dt>
                                <dd>{stats.pending} 件</dd>
                            </div>
                            <div>
                                <dt>
                                    <i className="shipped" />
                                    発送済み
                                </dt>
                                <dd>{stats.shipped} 件</dd>
                            </div>
                        </dl>
                    </DataPanel>
                </section>
            </div>
            <div className="dashboard-lists">
                <section className="dashboard-panel" aria-labelledby="recent-title">
                    <div className="dashboard-panel-heading">
                        <h2 id="recent-title">最近の注文</h2>
                        <Link to="/orders">
                            受注一覧 <ArrowRight size={14} aria-hidden="true" />
                        </Link>
                    </div>
                    <DataPanel loading={orders.loading} error={orders.loadError}>
                        {orders.items.length ? (
                            <ul className="dashboard-list dashboard-recent-orders">
                                {orders.items.slice(0, 5).map((order) => (
                                    <li key={order.id}>
                                        <Link to={orderHref({ q: order.id })}>
                                            <span>
                                                <strong>{order.user.name}</strong>
                                                <small>{orderDate.format(new Date(order.createdAt))}</small>
                                            </span>
                                            <span className={'badge ' + (order.status === 'SHIPPED' ? 'positive' : '')}>
                                                {orderLabels[order.status]}
                                            </span>
                                            <strong className="dashboard-list-value">{yen(order.total)}</strong>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="dashboard-empty">注文はまだありません。</p>
                        )}
                    </DataPanel>
                </section>
                <section className="dashboard-panel" aria-labelledby="low-stock-title">
                    <div className="dashboard-panel-heading">
                        <h2 id="low-stock-title">補充が必要な商品</h2>
                        <Link to="/inventory">
                            在庫一覧 <ArrowRight size={14} aria-hidden="true" />
                        </Link>
                    </div>
                    <DataPanel loading={products.loading} error={products.loadError}>
                        <p className="dashboard-stock-summary">
                            <Link to="/products">登録 {products.items.length} 商品</Link>
                            <span>在庫切れ {products.items.filter((product) => product.stock === 0).length} 商品</span>
                        </p>
                        {lowStock.length ? (
                            <ul className="dashboard-list">
                                {lowStock.slice(0, 5).map((product) => (
                                    <li key={product.id}>
                                        <Link to={inventoryHref(product.id)}>
                                            <strong>{product.name}</strong>
                                            <span className="badge warning">
                                                {product.stock === 0 ? '在庫切れ' : `残り ${product.stock} 点`}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="dashboard-empty">補充が必要な公開商品はありません。</p>
                        )}
                    </DataPanel>
                </section>
            </div>
        </section>
    );
}
