import { Body, CanActivate, Controller, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, Module, Post, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';
import { Db } from '../db';
import { verifyPassword } from './password';

type Viewer = { id: string; role: 'CUSTOMER' | 'ADMIN' };
type AuthRequest = { headers: { authorization?: string }; viewer: Viewer };
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthRequest>().viewer);
export const AdminOnly = () => SetMetadata('admin', true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly reflector: Reflector, private readonly db: Db) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1];
    if (!token) throw new UnauthorizedException('ログインしてください。');
    const payload = await this.jwt.verifyAsync<{ sub: string }>(token).catch(() => null);
    if (!payload?.sub) throw new UnauthorizedException('再度ログインしてください。');
    const viewer = await this.db.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true } });
    if (!viewer) throw new UnauthorizedException('ユーザーが見つかりません。');
    if (this.reflector.getAllAndOverride<boolean>('admin', [context.getHandler(), context.getClass()]) && viewer.role !== 'ADMIN') {
      throw new ForbiddenException('管理者権限が必要です。');
    }
    request.viewer = viewer;
    return true;
  }
}

class LoginDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @Length(1, 128) password!: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly db: Db, private readonly jwt: JwtService) {}

  async login(input: LoginDto) {
    const user = await this.db.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedException('メールアドレスまたはパスワードが正しくありません。');
    }
    return { token: await this.jwt.signAsync({ sub: user.id }), name: user.name, role: user.role };
  }
}

@ApiTags('認証')
@Controller('auth')
class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto); }
}

@Module({
  imports: [JwtModule.registerAsync({ useFactory: () => {
    const secret = process.env.THREAD_JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error('THREAD_JWT_SECRET に32文字以上を指定してください。');
    return { secret, signOptions: { expiresIn: '8h' } };
  } })],
  controllers: [AuthController], providers: [AuthGuard, AuthService], exports: [AuthGuard, JwtModule],
})
export class AuthModule {}
