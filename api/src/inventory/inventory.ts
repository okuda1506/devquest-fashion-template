import { Body, Controller, Injectable, Module, NotFoundException, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { Db } from '../db';
import { AdminOnly, AuthGuard, AuthModule } from '../auth/auth';

class UpdateStock {
  @ApiProperty() @IsInt() @Min(0) @Max(100000) stock!: number;
}

@Injectable()
class InventoryRepository {
  constructor(private readonly db: Db) {}
  update(id: string, stock: number) { return this.db.product.updateMany({ where: { id }, data: { stock } }); }
}

@Injectable()
class InventoryService {
  constructor(private readonly repo: InventoryRepository) {}
  async update(id: string, stock: number) {
    if (!(await this.repo.update(id, stock)).count) throw new NotFoundException('商品が見つかりません。');
    return { updated: true };
  }
}

@ApiTags('管理・在庫')
@ApiBearerAuth()
@AdminOnly()
@UseGuards(AuthGuard)
@Controller('admin/inventory')
class InventoryController {
  constructor(private readonly inventory: InventoryService) {}
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateStock) { return this.inventory.update(id, dto.stock); }
}

@Module({ imports: [AuthModule], controllers: [InventoryController], providers: [InventoryRepository, InventoryService] })
export class InventoryModule {}
