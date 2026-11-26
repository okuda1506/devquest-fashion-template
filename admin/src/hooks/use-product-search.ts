import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { categories, type Product } from '@thread/shared';

/** URL の検索語を初期値に商品名・ID・カテゴリーの検索状態を作る */
export function useProductSearch() {
    const [params] = useSearchParams();
    const [query, setQuery] = useState(() => params.get('q') ?? '');
    const keyword = query.trim().toLowerCase();
    function matchesProduct(product: Product) {
        const searchText = [product.name, product.id, categories[product.category]].join(' ').toLowerCase();
        return searchText.includes(keyword);
    }
    return { query, setQuery, matchesProduct };
}
