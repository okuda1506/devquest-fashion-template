import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const optionalText = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);

/**
 * 会員登録とマイページで編集する基本情報を検証する
 */
export class CustomerProfileDto {
    @ApiProperty() @Transform(trim) @IsEmail() @MaxLength(254) email!: string;
    @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(50) lastName!: string;
    @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(50) firstName!: string;
    @ApiPropertyOptional() @Transform(optionalText) @IsOptional() @IsString() @MaxLength(80) lastNameKana?: string | null;
    @ApiPropertyOptional() @Transform(optionalText) @IsOptional() @IsString() @MaxLength(80) firstNameKana?: string | null;
    @ApiPropertyOptional() @Transform(optionalText) @IsOptional() @IsString() @Matches(/^(?:\d-?){9,10}\d$/)
    phone?: string | null;
}
