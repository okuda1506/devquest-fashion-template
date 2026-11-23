import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule, configure } from '../api/src/app';

let app: INestApplication;
beforeAll(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication();
  configure(app);
  await app.init();
});
afterAll(async () => { await app?.close(); });

test('DEV-104: 公開向け絞り込み・件数・ページ分割から非公開商品を除外する', async () => {
  const server = app.getHttpServer();
  const all = await request(server).get('/api/products').expect(200);
  expect(all.body.items).not.toHaveLength(0);
  expect(all.body.items.every((item: { isPublished: boolean }) => item.isPublished)).toBe(true);
  const search = await request(server).get('/api/products').query({ q: 'ウールコート' }).expect(200);
  expect(search.body.items).toEqual([]);
  expect(search.body.total).toBe(0);
  const page = await request(server).get('/api/products').query({ category: 'outerwear', page: 1, limit: 1 }).expect(200);
  expect(page.body.items.map((item: { id: string }) => item.id)).toEqual(['field-jacket']);
  expect(page.body.total).toBe(1);
  const next = await request(server).get('/api/products').query({ category: 'outerwear', page: 2, limit: 1 }).expect(200);
  expect(next.body.items).toEqual([]);
});

test('DEV-104: 非公開商品は管理者だけが一覧で確認できる', async () => {
  const server = app.getHttpServer();
  await request(server).get('/api/admin/products').expect(401);
  const { body } = await request(server).post('/api/auth/admin/login').send({ email: 'admin@example.test', password: 'thread-admin' }).expect(201);
  const admin = await request(server).get('/api/admin/products').auth(body.token, { type: 'bearer' }).expect(200);
  expect(admin.body.map((item: { id: string }) => item.id)).toContain('draft-coat');
});
