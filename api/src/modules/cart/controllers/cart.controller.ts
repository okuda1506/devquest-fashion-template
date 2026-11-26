import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RequireRole } from '../../../common/decorators/require-role.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CartService } from '../cart.service';
import { QuantityDto } from '../dto/quantity.dto';

/** ログイン済みの顧客向けにカート操作を公開する */
@ApiTags('カート')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@RequireRole('CUSTOMER')
@Controller('cart')
export class CartController {
    /** 顧客のカート操作を実行するサービスを受け取る */
    constructor(private readonly cart: CartService) {}
    /** ログイン中の顧客のカートを返す */
    @Get() list(@CurrentUser() user: { id: string }) {
        return this.cart.list(user.id);
    }
    /** 商品を指定した数量だけカートに追加する */
    @Post(':id') add(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: QuantityDto) {
        return this.cart.add(user.id, id, dto.quantity);
    }
    /** 商品明細の数量を指定値に置き換える */
    @Put(':id') put(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: QuantityDto) {
        return this.cart.put(user.id, id, dto.quantity);
    }
    /** 商品を顧客のカートから取り除く */
    @Delete(':id') remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
        return this.cart.remove(user.id, id);
    }
}
