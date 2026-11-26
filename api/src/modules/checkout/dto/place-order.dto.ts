import { ApiProperty } from '@nestjs/swagger';
import { IsHash, IsUUID } from 'class-validator';
import { PreviewOrderDto } from './preview-order.dto';

/**
 * 確認時の配送先・注文識別子・見積もりバージョンを受け取る
 */
export class PlaceOrderDto extends PreviewOrderDto {
    @ApiProperty() @IsUUID('4') checkoutId!: string;
    @ApiProperty() @IsHash('sha256') version!: string;
}
