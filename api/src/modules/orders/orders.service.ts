import { orderMessages } from './order-messages';
import { Injectable, NotFoundException } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import type { OrderStatus } from '../../generated/prisma/client';

/**
 * 顧客の注文参照と店舗の受注管理を担当する
 */
@Injectable()
export class OrdersService {
    /**
     * 注文参照と更新に使うリポジトリを受け取る
     */
    constructor(private readonly repo: OrdersRepository) {}

    /**
     * 対象顧客の注文履歴を返す
     */
    list(userId?: string) {
        return this.repo.list(userId);
    }

    /**
     * 顧客情報付きの受注データを管理画面に返す
     */
    adminList() {
        return this.repo.adminList();
    }

    /**
     * 既存注文の発送ステータスを変更する
     *
     * @param id 更新対象の注文 ID
     * @param status 変更先のステータス
     * @returns 更新成功を示す結果
     * @throws NotFoundException 対象注文が存在しない場合
     */
    async update(id: string, status: OrderStatus) {
        if (!(await this.repo.update(id, status)).count) throw new NotFoundException(orderMessages.notFound);
        return { updated: true };
    }

    /**
     * 注文 ID を指定して対象顧客の注文だけを取得する
     *
     * @param userId 注文を参照する顧客 ID
     * @param id 対象の注文 ID
     * @returns 明細を含む注文
     * @throws NotFoundException 注文がないか顧客本人の注文ではない場合
     */
    async detail(userId: string, id: string) {
        const order = await this.repo.find(userId, id);
        if (!order) throw new NotFoundException(orderMessages.notFound);
        return order;
    }
}
