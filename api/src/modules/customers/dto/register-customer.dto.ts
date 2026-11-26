import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { CustomerProfileDto } from './customer-profile.dto';

/**
 * 新規会員登録に必要な基本情報とパスワードを検証する
 */
export class RegisterCustomerDto extends CustomerProfileDto {
    @ApiProperty({ minLength: 8, maxLength: 128 }) @IsString() @Length(8, 128) password!: string;
}
