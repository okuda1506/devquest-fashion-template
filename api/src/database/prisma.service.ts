import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { databaseUrl, logLevel } from '../config/environment';
import { logEvents } from '../common/logging/log-events';
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
        const connectionString = databaseUrl();
        const debug = logLevel() === 'debug';
        super({
            adapter: new PrismaPg({ connectionString }),
            log: debug ? [{ emit: 'event', level: 'query' }] : []
        });
        if (debug) {
            this.$on('query', ({ duration }) => logEvent('debug', logEvents.query, { elapsedMs: duration }));
        }
    }

    /**
     * NestJS の終了に合わせて DB 接続を解放する
     */
    async onModuleDestroy() {
        await this.$disconnect();
    }
}
