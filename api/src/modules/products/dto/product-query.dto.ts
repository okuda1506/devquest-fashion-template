import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { categories } from '../product-categories';

/**
 * 商品検索のカテゴリ・検索語・ページ範囲を定義する
 */
export class ProductQuery {
    @ApiPropertyOptional({ enum: categories }) @IsOptional() @IsIn(categories) category?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) q?: string;
    @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page = 1;
    @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
