import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { normalizeProductCode, productCategory, productView } from '../products/product-view';

/**
 * ユーザー別のカート明細と対象商品の永続化を担当する
 */
@Injectable()
export class CartRepository {
    /**
     * カート明細を操作する DB クライアントを受け取る
     */
    constructor(private readonly db: PrismaService) {}

    /**
     * 商品情報付きのカート明細を商品 ID 順に取得する
     */
    async list(customerId: number) {
        const items = await this.db.cartItem.findMany({
            where: { customerId },
            include: { product: { include: productCategory } },
            orderBy: { product: { code: 'asc' } }
        });
        return items.map(({ product, quantity }) => ({ productId: product.code, product: productView(product), quantity }));
    }

    /**
     * 追加または数量変更の対象になる公開商品を取得する
     */
    findProduct(id: string, source: Pick<Prisma.TransactionClient, 'product'> = this.db) {
        return source.product.findFirst({ where: { code: normalizeProductCode(id), isPublished: true } });
    }

    /**
     * ユーザーと商品の複合キーで明細の数量を設定する
     */
    put(
        customerId: number,
        productId: number,
        quantity: number,
        source: Pick<Prisma.TransactionClient, 'cartItem'> = this.db
    ) {
        return source.cartItem.upsert({
            where: { customerId_productId: { customerId, productId } },
            update: { quantity },
            create: { customerId, productId, quantity },
            select: { id: true, customerId: true, productId: true, quantity: true }
        });
    }

    /**
     * 対象のユーザーと商品に一致する明細を削除する
     */
    remove(customerId: number, code: string) {
        return this.db.cartItem.deleteMany({ where: { customerId, product: { code: normalizeProductCode(code) } } });
    }

    /**
     * カート数量の読み取りと更新を同じ直列化可能トランザクションで処理する
     *
     * @param process トランザクション用クライアントを使う処理
     * @returns コミットされた処理の結果
     */
    transact<T>(process: (db: Prisma.TransactionClient) => Promise<T>) {
        return this.db.$transaction(process, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
}
