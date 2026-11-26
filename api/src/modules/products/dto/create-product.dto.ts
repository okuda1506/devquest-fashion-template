import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Max, Min, ValidateIf } from 'class-validator';
import { ProductFields } from './product-fields.dto';

/** 商品マスタの登録項目に初期在庫の入力を追加する */
export class CreateProduct extends ProductFields {
    @ApiPropertyOptional({ default: 0 })
    @ValidateIf((_, value) => value !== undefined)
    @IsInt()
    @Min(0)
    @Max(100000)
    stock?: number;
}
