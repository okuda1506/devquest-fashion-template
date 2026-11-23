import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule, configure } from './app';
import { Db } from './db';
import { hashPassword } from './auth/password';

let app: INestApplication;
let db: Db;
let id: string;
let shopper: string;
let admin: string;
const sku = 'test-purchase';
const email = 'integration-check@example.test';

beforeAll(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication();
  configure(app);
  await app.init();
  db = app.get(Db);
  await db.product.upsert({
    where: { id: sku }, update: { stock: 2 },
    create: { id: sku, name: '注文検証用商品', category: 'tops', description: '', price: 3000, stock: 2 },
  });
  const user = await db.user.upsert({
    where: { email }, update: {},
    create: { email, name: 'API テスト用ユーザー', passwordHash: hashPassword('thread-check') },
  });
  id = user.id;
  shopper = (await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'thread-check' }).expect(201)).body.token;
  admin = (await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'admin@example.test', password: 'thread-admin' }).expect(201)).body.token;
});

afterAll(async () => {
  if (db && id) {
    await db.order.deleteMany({ where: { userId: id } });
    await db.user.delete({ where: { id } });
    await db.product.delete({ where: { id: sku } });
  }
  await app?.close();
});

test('公開商品を検索でき、非公開商品の詳細と不正な入力は拒否する', async () => {
  const server = app.getHttpServer();
  const res = await request(server).get('/api/products').query({ q: 'リネン', category: 'tops', limit: 1 }).expect(200);
  expect(res.body.items[0].id).toBe('linen-shirt');
  await request(server).get('/api/products/draft-coat').expect(404);
  await request(server).get('/api/products?page=0').expect(400);
});

test('認証済みの注文を保存し、在庫不足では全体を取り消す', async () => {
  const server = app.getHttpServer();
  await request(server).get('/api/cart').expect(401);
  await request(server).put('/api/cart/' + sku).auth(shopper, { type: 'bearer' }).send({ quantity: 3 }).expect(200);
  await request(server).post('/api/orders').auth(shopper, { type: 'bearer' }).expect(409);
  await request(server).put('/api/cart/' + sku).auth(shopper, { type: 'bearer' }).send({ quantity: 2 }).expect(200);
  const order = await request(server).post('/api/orders').auth(shopper, { type: 'bearer' }).expect(201);
  expect(order.body.total).toBe(6000);
  expect((await db.product.findUniqueOrThrow({ where: { id: sku } })).stock).toBe(0);
  const orders = await request(server).get('/api/orders').auth(shopper, { type: 'bearer' }).expect(200);
  expect(orders.body.map((item: { id: string }) => item.id)).toContain(order.body.id);
  await request(server).post('/api/orders').auth(shopper, { type: 'bearer' }).expect(400);
});

test('商品・在庫・注文の管理操作を管理者だけに許可する', async () => {
  const server = app.getHttpServer();
  await request(server).get('/api/admin/products').auth(shopper, { type: 'bearer' }).expect(403);
  const res = await request(server).get('/api/admin/products').auth(admin, { type: 'bearer' }).expect(200);
  expect(res.body.map((item: { id: string }) => item.id)).toContain('draft-coat');
  await request(server).patch('/api/admin/inventory/' + sku).auth(admin, { type: 'bearer' }).send({ stock: -1 }).expect(400);
  await request(server).patch('/api/admin/inventory/' + sku).auth(admin, { type: 'bearer' }).send({ stock: 7 }).expect(200);
  await request(server).get('/api/admin/orders').auth(admin, { type: 'bearer' }).expect(200);
});
