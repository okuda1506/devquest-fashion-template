import { useOutletContext } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { orderLabels, yen, type Order } from '@thread/shared';
import { AdminFeedback } from './admin-feedback';
import { useAdminList } from './admin-data';

export type AdminOrder = Order & {
  user: { name: string; email: string };
};

export function ManageOrders() {
  const token = useOutletContext<string>();
  const data = useAdminList<AdminOrder>('/admin/orders', token);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const keyword = query.trim().toLowerCase();
  const visible = data.items.filter(order => {
    const searchText = [order.id, order.user.name, order.user.email].join(' ').toLowerCase();
    return searchText.includes(keyword) && (status === 'all' || order.status === status);
  });
  const locked = data.loading || data.saving;

  return <section aria-labelledby="admin-orders-title">
    <h1 id="admin-orders-title">受注管理</h1>
    <div className="admin-toolbar">
      <label>受注を検索<input type="search" placeholder="注文番号・購入者名・メールアドレス"
        value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label>ステータス<select value={status} onChange={event => setStatus(event.target.value)}>
        <option value="all">すべて</option>
        {Object.entries(orderLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      <div className="admin-actions">
        <button type="button" className="admin-secondary" disabled={locked} onClick={data.refresh}>
          <RefreshCw size={15} aria-hidden="true" /> 一覧を更新
        </button>
      </div>
    </div>
    <AdminFeedback {...data} />
    {!data.loading && !data.loadError && !visible.length && <p>該当する注文はありません。</p>}
    <div className="admin-list">
      {visible.map(order => <details key={order.id} className="admin-order">
        <summary>
          <span><strong>{order.user.name}</strong><small className="admin-mono">{order.id}</small></span>
          <time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleString('ja-JP')}</time>
          <span className={'badge ' + (order.status === 'SHIPPED' ? 'positive' : '')}>{orderLabels[order.status]}</span>
          <strong>{yen(order.total)}</strong>
        </summary>
        <div className="admin-receipt">
          <p>購入者メールアドレス <span>{order.user.email}</span></p>
          <table>
            <caption>注文明細</caption>
            <thead><tr><th scope="col">商品</th><th scope="col">単価</th><th scope="col">数量</th><th scope="col">小計</th></tr></thead>
            <tbody>{order.items.map(item => <tr key={item.id}>
              <th scope="row">{item.name}</th><td>{yen(item.unitPrice)}</td><td>{item.quantity}</td><td>{yen(item.unitPrice * item.quantity)}</td>
            </tr>)}</tbody>
            <tfoot><tr><th scope="row" colSpan={3}>合計</th><td>{yen(order.total)}</td></tr></tfoot>
          </table>
          {order.status === 'PLACED' && <button type="button" disabled={locked} onClick={() => {
            void data.save('/admin/orders/' + encodeURIComponent(order.id), 'PATCH', { status: 'SHIPPED' }, '注文を発送済みに変更しました。');
          }}>発送済みにする</button>}
        </div>
      </details>)}
    </div>
  </section>;
}
