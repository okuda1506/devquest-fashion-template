import { logEvents } from '../../common/logging/log-events';
import { isConflictingWrite } from '../../database/prisma-conflict';
import { checkoutConflict, checkoutMessages } from './checkout-errors';
import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { logEvent } from '../../common/logging/logger';
import { OrdersRepository } from '../orders/orders.repository';
import { CheckoutRepository } from './checkout.repository';
import { checkoutVersion, normalizeAddress } from './checkout-quote';
import type { PlaceOrderDto } from './dto/place-order.dto';
import type { PreviewOrderDto } from './dto/preview-order.dto';

/**
 * 注文内容の見積もりと確定を扱う
 */
@Injectable()
export class CheckoutService {
    /**
     * 購入確定用と確定済み注文の照会用のリポジトリを受け取る
     */
    constructor(
        private readonly repo: CheckoutRepository,
        private readonly orders: OrdersRepository
    ) {}

    /**
     * 最新のカートから見積もりを作り配送先と注文内容の照合値を計算する
     *
     * @param customerId 注文する顧客の ID
     * @param input 見積もりに使用する配送先
     * @param db 確定処理で使用するトランザクション用クライアント
     * @returns 明細・合計・正規化した配送先と照合値
     * @throws BadRequestException カートが空か注文金額が上限を超える場合
     * @throws ConflictException 非公開または在庫不足で購入できない商品がある場合
     */
    private async quote(customerId: string, input: PreviewOrderDto, db?: Prisma.TransactionClient) {
        const cart = await this.repo.cart(customerId, db);
        if (!cart.length) throw new BadRequestException(checkoutMessages.emptyCart);
        const items = cart.map(({ product, quantity }) => {
            if (!product.isPublished || product.stock < quantity) {
                throw checkoutConflict(
                    product.isPublished ? 'INSUFFICIENT_STOCK' : 'PRODUCT_UNAVAILABLE',
                    checkoutMessages.unavailableQuantity(product.name)
                );
            }
            return { productId: product.id, name: product.name, unitPrice: product.price, quantity };
        });
        const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        if (total > 2147483647) throw new BadRequestException(checkoutMessages.totalLimit);
        const shippingAddress = normalizeAddress(input.shippingAddress);
        return { items, total, shippingAddress, version: checkoutVersion(items, shippingAddress) };
    }

    /**
     * 注文内容と確定リクエストの再送に使う識別子を返す
     */
    async preview(customerId: string, input: PreviewOrderDto) {
        return { ...(await this.quote(customerId, input)), checkoutId: randomUUID() };
    }

    /**
     * 見積もりと現在のカートが一致する場合に在庫・注文・カートの更新をまとめて確定する
     *
     * 同じ確認 ID を同じ顧客が再送した場合は保存済みの注文を返す
     *
     * @param customerId 注文する顧客の ID
     * @param input 確認 ID・照合値・配送先
     * @returns 確定した注文と明細
     * @throws BadRequestException カートが空か注文金額が上限を超える場合
     * @throws ConflictException 商品を購入できないか確認内容が変わった場合。または同時更新で確定できない場合
     */
    async place(customerId: string, input: PlaceOrderDto) {
        // タイムアウト後に同じ確認 ID を再送した場合は確定済みの注文を返す
        const existingOrder = await this.orders.find(customerId, input.checkoutId);
        if (existingOrder) {
            logEvent('info', logEvents.orderPlaced, { reason: 'already_committed' });
            return existingOrder;
        }
        try {
            const order = await this.repo.transact(async (db) => {
                const { items, total, shippingAddress, version } = await this.quote(customerId, input, db);
                if (input.version !== version) {
                    throw checkoutConflict('CHECKOUT_CHANGED', checkoutMessages.changed);
                }
                for (const item of items) {
                    // 在庫の条件判定と減算を同一の SQL 更新にまとめて売り越しを防ぐ
                    const updated = await this.repo.reduceStock(item, db);
                    if (!updated.count)
                        throw checkoutConflict('INSUFFICIENT_STOCK', checkoutMessages.insufficientStock(item.name));
                }
                const order = await this.repo.createOrder(
                    {
                        id: input.checkoutId,
                        customerId,
                        total,
                        shippingAddress: { create: shippingAddress },
                        items: { create: items }
                    },
                    db
                );
                await this.repo.clearCart(customerId, db);
                return order;
            });
            logEvent('info', logEvents.orderPlaced, { reason: 'committed' });
            return order;
        } catch (cause) {
            // 同じ確認 ID の別リクエストが先に確定した場合はその注文を返す
            const committed = await this.orders.find(customerId, input.checkoutId);
            if (committed) {
                logEvent('info', logEvents.orderPlaced, { reason: 'concurrent_commit' });
                return committed;
            }
            const reason =
                cause instanceof BadRequestException
                    ? 'invalid_cart'
                    : cause instanceof ConflictException
                      ? 'cart_or_stock_changed'
                      : isConflictingWrite(cause)
                        ? 'concurrent_update'
                        : 'unexpected_failure';
            logEvent(reason === 'unexpected_failure' ? 'error' : 'warn', logEvents.orderPlaced, { reason });
            if (isConflictingWrite(cause)) {
                throw checkoutConflict('CONCURRENT_UPDATE', checkoutMessages.concurrentUpdate);
            }
            throw cause;
        }
    }
}
