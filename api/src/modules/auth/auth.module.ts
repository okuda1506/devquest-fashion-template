import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';

/**
 * JWT の署名設定と認証ガードを提供する
 */
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
    providers: [AuthGuard, AuthService, AuthRepository],
    exports: [AuthGuard, AuthRepository, JwtModule]
})
export class AuthModule {}
