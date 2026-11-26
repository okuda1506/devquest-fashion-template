import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RequireRole } from '../../../common/decorators/require-role.decorator';
import { AuthService } from '../auth.service';
import { LoginDto } from '../dto/login.dto';

/** EC と管理画面それぞれの認証エンドポイントを提供する */
@ApiTags('認証')
@Controller('auth')
export class AuthController {
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
