import { jwtSecret } from '../../config/environment';
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
            useFactory: () => ({ secret: jwtSecret() })
        })
    ],
    controllers: [AuthController],
    providers: [AuthGuard, AuthService, AuthRepository],
    exports: [AuthGuard, AuthRepository, JwtModule]
})
export class AuthModule {}
