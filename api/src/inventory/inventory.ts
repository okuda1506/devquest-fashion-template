import {
    Body,
    ConflictException,
    Controller,
    Injectable,
    Module,
    NotFoundException,
    Param,
    Patch,
    UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsInt, Max, Min, ValidateIf } from 'class-validator';
import { Db } from '../db';
import { RequireRole, AuthGuard, AuthModule } from '../auth/auth';

/** 新しい在庫数と競合検出に用いる編集前の在庫数を受け取る */
class UpdateStock {
    @ApiProperty() @IsInt() @Min(0) @Max(100000) stock!: number;
    @ApiPropertyOptional() @ValidateIf((_, value) => value !== undefined) @IsInt() @Min(0) expectedStock?: number;
}

/** 商品行に保存された在庫数を読み書きする */
@Injectable()
class InventoryRepository {
    /** 商品在庫を更新する DB クライアントを受け取る */
    constructor(private readonly db: Db) {}
    /**
     * 編集前の在庫数を条件に含めて商品在庫を更新する
     *
     * @param id 在庫を更新する商品 ID
     * @param dto 新しい在庫数と省略可能な編集前在庫数
     * @returns 更新した行数を含む結果
     */
    update(id: string, { stock, expectedStock }: UpdateStock) {
        // 購入などで在庫が変わっていた場合は古い編集値で上書きしない
        return this.db.product.updateMany({ where: { id, stock: expectedStock }, data: { stock } });
    }
    /** 在庫更新に失敗した商品が存在するかを ID で調べる */
    find(id: string) {
        return this.db.product.findUnique({ where: { id }, select: { id: true } });
    }
}

/** 在庫更新の結果から商品不存在と編集競合を切り分ける */
@Injectable()
class InventoryService {
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

/** 管理者が在庫数を更新するための API を提供する */
@ApiTags('管理・在庫')
@ApiBearerAuth()
@RequireRole('ADMIN')
@UseGuards(AuthGuard)
@Controller('admin/inventory')
class InventoryController {
    /** 在庫更新を実行するサービスを受け取る */
    constructor(private readonly inventory: InventoryService) {}
    /** 商品 ID と入力値を使って在庫数の更新を依頼する */
    @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateStock) {
        return this.inventory.update(id, dto);
    }
}

/** 管理画面専用の在庫管理機能を構成する */
@Module({
    imports: [AuthModule],
    controllers: [InventoryController],
    providers: [InventoryRepository, InventoryService]
})
export class InventoryModule {}
