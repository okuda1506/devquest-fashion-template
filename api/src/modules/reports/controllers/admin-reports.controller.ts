import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RequireRole } from '../../../common/decorators/require-role.decorator';
import { ReportsService } from '../reports.service';

/**
 * 店舗管理者向けのレポートを提供する
 */
@ApiTags('管理・売上レポート')
@ApiBearerAuth()
@RequireRole('ADMIN')
@UseGuards(AuthGuard)
@Controller('admin/reports')
export class AdminReportsController {
    /**
     * 店舗管理用の集計を担当するサービスを受け取る
     */
    constructor(private readonly reports: ReportsService) {}

    /**
     * 日付を指定して日次売上を確認する
     */
    @Get('daily-sales') dailySales(@Query('day') day: string) {
        return this.reports.dailySales(day);
    }

    /**
     * カテゴリー内の商品ごとの販売点数を確認する
     */
    @Get('product-sales') productSales(@Query('category') category: string) {
        return this.reports.productSales(category);
    }
}
