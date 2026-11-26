import { yen } from '@thread/shared';
import type { Line } from './checkout.types';

/** 注文内容の明細と合計金額を表示する */
export function OrderSummary({ items, total }: { items: Line[]; total: number }) {
    return (
        <aside className="checkout-summary" aria-label="注文内容">
            <h2>注文内容</h2>
            <ul>
                {items.map((item) => (
                    <li key={item.productId ?? item.id}>
                        <span>
                            {item.name}
                            <small>
                                {yen(item.unitPrice)} × {item.quantity} 点
                            </small>
                        </span>
                        <strong>{yen(item.unitPrice * item.quantity)}</strong>
                    </li>
                ))}
            </ul>
            <dl>
                <div>
                    <dt>商品小計</dt>
                    <dd>{yen(total)}</dd>
                </div>
                <div>
                    <dt>送料</dt>
                    <dd>無料</dd>
                </div>
                <div className="checkout-total">
                    <dt>お支払い合計</dt>
                    <dd>{yen(total)}</dd>
                </div>
            </dl>
        </aside>
    );
}
