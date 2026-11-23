import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { NestFactory } from '@nestjs/core';
import { AppModule, configure } from './app';

async function main() {
  // npm ワークスペースでは API フォルダで実行されるため、リポジトリ直下を参照する。
  const envFile = resolve(__dirname, '../../.env');
  if (existsSync(envFile)) loadEnvFile(envFile);

  if (process.env.npm_lifecycle_event === 'dev') {
    try {
      require.resolve('@thread/shared/session');
    } catch {
      console.warn('EC・管理画面の共有パッケージが見つかりません。リポジトリ直下で npm ci を実行してから再起動してください。');
    }
  }

  const app = await NestFactory.create(AppModule);
  configure(app);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.THREAD_PORT ?? 3001), '127.0.0.1');
}
void main();
