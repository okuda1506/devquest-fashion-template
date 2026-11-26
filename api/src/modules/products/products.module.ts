import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProductsController } from './controllers/products.controller';
import { AdminProductsController } from './controllers/admin-products.controller';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

/** 商品カタログと管理者向け商品管理を構成する */
@Module({
    imports: [AuthModule],
    controllers: [ProductsController, AdminProductsController],
    providers: [ProductsRepository, ProductsService]
})
export class ProductsModule {}
