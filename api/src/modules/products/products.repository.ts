import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { ProductQuery } from './dto/product-query.dto';
import type { CreateProduct } from './dto/create-product.dto';
import type { UpdateProduct } from './dto/update-product.dto';

/**
 * 商品検索と管理画面の商品マスタ操作を担当する
 */
@Injectable()
export class ProductsRepository {
    /**
     * 商品マスタを操作する DB クライアントを受け取る
     */
    constructor(private readonly db: PrismaService) {}

    /**
     * 同じ検索条件で指定ページと総件数を照会する
     *
     * 商品名は大文字小文字を区別せず部分一致させる
     *
     * @param query カテゴリー・検索語・ページ番号・件数上限
     * @returns 商品 ID 順の結果と総件数およびページ情報
     */
    async list(query: ProductQuery) {
        const where: Prisma.ProductWhereInput = {
            category: query.category,
            name: query.q ? { contains: query.q, mode: 'insensitive' } : undefined
        };
        const [items, total] = await this.db.$transaction([
            this.db.product.findMany({
                where,
                orderBy: { id: 'asc' },
                skip: (query.page - 1) * query.limit,
                take: query.limit
            }),
            this.db.product.count({ where })
        ]);
        return { items, total, page: query.page, limit: query.limit };
    }

    /**
     * 公開状態の商品だけを詳細表示の対象とする
     */
    detail(id: string) {
        return this.db.product.findFirst({ where: { id, isPublished: true } });
    }
    /**
     * 非公開を含む全商品を商品 ID 順で取得する
     */
    adminList() {
        return this.db.product.findMany({ orderBy: { id: 'asc' } });
    }
    /**
     * 商品 ID を採番して初期在庫と商品情報を保存する
     */
    create({ stock = 0, ...data }: CreateProduct) {
        return this.db.product.create({ data: { id: randomUUID(), stock, ...data } });
    }
    /**
     * 指定商品に入力された変更項目だけを反映する
     */
    update(id: string, data: UpdateProduct) {
        return this.db.product.updateMany({ where: { id }, data });
    }
}
