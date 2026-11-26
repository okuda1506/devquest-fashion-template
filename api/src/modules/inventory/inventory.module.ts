import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminInventoryController } from './controllers/admin-inventory.controller';
import { InventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';

/** 管理画面専用の在庫管理機能を構成する */
@Module({
    imports: [AuthModule],
    controllers: [AdminInventoryController],
    providers: [InventoryRepository, InventoryService]
})
export class InventoryModule {}
