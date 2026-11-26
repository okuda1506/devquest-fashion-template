import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { logEvent } from '../common/logging/logger';
import { PrismaClient } from '../generated/prisma/client';

/**
 * アプリケーション内で共有する PostgreSQL 接続
 */
@Injectable()
export class PrismaService
    extends PrismaClient<{ adapter: PrismaPg; log: { emit: 'event'; level: 'query' }[] }>
    implements OnModuleDestroy
{
    /**
     * 環境変数で指定された接続先で Prisma クライアントを初期化する
     */
    constructor() {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) throw new Error('DATABASE_URL を指定してください。');
        super({
            adapter: new PrismaPg({ connectionString }),
            log: process.env.THREAD_LOG_LEVEL === 'debug' ? [{ emit: 'event', level: 'query' }] : []
        });
        if (process.env.THREAD_LOG_LEVEL === 'debug') {
            this.$on('query', ({ duration }) => logEvent('debug', 'db.query', { elapsedMs: duration }));
        }
    }

    /**
     * NestJS の終了に合わせて DB 接続を解放する
     */
    async onModuleDestroy() {
        await this.$disconnect();
    }
}
