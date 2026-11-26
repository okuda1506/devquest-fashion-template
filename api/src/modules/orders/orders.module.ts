import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersController } from './controllers/orders.controller';
import { AdminOrdersController } from './controllers/admin-orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

/** 店舗管理と EC の注文機能を同じ業務サービスに接続する */
@Module({
    imports: [AuthModule],
    controllers: [OrdersController, AdminOrdersController],
    providers: [OrdersRepository, OrdersService],
    exports: [OrdersRepository]
})
export class OrdersModule {}
