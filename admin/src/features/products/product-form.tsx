import { categories, type Product } from '@thread/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';

export type ProductFields = Pick<Product, 'name' | 'description' | 'category' | 'price' | 'isPublished'>;

/** 商品登録と編集で共通の入力フォームを表示する */
export function ProductForm({
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

    // 商品フォームの入力値を送信用の型にそろえる
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
