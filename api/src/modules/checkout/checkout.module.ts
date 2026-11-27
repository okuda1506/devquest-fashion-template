import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersModule } from '../orders/orders.module';
import { CheckoutController } from './controllers/checkout.controller';
import { GuestCheckoutController } from './controllers/guest-checkout.controller';
import { CheckoutService } from './checkout.service';
import { CheckoutRepository } from './checkout.repository';

/**
 * 購入確認と確定に必要な依存を登録する
 */
@Module({
    imports: [AuthModule, OrdersModule, PaymentsModule],
    controllers: [CheckoutController, GuestCheckoutController],
    providers: [CheckoutService, CheckoutRepository]
})
export class CheckoutModule {}
