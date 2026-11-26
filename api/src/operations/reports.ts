import {
    BadRequestException,
    Controller,
    Get,
    Injectable,
    InternalServerErrorException,
    Module,
    Query,
    UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, AuthModule, RequireRole } from '../auth/auth';
import { Db } from '../db';
import { logEvent } from '../logging';

const dayMs = 86400000;
const categories = ['tops', 'outerwear', 'bottoms', 'accessories'];

/** UTC の営業日を表す YYYY-MM-DD を日付境界へ変換する */
function dayStart(day: string | undefined) {
    const date = new Date(day + 'T00:00:00.000Z');
    if (
        !day ||
        !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== day
    ) {
        throw new BadRequestException('日付を YYYY-MM-DD 形式で指定してください。');
    }
    return date;
}

/** 店舗スタッフが注文実績を調査するための日次・商品別レポート */
@Injectable()
class OperationsReports {
    /** 受注と商品を取得する共通 DB クライアントを受け取る */
    constructor(private readonly db: Db) {}

    /** UTC の営業日に含まれる注文の件数と合計を集計する */
    async dailySales(day: string) {
        const start = dayStart(day);
        const nextDay = new Date(start.getTime() + dayMs);
        const result = await this.db.order.aggregate({
            where: { createdAt: { gte: start, lte: nextDay } },
            _count: true,
            _sum: { total: true }
        });
        if (result._sum.total === null) {
            logEvent('error', 'reports.daily_sales', { reason: 'missing_aggregate_total' });
            throw new InternalServerErrorException('売上を集計できませんでした。');
        }
        logEvent('info', 'reports.daily_sales', { reason: 'computed' });
        return { day, orders: result._count, total: result._sum.total };
    }

    /**
     * カテゴリーごとに最大100商品を商品 ID 順で取得する
     *
     * 受注明細に残る販売点数を商品単位で集計する
     */
    async productSales(category: string) {
        if (!categories.includes(category)) throw new BadRequestException('カテゴリーを指定してください。');
        const products = await this.db.product.findMany({
            where: { category },
            orderBy: { id: 'asc' },
            take: 100,
            select: { id: true, name: true }
        });
        const result = [];
        for (const product of products) {
            const sales = await this.db.orderItem.aggregate({
                where: { productId: product.id },
                _sum: { quantity: true }
            });
            result.push({ ...product, unitsSold: sales._sum.quantity ?? 0 });
        }
        logEvent('info', 'reports.product_sales', { reason: 'computed' });
        return result;
    }
}

/** 店舗管理者向けのレポートを提供する */
@ApiTags('管理・売上レポート')
@ApiBearerAuth()
@RequireRole('ADMIN')
@UseGuards(AuthGuard)
@Controller('admin/reports')
class ReportsController {
    /** 店舗管理用の集計を担当するサービスを受け取る */
    constructor(private readonly reports: OperationsReports) {}

    /** 日付を指定して日次売上を確認する */
    @Get('daily-sales') dailySales(@Query('day') day: string) {
        return this.reports.dailySales(day);
    }

    /** カテゴリー内の商品ごとの販売点数を確認する */
    @Get('product-sales') productSales(@Query('category') category: string) {
        return this.reports.productSales(category);
    }
}

/** 店舗管理にレポート用 API を追加する */
@Module({ imports: [AuthModule], controllers: [ReportsController], providers: [OperationsReports] })
export class ReportsModule {}
