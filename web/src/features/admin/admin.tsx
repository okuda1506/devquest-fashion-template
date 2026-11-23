import { useEffect, useState } from 'react';
import { api, yen } from '../../api';
import { useSession } from '../auth/session';
import { orderLabels, type Order } from '../orders/orders';
import type { Product } from '../products/products';

export function Admin() {
  const session = useSession().session;
  const token = session?.role === 'ADMIN' ? session.token : undefined;
  const [products, setProducts] = useState<Product[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    Promise.all([api<Product[]>('/admin/products', { signal: controller.signal }, token), api<Order[]>('/admin/orders', { signal: controller.signal }, token)])
      .then(([products, orders]) => { setProducts(products); setOrders(orders); }, (error: Error) => {
        if (!controller.signal.aborted) setNotice(error.message);
      });
    return () => controller.abort();
  }, [token, reload]);

  async function update(path: string, body: object) {
    setBusy(true);
    try { await api(path, { method: 'PATCH', body: JSON.stringify(body) }, token); setNotice('保存しました。'); setReload(n => n + 1); }
    catch (error) { setNotice((error as Error).message); }
    finally { setBusy(false); }
  }

  if (!token) return <p role="alert">管理者としてログインしてください。</p>;
  return <section className="utility-page"><h1>店舗管理</h1>{notice && <p role="status">{notice}</p>}
    <h2>商品・在庫</h2>
    {!products && !notice && <p role="status">読み込み中…</p>}
    {products?.map(product => <article className="row" key={product.id}>
      <strong>{product.name}</strong><span>{yen(product.price)}</span>
      <button disabled={busy} onClick={() => void update('/admin/products/' + product.id, { isPublished: !product.isPublished })}>{product.isPublished ? '非公開にする' : '公開する'}</button>
      <form key={product.stock} onSubmit={event => {
        event.preventDefault();
        const stock = Number(new FormData(event.currentTarget).get('stock'));
        void update('/admin/inventory/' + product.id, { stock });
      }}><label>在庫 <input name="stock" className="quantity" type="number" defaultValue={product.stock} min={0} max={100000} required /></label> <button disabled={busy}>保存</button></form>
    </article>)}
    <h2>注文</h2>
    {orders?.length === 0 && <p>注文はありません。</p>}
    {orders?.map(order => <article className="row" key={order.id}>
      <strong>{order.id}</strong><span>{yen(order.total)}</span><span>{orderLabels[order.status]}</span>
      <button disabled={busy || order.status === 'SHIPPED'} onClick={() => void update('/admin/orders/' + order.id, { status: 'SHIPPED' })}>発送済みにする</button>
    </article>)}
  </section>;
}
