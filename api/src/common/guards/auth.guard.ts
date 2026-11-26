import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthRepository } from '../../modules/auth/auth.repository';
import type { Role } from '../../generated/prisma/client';
import { allowedOrigins } from '../../config/environment';
import type { AuthRequest } from '../../modules/auth/auth.types';
import { audiences, issuer, sessionLifetimeSeconds } from '../../modules/auth/auth.config';
import { authMessages } from '../../modules/auth/auth-messages';

/**
 * 署名・有効期限・利用先・権限に基づいて API のアクセスを制御する
 */
@Injectable()
export class AuthGuard implements CanActivate {
    /**
     * JWT・アクセス権限メタデータ・利用者照合に必要な依存を受け取る
     */
    constructor(
        private readonly jwt: JwtService,
        private readonly reflector: Reflector,
        private readonly accounts: AuthRepository
    ) {}

    /**
     * JWT と DB 上の現在の権限を照合して認証済み利用者を設定する
     *
     * @param context HTTP リクエストと権限定義を参照する実行コンテキスト
     * @returns 認証済み利用者を設定できた場合に true
     * @throws UnauthorizedException トークンが無効か DB 上の利用者と一致しない場合
     * @throws ForbiddenException ロールまたは呼び出し元のオリジンが許可されていない場合
     */
    async canActivate(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest<AuthRequest>();
        const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? '')?.[1];
        if (!token) throw new UnauthorizedException(authMessages.loginRequired);
        const payload = await this.jwt
            .verifyAsync<{ sub: string; aud: string; exp: number }>(token, {
                issuer,
                algorithms: ['HS256'],
                maxAge: sessionLifetimeSeconds
            })
            .catch(() => null);
        if (typeof payload?.sub !== 'string' || typeof payload.exp !== 'number') {
            throw new UnauthorizedException(authMessages.sessionExpired);
        }
        const viewer = await this.accounts.findViewer(payload.sub);
        if (!viewer || payload.aud !== audiences[viewer.role])
            throw new UnauthorizedException(authMessages.sessionExpired);
        const required = this.reflector.getAllAndOverride<Role>('requiredRole', [
            context.getHandler(),
            context.getClass()
        ]);
        if (viewer.role !== required) throw new ForbiddenException(authMessages.forbidden);
        const origin = request.headers.origin;
        if (origin !== undefined && !allowedOrigins(viewer.role === 'ADMIN' ? 'admin' : 'store').includes(origin)) {
            throw new ForbiddenException(authMessages.forbidden);
        }
        request.viewer = viewer;
        return true;
    }
}
