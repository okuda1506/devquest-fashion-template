import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { normalizeProductCode } from '../products/product-view';
import type { UpdateStock } from './dto/update-stock.dto';

/**
 * 商品行に保存された在庫数を読み書きする
 */
@Injectable()
export class InventoryRepository {
    /**
     * 商品在庫を更新する DB クライアントを受け取る
     */
    constructor(private readonly db: PrismaService) {}

    /**
     * 編集前の在庫数を条件に含めて商品在庫を更新する
     *
     * @param id 在庫を更新する商品 ID
     * @param dto 新しい在庫数と省略可能な編集前在庫数
     * @returns 更新した行数を含む結果
     */
    update(id: string, { stock, expectedStock }: UpdateStock) {
        // 購入などで在庫が変わっていた場合は古い編集値で上書きしない
        return this.db.product.updateMany({ where: { code: normalizeProductCode(id), stock: expectedStock }, data: { stock } });
    }

    /**
     * 在庫更新に失敗した商品が存在するかを ID で調べる
     */
    find(id: string) {
        return this.db.product.findUnique({ where: { code: normalizeProductCode(id) }, select: { id: true } });
    }
}
