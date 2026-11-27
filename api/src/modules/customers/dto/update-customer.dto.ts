import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CustomerProfileDto } from './customer-profile.dto';

/**
 * 会員情報の更新内容とログイン用メール変更時の確認情報を検証する
 */
export class UpdateCustomerDto extends OmitType(CustomerProfileDto, ['firstName'] as const) {
    @ApiPropertyOptional({ nullable: true })
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() || null : value))
    @IsOptional()
    @IsString()
    @MaxLength(50)
    firstName?: string | null;

    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(128) currentPassword?: string;
}
