import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import { type Order } from '@thread/shared';
import { api } from '@thread/shared';
import { useCart } from '../cart/cart-state';
import { CheckoutPage } from './checkout-layout';
import type { CheckoutContext, CheckoutReview } from './checkout.types';
import { OrderSummary } from './order-summary';
import { DeliveryDetails } from './delivery-details';

/** 注文内容と配送先を表示して注文の確定を受け付ける */
export function CheckoutConfirm() {
    const { token, review } = useOutletContext<CheckoutContext>();
    const { refresh } = useCart();
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);
    const sending = useRef(false);
    const [error, setError] = useState('');

    if (!review) return <Navigate to="/checkout" replace />;

    /** 確認済みの内容で注文を送信して完了画面へ遷移する */
    async function placeOrder(event: FormEvent<HTMLFormElement>, current: CheckoutReview) {
        event.preventDefault();
        if (sending.current) return;
        sending.current = true;
        setBusy(true);
        setError('');
        try {
            const { checkoutId, version, shippingAddress } = current;
            const order = await api<Order>(
                '/orders',
                {
                    method: 'POST',
                    body: JSON.stringify({ checkoutId, version, shippingAddress })
                },
                token
            );
            refresh();
            navigate('/checkout/complete/' + encodeURIComponent(order.id), { replace: true });
        } catch (cause) {
            setError((cause as Error).message);
        } finally {
            setBusy(false);
            sending.current = false;
        }
    }

    return (
        <CheckoutPage step={2} title="注文内容を確認">
            <div className="checkout-grid">
                <div>
                    <section className="checkout-card" aria-labelledby="delivery-title">
                        <h2 id="delivery-title">配送先とお支払い</h2>
                        <DeliveryDetails address={review.shippingAddress} />
                    </section>
                    <form
                        className="checkout-confirm"
                        onSubmit={(event) => {
                            void placeOrder(event, review);
                        }}
                    >
                        <p>こちらは演習用の注文です。実際の請求・配送はありません。</p>
                        {error && (
                            <div className="checkout-error" role="alert">
                                <p>{error}</p>
                                <p>
                                    <Link to="/checkout">注文内容を確認し直す</Link> ·{' '}
                                    <Link to="/orders">注文履歴を見る</Link>
                                </p>
                            </div>
                        )}
                        <div className="checkout-confirm-actions">
                            <button
                                type="button"
                                className="checkout-back"
                                disabled={busy}
                                onClick={() => navigate('/checkout')}
                            >
                                <ArrowLeft size={16} aria-hidden="true" /> 戻る
                            </button>
                            <button className="checkout-primary" disabled={busy}>
                                {busy ? '注文を処理中…' : '注文を確定する'} <ArrowRight size={17} aria-hidden="true" />
                            </button>
                        </div>
                    </form>
                </div>
                <OrderSummary items={review.items} total={review.total} />
            </div>
        </CheckoutPage>
    );
}
