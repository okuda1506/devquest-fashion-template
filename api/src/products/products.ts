import { Body, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Prisma } from '@prisma/client';
import { Db } from '../db';
import { AdminOnly, AuthGuard, AuthModule } from '../auth/auth';

export const categories = ['tops', 'outerwear', 'bottoms', 'accessories'] as const;
class ProductQuery {
  @ApiPropertyOptional({ enum: categories }) @IsOptional() @IsIn(categories) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) q?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page = 1;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
class UpdateProduct {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(1000000) price?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPublished?: boolean;
}

@Injectable()
export class ProductsRepository {
  constructor(private readonly db: Db) {}

  async list(query: ProductQuery) {
    const where: Prisma.ProductWhereInput = {
      category: query.category,
      name: query.q ? { contains: query.q, mode: 'insensitive' } : undefined,
    };
    const [items, total] = await this.db.$transaction([
      this.db.product.findMany({ where, orderBy: { id: 'asc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
      this.db.product.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  detail(id: string) { return this.db.product.findFirst({ where: { id, isPublished: true } }); }
  adminList() { return this.db.product.findMany({ orderBy: { id: 'asc' } }); }
  update(id: string, data: UpdateProduct) { return this.db.product.updateMany({ where: { id }, data }); }
}

@Injectable()
export class ProductsService {
  constructor(private readonly repository: ProductsRepository) {}
  list(query: ProductQuery) { return this.repository.list(query); }
  async detail(id: string) {
    const product = await this.repository.detail(id);
    if (!product) throw new NotFoundException('商品が見つかりません。');
    return product;
  }
  adminList() { return this.repository.adminList(); }
  async update(id: string, dto: UpdateProduct) {
    if (!(await this.repository.update(id, dto)).count) throw new NotFoundException('商品が見つかりません。');
    return { updated: true };
  }
}

@ApiTags('商品')
@Controller('products')
class ProductsController {
  constructor(private readonly products: ProductsService) {}
  @Get() list(@Query() query: ProductQuery) { return this.products.list(query); }
  @Get(':id') detail(@Param('id') id: string) { return this.products.detail(id); }
}

@ApiTags('管理・商品')
@ApiBearerAuth()
@AdminOnly()
@UseGuards(AuthGuard)
@Controller('admin/products')
class AdminProductsController {
  constructor(private readonly products: ProductsService) {}
  @Get() list() { return this.products.adminList(); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateProduct) { return this.products.update(id, dto); }
}

@Module({ imports: [AuthModule], controllers: [ProductsController, AdminProductsController], providers: [ProductsRepository, ProductsService] })
export class ProductsModule {}
