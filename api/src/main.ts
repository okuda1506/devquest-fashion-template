import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { apiPort } from './config/environment';
import { configure } from './app.config';

/** リポジトリ直下の環境変数を読み込みローカル API を起動する */
async function main() {
    // ワークスペース実行時のカレントディレクトリに依存せずルートの .env を参照する
    const envFile = resolve(__dirname, '../../.env');
    if (existsSync(envFile)) loadEnvFile(envFile);

    if (process.env.npm_lifecycle_event === 'dev') {
        try {
            require.resolve('@thread/shared/session');
        } catch {
            console.warn(
                'EC・管理画面の共有パッケージが見つかりません。リポジトリ直下で npm ci を実行してから再起動してください。'
            );
        }
    }

    const app = await NestFactory.create(AppModule);
    configure(app);
    app.enableShutdownHooks();
    await app.listen(apiPort(), '127.0.0.1');
}
void main();
