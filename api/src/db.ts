import { Global, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

@Injectable()
export class Db extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL を指定してください。');
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleDestroy() { await this.$disconnect(); }
}

@Global()
@Module({ providers: [Db], exports: [Db] })
export class DbModule {}
