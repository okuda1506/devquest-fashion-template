import { logEvents } from '../../common/logging/log-events';
import { isConflictingWrite } from '../../database/prisma-conflict';
import { checkoutConflict, checkoutMessages } from './checkout-errors';
import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { logEvent } from '../../common/logging/logger';
import { orderMessages } from '../orders/order-messages';
import { OrdersRepository } from '../orders/orders.repository';
import { CheckoutRepository } from './checkout.repository';
import { checkoutVersion, normalizeAddress } from './checkout-quote';
import type { PlaceOrderDto } from './dto/place-order.dto';
import type { PreviewOrderDto } from './dto/preview-order.dto';
import type { GuestCartLineDto, GuestPlaceDto, GuestPreviewDto } from './dto/guest-checkout.dto';
import { guestCheckoutVersion } from './guest-checkout-proof';

type Buyer = { customerId: string } | { accessHash: string; email: string; items: GuestCartLineDto[] };

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
     * @param buyer 会員の顧客 ID またはゲストのカートと連絡先
     * @param input 見積もりに使用する配送先
     * @param db 確定処理で使用するトランザクション用クライアント
     * @returns 明細・合計・正規化した配送先と照合値
     * @throws BadRequestException カートが空か注文金額が上限を超える場合
     * @throws ConflictException 非公開または在庫不足で購入できない商品がある場合
     */
    private async quote(buyer: Buyer, input: PreviewOrderDto, db?: Prisma.TransactionClient) {
        const cart = 'customerId' in buyer
            ? await this.repo.cart(buyer.customerId, db)
            : await this.repo.guestCart(buyer.items, db);
        if ('items' in buyer && cart.length !== buyer.items.length) {
            throw checkoutConflict('PRODUCT_UNAVAILABLE', checkoutMessages.missingProducts);
        }
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
        return { ...(await this.quote({ customerId }, input)), checkoutId: randomUUID() };
    }

    /**
     * 注文 ID と連絡先に結びついたゲストの見積もりを返す
     */
    async guestPreview(accessHash: string, input: GuestPreviewDto) {
        const buyer = { accessHash, email: input.email, items: input.items };
        const quote = await this.quote(buyer, input);
        const checkoutId = randomUUID();
        return {
            ...quote,
            checkoutId,
            email: input.email,
            version: guestCheckoutVersion(checkoutId, accessHash, input.email, quote.version)
        };
    }

    /**
     * ログインした会員の注文を確定する
     */
    place(customerId: string, input: PlaceOrderDto) {
        return this.commit({ customerId }, input);
    }

    /**
     * ゲストの見積もり署名を照合して注文を確定する
     */
    guestPlace(accessHash: string, input: GuestPlaceDto) {
        return this.commit({ accessHash, email: input.email, items: input.items }, input);
    }

    /**
     * 注文を作成したゲストからの照会に応答する
     */
    async guestDetail(accessHash: string, id: string) {
        const order = await this.orders.findGuest(accessHash, id);
        if (!order) throw new NotFoundException(orderMessages.notFound);
        return order;
    }

    /**
     * 同じ確認 ID で確定済みの注文を所有者の範囲で検索する
     */
    private findOrder(buyer: Buyer, id: string) {
        return 'customerId' in buyer ? this.orders.find(buyer.customerId, id) : this.orders.findGuest(buyer.accessHash, id);
    }

    /**
     * 見積もりと現在のカートが一致する場合に在庫・注文・カートの更新をまとめて確定する
     *
     * 同じ確認 ID を同じ購入者が再送した場合は保存済みの注文を返す
     *
     * @param buyer 注文する会員またはゲスト
     * @param input 確認 ID・照合値・配送先
     * @returns 確定した注文と明細
     * @throws BadRequestException カートが空か注文金額が上限を超える場合
     * @throws ConflictException 商品を購入できないか確認内容が変わった場合。または同時更新で確定できない場合
     */
    private async commit(buyer: Buyer, input: PlaceOrderDto) {
        // タイムアウト後に同じ確認 ID を再送した場合は確定済みの注文を返す
        const existingOrder = await this.findOrder(buyer, input.checkoutId);
        if (existingOrder) {
            logEvent('info', logEvents.orderPlaced, { reason: 'already_committed' });
            return existingOrder;
        }
        try {
            const order = await this.repo.transact(async (db) => {
                const { items, total, shippingAddress, version } = await this.quote(buyer, input, db);
                const expectedVersion = 'customerId' in buyer
                    ? version
                    : guestCheckoutVersion(input.checkoutId, buyer.accessHash, buyer.email, version);
                if (input.version !== expectedVersion) {
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
                        ...('customerId' in buyer
                            ? { customerId: buyer.customerId }
                            : { guestEmail: buyer.email, guestAccessHash: buyer.accessHash }),
                        total,
                        shippingAddress: { create: shippingAddress },
                        items: { create: items }
                    },
                    db
                );
                if ('customerId' in buyer) await this.repo.clearCart(buyer.customerId, db);
                return order;
            });
            logEvent('info', logEvents.orderPlaced, { reason: 'committed' });
            return order;
        } catch (cause) {
            // 同じ確認 ID の別リクエストが先に確定した場合はその注文を返す
            const committed = await this.findOrder(buyer, input.checkoutId);
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
