import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, yen } from '@thread/shared';
import { useSession } from '@thread/shared/session';
import { ProductVisual } from '../products/product-visual';
import { CheckoutPage } from '../checkout/checkout-layout';
import { useCart } from './cart-state';

/** ログイン状態に合わせてカート明細またはログイン導線を表示する */
export function Cart() {
    const { session, checking } = useSession();
    if (checking)
        return (
            <CheckoutPage step={0} title="カート">
                <p role="status">ログイン状態を確認しています…</p>
            </CheckoutPage>
        );
    if (!session)
        return (
            <CheckoutPage step={0} title="カート">
                <p>
                    <Link to="/login" state={{ returnTo: '/cart' }}>
                        ログイン
                    </Link>
                    してカートを確認してください。
                </p>
            </CheckoutPage>
        );
    return <CartContents key={session.token} token={session.token} />;
}

/** 数量変更・削除と購入手続きへの移動を提供する */
function CartContents({ token }: { token: string }) {
    const { items, loading, loadError, refresh } = useCart();
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    // 変更したい数量または削除をカート API に反映する
    async function change(path: string, options: RequestInit) {
        setBusy(true);
        setMessage('');
        try {
            await api(path, options, token);
            refresh();
        } catch (error) {
            setMessage((error as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <CheckoutPage step={0} title="カート">
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
                                            void change('/cart/' + item.productId, {
                                                method: 'PUT',
                                                body: JSON.stringify({ quantity })
                                            });
                                    }}
                                />
                            </label>
                            <button
                                disabled={busy || loading}
                                onClick={() => void change('/cart/' + item.productId, { method: 'DELETE' })}
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
                                購入手続きへ
                            </button>
                        ) : (
                            <Link className="action-link checkout-primary" to="/checkout">
                                購入手続きへ
                            </Link>
                        )}
                        <Link to="/">買い物を続ける</Link>
                    </div>
                </>
            )}
        </CheckoutPage>
    );
}
