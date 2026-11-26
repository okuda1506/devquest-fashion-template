import { randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthRepository } from './auth.repository';
import { hashPassword, verifyPassword } from './password';
import { allowedOrigins, type Surface } from './origins';
import { roles, audiences, issuer, sessionLifetimeSeconds, loginDenied } from './auth.config';
import type { LoginDto } from './dto/login.dto';

/**
 * 画面の用途に合うアカウントを認証してセッションを発行する
 */
@Injectable()
export class AuthService {
    private readonly dummyHash = hashPassword(randomBytes(24).toString('hex'));

    /**
     * アカウント検索と JWT 発行に必要な依存を受け取る
     */
    constructor(
        private readonly accounts: AuthRepository,
        private readonly jwt: JwtService
    ) {}

    /**
     * 認証に成功した利用者に画面用途を限定した1時間有効の JWT を発行する
     *
     * @param input 照合するメールアドレスとパスワード
     * @param surface ストアまたは管理画面
     * @param origin ブラウザから送信された呼び出し元
     *
     * @returns トークンと利用者の表示名・ロール・失効時刻
     * @throws UnauthorizedException オリジン・資格情報・画面用途のいずれかが一致しない場合
     */
    async login(input: LoginDto, surface: Surface, origin?: string) {
        if (origin !== undefined && !allowedOrigins(surface).includes(origin))
            throw new UnauthorizedException(loginDenied);
        const user = await this.accounts.findByEmail(input.email.toLowerCase());
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
