import { type ShippingAddress } from '@thread/shared';

/** 注文の配送先を確認できる形式で表示する */
export function DeliveryDetails({ address }: { address: ShippingAddress }) {
    return (
        <dl className="checkout-delivery">
            <div>
                <dt>お届け先</dt>
                <dd>{address.name} 様</dd>
            </div>
            <div>
                <dt>住所</dt>
                <dd>
                    〒{address.postalCode}
                    <br />
                    {address.prefecture}
                    {address.city}
                    {address.line1}
                    {address.line2 && (
                        <>
                            <br />
                            {address.line2}
                        </>
                    )}
                </dd>
            </div>
            <div>
                <dt>電話番号</dt>
                <dd>{address.phone}</dd>
            </div>
            <div>
                <dt>配送方法</dt>
                <dd>宅配便</dd>
            </div>
            <div>
                <dt>お支払い</dt>
                <dd>代金引換（模擬）</dd>
            </div>
        </dl>
    );
}
