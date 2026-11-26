import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CartModule } from './modules/cart/cart.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ReportsModule } from './modules/reports/reports.module';

/**
 * EC と店舗管理が使用する各機能モジュールを束ねる
 */
@Module({
    imports: [
        DatabaseModule,
        AuthModule,
        ProductsModule,
        InventoryModule,
        CartModule,
        CheckoutModule,
        OrdersModule,
        ReportsModule
    ]
})
export class AppModule {}
