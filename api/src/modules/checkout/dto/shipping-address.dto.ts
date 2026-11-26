import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

/** DTO の入力文字列だけをトリムして数値などは型検証に渡す */
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** 注文時に必要な国内配送先の文字数と形式を定義する */
export class ShippingAddressDto {
    @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
    @ApiProperty() @Transform(trim) @IsString() @Matches(/^\d{3}-?\d{4}$/) postalCode!: string;
    @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(12) prefecture!: string;
    @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) city!: string;
    @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(120) line1!: string;
    @ApiPropertyOptional()
    @ValidateIf((_, value) => value !== undefined)
    @Transform(trim)
    @IsString()
    @MaxLength(120)
    line2?: string;
    @ApiProperty() @Transform(trim) @IsString() @Matches(/^(?:\d-?){9,10}\d$/) phone!: string;
}
