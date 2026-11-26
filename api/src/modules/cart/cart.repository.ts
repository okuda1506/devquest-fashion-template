import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';

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
    list(userId: string) {
        return this.db.cartItem.findMany({
            where: { userId },
            include: { product: true },
            orderBy: { productId: 'asc' }
        });
    }

    /**
     * 追加または数量変更の対象になる公開商品を取得する
     */
    findProduct(id: string, source: Pick<Prisma.TransactionClient, 'product'> = this.db) {
        return source.product.findFirst({ where: { id, isPublished: true } });
    }

    /**
     * ユーザーと商品の複合キーで明細の数量を設定する
     */
    put(
        userId: string,
        productId: string,
        quantity: number,
        source: Pick<Prisma.TransactionClient, 'cartItem'> = this.db
    ) {
        return source.cartItem.upsert({
            where: { userId_productId: { userId, productId } },
            update: { quantity },
            create: { userId, productId, quantity }
        });
    }

    /**
     * 対象のユーザーと商品に一致する明細を削除する
     */
    remove(userId: string, productId: string) {
        return this.db.cartItem.deleteMany({ where: { userId, productId } });
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
