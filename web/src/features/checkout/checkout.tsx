import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { orderLabels, type Order, type ShippingAddress } from '@thread/shared';
import { api, yen } from '../../api';
import { useSession } from '../auth/session';
import { useCart } from '../cart/cart-state';
import { CheckoutPage } from './checkout-layout';
import './checkout.css';

type Line = { productId?: string; id?: string; name: string; unitPrice: number; quantity: number };
type CheckoutReview = {
  items: Line[];
  total: number;
  shippingAddress: ShippingAddress;
  checkoutId: string;
  version: string;
};
type CheckoutContext = {
  token: string;
  address?: ShippingAddress;
  review?: CheckoutReview;
  setAddress: (address?: ShippingAddress) => void;
  setReview: (review?: CheckoutReview) => void;
};
const prefectures = '北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' ');

export function CheckoutFlow() {
  const { session, checking } = useSession();
  if (checking) return <p className="utility-page" role="status">ログイン状態を確認しています…</p>;
  if (!session) return <Navigate to="/login" state={{ returnTo: '/checkout' }} replace />;
  return <CheckoutDraft key={session.token} token={session.token} />;
}

function CheckoutDraft({ token }: { token: string }) {
  const [address, setAddress] = useState<ShippingAddress>();
  const [review, setReview] = useState<CheckoutReview>();
  return <Outlet context={{ token, address, review, setAddress, setReview } satisfies CheckoutContext} />;
}

function OrderSummary({ items, total }: { items: Line[]; total: number }) {
  return <aside className="checkout-summary" aria-label="注文内容">
    <h2>注文内容</h2>
    <ul>{items.map(item => <li key={item.productId ?? item.id}>
      <span>{item.name}<small>{yen(item.unitPrice)} × {item.quantity} 点</small></span>
      <strong>{yen(item.unitPrice * item.quantity)}</strong>
    </li>)}</ul>
    <dl>
      <div><dt>商品小計</dt><dd>{yen(total)}</dd></div>
      <div><dt>送料</dt><dd>無料</dd></div>
      <div className="checkout-total"><dt>お支払い合計</dt><dd>{yen(total)}</dd></div>
    </dl>
  </aside>;
}

function DeliveryDetails({ address }: { address: ShippingAddress }) {
  return <dl className="checkout-delivery">
    <div><dt>お届け先</dt><dd>{address.name} 様</dd></div>
    <div><dt>住所</dt><dd>〒{address.postalCode}<br />{address.prefecture}{address.city}{address.line1}
      {address.line2 && <><br />{address.line2}</>}</dd></div>
    <div><dt>電話番号</dt><dd>{address.phone}</dd></div>
    <div><dt>配送方法</dt><dd>宅配便</dd></div>
    <div><dt>お支払い</dt><dd>代金引換（模擬）</dd></div>
  </dl>;
}

