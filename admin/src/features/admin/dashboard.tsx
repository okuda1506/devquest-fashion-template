import { ArrowRight } from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import type { Product } from '@thread/shared';
import { useAdminList } from './admin-data';
import type { AdminOrder } from './manage-orders';

export function Dashboard() {
  const token = useOutletContext<string>();
  const products = useAdminList<Product>('/admin/products', token);
  const orders = useAdminList<AdminOrder>('/admin/orders', token);
  const cards = [
    { label: '登録商品', to: '/products', data: products, count: products.items.length },
    { label: '在庫切れ', to: '/inventory', data: products, count: products.items.filter(product => product.stock === 0).length },
    { label: '発送待ち', to: '/orders', data: orders, count: orders.items.filter(order => order.status === 'PLACED').length },
  ];
  return <section aria-labelledby="dashboard-title">
    <h1 id="dashboard-title">ダッシュボード</h1>
    {(products.loadError || orders.loadError) && <p role="alert">集計を取得できませんでした。<button className="admin-secondary" onClick={() => {
      products.refresh();
      orders.refresh();
    }}>再読み込み</button></p>}
    <div className="dashboard-cards">
      {cards.map(({ label, to, data, count }) => <Link to={to} key={to}>
        <span>{label}</span><strong>{data.loading ? '取得中…' : data.loadError ? '—' : count}</strong><ArrowRight size={16} aria-hidden="true" />
      </Link>)}
    </div>
  </section>;
}
