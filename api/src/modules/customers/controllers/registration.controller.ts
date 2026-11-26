import { Body, Controller, ForbiddenException, Header, Headers, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { allowedOrigins } from '../../../config/environment';
import { authMessages } from '../../auth/auth-messages';
import { CustomersService } from '../customers.service';
import { RegisterCustomerDto } from '../dto/register-customer.dto';

/**
 * EC の会員登録エンドポイントを提供する
 */
@ApiTags('会員')
@Controller('customers')
export class RegistrationController {
    /**
     * 会員登録サービスを受け取る
     */
    constructor(private readonly customers: CustomersService) {}

    /**
     * EC 用の顧客アカウントを作成する
     */
    @Post('register')
    @Header('Cache-Control', 'no-store')
    register(@Body() dto: RegisterCustomerDto, @Headers('origin') origin?: string) {
        if (origin !== undefined && !allowedOrigins('store').includes(origin)) {
            throw new ForbiddenException(authMessages.forbidden);
        }
        return this.customers.register(dto);
    }
}
