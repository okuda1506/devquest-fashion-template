import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseIntPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireRole } from '../../../common/decorators/require-role.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { ShippingAddressDto } from '../../checkout/dto/shipping-address.dto';
import { CustomersService } from '../customers.service';
import { UpdateCustomerDto } from '../dto/update-customer.dto';

/**
 * ログイン中の顧客自身の会員情報とアドレス帳を提供する
 */
@ApiTags('会員')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@RequireRole('CUSTOMER')
@Controller('customers/me')
export class CustomerAccountController {
    /**
     * 本人の会員情報を扱うサービスを受け取る
     */
    constructor(private readonly customers: CustomersService) {}

    /**
     * 本人の会員情報を表示する
     */
    @Get()
    @Header('Cache-Control', 'no-store')
    profile(@CurrentUser() customer: { id: number }) {
        return this.customers.profile(customer.id);
    }

    /**
     * 本人の氏名・連絡先を更新する
     */
    @Patch()
    @Header('Cache-Control', 'no-store')
    updateProfile(@CurrentUser() customer: { id: number }, @Body() dto: UpdateCustomerDto) {
        return this.customers.updateProfile(customer.id, dto);
    }

    /**
     * 本人のアドレス帳を表示する
     */
    @Get('addresses')
    @Header('Cache-Control', 'no-store')
    addresses(@CurrentUser() customer: { id: number }) {
        return this.customers.addresses(customer.id);
    }

    /**
     * 本人のアドレス帳に配送先を登録する
     */
    @Post('addresses')
    @Header('Cache-Control', 'no-store')
    addAddress(@CurrentUser() customer: { id: number }, @Body() dto: ShippingAddressDto) {
        return this.customers.addAddress(customer.id, dto);
    }

    /**
     * 本人が登録した配送先を変更する
     */
    @Put('addresses/:id')
    @Header('Cache-Control', 'no-store')
    updateAddress(@CurrentUser() customer: { id: number }, @Param('id', ParseIntPipe) id: number, @Body() dto: ShippingAddressDto) {
        return this.customers.updateAddress(customer.id, id, dto);
    }

    /**
     * 本人が登録した配送先を削除する
     */
    @Delete('addresses/:id')
    @HttpCode(204)
    deleteAddress(@CurrentUser() customer: { id: number }, @Param('id', ParseIntPipe) id: number) {
        return this.customers.deleteAddress(customer.id, id);
    }
}
