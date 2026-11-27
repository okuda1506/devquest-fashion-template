import { BadRequestException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { logEvents } from '../../common/logging/log-events';
import { logEvent } from '../../common/logging/logger';
import type { CheckoutPaymentDto } from './dto/checkout-payment.dto';
import { paymentMessages } from './payment-messages';
import { PAYMENT_PROVIDER, type PaymentProvider, type PaymentResult } from './payment-provider';

/**
 * 注文から受け取った決済要求を指定のプロバイダーへ渡す
 */
@Injectable()
export class PaymentService {
    /**
     * 決済を処理するプロバイダーを受け取る
     */
    constructor(@Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider) {}

    /**
     * テストカードで模擬決済を試み 承認されたときだけ保存用の情報を返す
     */
    async authorize(orderId: string, amount: number, payment?: CheckoutPaymentDto) {
        if (!payment || payment.method === 'CASH_ON_DELIVERY') {
            if (payment?.card) throw new BadRequestException(paymentMessages.cardNotAllowed);
            return;
        }
        if (!payment.card) throw new BadRequestException(paymentMessages.PAYMENT_TEST_CARD_REQUIRED);

        logEvent('info', logEvents.paymentStarted, { orderId });
        let result: PaymentResult;
        try {
            result = await this.provider.charge({ idempotencyKey: orderId, amount, card: payment.card });
        } catch {
            const errorCode = 'PAYMENT_UNAVAILABLE';
            logEvent('error', logEvents.paymentFailed, { orderId, errorCode });
            throw new HttpException({ message: paymentMessages[errorCode], code: errorCode }, HttpStatus.SERVICE_UNAVAILABLE);
        }
        if (!result.approved) {
            logEvent('warn', logEvents.paymentFailed, { orderId, transactionId: result.transactionId, errorCode: result.code });
            throw new HttpException({ message: paymentMessages[result.code], code: result.code }, HttpStatus.PAYMENT_REQUIRED);
        }

        return {
            paymentMethod: 'CREDIT_CARD',
            paymentStatus: 'PAID',
            paymentPaidAt: result.paidAt,
            paymentTransactionId: result.transactionId
        } as const;
    }

    /**
     * 注文と決済結果の保存が確定した後に成功ログを出す
     */
    recordSuccess(orderId: string, transactionId: string) {
        logEvent('info', logEvents.paymentSucceeded, { orderId, transactionId });
    }

    /**
     * 模擬承認後に注文がロールバックされた場合を記録する
     */
    recordRollback(orderId: string, transactionId: string) {
        logEvent('error', logEvents.paymentFailed, { orderId, transactionId, errorCode: 'PAYMENT_NOT_COMMITTED' });
    }
}
