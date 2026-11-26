import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { allowedOrigins } from './config/environment';
import { SafeExceptionFilter } from './common/filters/safe-exception.filter';
import { requestIdHeader } from './common/logging/log-events';
import { traceRequest } from './common/logging/request-logger.middleware';
import { httpMessages } from './common/http-messages';

/** API の共通パス・CORS・入力検証・OpenAPI を構成する */
export function configure(app: INestApplication) {
    app.setGlobalPrefix('api');
    app.enableCors({
        origin: [...allowedOrigins('store'), ...allowedOrigins('admin')],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowedHeaders: ['Authorization', 'Content-Type', requestIdHeader],
        exposedHeaders: [requestIdHeader]
    });
    app.use(traceRequest);
    app.useGlobalFilters(new SafeExceptionFilter(app.getHttpAdapter()));
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: true,
            exceptionFactory: () => new BadRequestException(httpMessages.invalidInput)
        })
    );
    const config = new DocumentBuilder()
        .setTitle('THREAD API')
        .setDescription('アパレル EC 演習用 API')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    // 構成刷新前に発行した OpenAPI の操作 ID も引き継ぐ
    const publishedControllerNames: Record<string, string> = {
        CheckoutController: 'OrdersController',
        AdminInventoryController: 'InventoryController',
        AdminReportsController: 'ReportsController'
    };
    SwaggerModule.setup('api/docs', app, () =>
        SwaggerModule.createDocument(app, config, {
            operationIdFactory: (controller, method, version) =>
                `${publishedControllerNames[controller] ?? controller}_${method}${version ? '_' + version : ''}`
        })
    );
}
