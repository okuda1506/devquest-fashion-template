import {
    Body, Controller, ForbiddenException, Get, Header, Headers, Param, ParseUUIDPipe, Post, UnauthorizedException
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { allowedOrigins } from '../../../config/environment';
import { authMessages } from '../../auth/auth-messages';
import { CheckoutService } from '../checkout.service';
import { checkoutMessages } from '../checkout-errors';
import { GuestPlaceDto, GuestPreviewDto } from '../dto/guest-checkout.dto';
import { guestAccessHash } from '../guest-checkout-proof';

/**
 * ゲスト注文のプレビュー・確定・確定後の照会を提供する
 */
@ApiTags('ゲスト注文')
@Controller('guest-orders')
export class GuestCheckoutController {
    /**
     * ゲストと会員の注文確定を扱うサービスを受け取る
     */
    constructor(private readonly checkout: CheckoutService) {}

    /**
     * ゲストカートの見積もりを作成する
     */
    @Post('preview')
    @Header('Cache-Control', 'no-store')
    preview(@Headers() headers: GuestHeaders, @Body() input: GuestPreviewDto) {
        return this.checkout.guestPreview(this.authorize(headers), input);
    }

    /**
     * 認証したブラウザからのゲスト注文を確定する
     */
    @Post()
    @Header('Cache-Control', 'no-store')
    place(@Headers() headers: GuestHeaders, @Body() input: GuestPlaceDto) {
        return this.checkout.guestPlace(this.authorize(headers), input);
    }

    /**
     * 同じ参照キーで確定した注文のみを照会する
     */
    @Get(':id')
    @Header('Cache-Control', 'no-store')
    detail(@Headers() headers: GuestHeaders, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
        return this.checkout.guestDetail(this.authorize(headers), id);
    }

    /**
     * EC の呼び出し元とゲストの参照キーを確認する
     */
    private authorize({ origin, authorization }: GuestHeaders) {
        if (origin !== undefined && !allowedOrigins('store').includes(origin)) {
            throw new ForbiddenException(authMessages.forbidden);
        }
        const accessHash = guestAccessHash(authorization);
        if (!accessHash) throw new UnauthorizedException(checkoutMessages.guestAccessRequired);
        return accessHash;
    }
}

type GuestHeaders = { origin?: string; authorization?: string };
