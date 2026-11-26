import { useState } from 'react';
import { Link } from 'react-router-dom';
import { yen } from '@thread/shared';
import { useSession } from '@thread/shared/session';
import { ProductVisual } from '../products/product-visual';
import { guestCheckoutPath } from '../checkout/guest-order-session';
import { CheckoutPage } from '../checkout/checkout-layout';
import { useCart } from './cart-state';

/** 会員またはゲストのカート明細を表示する */
export function Cart() {
    const { session, checking } = useSession();
    if (checking)
        return (
            <CheckoutPage step={0} title="カート">
                <p role="status">ログイン状態を確認しています…</p>
            </CheckoutPage>
        );
    return <CartContents key={session?.token ?? 'guest'} guest={!session} />;
}

/** 数量変更・削除と購入手続きへの移動を提供する */
function CartContents({ guest }: { guest: boolean }) {
    const { items, loading, loadError, refresh, changeQuantity, removeProduct, guestItems } = useCart();
    const checkoutPath = guest ? guestCheckoutPath : '/checkout';
    const checkoutLabel = guest ? 'ゲスト購入へ' : '購入手続きへ';
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    // 数量変更と削除の完了を待ってから入力を再開する
    async function change(update: () => Promise<void>) {
        setBusy(true);
        setMessage('');
        try {
            await update();
        } catch (error) {
            setMessage((error as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <CheckoutPage step={0} title="カート">
            {!guest && guestItems.length > 0 && (
                <p><Link to={guestCheckoutPath}>ゲストカートの商品を購入する</Link></p>
            )}
            {message && <p role="alert">{message}</p>}
            {loading && <p role="status">読み込み中…</p>}
            {loadError && (
                <div>
                    <p role="alert">{loadError}</p>
                    <button onClick={refresh}>再試行</button>
                </div>
            )}
            {!loadError && items?.length === 0 && (
                <p>
                    カートに商品がありません。 <Link to="/">買い物を続ける</Link>
                </p>
            )}
            {!loadError && !!items?.length && (
                <>
                    {items.map((item) => (
                        <div className="row" key={item.productId}>
                            <Link className="cart-product" to={'/products/' + item.productId}>
                                <ProductVisual product={item.product} />
                                {item.product.name}
                            </Link>
                            <span>{yen(item.product.price)}</span>
                            <label>
                                数量{' '}
                                <input
                                    className="quantity"
                                    type="number"
                                    min={1}
                                    max={99}
                                    value={item.quantity}
                                    disabled={busy || loading}
                                    onChange={(event) => {
                                        const quantity = event.target.valueAsNumber;
                                        if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 99)
                                            void change(() => changeQuantity(item.productId, quantity));
                                    }}
                                />
                            </label>
                            <button
                                disabled={busy || loading}
                                onClick={() => void change(() => removeProduct(item.productId))}
                            >
                                削除
                            </button>
                        </div>
                    ))}
                    <p className="cart-total">
                        合計{' '}
                        <strong>{yen(items.reduce((sum, item) => sum + item.quantity * item.product.price, 0))}</strong>
                    </p>
                    <div className="checkout-links">
                        {busy || loading ? (
                            <button disabled className="checkout-primary">
                                {checkoutLabel}
                            </button>
                        ) : (
                            <Link className="action-link checkout-primary" to={checkoutPath}>
                                {checkoutLabel}
                            </Link>
                        )}
                        <Link to="/">買い物を続ける</Link>
                    </div>
                </>
            )}
        </CheckoutPage>
    );
}
