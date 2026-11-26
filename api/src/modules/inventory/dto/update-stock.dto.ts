import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Max, Min, ValidateIf } from 'class-validator';

/**
 * 新しい在庫数と競合検出に用いる編集前の在庫数を受け取る
 */
export class UpdateStock {
    @ApiProperty() @IsInt() @Min(0) @Max(100000) stock!: number;
    @ApiPropertyOptional() @ValidateIf((_, value) => value !== undefined) @IsInt() @Min(0) expectedStock?: number;
}
