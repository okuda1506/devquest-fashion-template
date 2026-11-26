import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';
import { categories } from '../product-categories';

/**
 * 商品登録と更新に共通する項目の入力条件を定義する
 */
export class ProductFields {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    name!: string;

    @ApiProperty() @IsString() @MaxLength(2000) description!: string;
    @ApiProperty({ enum: categories }) @IsIn(categories) category!: string;
    @ApiProperty() @IsInt() @Min(0) @Max(1000000) price!: number;
    @ApiProperty() @IsBoolean() isPublished!: boolean;
}
