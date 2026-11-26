import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { type ShippingAddress } from '@thread/shared';
import { api } from '@thread/shared';
import { useCart } from '../cart/cart-state';
import { CheckoutPage } from './checkout-layout';
import type { CheckoutContext, CheckoutReview } from './checkout.types';
import { OrderSummary } from './order-summary';

const prefectures =
    '北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(
        ' '
    );

/** 配送先を入力して注文内容の確認へ進む */
export function CheckoutAddress() {
    const { token, address, setAddress, setReview } = useOutletContext<CheckoutContext>();
    const { items: cart, loadError, refresh } = useCart();
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const navigate = useNavigate();

    const items = (cart ?? []).map(({ product, quantity }) => ({
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        quantity
    }));
    const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    /** 配送先を検証して注文内容プレビューを API から取得する */
    async function confirm(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        const data = new FormData(event.currentTarget);
        /** フォームに入力された配送先の値をトリムして取得する */
        const field = (name: keyof ShippingAddress) => String(data.get(name) ?? '').trim();
        const shippingAddress = {
            name: field('name'),
            postalCode: field('postalCode'),
            prefecture: field('prefecture'),
            city: field('city'),
            line1: field('line1'),
            line2: field('line2'),
            phone: field('phone')
        };
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
                                <label>
                                    お名前
                                    <input
                                        name="name"
                                        autoComplete="shipping name"
                                        maxLength={100}
                                        defaultValue={address?.name}
                                        required
                                    />
                                </label>
                                <div className="checkout-fields">
                                    <label>
                                        郵便番号
                                        <input
                                            name="postalCode"
                                            autoComplete="shipping postal-code"
                                            inputMode="numeric"
                                            placeholder="100-0001"
                                            pattern="[0-9]{3}-?[0-9]{4}"
                                            maxLength={8}
                                            defaultValue={address?.postalCode}
                                            required
                                        />
                                    </label>
                                    <label>
                                        都道府県
                                        <select
                                            name="prefecture"
                                            autoComplete="shipping address-level1"
                                            defaultValue={address?.prefecture ?? ''}
                                            required
                                        >
                                            <option value="">選択してください</option>
                                            {prefectures.map((prefecture) => (
                                                <option key={prefecture}>{prefecture}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                                <label>
                                    市区町村
                                    <input
                                        name="city"
                                        autoComplete="shipping address-level2"
                                        maxLength={100}
                                        defaultValue={address?.city}
                                        required
                                    />
                                </label>
                                <label>
                                    番地
                                    <input
                                        name="line1"
                                        autoComplete="shipping address-line1"
                                        maxLength={120}
                                        defaultValue={address?.line1}
                                        required
                                    />
                                </label>
                                <label>
                                    建物名・部屋番号（任意）
                                    <input
                                        name="line2"
                                        autoComplete="shipping address-line2"
                                        maxLength={120}
                                        defaultValue={address?.line2}
                                    />
                                </label>
                                <label>
                                    電話番号
                                    <input
                                        name="phone"
                                        type="tel"
                                        autoComplete="shipping tel"
                                        placeholder="090-1234-5678"
                                        pattern="([0-9]-?){9,10}[0-9]"
                                        maxLength={14}
                                        defaultValue={address?.phone}
                                        required
                                    />
                                </label>
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
