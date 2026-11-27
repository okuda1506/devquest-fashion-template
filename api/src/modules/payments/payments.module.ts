import { Module } from '@nestjs/common';
import { MockPaymentProvider } from './mock-payment.provider';
import { PAYMENT_PROVIDER } from './payment-provider';
import { PaymentService } from './payment.service';

/**
 * 注文機能に模擬決済サービスを提供する
 */
@Module({
    providers: [PaymentService, { provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider }],
    exports: [PaymentService]
})
export class PaymentsModule {}
