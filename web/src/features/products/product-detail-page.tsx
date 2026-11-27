import { categories, type Product } from '@thread/shared';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ProductVisual } from './product-visual';
import { api, yen } from '@thread/shared';
import { useSession } from '@thread/shared/session';
import { AddToCart } from './add-to-cart';

/** 商品情報と購入数量を選べるカート追加欄を表示する */
export function ProductDetail({ cartIcon }: { cartIcon: RefObject<HTMLSpanElement | null> }) {
    const { id } = useParams();
    const { session, checking } = useSession();
    const productImage = useRef<HTMLImageElement>(null);
    const [result, setResult] = useState<{ id?: string; item?: Product; error?: string }>({});
    useEffect(() => {
        const controller = new AbortController();
        api<Product>('/products/' + encodeURIComponent(id ?? ''), { signal: controller.signal }).then(
            (item) => {
                if (!controller.signal.aborted) setResult({ id, item });
            },
            (error: Error) => {
                if (!controller.signal.aborted) setResult({ id, error: error.message });
            }
        );
        return () => controller.abort();
    }, [id]);
    if (result.id !== id) return <p role="status">商品を読み込み中…</p>;
    if (!result.item) return <p role="alert">{result.error}</p>;
    const product = result.item;
    return (
        <div className="product-page">
            <Link className="back-link" to="/">
                <ArrowLeft size={15} aria-hidden="true" /> 商品一覧へ
            </Link>
            <div className="detail">
                <ProductVisual product={product} detail imageRef={productImage} />
                <section className="detail-copy">
                    <span className="product-category">{categories[product.category]}</span>
                    <h1>{product.name}</h1>
                    <strong className="detail-price">{yen(product.price)}</strong>
                    <p className="detail-description">{product.description}</p>
                    <p>{product.stock > 0 ? `在庫 ${product.stock} 点` : '在庫切れ'}</p>
                    {checking ? (
                        <p role="status">カートを準備しています…</p>
                    ) : (
                        <AddToCart
                            key={product.id + ':' + (session?.token ?? 'guest')}
                            product={product}
                            cartIcon={cartIcon}
                            productImage={productImage}
                        />
                    )}
                </section>
            </div>
        </div>
    );
}
