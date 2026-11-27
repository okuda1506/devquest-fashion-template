import { Injectable } from '@nestjs/common';
import { setTimeout } from 'node:timers/promises';
import { mockCards } from './mock-cards';
import type { PaymentProvider, PaymentRequest, PaymentResult } from './payment-provider';

/**
 * 外部通信なしでテストカードの承認と否認を再現する
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
    /**
     * 確認 ID を元に同じ再送キーでは同じ模擬取引 ID を返す
     */
    async charge({ idempotencyKey, amount, card }: PaymentRequest): Promise<PaymentResult> {
        const transactionId = 'mock_' + idempotencyKey;
        await setTimeout(320);
        if (!Number.isSafeInteger(amount) || amount < 0) throw new RangeError('Invalid payment amount');
        if (card.expiry !== mockCards.expiry || card.securityCode !== mockCards.securityCode) {
            return { approved: false, transactionId, code: 'PAYMENT_TEST_CARD_REQUIRED' };
        }
        if (card.number === mockCards.approved) {
            return { approved: true, transactionId, paidAt: new Date() };
        }
        const code = card.number === mockCards.declined ? 'PAYMENT_DECLINED' : 'PAYMENT_TEST_CARD_REQUIRED';
        return { approved: false, transactionId, code };
    }
}
