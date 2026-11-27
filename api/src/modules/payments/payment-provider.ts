export type TestCard = { number: string; expiry: string; securityCode: string };

export type PaymentRequest = {
    idempotencyKey: string;
    amount: number;
    card: TestCard;
};

export type PaymentResult =
    | { approved: true; transactionId: string; paidAt: Date }
    | { approved: false; transactionId: string; code: 'PAYMENT_DECLINED' | 'PAYMENT_TEST_CARD_REQUIRED' };

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

/**
 * サーバーで確定した金額を指定の決済手段で処理する
 */
export interface PaymentProvider {
    /**
     * 同じ再送キーで重複請求を起こさずに決済結果を返す
     */
    charge(request: PaymentRequest): Promise<PaymentResult>;
}
