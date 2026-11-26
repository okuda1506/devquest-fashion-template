import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { logEvent } from '../../common/logging/logger';
import { categories } from '../products/product-categories';
import { ReportsRepository } from './reports.repository';
import { reportsMessages } from './reports-messages';

const dayMs = 86400000;

/** UTC の営業日を表す YYYY-MM-DD を日付境界へ変換する */
function dayStart(day: string | undefined) {
    const date = new Date(day + 'T00:00:00.000Z');
    if (
        !day ||
        !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== day
    ) {
        throw new BadRequestException(reportsMessages.invalidDay);
    }
    return date;
}

/**
 * 店舗スタッフが注文実績を調査するための日次・商品別レポート
 */
@Injectable()
export class ReportsService {
    /**
     * 集計に使う受注と商品を取得するリポジトリを受け取る
     */
    constructor(private readonly reports: ReportsRepository) {}

    /**
     * UTC の営業日に含まれる注文の件数と合計を集計する
     */
    async dailySales(day: string) {
        const start = dayStart(day);
        const nextDay = new Date(start.getTime() + dayMs);
        const result = await this.reports.dailySales(start, nextDay);
        if (result._sum.total === null) {
            logEvent('error', 'reports.daily_sales', { reason: 'missing_aggregate_total' });
            throw new InternalServerErrorException(reportsMessages.aggregationFailed);
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
        if (!categories.some((value) => value === category))
            throw new BadRequestException(reportsMessages.invalidCategory);
        const products = await this.reports.products(category);
        const result = [];
        for (const product of products) {
            const sales = await this.reports.salesForProduct(product.id);
            result.push({ ...product, unitsSold: sales._sum.quantity ?? 0 });
        }
        logEvent('info', 'reports.product_sales', { reason: 'computed' });
        return result;
    }
}
