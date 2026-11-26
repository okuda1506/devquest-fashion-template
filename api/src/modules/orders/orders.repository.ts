import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { formatAccountName } from '../auth/account-name';
import { orderDetails } from './order-shipping-address';
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
    list(customerId: string) {
        return this.db.order.findMany({ ...orderDetails, where: { customerId }, orderBy: { createdAt: 'desc' } });
    }

    /**
     * 注文 ID と顧客 ID の組み合わせで注文を取得する
     */
    find(customerId: string, id: string) {
        return this.db.order.findFirst({ ...orderDetails, where: { id, customerId } });
    }

    /**
     * 注文 ID とゲストの参照キーハッシュが一致する注文を取得する
     */
    findGuest(accessHash: string, id: string) {
        return this.db.order.findFirst({ ...orderDetails, where: { id, customerId: null, guestAccessHash: accessHash } });
    }

    /**
     * 管理画面の受注一覧に必要な注文・明細・顧客連絡先を取得する
     */
    async adminList() {
        const orders = await this.db.order.findMany({
            ...orderDetails,
            include: {
                ...orderDetails.include,
                customer: { select: { lastName: true, firstName: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        return orders.map(({ customer, guestEmail, ...order }) => ({
            ...order,
            isGuest: customer === null,
            user: customer
                ? { name: formatAccountName(customer), email: customer.email }
                : { name: order.shippingAddress?.name ?? 'ゲスト', email: guestEmail ?? '' }
        }));
    }

    /**
     * 指定した注文を新しいステータスに変更する
     */
    update(id: string, status: OrderStatus) {
        return this.db.order.updateMany({ where: { id }, data: { status } });
    }
}
