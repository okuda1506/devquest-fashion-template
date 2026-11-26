import { categories, yen, type Product } from '@thread/shared';
import type { ReactNode } from 'react';

/** 商品と在庫の一覧で商品情報と行ごとの操作を表示する */
export function ProductTable({
    products,
    inventory = false,
    action
}: {
    products: Product[];
    inventory?: boolean;
    action: (product: Product) => ReactNode;
}) {
    return (
        <div className="table-scroll" role="region" aria-label={inventory ? '在庫一覧' : '商品一覧'} tabIndex={0}>
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
                    {products.map((product) => (
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
                            <td>{action(product)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
