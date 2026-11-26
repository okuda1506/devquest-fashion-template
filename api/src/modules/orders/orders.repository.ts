import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { OrderStatus } from '../../generated/prisma/client';

/**
 * 顧客の注文履歴と店舗の受注情報を読み書きする
 */
@Injectable()
export class OrdersRepository {
    /**
     * 注文を読み書きする DB クライアントを受け取る
     */
    constructor(private readonly db: PrismaService) {}

    /**
     * 注文を明細付きで新しい順に取得する
     */
    list(userId?: string) {
        return this.db.order.findMany({ where: { userId }, include: { items: true }, orderBy: { createdAt: 'desc' } });
    }

    /**
     * 注文 ID と顧客 ID の組み合わせで注文を取得する
     */
    find(userId: string, id: string) {
        return this.db.order.findFirst({ where: { id, userId }, include: { items: true } });
    }

    /**
     * 管理画面の受注一覧に必要な注文・明細・顧客連絡先を取得する
     */
    adminList() {
        return this.db.order.findMany({
            include: { items: true, user: { select: { name: true, email: true } } },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * 指定した注文を新しいステータスに変更する
     */
    update(id: string, status: OrderStatus) {
        return this.db.order.updateMany({ where: { id }, data: { status } });
    }
}
