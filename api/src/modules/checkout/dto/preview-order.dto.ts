import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsObject, ValidateNested } from 'class-validator';
import { ShippingAddressDto } from './shipping-address.dto';

/** 注文内容の確認に必要な配送先を受け取る */
export class PreviewOrderDto {
    @ApiProperty({ type: ShippingAddressDto })
    @IsDefined()
    @IsObject()
    @ValidateNested()
    @Type(() => ShippingAddressDto)
    shippingAddress!: ShippingAddressDto;
}
