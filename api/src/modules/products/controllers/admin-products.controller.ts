import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RequireRole } from '../../../common/decorators/require-role.decorator';
import { ProductsService } from '../products.service';
import { CreateProduct } from '../dto/create-product.dto';
import { UpdateProduct } from '../dto/update-product.dto';

/**
 * 管理者向けの商品マスタ参照・登録・更新を提供する
 */
@ApiTags('管理・商品')
@ApiBearerAuth()
@RequireRole('ADMIN')
@UseGuards(AuthGuard)
@Controller('admin/products')
export class AdminProductsController {
    /**
     * 商品マスタを管理するサービスを受け取る
     */
    constructor(private readonly products: ProductsService) {}

    /**
     * 非公開の商品を含めて商品マスタを列挙する
     */
    @Get() list() {
        return this.products.adminList();
    }

    /**
     * 管理用フォームから新しい商品を登録する
     */
    @Post() create(@Body() dto: CreateProduct) {
        return this.products.create(dto);
    }

    /**
     * 商品マスタの入力済み項目を更新する
     */
    @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateProduct) {
        return this.products.update(id, dto);
    }
}
