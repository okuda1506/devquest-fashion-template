import { Body, ConflictException, Controller, Injectable, Module, NotFoundException, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsInt, Max, Min, ValidateIf } from 'class-validator';
import { Db } from '../db';
import { AdminOnly, AuthGuard, AuthModule } from '../auth/auth';

class UpdateStock {
  @ApiProperty() @IsInt() @Min(0) @Max(100000) stock!: number;
  @ApiPropertyOptional() @ValidateIf((_, value) => value !== undefined) @IsInt() @Min(0) expectedStock?: number;
}

@Injectable()
class InventoryRepository {
  constructor(private readonly db: Db) {}
  update(id: string, { stock, expectedStock }: UpdateStock) {
    return this.db.product.updateMany({ where: { id, stock: expectedStock }, data: { stock } });
  }
  find(id: string) { return this.db.product.findUnique({ where: { id }, select: { id: true } }); }
}

@Injectable()
class InventoryService {
  constructor(private readonly repo: InventoryRepository) {}
  async update(id: string, dto: UpdateStock) {
    if ((await this.repo.update(id, dto)).count) return { updated: true };
    if (dto.expectedStock !== undefined && await this.repo.find(id)) {
      throw new ConflictException('在庫数が変更されました。一覧を更新してからやり直してください。');
    }
    throw new NotFoundException('商品が見つかりません。');
  }
}

@ApiTags('管理・在庫')
@ApiBearerAuth()
@AdminOnly()
@UseGuards(AuthGuard)
@Controller('admin/inventory')
class InventoryController {
  constructor(private readonly inventory: InventoryService) {}
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateStock) { return this.inventory.update(id, dto); }
}

@Module({ imports: [AuthModule], controllers: [InventoryController], providers: [InventoryRepository, InventoryService] })
export class InventoryModule {}
