import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomerAccountController } from './controllers/customer-account.controller';
import { RegistrationController } from './controllers/registration.controller';
import { CustomersRepository } from './customers.repository';
import { CustomersService } from './customers.service';

/**
 * EC の会員登録とマイページ機能を提供する
 */
@Module({
    imports: [AuthModule],
    controllers: [RegistrationController, CustomerAccountController],
    providers: [CustomersRepository, CustomersService]
})
export class CustomersModule {}
