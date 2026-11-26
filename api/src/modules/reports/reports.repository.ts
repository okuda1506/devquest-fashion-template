import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * 日次売上と商品別売上に使うデータを取得する
 */
@Injectable()
export class ReportsRepository {
    /**
     * 日次集計と商品別集計に使う共通 DB 接続を受け取る
     */
    constructor(private readonly db: PrismaService) {}

    /**
     * 日付範囲で注文の件数と売上合計を取得する
     */
    dailySales(start: Date, nextDay: Date) {
        return this.db.order.aggregate({
            where: { createdAt: { gte: start, lte: nextDay } },
            _count: true,
            _sum: { total: true }
        });
    }

    /**
     * 指定カテゴリーの商品から集計に必要な項目だけを取得する
     */
    products(category: string) {
        return this.db.product.findMany({
            where: { productCategory: { code: category } },
            orderBy: { code: 'asc' },
            take: 100,
            select: { id: true, code: true, name: true }
        });
    }

    /**
     * 指定商品の注文明細に記録された販売点数を集計する
     */
    salesForProduct(productId: number) {
        return this.db.orderItem.aggregate({
            where: { productId: productId },
            _sum: { quantity: true }
        });
    }
}
