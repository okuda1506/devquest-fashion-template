import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

/**
 * ログイン時のメールアドレスとパスワードを検証する
 */
export class LoginDto {
    @ApiProperty() @IsEmail() email!: string;
    @ApiProperty() @IsString() @Length(1, 128) password!: string;
}
