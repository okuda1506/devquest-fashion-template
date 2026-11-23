import { randomBytes } from 'node:crypto';
import { Body, CanActivate, Controller, createParamDecorator, ExecutionContext, ForbiddenException, Get, Headers, Injectable, Module, Post, SetMetadata, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';
import { Db } from '../db';
import type { Role } from '../generated/prisma/client';
import { allowedOrigins, type Surface } from './origins';
import { hashPassword, verifyPassword } from './password';

const roles = { store: 'CUSTOMER', admin: 'ADMIN' } satisfies Record<Surface, Role>;
const audiences = { CUSTOMER: 'thread-store', ADMIN: 'thread-admin' } satisfies Record<Role, string>;
const issuer = 'thread-api';
const loginDenied = 'メールアドレスまたはパスワードが正しくありません。';

type Viewer = { id: string; role: Role };
type AuthRequest = { headers: { authorization?: string; origin?: string }; viewer: Viewer };
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthRequest>().viewer);
export const RequireRole = (role: Role) => SetMetadata('requiredRole', role);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly reflector: Reflector, private readonly db: Db) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1];
    if (!token) throw new UnauthorizedException('ログインしてください。');
    const payload = await this.jwt.verifyAsync<{ sub: string; aud: string; exp: number }>(token, {
      issuer, algorithms: ['HS256'],
    }).catch(() => null);
    if (typeof payload?.sub !== 'string' || typeof payload.exp !== 'number') {
      throw new UnauthorizedException('再度ログインしてください。');
    }
    const viewer = await this.db.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true } });
    if (!viewer || payload.aud !== audiences[viewer.role]) throw new UnauthorizedException('再度ログインしてください。');
    const required = this.reflector.getAllAndOverride<Role>('requiredRole', [context.getHandler(), context.getClass()]);
    if (viewer.role !== required) throw new ForbiddenException('この操作を利用する権限がありません。');
    const origin = request.headers.origin;
    if (origin !== undefined && !allowedOrigins(viewer.role === 'ADMIN' ? 'admin' : 'store').includes(origin)) {
      throw new ForbiddenException('この操作を利用する権限がありません。');
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
  private readonly dummyHash = hashPassword(randomBytes(24).toString('hex'));

  constructor(private readonly db: Db, private readonly jwt: JwtService) {}

  async login(input: LoginDto, surface: Surface, origin?: string) {
    if (origin !== undefined && !allowedOrigins(surface).includes(origin)) throw new UnauthorizedException(loginDenied);
    const user = await this.db.user.findUnique({ where: { email: input.email.toLowerCase() } });
    // 存在しないメールアドレスでもパスワード照合を行い、エラーは共通にする。
    const valid = verifyPassword(input.password, user?.passwordHash ?? this.dummyHash);
    if (!valid || user?.role !== roles[surface]) throw new UnauthorizedException(loginDenied);
    const exp = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
    const token = await this.jwt.signAsync({ sub: user.id, exp }, { issuer, audience: audiences[user.role], algorithm: 'HS256' });
    return { token, name: user.name, role: user.role, expiresAt: exp * 1000 };
  }
}

@ApiTags('認証')
@Controller('auth')
class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('store/login') storeLogin(@Body() dto: LoginDto, @Headers('origin') origin?: string) {
    return this.auth.login(dto, 'store', origin);
  }

  @Post('admin/login') adminLogin(@Body() dto: LoginDto, @Headers('origin') origin?: string) {
    return this.auth.login(dto, 'admin', origin);
  }

  @Get('store/session') @ApiBearerAuth() @UseGuards(AuthGuard) @RequireRole('CUSTOMER')
  storeSession() { return { authenticated: true }; }

  @Get('admin/session') @ApiBearerAuth() @UseGuards(AuthGuard) @RequireRole('ADMIN')
  adminSession() { return { authenticated: true }; }
}

@Module({
  imports: [JwtModule.registerAsync({ useFactory: () => {
    const secret = process.env.THREAD_JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error('THREAD_JWT_SECRET に32文字以上を指定してください。');
    return { secret };
  } })],
  controllers: [AuthController], providers: [AuthGuard, AuthService], exports: [AuthGuard, JwtModule],
})
export class AuthModule {}
