import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { logEvent } from '../../common/logging/logger';
import { OrdersRepository } from '../orders/orders.repository';
import { CheckoutRepository } from './checkout.repository';
import { checkoutVersion, normalizeAddress } from './checkout-quote';
import type { PlaceOrderDto } from './dto/place-order.dto';
import type { PreviewOrderDto } from './dto/preview-order.dto';

/** 注文内容の見積もりと確定を扱う */
@Injectable()
export class CheckoutService {
    constructor(
        private readonly repo: CheckoutRepository,
        private readonly orders: OrdersRepository
    ) {}

    /**
     * 最新のカートから見積もりを作り配送先と注文内容の照合値を計算する
     *
     * @param userId 注文する顧客の ID
     * @param input 見積もりに使用する配送先
     * @param db 確定処理で使用するトランザクション用クライアント
     * @returns 明細・合計・正規化した配送先と照合値
     * @throws BadRequestException カートが空か注文金額が上限を超える場合
     * @throws ConflictException 非公開または在庫不足で購入できない商品がある場合
     */
    private async quote(userId: string, input: PreviewOrderDto, db?: Prisma.TransactionClient) {
        const cart = await this.repo.cart(userId, db);
        if (!cart.length) throw new BadRequestException('カートに商品がありません。');
        const items = cart.map(({ product, quantity }) => {
            if (!product.isPublished || product.stock < quantity) {
                throw new ConflictException(
                    `${product.name} は現在、この数量で注文できません。カートを確認してください。`
                );
            }
            return { productId: product.id, name: product.name, unitPrice: product.price, quantity };
        });
        const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        if (total > 2147483647)
            throw new BadRequestException('一度に注文できる金額を超えています。数量を調整してください。');
        const shippingAddress = normalizeAddress(input.shippingAddress);
        return { items, total, shippingAddress, version: checkoutVersion(items, shippingAddress) };
    }

    /** 注文内容と確定リクエストの再送に使う識別子を返す */
    async preview(userId: string, input: PreviewOrderDto) {
        return { ...(await this.quote(userId, input)), checkoutId: randomUUID() };
    }

    /**
     * 見積もりと現在のカートが一致する場合に在庫・注文・カートの更新をまとめて確定する
     *
     * 同じ確認 ID を同じ顧客が再送した場合は保存済みの注文を返す
     *
     * @param userId 注文する顧客の ID
     * @param input 確認 ID・照合値・配送先
     * @returns 確定した注文と明細
     * @throws BadRequestException カートが空か注文金額が上限を超える場合
     * @throws ConflictException 商品を購入できないか確認内容が変わった場合。または同時更新で確定できない場合
     */
    async place(userId: string, input: PlaceOrderDto) {
        // タイムアウト後に同じ確認 ID を再送した場合は確定済みの注文を返す
        const existingOrder = await this.orders.find(userId, input.checkoutId);
        if (existingOrder) {
            logEvent('info', 'orders.place', { reason: 'already_committed' });
            return existingOrder;
        }
        try {
            const order = await this.repo.transact(async (db) => {
                const { items, total, shippingAddress, version } = await this.quote(userId, input, db);
                if (input.version !== version) {
                    throw new ConflictException(
                        'カートまたは配送先の内容が変わりました。注文内容を確認し直してください。'
                    );
                }
                for (const item of items) {
                    // 在庫の条件判定と減算を同一の SQL 更新にまとめて売り越しを防ぐ
                    const updated = await this.repo.reduceStock(item, db);
                    if (!updated.count) throw new ConflictException(`${item.name} の在庫が不足しています。`);
                }
                const order = await this.repo.createOrder(
                    { id: input.checkoutId, userId, total, shippingAddress, items: { create: items } },
                    db
                );
                await this.repo.clearCart(userId, db);
                return order;
            });
            logEvent('info', 'orders.place', { reason: 'committed' });
            return order;
        } catch (cause) {
            // 同じ確認 ID の別リクエストが先に確定した場合はその注文を返す
            const committed = await this.orders.find(userId, input.checkoutId);
            if (committed) {
                logEvent('info', 'orders.place', { reason: 'concurrent_commit' });
                return committed;
            }
            const reason =
                cause instanceof BadRequestException
                    ? 'invalid_cart'
                    : cause instanceof ConflictException
                      ? 'cart_or_stock_changed'
                      : cause instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(cause.code)
                        ? 'concurrent_update'
                        : 'unexpected_failure';
            logEvent(reason === 'unexpected_failure' ? 'error' : 'warn', 'orders.place', { reason });
            if (cause instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(cause.code)) {
                throw new ConflictException('在庫またはカートが更新されました。内容を確認してください。');
            }
            throw cause;
        }
    }
}
