import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '@thread/shared';
import { useCart } from '../cart/cart-state';
import { CheckoutPage } from './checkout-layout';
import type { CheckoutContext, CheckoutReview } from './checkout.types';
import type { CustomerAddress } from '../account/account.types';
import { ShippingFields, readShippingAddress } from './shipping-fields';
import { OrderSummary } from './order-summary';

/** 配送先を入力して注文内容の確認へ進む */
export function CheckoutAddress() {
    const { token, address, setAddress, setReview } = useOutletContext<CheckoutContext>();
    const { items: cart, loadError, refresh } = useCart();
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const navigate = useNavigate();
    const addressBookLabel = useId();
    const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState('');
    const [addressBookError, setAddressBookError] = useState(false);
    const selectedAddress = savedAddresses.find(({ id }) => id === selectedAddressId);

    useEffect(() => {
        const controller = new AbortController();
        void api<CustomerAddress[]>('/customers/me/addresses', { signal: controller.signal }, token).then(
            (addresses) => { if (!controller.signal.aborted) setSavedAddresses(addresses); },
            () => { if (!controller.signal.aborted) setAddressBookError(true); }
        );
        return () => controller.abort();
    }, [token]);

    const items = (cart ?? []).map(({ product, quantity }) => ({
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        quantity
    }));
    const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    // 配送先を検証して注文内容プレビューを API から取得する
    async function confirm(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        const shippingAddress = readShippingAddress(event.currentTarget);
        setAddress(shippingAddress);
        setReview(undefined);
        if (!shippingAddress.name || !shippingAddress.city || !shippingAddress.line1) {
            setError('お名前、市区町村、番地を入力してください。');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const review = await api<CheckoutReview>(
                '/orders/preview',
                { method: 'POST', body: JSON.stringify({ shippingAddress }) },
                token
            );
            setAddress(review.shippingAddress);
            setReview(review);
            navigate('/checkout/confirm');
        } catch (cause) {
            setError((cause as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <CheckoutPage step={1} title="配送先を入力">
            <Link className="back-link" to="/cart">
                <ArrowLeft size={15} aria-hidden="true" /> カートへ戻る
            </Link>
            {loadError ? (
                <div>
                    <p role="alert">{loadError}</p>
                    <button onClick={refresh}>再試行</button>
                </div>
            ) : !cart ? (
                <p role="status">カートを読み込み中…</p>
            ) : !cart.length ? (
                <p>
                    カートに商品がありません。 <Link to="/">買い物を続ける</Link>
                </p>
            ) : (
                <div className="checkout-grid">
                    <div>
                        <form className="checkout-form" onSubmit={confirm}>
                            <fieldset disabled={busy}>
                                <legend>お届け先</legend>
                                {savedAddresses.length > 0 && (
                                    <label>
                                        <span id={addressBookLabel}>アドレス帳から選ぶ</span>
                                        <select
                                            aria-labelledby={addressBookLabel}
                                            value={selectedAddressId}
                                            onChange={(event) => setSelectedAddressId(event.target.value)}
                                        >
                                            <option value="">自分で入力する</option>
                                            {savedAddresses.map(({ id, name, prefecture, city, line1 }) => (
                                                <option key={id} value={id}>{name} ／ {prefecture}{city}{line1}</option>
                                            ))}
                                        </select>
                                    </label>
                                )}
                                {addressBookError && <p role="status">アドレス帳を取得できませんでした。お届け先を入力してください。</p>}
                                <ShippingFields key={selectedAddressId} address={selectedAddress ?? address} />
                            </fieldset>
                            <div className="checkout-method">
                                <h2>配送・お支払い</h2>
                                <p>宅配便（送料無料）／ 代金引換（模擬）</p>
                            </div>
                            {error && (
                                <p className="checkout-error" role="alert">
                                    {error}
                                </p>
                            )}
                            <button className="checkout-primary" disabled={busy}>
                                {busy ? '確認中…' : '注文内容を確認する'} <ArrowRight size={17} aria-hidden="true" />
                            </button>
                        </form>
                    </div>
                    <OrderSummary items={items} total={total} />
                </div>
            )}
        </CheckoutPage>
    );
}
