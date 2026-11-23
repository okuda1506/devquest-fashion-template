import { orderLabels, type Order } from '@thread/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, yen } from '../../api';
import { useSession } from '../auth/session';

export function Orders() {
  const token = useSession().session?.token;
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    api<Order[]>('/orders', { signal: controller.signal }, token).then(setOrders, (cause: Error) => {
      if (!controller.signal.aborted) setError(cause.message);
    });
    return () => controller.abort();
  }, [token]);
  return <section className="utility-page"><h1>注文履歴</h1>
    {!token ? <p><Link to="/login">ログイン</Link>してください。</p> : error ? <p role="alert">{error}</p>
      : !orders ? <p role="status">注文を読み込み中…</p> : !orders.length ? <p>注文履歴はありません。</p>
      : orders.map(order => <article className="row" key={order.id}>
        <div><strong>{order.items.map(item => `${item.name} × ${item.quantity}`).join('、')}</strong>
          <p>{new Date(order.createdAt).toLocaleString('ja-JP')} ・ {orderLabels[order.status]}</p></div>
        <span>{yen(order.total)}</span>
        <Link to={'/checkout/complete/' + encodeURIComponent(order.id)}>注文内容を見る</Link>
      </article>)}
  </section>;
}
