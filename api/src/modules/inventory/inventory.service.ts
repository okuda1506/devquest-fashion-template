import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryRepository } from './inventory.repository';
import type { UpdateStock } from './dto/update-stock.dto';

/** 在庫更新の結果から商品不存在と編集競合を切り分ける */
@Injectable()
export class InventoryService {
    /** 在庫と競合状態の確認に使うリポジトリを受け取る */
    constructor(private readonly repo: InventoryRepository) {}
    /**
     * 在庫の更新結果から商品不存在と編集競合を判別する
     *
     * @param id 在庫を更新する商品 ID
     * @param dto 新しい在庫数と省略可能な編集前在庫数
     * @returns 更新成功を示す結果
     * @throws NotFoundException 対象商品が存在しない場合
     * @throws ConflictException 編集開始後に在庫が更新された場合
     */
    async update(id: string, dto: UpdateStock) {
        if ((await this.repo.update(id, dto)).count) return { updated: true };
        if (dto.expectedStock !== undefined && (await this.repo.find(id))) {
            throw new ConflictException('在庫数が変更されました。一覧を更新してからやり直してください。');
        }
        throw new NotFoundException('商品が見つかりません。');
    }
}
