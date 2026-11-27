import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsHash, IsObject, IsUUID, ValidateIf, ValidateNested } from 'class-validator';
import { CheckoutPaymentDto } from '../../payments/dto/checkout-payment.dto';
import { PreviewOrderDto } from './preview-order.dto';

/**
 * 確認時の配送先・注文識別子・見積もりバージョンを受け取る
 */
export class PlaceOrderDto extends PreviewOrderDto {
    @ApiProperty() @IsUUID('4') checkoutId!: string;
    @ApiProperty() @IsHash('sha256') version!: string;

    @ApiPropertyOptional({ type: CheckoutPaymentDto })
    @ValidateIf((_, value) => value !== undefined)
    @IsObject()
    @ValidateNested()
    @Type(() => CheckoutPaymentDto)
    payment?: CheckoutPaymentDto;
}
