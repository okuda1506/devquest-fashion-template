import { type Product } from '@thread/shared';

export type Sort = 'default' | 'asc' | 'desc';

/** 画面で指定された価格順で商品一覧を並べ替える */
export function sortProducts(products: Product[], sort: Sort) {
    if (sort === 'default') return products;
    return [...products].sort((a, b) =>
        sort === 'asc' ? String(a.price).localeCompare(String(b.price)) : String(b.price).localeCompare(String(a.price))
    );
}
