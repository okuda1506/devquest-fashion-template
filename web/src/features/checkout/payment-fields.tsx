import { paymentMethodLabels, type PaymentMethod } from '@thread/shared';

export const testCards = { approved: '4242424242424242', declined: '4000000000000002' };
export type TestCardChoice = keyof typeof testCards;

export const cardExpiry = '12/39';
export const cardSecurityCode = '123';

type PaymentFieldsProps = {
    method: PaymentMethod;
    onMethodChange: (method: PaymentMethod) => void;
    testCard: TestCardChoice;
    onTestCardChange: (choice: TestCardChoice) => void;
    disabled: boolean;
};

/**
 * 注文確認で決済方法と模擬カードを選択できるようにする
 */
export function PaymentFields({ method, onMethodChange, testCard, onTestCardChange, disabled }: PaymentFieldsProps) {
    return (
        <fieldset className="checkout-payment" disabled={disabled}>
            <legend>お支払い方法</legend>
            <div className="checkout-payment-options">
                <label>
                    <input
                        type="radio"
                        name="paymentMethod"
                        value="CASH_ON_DELIVERY"
                        checked={method === 'CASH_ON_DELIVERY'}
                        onChange={() => onMethodChange('CASH_ON_DELIVERY')}
                    />
                    {paymentMethodLabels.CASH_ON_DELIVERY}
                </label>
                <label>
                    <input
                        type="radio"
                        name="paymentMethod"
                        value="CREDIT_CARD"
                        checked={method === 'CREDIT_CARD'}
                        onChange={() => onMethodChange('CREDIT_CARD')}
                    />
                    {paymentMethodLabels.CREDIT_CARD}
                </label>
            </div>
            {method === 'CREDIT_CARD' && (
                <div className="checkout-test-card">
                    <p>テスト専用の模擬決済です。実際のカード情報は入力できません。</p>
                    <label>
                        テストカード
                        <select value={testCard} onChange={(event) => onTestCardChange(event.target.value as TestCardChoice)}>
                            <option value="approved">成功用カード</option>
                            <option value="declined">失敗用カード</option>
                        </select>
                    </label>
                    <label>
                        カード番号
                        <input value={testCards[testCard]} readOnly autoComplete="off" />
                    </label>
                    <div className="checkout-fields">
                        <label>
                            有効期限
                            <input value={cardExpiry} readOnly autoComplete="off" />
                        </label>
                        <label>
                            セキュリティコード
                            <input value={cardSecurityCode} readOnly autoComplete="off" />
                        </label>
                    </div>
                </div>
            )}
        </fieldset>
    );
}
