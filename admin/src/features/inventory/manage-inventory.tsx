import { useOutletContext } from 'react-router-dom';
import { useState, type FormEvent } from 'react';
import type { Product } from '@thread/shared';
import { AdminFeedback } from '../../components/admin-feedback';
import { ProductTable } from '../../components/product-table';
import { useAdminList } from '../../hooks/use-admin-list';
import { useProductSearch } from '../../hooks/use-product-search';
import { RefreshCw } from 'lucide-react';

/** 在庫の一覧・絞り込み・更新を扱う */
export function ManageInventory() {
    const token = useOutletContext<string>();
    const data = useAdminList<Product>('/admin/products', token);
    const { query, setQuery, matchesProduct } = useProductSearch();
    const [stockFilter, setStockFilter] = useState('all');
    const visible = data.items.filter(
        (product) => matchesProduct(product) && (stockFilter === 'all' || product.stock === 0)
    );
    const locked = data.saving || data.loading;

    // 一覧で確認した在庫数を更新前の期待値として API に送る
    function updateStock(event: FormEvent<HTMLFormElement>, product: Product) {
        event.preventDefault();
        const stock = Number(new FormData(event.currentTarget).get('stock'));
        void data.save(
            '/admin/inventory/' + encodeURIComponent(product.id),
            'PATCH',
            { stock, expectedStock: product.stock },
            '在庫数を保存しました。'
        );
    }

    return (
        <section aria-labelledby="admin-products-title">
            <h1 id="admin-products-title">在庫管理</h1>
            <div className="admin-toolbar">
                <label>
                    商品を検索
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="商品名・商品ID・カテゴリー"
                    />
                </label>
                <label>
                    在庫状況
                    <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
                        <option value="all">すべて</option>
                        <option value="out">在庫切れのみ</option>
                    </select>
                </label>
                <div className="admin-actions">
                    <button type="button" className="admin-secondary" disabled={locked} onClick={data.refresh}>
                        <RefreshCw size={15} aria-hidden="true" /> 一覧を更新
                    </button>
                </div>
            </div>
            <AdminFeedback {...data} />
            {!data.loading && !data.loadError && !visible.length && <p>該当する商品はありません。</p>}
            {!!visible.length && (
                <ProductTable
                    products={visible}
                    inventory
                    action={(product) => (
                        <form
                            className="stock-editor"
                            key={product.stock}
                            onSubmit={(event) => updateStock(event, product)}
                        >
                            <input
                                name="stock"
                                aria-label={product.name + 'の在庫数'}
                                type="number"
                                min={0}
                                max={100000}
                                defaultValue={product.stock}
                                disabled={locked}
                                required
                            />
                            <button className="admin-secondary" disabled={locked}>
                                保存
                            </button>
                        </form>
                    )}
                />
            )}
        </section>
    );
}
