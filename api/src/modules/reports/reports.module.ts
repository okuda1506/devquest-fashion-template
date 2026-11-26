import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminReportsController } from './controllers/admin-reports.controller';
import { ReportsService } from './reports.service';
import { ReportsRepository } from './reports.repository';

/** 店舗管理にレポート用 API を追加する */
@Module({
    imports: [AuthModule],
    controllers: [AdminReportsController],
    providers: [ReportsService, ReportsRepository]
})
export class ReportsModule {}
