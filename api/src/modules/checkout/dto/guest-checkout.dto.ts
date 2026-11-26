import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEmail, IsHash, IsNotEmpty, IsObject,
    IsString, IsUUID, MaxLength, ValidateNested
} from 'class-validator';
import { QuantityDto } from '../../cart/dto/quantity.dto';
import { PreviewOrderDto } from './preview-order.dto';

/**
 * ブラウザのゲストカートから送る商品 ID と数量を検証する
 */
export class GuestCartLineDto extends QuantityDto {
    @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(128) productId!: string;
}

/**
 * ゲストの配送先・連絡先と重複のないカート明細を受け取る
 */
export class GuestPreviewDto extends PreviewOrderDto {
    @ApiProperty()
    @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
    @IsEmail()
    @MaxLength(254)
    email!: string;

    @ApiProperty({ type: [GuestCartLineDto], maxItems: 100 })
    @IsArray()
    @IsObject({ each: true })
    @ArrayMinSize(1)
    @ArrayMaxSize(100)
    @ArrayUnique((line: GuestCartLineDto | null) => line?.productId)
    @ValidateNested({ each: true })
    @Type(() => GuestCartLineDto)
    items!: GuestCartLineDto[];
}

/**
 * ゲスト注文の確定時に受け取る確認 ID と署名を検証する
 */
export class GuestPlaceDto extends GuestPreviewDto {
    @ApiProperty() @IsUUID('4') checkoutId!: string;
    @ApiProperty() @IsHash('sha256') version!: string;
}
