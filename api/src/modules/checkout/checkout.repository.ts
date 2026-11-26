import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { orderDetails } from '../orders/order-shipping-address';
import type { GuestCartLineDto } from './dto/guest-checkout.dto';
import type { CheckoutItem } from './checkout-quote';

/**
 * 購入確定で在庫・注文・カートを同じトランザクションから操作する
 */
@Injectable()
export class CheckoutRepository {
    /**
     * 購入確定のトランザクションを開始する共通 DB 接続を受け取る
     */
    constructor(private readonly db: PrismaService) {}

    /**
     * 見積もりに必要な商品情報付きのカート明細を取得する
     */
    cart(customerId: string, source: Pick<Prisma.TransactionClient, 'cartItem'> = this.db) {
        return source.cartItem.findMany({
            where: { customerId },
            include: { product: true },
            orderBy: { productId: 'asc' }
        });
    }

    /**
     * ゲストのカートに含まれる商品を現在の値で取得する
     */
    async guestCart(items: GuestCartLineDto[], db: Pick<Prisma.TransactionClient, 'product'> = this.db) {
        const quantities = new Map(items.map((item) => [item.productId, item.quantity]));
        const products = await db.product.findMany({
            where: { id: { in: [...quantities.keys()] } },
            orderBy: { id: 'asc' }
        });
        return products.map((product) => ({ product, quantity: quantities.get(product.id)! }));
    }

    /**
     * 在庫・注文・カートにまたがる処理を単一トランザクションとして実行する
     */
    transact<T>(process: (db: Prisma.TransactionClient) => Promise<T>) {
        return this.db.$transaction(process, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }

    /**
     * 在庫に余裕がある公開商品だけを原子的に減算する
     */
    reduceStock(item: CheckoutItem, db: Prisma.TransactionClient) {
        return db.product.updateMany({
            where: { id: item.productId, isPublished: true, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } }
        });
    }

    /**
     * 確認 ID を注文 ID として明細と配送先を保存する
     */
    createOrder(data: Prisma.OrderUncheckedCreateInput, db: Prisma.TransactionClient) {
        return db.order.create({ ...orderDetails, data });
    }

    /**
     * 確定済みのカート明細を削除する
     */
    clearCart(customerId: string, db: Prisma.TransactionClient) {
        return db.cartItem.deleteMany({ where: { customerId } });
    }
}
