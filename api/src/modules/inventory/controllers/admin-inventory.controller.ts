import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RequireRole } from '../../../common/decorators/require-role.decorator';
import { InventoryService } from '../inventory.service';
import { UpdateStock } from '../dto/update-stock.dto';

/**
 * 管理者が在庫数を更新するための API を提供する
 */
@ApiTags('管理・在庫')
@ApiBearerAuth()
@RequireRole('ADMIN')
@UseGuards(AuthGuard)
@Controller('admin/inventory')
export class AdminInventoryController {
    /**
     * 在庫更新を実行するサービスを受け取る
     */
    constructor(private readonly inventory: InventoryService) {}

    /**
     * 商品 ID と入力値を使って在庫数の更新を依頼する
     */
    @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateStock) {
        return this.inventory.update(id, dto);
    }
}