export function CheckoutAddress() {
  const { token, address, setAddress, setReview } = useOutletContext<CheckoutContext>();
  const { items: cart, loadError, refresh } = useCart();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const items = (cart ?? []).map(({ product, quantity }) => ({
    productId: product.id, name: product.name, unitPrice: product.price, quantity,
  }));
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const field = (name: keyof ShippingAddress) => String(data.get(name) ?? '').trim();
    const shippingAddress = {
      name: field('name'), postalCode: field('postalCode'), prefecture: field('prefecture'), city: field('city'),
      line1: field('line1'), line2: field('line2'), phone: field('phone'),
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
      const review = await api<CheckoutReview>('/orders/preview', { method: 'POST', body: JSON.stringify({ shippingAddress }) }, token);
      setAddress(review.shippingAddress);
      setReview(review);
      navigate('/checkout/confirm');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <CheckoutPage step={1} title="配送先を入力">
    <Link className="back-link" to="/cart"><ArrowLeft size={15} aria-hidden="true" /> カートへ戻る</Link>
    {loadError ? <div><p role="alert">{loadError}</p>
      <button onClick={refresh}>再試行</button></div>
      : !cart ? <p role="status">カートを読み込み中…</p>
      : !cart.length ? <p>カートに商品がありません。 <Link to="/">買い物を続ける</Link></p>
      : <div className="checkout-grid">
        <div>
          <form className="checkout-form" onSubmit={confirm}>
            <fieldset disabled={busy}>
              <legend>お届け先</legend>
              <label>お名前<input name="name" autoComplete="shipping name" maxLength={100} defaultValue={address?.name} required /></label>
              <div className="checkout-fields">
                <label>郵便番号<input name="postalCode" autoComplete="shipping postal-code" inputMode="numeric" placeholder="100-0001"
                  pattern="[0-9]{3}-?[0-9]{4}" maxLength={8} defaultValue={address?.postalCode} required /></label>
                <label>都道府県<select name="prefecture" autoComplete="shipping address-level1" defaultValue={address?.prefecture ?? ''} required>
                  <option value="">選択してください</option>{prefectures.map(prefecture => <option key={prefecture}>{prefecture}</option>)}
                </select></label>
              </div>
              <label>市区町村<input name="city" autoComplete="shipping address-level2" maxLength={100} defaultValue={address?.city} required /></label>
              <label>番地<input name="line1" autoComplete="shipping address-line1" maxLength={120} defaultValue={address?.line1} required /></label>
              <label>建物名・部屋番号（任意）<input name="line2" autoComplete="shipping address-line2" maxLength={120} defaultValue={address?.line2} /></label>
              <label>電話番号<input name="phone" type="tel" autoComplete="shipping tel" placeholder="090-1234-5678"
                pattern="([0-9]-?){9,10}[0-9]" maxLength={14} defaultValue={address?.phone} required /></label>
            </fieldset>
            <div className="checkout-method"><h2>配送・お支払い</h2><p>宅配便（送料無料）／ 代金引換（模擬）</p></div>
            {error && <p className="checkout-error" role="alert">{error}</p>}
            <button className="checkout-primary" disabled={busy}>{busy ? '確認中…' : '注文内容を確認する'} <ArrowRight size={17} aria-hidden="true" /></button>
          </form>
        </div>
        <OrderSummary items={items} total={total} />
      </div>}
  </CheckoutPage>;
}

export function CheckoutConfirm() {
  const { token, review } = useOutletContext<CheckoutContext>();
  const { refresh } = useCart();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [error, setError] = useState('');

  if (!review) return <Navigate to="/checkout" replace />;

  async function placeOrder(event: FormEvent<HTMLFormElement>, current: CheckoutReview) {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const { checkoutId, version, shippingAddress } = current;
      const order = await api<Order>('/orders', {
        method: 'POST', body: JSON.stringify({ checkoutId, version, shippingAddress }),
      }, token);
      refresh();
      navigate('/checkout/complete/' + encodeURIComponent(order.id), { replace: true });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
      sending.current = false;
    }
  }

  return <CheckoutPage step={2} title="注文内容を確認">
    <div className="checkout-grid">
      <div>
        <section className="checkout-card" aria-labelledby="delivery-title">
          <h2 id="delivery-title">配送先とお支払い</h2>
          <DeliveryDetails address={review.shippingAddress} />
        </section>
        <form className="checkout-confirm" onSubmit={event => { void placeOrder(event, review); }}>
          <p>こちらは演習用の注文です。実際の請求・配送はありません。</p>
          {error && <div className="checkout-error" role="alert"><p>{error}</p>
            <p><Link to="/checkout">注文内容を確認し直す</Link> · <Link to="/orders">注文履歴を見る</Link></p></div>}
          <div className="checkout-confirm-actions">
            <button type="button" className="checkout-back" disabled={busy} onClick={() => navigate('/checkout')}>
              <ArrowLeft size={16} aria-hidden="true" /> 戻る
            </button>
            <button className="checkout-primary" disabled={busy}>{busy ? '注文を処理中…' : '注文を確定する'} <ArrowRight size={17} aria-hidden="true" /></button>
          </div>
        </form>
      </div>
      <OrderSummary items={review.items} total={review.total} />
    </div>
  </CheckoutPage>;
}

export function CheckoutComplete() {
  const { token, setReview, setAddress } = useOutletContext<CheckoutContext>();
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
    void api<Order>('/orders/' + encodeURIComponent(id), { signal: abort.signal }, token).then(
      result => { if (!abort.signal.aborted) setOrder(result); },
      (cause: Error) => { if (!abort.signal.aborted) setError(cause.message); },
    );
    return () => abort.abort();
  }, [id, token]);

  return <CheckoutPage step={3} title={order ? 'ご注文を承りました' : '注文の確認'}>
    {error ? <div><p role="alert">{error}</p><Link to="/orders">注文履歴に戻る</Link></div>
      : !order ? <p role="status">注文内容を読み込み中…</p>
      : <div className="checkout-grid">
        <div className="checkout-card">
          <span className="checkout-success-icon"><Check size={21} aria-hidden="true" /></span>
          <h2>注文番号</h2>
          <p className="checkout-order-id">{order.id}</p>
          <p>{orderLabels[order.status]}</p>
          {order.shippingAddress && <DeliveryDetails address={order.shippingAddress} />}
          <div className="checkout-links">
            <Link className="action-link" to="/orders">注文履歴を見る</Link><Link to="/">買い物を続ける</Link>
          </div>
        </div>
        <OrderSummary items={order.items} total={order.total} />
      </div>}
  </CheckoutPage>;
}
