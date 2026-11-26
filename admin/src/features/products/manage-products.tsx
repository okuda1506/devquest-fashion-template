import { useOutletContext } from 'react-router-dom';
import { useState } from 'react';
import type { Product } from '@thread/shared';
import { AdminFeedback } from '../../components/admin-feedback';
import { ProductTable } from '../../components/product-table';
import { useAdminList } from '../../hooks/use-admin-list';
import { useProductSearch } from '../../hooks/use-product-search';
import { Plus, RefreshCw } from 'lucide-react';
import { ProductForm, type ProductFields } from './product-form';

/** 商品マスタの一覧・登録・編集を扱う */
export function ManageProducts() {
    const token = useOutletContext<string>();
    const data = useAdminList<Product>('/admin/products', token);
    const [editor, setEditor] = useState<Product | 'new' | null>(null);
    const { query, setQuery, matchesProduct } = useProductSearch();
    const visible = data.items.filter(matchesProduct);
    const locked = data.saving || data.loading;

    // 商品登録または既存商品の変更項目の保存を行う
    async function saveProduct(fields: ProductFields, stock: number) {
        if (editor === null) return false;
        if (editor === 'new') {
            const success = await data.save('/admin/products', 'POST', { ...fields, stock }, '商品を登録しました。');
            if (success) {
                setEditor(null);
                setQuery('');
            }
            return success;
        }

        // 差分のみ送信して別の操作者が変更した未編集項目を上書きしない
        const changed = Object.fromEntries(
            (Object.keys(fields) as Array<keyof ProductFields>)
                .filter((key) => fields[key] !== editor[key])
                .map((key) => [key, fields[key]])
        );
        if (Object.keys(changed).length === 0) {
            setEditor(null);
            return true;
        }
        const success = await data.save(
            '/admin/products/' + encodeURIComponent(editor.id),
            'PATCH',
            changed,
            '商品情報を保存しました。'
        );
        if (success) setEditor(null);
        return success;
    }

    return (
        <section aria-labelledby="admin-products-title">
            <h1 id="admin-products-title">商品管理</h1>
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
                <div className="admin-actions">
                    <button type="button" className="admin-secondary" disabled={locked} onClick={data.refresh}>
                        <RefreshCw size={15} aria-hidden="true" /> 一覧を更新
                    </button>
                    <button type="button" disabled={locked} onClick={() => setEditor('new')}>
                        <Plus size={16} aria-hidden="true" /> 新規登録
                    </button>
                </div>
            </div>
            {editor && (
                <ProductForm
                    key={editor === 'new' ? 'new' : editor.id}
                    product={editor === 'new' ? undefined : editor}
                    save={saveProduct}
                    busy={locked}
                    close={() => setEditor(null)}
                />
            )}
            <AdminFeedback {...data} />
            {!data.loading && !data.loadError && !visible.length && <p>該当する商品はありません。</p>}
            {!!visible.length && (
                <ProductTable
                    products={visible}
                    action={(product) => (
                        <button
                            type="button"
                            className="admin-secondary"
                            disabled={locked}
                            onClick={() => setEditor(product)}
                        >
                            編集
                        </button>
                    )}
                />
            )}
        </section>
    );
}
