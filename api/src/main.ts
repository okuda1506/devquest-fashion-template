import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule, configure } from './app';

async function main() {
  const app = await NestFactory.create(AppModule);
  configure(app);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.THREAD_PORT ?? 3001), '127.0.0.1');
}
void main();
