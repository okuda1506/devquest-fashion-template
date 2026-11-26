import { type Product } from '@thread/shared';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Minus, Plus, ShoppingBag } from 'lucide-react';
import { api } from '@thread/shared';
import { animateCartAddition } from '../cart/cart-animation';
import { useCart } from '../cart/cart-state';

/** 商品詳細で選択した数量を追加して結果を表示する */
export function AddToCart({
    product,
    token,
    cartIcon,
    productImage
}: {
    product: Product;
    token: string;
    cartIcon: RefObject<HTMLSpanElement | null>;
    productImage: RefObject<HTMLImageElement | null>;
}) {
    const { items, refresh } = useCart();
    const [quantity, setQuantity] = useState(1);
    const [added, setAdded] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const stopAnimation = useRef<(() => void) | undefined>(undefined);
    const inCart = items?.find((item) => item.productId === product.id)?.quantity ?? 0;
    const available = Math.max(0, Math.min(product.stock, 99) - inCart);
    const selected = Math.min(quantity, available);

    useEffect(() => () => stopAnimation.current?.(), []);

    /** 商品数量を追加し成功時にカート状態と演出を反映する */
    async function addToCart(button: HTMLButtonElement) {
        stopAnimation.current?.();
        setAdded(false);
        setError('');
        setBusy(true);
        try {
            await api(
                '/cart/' + encodeURIComponent(product.id),
                { method: 'POST', body: JSON.stringify({ quantity: selected }) },
                token
            );
            refresh();
            setAdded(true);
        } catch (cause) {
            setError((cause as Error).message);
            return;
        } finally {
            setBusy(false);
        }
        if (cartIcon.current && button.isConnected) {
            stopAnimation.current = animateCartAddition(cartIcon.current, productImage.current, button);
        }
    }

    return (
        <div className="detail-actions">
            <div className="detail-quantity-label">
                <span>追加点数</span>
                {inCart > 0 && <span>カート内 {inCart} 点</span>}
            </div>
            <div className="detail-purchase-row">
                <div className="detail-quantity" role="group" aria-label="追加点数">
                    <button
                        type="button"
                        aria-label="追加点数を減らす"
                        disabled={busy || selected <= 1}
                        onClick={() => setQuantity(selected - 1)}
                    >
                        <Minus size={15} aria-hidden="true" />
                    </button>
                    <output>{selected}</output>
                    <button
                        type="button"
                        aria-label="追加点数を増やす"
                        disabled={busy || selected >= available}
                        onClick={() => setQuantity(selected + 1)}
                    >
                        <Plus size={15} aria-hidden="true" />
                    </button>
                </div>
                <button
                    type="button"
                    className="detail-add"
                    disabled={busy || selected === 0}
                    onClick={(event) => void addToCart(event.currentTarget)}
                >
                    <ShoppingBag size={18} aria-hidden="true" />
                    {busy ? '追加中…' : 'カートに追加'}
                </button>
            </div>
            {product.stock > 0 && available === 0 && (
                <p className="detail-quantity-note">追加できる上限に達しました。</p>
            )}
            <div className={added ? 'detail-cart-feedback is-added' : 'detail-cart-feedback'}>
                <p role="status">
                    {added && (
                        <>
                            <span className="detail-cart-check">
                                <Check size={14} aria-hidden="true" />
                            </span>
                            カートに追加しました。
                        </>
                    )}
                </p>
                {added && (
                    <Link className="detail-cart-link" to="/cart">
                        カートを見る <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                )}
            </div>
            {error && <p role="alert">{error}</p>}
        </div>
    );
}
