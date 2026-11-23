import { randomBytes } from 'node:crypto';
import {
    Body,
    CanActivate,
    Controller,
    createParamDecorator,
    ExecutionContext,
    ForbiddenException,
    Get,
    Headers,
    Injectable,
    Module,
    Post,
    SetMetadata,
    UnauthorizedException,
    UseGuards
} from '@nestjs/common';
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
const sessionLifetimeSeconds = 60 * 60;
const loginDenied = 'メールアドレスまたはパスワードが正しくありません。';

type Viewer = { id: string; role: Role };
type AuthRequest = { headers: { authorization?: string; origin?: string }; viewer: Viewer };
/** 認証ガードがリクエストに付与した利用者をハンドラーへ渡す */
export const CurrentUser = createParamDecorator(
    (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthRequest>().viewer
);
/** コントローラーまたはハンドラーに必要なロールを指定する */
export const RequireRole = (role: Role) => SetMetadata('requiredRole', role);

/** 署名・有効期限・利用先・権限に基づいて API のアクセスを制御する */
@Injectable()
export class AuthGuard implements CanActivate {
    /** JWT・アクセス権限メタデータ・利用者照合に必要な依存を受け取る */
    constructor(
        private readonly jwt: JwtService,
        private readonly reflector: Reflector,
        private readonly db: Db
    ) {}

    /** JWT と現在のユーザー権限を照合して認証済みユーザーをリクエストに設定する */
    async canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest<AuthRequest>();
        const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1];
        if (!token) throw new UnauthorizedException('ログインしてください。');
        const payload = await this.jwt
            .verifyAsync<{ sub: string; aud: string; exp: number }>(token, {
                issuer,
                algorithms: ['HS256'],
                maxAge: sessionLifetimeSeconds
            })
            .catch(() => null);
        if (typeof payload?.sub !== 'string' || typeof payload.exp !== 'number') {
            throw new UnauthorizedException('再度ログインしてください。');
        }
        const viewer = await this.db.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true } });
        if (!viewer || payload.aud !== audiences[viewer.role])
            throw new UnauthorizedException('再度ログインしてください。');
        const required = this.reflector.getAllAndOverride<Role>('requiredRole', [
            context.getHandler(),
            context.getClass()
        ]);
        if (viewer.role !== required) throw new ForbiddenException('この操作を利用する権限がありません。');
        const origin = request.headers.origin;
        if (origin !== undefined && !allowedOrigins(viewer.role === 'ADMIN' ? 'admin' : 'store').includes(origin)) {
            throw new ForbiddenException('この操作を利用する権限がありません。');
        }
        request.viewer = viewer;
        return true;
    }
}

/** ログイン時のメールアドレスとパスワードを検証する */
class LoginDto {
    @ApiProperty() @IsEmail() email!: string;
    @ApiProperty() @IsString() @Length(1, 128) password!: string;
}

/** 画面の用途に合うアカウントを認証してセッションを発行する */
@Injectable()
export class AuthService {
    private readonly dummyHash = hashPassword(randomBytes(24).toString('hex'));

    /** アカウント検索と JWT 発行に必要な依存を受け取る */
    constructor(
        private readonly db: Db,
        private readonly jwt: JwtService
    ) {}

    /** 認証に成功した利用者に有効期限1時間の JWT を発行する */
    async login(input: LoginDto, surface: Surface, origin?: string) {
        if (origin !== undefined && !allowedOrigins(surface).includes(origin))
            throw new UnauthorizedException(loginDenied);
        const user = await this.db.user.findUnique({ where: { email: input.email.toLowerCase() } });
        // メールアドレスの登録有無による応答の差を抑えるため未登録でもハッシュを照合する
        const valid = verifyPassword(input.password, user?.passwordHash ?? this.dummyHash);
        if (!valid || user?.role !== roles[surface]) throw new UnauthorizedException(loginDenied);
        const exp = Math.floor(Date.now() / 1000) + sessionLifetimeSeconds;
        const token = await this.jwt.signAsync(
            { sub: user.id, exp },
            { issuer, audience: audiences[user.role], algorithm: 'HS256' }
        );
        return { token, name: user.name, role: user.role, expiresAt: exp * 1000 };
    }
}

/** EC と管理画面それぞれの認証エンドポイントを提供する */
@ApiTags('認証')
@Controller('auth')
class AuthController {
    /** 画面用途別の認証を担当するサービスを受け取る */
    constructor(private readonly auth: AuthService) {}

    /** 顧客アカウントで EC にログインする */
    @Post('store/login') storeLogin(@Body() dto: LoginDto, @Headers('origin') origin?: string) {
        return this.auth.login(dto, 'store', origin);
    }

    /** 運営アカウントで店舗管理画面にログインする */
    @Post('admin/login') adminLogin(@Body() dto: LoginDto, @Headers('origin') origin?: string) {
        return this.auth.login(dto, 'admin', origin);
    }

    /** EC 用のセッションが有効か確認する */
    @Get('store/session')
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @RequireRole('CUSTOMER')
    storeSession() {
        return { authenticated: true };
    }

    /** 店舗管理用のセッションが有効か確認する */
    @Get('admin/session')
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @RequireRole('ADMIN')
    adminSession() {
        return { authenticated: true };
    }
}

/** JWT の署名設定と認証ガードを提供する */
@Module({
    imports: [
        JwtModule.registerAsync({
            useFactory: () => {
                const secret = process.env.THREAD_JWT_SECRET;
                if (!secret || secret.length < 32) {
                    throw new Error(
                        'リポジトリ直下の .env または環境変数の THREAD_JWT_SECRET に32文字以上の値を設定し、API を再起動してください。'
                    );
                }
                return { secret };
            }
        })
    ],
    controllers: [AuthController],
    providers: [AuthGuard, AuthService],
    exports: [AuthGuard, JwtModule]
})
export class AuthModule {}
