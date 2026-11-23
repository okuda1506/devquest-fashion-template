import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, yen } from '../../api';
import { useSession } from '../auth/session';
import type { Product } from '../products/products';

type Item = { productId: string; product: Product; quantity: number };

export function Cart() {
  const { session } = useSession();
  const token = session?.token;
  const [items, setItems] = useState<Item[] | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    api<Item[]>('/cart', { signal: controller.signal }, token).then(setItems, (cause: Error) => {
      if (!controller.signal.aborted) setMessage(cause.message);
    });
    return () => controller.abort();
  }, [token, reload]);
  if (!token) return <p><Link to="/login">ログイン</Link>してカートを確認してください。</p>;

  async function change(path: string, options: RequestInit, success?: string) {
    setBusy(true); setMessage('');
    try { await api(path, options, token); setReload(n => n + 1); if (success) setMessage(success); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  return <section><h1>カート</h1>
    {message && <p role="status">{message}</p>}
    {!items && !message && <p role="status">読み込み中…</p>}
    {items?.length === 0 && <p>カートに商品がありません。 <Link to="/">買い物を続ける</Link></p>}
    {!!items?.length && <>
      {items.map(item => <div className="row" key={item.productId}>
        <Link to={'/products/' + item.productId}>{item.product.name}</Link>
        <span>{yen(item.product.price)}</span>
        <label>数量 <input className="quantity" type="number" min={1} max={99} value={item.quantity} disabled={busy}
          onChange={event => { const quantity = event.target.valueAsNumber; if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 99) void change('/cart/' + item.productId, { method: 'PUT', body: JSON.stringify({ quantity }) }); }} /></label>
        <button disabled={busy} onClick={() => void change('/cart/' + item.productId, { method: 'DELETE' })}>削除</button>
      </div>)}
      <p>合計 <strong>{yen(items.reduce((sum, item) => sum + item.quantity * item.product.price, 0))}</strong></p>
      <button disabled={busy} onClick={() => void change('/orders', { method: 'POST' }, '注文が確定しました。')}>注文する</button>
    </>}
  </section>;
}
