import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RequireRole } from '../../../common/decorators/require-role.decorator';
import { OrdersService } from '../orders.service';
import { StatusDto } from '../dto/update-order-status.dto';

/**
 * 管理者向けに受注一覧とステータス変更を提供する
 */
@ApiTags('管理・注文')
@ApiBearerAuth()
@RequireRole('ADMIN')
@UseGuards(AuthGuard)
@Controller('admin/orders')
export class AdminOrdersController {
    /**
     * 管理用の注文参照と更新を実行するサービスを受け取る
     */
    constructor(private readonly orders: OrdersService) {}
    /**
     * 運営に必要な全顧客の受注を一覧取得する
     */
    @Get() list() {
        return this.orders.adminList();
    }
    /**
     * 指定した注文の発送ステータスを更新する
     */
    @Patch(':id') update(@Param('id') id: string, @Body() dto: StatusDto) {
        return this.orders.update(id, dto.status);
    }
}
