import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { MAX_CART_QUANTITY } from '../cart-limits';

/** カート操作で受け付ける商品数量の範囲を定義する */
export class QuantityDto {
    @ApiProperty() @IsInt() @Min(1) @Max(MAX_CART_QUANTITY) quantity!: number;
}
