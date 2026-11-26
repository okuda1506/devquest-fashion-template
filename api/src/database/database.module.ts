import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** 単一の Prisma クライアントをアプリ全体で共有する */
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class DatabaseModule {}
