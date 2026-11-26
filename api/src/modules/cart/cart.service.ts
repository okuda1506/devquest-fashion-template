import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { CartRepository } from './cart.repository';
import { MAX_CART_QUANTITY } from './cart-limits';

/** カートへの追加・数量指定・削除に必要な業務ルールを適用する */
@Injectable()
export class CartService {
    /** カート操作とトランザクションに使うリポジトリを受け取る */
    constructor(private readonly repo: CartRepository) {}
    /** 指定ユーザーのカート明細を返す */
    list(userId: string) {
        return this.repo.list(userId);
    }
    /**
     * 公開商品であることを確認してカート数量を指定値に置き換える
     *
     * @param userId カートの所有者
     * @param id 対象商品の ID
     * @param qty 更新後の数量
     * @returns 作成または更新されたカート明細
     * @throws NotFoundException 公開中の対象商品が存在しない場合
     */
    async put(userId: string, id: string, qty: number) {
        if (!(await this.repo.findProduct(id))) throw new NotFoundException('商品が見つかりません。');
        return this.repo.put(userId, id, qty);
    }
    /**
     * 現在の数量に加算して在庫数とカート上限を両方守る
     *
     * 同時更新による直列化競合または一意制約違反は最大3回まで試行する
     *
     * @param userId カートの所有者
     * @param productId 追加対象の商品 ID
     * @param quantity 現在の数量へ加算する点数
     * @returns 更新されたカート明細
     * @throws NotFoundException 公開中の対象商品が存在しない場合
     * @throws ConflictException 在庫不足・数量上限超過・同時更新で追加できない場合
     */
    async add(userId: string, productId: string, quantity: number) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                return await this.repo.transact(async (db) => {
                    const product = await this.repo.findProduct(productId, db);
                    if (!product) throw new NotFoundException('商品が見つかりません。');
                    const current = await db.cartItem.findUnique({
                        where: { userId_productId: { userId, productId } }
                    });
                    const next = (current?.quantity ?? 0) + quantity;
                    if (next > Math.min(product.stock, MAX_CART_QUANTITY)) {
                        throw new ConflictException('在庫またはカートの上限を超える数量は追加できません。');
                    }
                    return this.repo.put(userId, productId, next, db);
                });
            } catch (cause) {
                // 同時追加で起きる直列化競合と複合キー重複だけを再試行する
                if (
                    !(cause instanceof Prisma.PrismaClientKnownRequestError) ||
                    !['P2034', 'P2002'].includes(cause.code)
                )
                    throw cause;
            }
        }
        throw new ConflictException('カートが更新されました。もう一度追加してください。');
    }
    /**
     * 指定商品の明細をカートから取り除く
     *
     * @param userId カートの所有者
     * @param id 削除対象の商品 ID
     * @returns 明細の有無にかかわらず removed が true の結果
     */
    async remove(userId: string, id: string) {
        await this.repo.remove(userId, id);
        return { removed: true };
    }
}
