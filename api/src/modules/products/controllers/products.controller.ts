import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProductsService } from '../products.service';
import { ProductQuery } from '../dto/product-query.dto';

/** ログイン不要の商品カタログと詳細取得を提供する */
@ApiTags('商品')
@Controller('products')
export class ProductsController {
    /** 公開カタログを参照するサービスを受け取る */
    constructor(private readonly products: ProductsService) {}
    /** 検索条件を受け取って商品一覧を返す */
    @Get() list(@Query() query: ProductQuery) {
        return this.products.list(query);
    }
    /** 指定商品 ID の公開商品を取得する */
    @Get(':id') detail(@Param('id') id: string) {
        return this.products.detail(id);
    }
}
