import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RequireRole } from '../../../common/decorators/require-role.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { CheckoutService } from '../checkout.service';
import { PlaceOrderDto } from '../dto/place-order.dto';
import { PreviewOrderDto } from '../dto/preview-order.dto';

/**
 * 顧客の注文内容の確認と確定を受け付ける
 */
@ApiTags('注文')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@RequireRole('CUSTOMER')
@Controller('orders')
export class CheckoutController {
    /**
     * 見積もりと注文確定を担当するサービスを受け取る
     */
    constructor(private readonly checkout: CheckoutService) {}

    /**
     * 入力された配送先とカートで注文内容を確認する
     */
    @Post('preview') preview(@CurrentUser() user: { id: number }, @Body() input: PreviewOrderDto) {
        return this.checkout.preview(user.id, input);
    }

    /**
     * 確認時の識別子とバージョンを使って注文を確定する
     */
    @Post() place(@CurrentUser() user: { id: number }, @Body() input: PlaceOrderDto) {
        return this.checkout.place(user.id, input);
    }
}
