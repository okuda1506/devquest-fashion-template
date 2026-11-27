import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import { type Order, type PaymentMethod } from '@thread/shared';
import { ApiError, api } from '@thread/shared';
import { guestCartLines, guestCartSignature } from '../cart/guest-cart';
import { useCart } from '../cart/cart-state';
import { CheckoutPage } from './checkout-layout';
import type { CheckoutContext, CheckoutReview } from './checkout.types';
import { forgetGuestOrder, guestCheckoutPath, guestOrderApi, rememberGuestOrder } from './guest-order-session';
import { OrderSummary } from './order-summary';
import { DeliveryDetails } from './delivery-details';
import { cardExpiry, cardSecurityCode, PaymentFields, testCards, type TestCardChoice } from './payment-fields';

/** 注文内容と配送先を表示して注文の確定を受け付ける */
export function CheckoutConfirm() {
    const { guest, token, review } = useOutletContext<CheckoutContext>();
    const { refresh, guestItems, clearGuestCartIfMatch } = useCart();
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);
    const sending = useRef(false);
    const [error, setError] = useState('');
    const [method, setMethod] = useState<PaymentMethod>('CASH_ON_DELIVERY');
    const [testCard, setTestCard] = useState<TestCardChoice>('approved');

    const checkoutPath = guest ? guestCheckoutPath : '/checkout';
    if (!review) return <Navigate to={checkoutPath} replace />;

    // 確認済みの内容で注文を送信して完了画面へ遷移する
    async function placeOrder(event: FormEvent<HTMLFormElement>, current: CheckoutReview) {
        event.preventDefault();
        if (sending.current) return;
        sending.current = true;
        setBusy(true);
        setError('');
        try {
            const { checkoutId, version, shippingAddress, email } = current;
            const payment = method === 'CREDIT_CARD'
                ? { method, card: { number: testCards[testCard], expiry: cardExpiry, securityCode: cardSecurityCode } }
                : { method };
            const payload = { checkoutId, version, shippingAddress, payment };
            let order: Order;
            if (guest) {
                rememberGuestOrder({ id: checkoutId, cartSignature: guestCartSignature(guestItems) });
                order = await guestOrderApi<Order>('', {
                    method: 'POST',
                    body: JSON.stringify({ ...payload, email, items: guestCartLines(guestItems) })
                });
                const signature = forgetGuestOrder(checkoutId);
                if (signature) clearGuestCartIfMatch(signature);
            } else {
                order = await api<Order>('/orders', { method: 'POST', body: JSON.stringify(payload) }, token);
                refresh();
            }
            navigate(checkoutPath + '/complete/' + encodeURIComponent(order.id), { replace: true });
        } catch (cause) {
            if (guest && cause instanceof ApiError && (
                cause.status === 400 ||
                cause.status === 402 ||
                (cause.status === 409 && cause.code !== 'CONCURRENT_UPDATE')
            )) {
                forgetGuestOrder(current.checkoutId);
            }
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
                        <h2 id="delivery-title">配送先</h2>
                        <DeliveryDetails address={review.shippingAddress} />
                        {guest && <p>ご連絡先メールアドレス {review.email}</p>}
                    </section>
                    <form
                        className="checkout-confirm"
                        onSubmit={(event) => {
                            void placeOrder(event, review);
                        }}
                    >
                        <PaymentFields
                            method={method}
                            onMethodChange={(next) => { setMethod(next); setError(''); }}
                            testCard={testCard}
                            onTestCardChange={(next) => { setTestCard(next); setError(''); }}
                            disabled={busy}
                        />
                        <p>こちらは演習用の注文です。実際の請求・配送はありません。</p>
                        {busy && (
                            <p role="status">
                                {method === 'CREDIT_CARD' ? '模擬決済を処理しています…' : '注文を処理しています…'}
                            </p>
                        )}
                        {error && (
                            <div className="checkout-error" role="alert">
                                <p>{error}</p>
                                <p>
                                    <Link to={checkoutPath}>注文内容を確認し直す</Link>
                                    {guest ? ' ' : <> · <Link to="/orders">注文履歴を見る</Link></>}
                                </p>
                            </div>
                        )}
                        <div className="checkout-confirm-actions">
                            <button
                                type="button"
                                className="checkout-back"
                                disabled={busy}
                                onClick={() => navigate(checkoutPath)}
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
