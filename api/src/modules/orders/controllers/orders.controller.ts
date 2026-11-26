import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RequireRole } from '../../../common/decorators/require-role.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { OrdersService } from '../orders.service';

/** 顧客自身の注文履歴と詳細の参照を提供する */
@ApiTags('注文')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@RequireRole('CUSTOMER')
@Controller('orders')
export class OrdersController {
    /** 顧客の注文を参照するサービスを受け取る */
    constructor(private readonly orders: OrdersService) {}
    /** ログイン中の顧客が行った注文を一覧表示する */
    @Get() list(@CurrentUser() user: { id: string }) {
        return this.orders.list(user.id);
    }
    /** ログイン中の顧客が行った指定注文を取得する */
    @Get(':id') detail(@CurrentUser() user: { id: string }, @Param('id') id: string) {
        return this.orders.detail(user.id, id);
    }
}
