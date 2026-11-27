import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { formatAccountName } from '../auth/account-name';
import { orderDetails, orderView } from './order-shipping-address';
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
    async list(customerId: number) {
        const orders = await this.db.order.findMany({ ...orderDetails, where: { customerId }, orderBy: { createdAt: 'desc' } });
        return orders.map(orderView);
    }

    /**
     * 注文 ID と顧客 ID の組み合わせで注文を取得する
     */
    async find(customerId: number, reference: string) {
        const order = await this.db.order.findFirst({ ...orderDetails, where: { reference, customerId } });
        return order && orderView(order);
    }

    /**
     * 注文 ID とゲストの参照キーハッシュが一致する注文を取得する
     */
    async findGuest(accessHash: string, reference: string) {
        const order = await this.db.order.findFirst({
            ...orderDetails,
            where: { reference, customerId: null, guestAccessHash: accessHash }
        });
        return order && orderView(order);
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
            ...orderView({ ...order, guestEmail: null }),
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
        return this.db.order.updateMany({ where: { reference: id }, data: { status } });
    }
}
