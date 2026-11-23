import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { categories, yen, type Product } from '@thread/shared';
import { AdminFeedback } from './admin-feedback';
import { useAdminList } from './admin-data';

type ProductFields = Pick<Product, 'name' | 'description' | 'category' | 'price' | 'isPublished'>;

/** 商品登録と編集で共通の入力フォームを表示する */
function ProductForm({
    product,
    busy,
    close,
    save
}: {
    product?: Product;
    busy: boolean;
    close: () => void;
    save: (fields: ProductFields, stock: number) => Promise<boolean>;
}) {
    const name = useRef<HTMLInputElement>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        name.current?.focus();
    }, []);

    /** 商品フォームの入力値を送信用の型にそろえる */
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const name = String(form.get('name')).trim();
        if (!name) {
            setError('商品名を入力してください。');
            return;
        }
        setError('');
        await save(
            {
                name,
                description: String(form.get('description')),
                category: String(form.get('category')),
                price: Number(form.get('price')),
                isPublished: form.get('isPublished') === 'true'
            },
            Number(form.get('stock') ?? 0)
        );
    }

    return (
        <form className="product-editor" onSubmit={submit} aria-labelledby="product-edit-title">
            <h3 id="product-edit-title">{product ? '商品を編集' : '商品を新規登録'}</h3>
            <fieldset className="admin-fields" disabled={busy}>
                <label className="full-width">
                    商品名
                    <input required name="name" ref={name} maxLength={100} defaultValue={product?.name} />
                </label>
                <label>
                    カテゴリー
                    <select name="category" defaultValue={product?.category ?? 'tops'}>
                        {Object.entries(categories).map(([id, label]) => (
                            <option key={id} value={id}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    販売価格（円）
                    <input required name="price" type="number" min={0} max={1000000} defaultValue={product?.price} />
                </label>
                <label>
                    公開状態
                    <select name="isPublished" defaultValue={String(product?.isPublished ?? false)}>
                        <option value="false">非公開</option>
                        <option value="true">公開</option>
                    </select>
                </label>
                {!product && (
                    <label>
                        初期在庫数
                        <input required name="stock" type="number" min={0} max={100000} defaultValue={0} />
                    </label>
                )}
                <label className="full-width">
                    商品説明
                    <textarea name="description" maxLength={2000} rows={4} defaultValue={product?.description} />
                </label>
            </fieldset>
            {error && <p role="alert">{error}</p>}
            <div className="admin-actions">
                <button type="submit" disabled={busy}>
                    {product ? '変更を保存' : '商品を登録'}
                </button>
                <button type="button" className="admin-secondary" disabled={busy} onClick={close}>
                    閉じる
                </button>
            </div>
        </form>
    );
}

/** 商品マスタと在庫管理それぞれの一覧・編集を切り替えて表示する */
export function ManageProducts({ inventory }: { inventory: boolean }) {
    const token = useOutletContext<string>();
    const data = useAdminList<Product>('/admin/products', token);
    const [editor, setEditor] = useState<Product | 'new' | null>(null);
    const [params] = useSearchParams();
    const [query, setQuery] = useState(() => params.get('q') ?? '');
    const [stockFilter, setStockFilter] = useState('all');
    const keyword = query.trim().toLowerCase();
    const visible = data.items.filter((product) => {
        const searchText = [product.name, product.id, categories[product.category]].join(' ').toLowerCase();
        return searchText.includes(keyword) && (stockFilter === 'all' || product.stock === 0);
    });
    const locked = data.saving || data.loading;

    /** 商品登録または既存商品の変更項目の保存を行う */
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

    /** 一覧で確認した在庫数を更新前の期待値として API に送る */
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
            <h1 id="admin-products-title">{inventory ? '在庫管理' : '商品管理'}</h1>
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
                {inventory && (
                    <label>
                        在庫状況
                        <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
                            <option value="all">すべて</option>
                            <option value="out">在庫切れのみ</option>
                        </select>
                    </label>
                )}
                <div className="admin-actions">
                    <button type="button" className="admin-secondary" disabled={locked} onClick={data.refresh}>
                        <RefreshCw size={15} aria-hidden="true" /> 一覧を更新
                    </button>
                    {!inventory && (
                        <button type="button" disabled={locked} onClick={() => setEditor('new')}>
                            <Plus size={16} aria-hidden="true" /> 新規登録
                        </button>
                    )}
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
                <div
                    className="table-scroll"
                    role="region"
                    aria-label={inventory ? '在庫一覧' : '商品一覧'}
                    tabIndex={0}
                >
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th scope="col">商品</th>
                                <th scope="col">カテゴリー</th>
                                <th scope="col">価格</th>
                                <th scope="col">公開状態</th>
                                {inventory && <th scope="col">現在の在庫</th>}
                                <th scope="col">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map((product) => (
                                <tr key={product.id}>
                                    <th scope="row">
                                        {product.name}
                                        <small className="admin-mono">{product.id}</small>
                                    </th>
                                    <td>{categories[product.category]}</td>
                                    <td>{yen(product.price)}</td>
                                    <td>
                                        <span className={'badge ' + (product.isPublished ? 'positive' : '')}>
                                            {product.isPublished ? '公開' : '非公開'}
                                        </span>
                                    </td>
                                    {inventory && (
                                        <td>
                                            {product.stock === 0 ? (
                                                <span className="badge warning">在庫切れ</span>
                                            ) : (
                                                `${product.stock} 点`
                                            )}
                                        </td>
                                    )}
                                    <td>
                                        {inventory ? (
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
                                        ) : (
                                            <button
                                                type="button"
                                                className="admin-secondary"
                                                disabled={locked}
                                                onClick={() => setEditor(product)}
                                            >
                                                編集
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
