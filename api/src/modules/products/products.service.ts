import { productMessages } from './product-messages';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductsRepository } from './products.repository';
import type { ProductQuery } from './dto/product-query.dto';
import type { CreateProduct } from './dto/create-product.dto';
import type { UpdateProduct } from './dto/update-product.dto';

/**
 * 公開商品参照と運営向け商品マスタ操作を提供する
 */
@Injectable()
export class ProductsService {
    /**
     * 公開商品と管理用商品を参照するリポジトリを受け取る
     */
    constructor(private readonly repository: ProductsRepository) {}
    /**
     * 検索条件に一致する商品カタログのページを返す
     */
    list(query: ProductQuery) {
        return this.repository.list(query);
    }
    /**
     * 公開商品を ID で参照する
     *
     * @param id 対象商品の ID
     * @returns 公開中の商品情報
     * @throws NotFoundException 存在しない場合または非公開の場合
     */
    async detail(id: string) {
        const product = await this.repository.detail(id);
        if (!product) throw new NotFoundException(productMessages.notFound);
        return product;
    }
    /**
     * 店舗運営が管理できる全商品を取得する
     */
    adminList() {
        return this.repository.adminList();
    }
    /**
     * 入力済みの商品マスタを初期在庫とともに登録する
     */
    create(dto: CreateProduct) {
        return this.repository.create(dto);
    }
    /**
     * リクエストに含まれる商品情報を更新する
     *
     * @param id 更新対象の商品 ID
     * @param dto 更新する項目
     * @returns 更新成功を示す結果
     * @throws NotFoundException 対象商品が存在しない場合
     */
    async update(id: string, dto: UpdateProduct) {
        if (!(await this.repository.update(id, dto)).count) throw new NotFoundException(productMessages.notFound);
        return { updated: true };
    }
}
