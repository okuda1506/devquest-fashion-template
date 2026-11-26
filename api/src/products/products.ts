import { randomUUID } from 'node:crypto';
import {
    Body,
    Controller,
    Get,
    Injectable,
    Module,
    NotFoundException,
    Param,
    Patch,
    Post,
    Query,
    UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
    IsBoolean,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    ValidateIf
} from 'class-validator';
import { Prisma } from '../generated/prisma/client';
import { Db } from '../db';
import { RequireRole, AuthGuard, AuthModule } from '../auth/auth';

export const categories = ['tops', 'outerwear', 'bottoms', 'accessories'] as const;
/** 商品検索のカテゴリ・検索語・ページ範囲を定義する */
class ProductQuery {
    @ApiPropertyOptional({ enum: categories }) @IsOptional() @IsIn(categories) category?: string;
    @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) q?: string;
    @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page = 1;
    @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
/** 商品登録と更新に共通する項目の入力条件を定義する */
class ProductFields {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    name!: string;

    @ApiProperty() @IsString() @MaxLength(2000) description!: string;
    @ApiProperty({ enum: categories }) @IsIn(categories) category!: string;
    @ApiProperty() @IsInt() @Min(0) @Max(1000000) price!: number;
    @ApiProperty() @IsBoolean() isPublished!: boolean;
}
/** 商品マスタの登録項目に初期在庫の入力を追加する */
class CreateProduct extends ProductFields {
    @ApiPropertyOptional({ default: 0 })
    @ValidateIf((_, value) => value !== undefined)
    @IsInt()
    @Min(0)
    @Max(100000)
    stock?: number;
}
/** 指定された項目だけを商品マスタに反映するための入力 */
class UpdateProduct extends PartialType(ProductFields, { skipNullProperties: false }) {}

/** 商品検索と管理画面の商品マスタ操作を担当する */
@Injectable()
export class ProductsRepository {
    /** 商品マスタを操作する DB クライアントを受け取る */
    constructor(private readonly db: Db) {}

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

    /** 公開状態の商品だけを詳細表示の対象とする */
    detail(id: string) {
        return this.db.product.findFirst({ where: { id, isPublished: true } });
    }
    /** 非公開を含む全商品を商品 ID 順で取得する */
    adminList() {
        return this.db.product.findMany({ orderBy: { id: 'asc' } });
    }
    /** 商品 ID を採番して初期在庫と商品情報を保存する */
    create({ stock = 0, ...data }: CreateProduct) {
        return this.db.product.create({ data: { id: randomUUID(), stock, ...data } });
    }
    /** 指定商品に入力された変更項目だけを反映する */
    update(id: string, data: UpdateProduct) {
        return this.db.product.updateMany({ where: { id }, data });
    }
}

/** 公開商品参照と運営向け商品マスタ操作を提供する */
@Injectable()
export class ProductsService {
    /** 公開商品と管理用商品を参照するリポジトリを受け取る */
    constructor(private readonly repository: ProductsRepository) {}
    /** 検索条件に一致する商品カタログのページを返す */
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
        if (!product) throw new NotFoundException('商品が見つかりません。');
        return product;
    }
    /** 店舗運営が管理できる全商品を取得する */
    adminList() {
        return this.repository.adminList();
    }
    /** 入力済みの商品マスタを初期在庫とともに登録する */
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
        if (!(await this.repository.update(id, dto)).count) throw new NotFoundException('商品が見つかりません。');
        return { updated: true };
    }
}

/** ログイン不要の商品カタログと詳細取得を提供する */
@ApiTags('商品')
@Controller('products')
class ProductsController {
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

/** 管理者向けの商品マスタ参照・登録・更新を提供する */
@ApiTags('管理・商品')
@ApiBearerAuth()
@RequireRole('ADMIN')
@UseGuards(AuthGuard)
@Controller('admin/products')
class AdminProductsController {
    /** 商品マスタを管理するサービスを受け取る */
    constructor(private readonly products: ProductsService) {}
    /** 非公開の商品を含めて商品マスタを列挙する */
    @Get() list() {
        return this.products.adminList();
    }
    /** 管理用フォームから新しい商品を登録する */
    @Post() create(@Body() dto: CreateProduct) {
        return this.products.create(dto);
    }
    /** 商品マスタの入力済み項目を更新する */
    @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateProduct) {
        return this.products.update(id, dto);
    }
}

/** 商品カタログと管理者向け商品管理を構成する */
@Module({
    imports: [AuthModule],
    controllers: [ProductsController, AdminProductsController],
    providers: [ProductsRepository, ProductsService]
})
export class ProductsModule {}
