import { BadRequestException, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AuthModule } from './auth/auth';
import { allowedOrigins } from './auth/origins';
import { CartModule } from './cart/cart';
import { DbModule } from './db';
import { InventoryModule } from './inventory/inventory';
import { OrdersModule } from './orders/orders';
import { ProductsModule } from './products/products';

/** EC と店舗管理が使用する各機能モジュールを束ねる */
@Module({ imports: [DbModule, AuthModule, ProductsModule, InventoryModule, CartModule, OrdersModule] })
export class AppModule {}

/** API の共通パス・CORS・入力検証・OpenAPI を構成する */
export function configure(app: INestApplication) {
    app.setGlobalPrefix('api');
    app.enableCors({
        origin: [...allowedOrigins('store'), ...allowedOrigins('admin')],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowedHeaders: ['Authorization', 'Content-Type']
    });
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
            exceptionFactory: () => new BadRequestException('入力内容が正しくありません。')
        })
    );
    const config = new DocumentBuilder()
        .setTitle('THREAD API')
        .setDescription('アパレル EC 演習用 API')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, config));
}
