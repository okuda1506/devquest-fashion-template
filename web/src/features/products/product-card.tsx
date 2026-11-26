import { categories, type Product } from '@thread/shared';
import { Link } from 'react-router-dom';
import { ProductVisual } from './product-visual';
import { yen } from '@thread/shared';

/** 一覧で商品写真・商品名・価格を表示して詳細へ案内する */
export function ProductCard({ product }: { product: Product }) {
    return (
        <article className="product-card">
            <Link to={'/products/' + product.id}>
                <ProductVisual product={product} />
                <div className="product-caption">
                    <span className="product-category">{categories[product.category]}</span>
                    <h2>{product.name}</h2>
                    <p>{yen(product.price)}</p>
                </div>
            </Link>
        </article>
    );
}
