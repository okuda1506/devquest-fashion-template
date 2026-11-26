import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { orderLabels, type Order } from '@thread/shared';
import { api } from '@thread/shared';
import { useCart } from '../cart/cart-state';
import { forgetGuestOrder, guestCheckoutPath, guestOrderApi } from './guest-order-session';
import { CheckoutPage } from './checkout-layout';
import type { CheckoutContext } from './checkout.types';
import { OrderSummary } from './order-summary';
import { DeliveryDetails } from './delivery-details';

/** 確定済みの注文を取得して注文番号と明細を表示する */
export function CheckoutComplete() {
    const { guest, token, setReview, setAddress } = useOutletContext<CheckoutContext>();
    const { clearGuestCartIfMatch } = useCart();
    const { id = '' } = useParams();
    const [order, setOrder] = useState<Order | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        setReview(undefined);
        setAddress(undefined);
    }, [setAddress, setReview]);

    useEffect(() => {
        const abort = new AbortController();
        setOrder(null);
        setError('');
        const path = '/' + encodeURIComponent(id);
        const options = { signal: abort.signal };
        const request = guest ? guestOrderApi<Order>(path, options) : api<Order>('/orders' + path, options, token);
        void request.then(
            (result) => {
                if (abort.signal.aborted) return;
                if (guest) {
                    const signature = forgetGuestOrder(id);
                    if (signature) clearGuestCartIfMatch(signature);
                }
                setOrder(result);
            },
            (cause: Error) => {
                if (!abort.signal.aborted) setError(cause.message);
            }
        );
        return () => abort.abort();
    }, [id, guest, token, clearGuestCartIfMatch]);

    return (
        <CheckoutPage step={3} title={order ? 'ご注文を承りました' : '注文の確認'}>
            {error ? (
                <div>
                    <p role="alert">{error}</p>
                    {guest ? (
                        <Link to={guestCheckoutPath}>ゲスト購入に戻る</Link>
                    ) : <Link to="/orders">注文履歴に戻る</Link>}
                </div>
            ) : !order ? (
                <p role="status">注文内容を読み込み中…</p>
            ) : (
                <div className="checkout-grid">
                    <div className="checkout-card">
                        <span className="checkout-success-icon">
                            <Check size={21} aria-hidden="true" />
                        </span>
                        <h2>注文番号</h2>
                        <p className="checkout-order-id">{order.orderNumber ?? order.id}</p>
                        <p>{orderLabels[order.status]}</p>
                        {order.shippingAddress && <DeliveryDetails address={order.shippingAddress} />}
                        <div className="checkout-links">
                            {guest ? (
                                <p>このタブで注文内容を確認できます。注文番号を控えておいてください。</p>
                            ) : (
                                <Link className="action-link" to="/orders">注文履歴を見る</Link>
                            )}
                            <Link to="/">買い物を続ける</Link>
                        </div>
                    </div>
                    <OrderSummary items={order.items} total={order.total} />
                </div>
            )}
        </CheckoutPage>
    );
}
