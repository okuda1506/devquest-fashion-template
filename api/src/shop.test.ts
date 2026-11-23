import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
    where: { id: sku }, update: { stock: 2, price: 3000 },
    create: { id: sku, name: '注文検証用商品', category: 'tops', description: '', price: 3000, stock: 2 },
  });
  const user = await db.user.upsert({
    where: { email }, update: {},
    create: { email, name: 'API テスト用ユーザー', passwordHash: hashPassword('thread-check') },
  });
  id = user.id;
  shopper = (await request(app.getHttpServer()).post('/api/auth/store/login').send({ email, password: 'thread-check' }).expect(201)).body.token;
  admin = (await request(app.getHttpServer()).post('/api/auth/admin/login').send({ email: 'admin@example.test', password: 'thread-admin' }).expect(201)).body.token;
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

test('同じ商品を並行して追加しても加算し、在庫を超える追加は拒否する', async () => {
  const server = app.getHttpServer();
  const path = '/api/cart/' + sku;
  const auth = { type: 'bearer' } as const;
  const add = (quantity: number) => request(server).post(path).auth(shopper, auth).send({ quantity });
  const [first, second] = await Promise.all([add(1).expect(201), add(1).expect(201)]);
  expect([first.body.quantity, second.body.quantity].sort()).toEqual([1, 2]);
  await add(1).expect(409);
  const cart = await request(server).get('/api/cart').auth(shopper, auth).expect(200);
  expect(cart.body).toMatchObject([{ productId: sku, quantity: 2 }]);
  await request(server).delete(path).auth(shopper, auth).expect(200);
});

test('配送先と確認済みの商品・金額でのみ注文を確定し、再送しても注文を重複させない', async () => {
  const server = app.getHttpServer();
  const shippingAddress = {
    name: 'テスト 購入者', postalCode: '1000001', prefecture: '東京都', city: '千代田区',
    line1: '1-2-3', line2: 'テストビル 101', phone: '090-1234-5678',
  };
  const preview = () => request(server).post('/api/orders/preview').auth(shopper, { type: 'bearer' }).send({ shippingAddress });
  await request(server).get('/api/cart').expect(401);
  await request(server).post('/api/orders').auth(shopper, { type: 'bearer' }).expect(400);
  await request(server).post('/api/orders/preview').auth(shopper, { type: 'bearer' }).send({ shippingAddress: [] }).expect(400);
  await request(server).put('/api/cart/' + sku).auth(shopper, { type: 'bearer' }).send({ quantity: 3 }).expect(200);
  await preview().expect(409);
  await request(server).put('/api/cart/' + sku).auth(shopper, { type: 'bearer' }).send({ quantity: 2 }).expect(200);
  const quoted = (await preview().expect(201)).body;
  expect(quoted.total).toBe(6000);
  expect(quoted.shippingAddress.postalCode).toBe('100-0001');
  const place = (quote: typeof quoted) => request(server).post('/api/orders').auth(shopper, { type: 'bearer' }).send({
    shippingAddress: quote.shippingAddress, version: quote.version, checkoutId: quote.checkoutId,
  });
  await place({ ...quoted, shippingAddress: { ...shippingAddress, city: '港区' } }).expect(409);
  await db.product.update({ where: { id: sku }, data: { price: 3100 } });
  await place(quoted).expect(409);
  expect((await db.product.findUniqueOrThrow({ where: { id: sku } })).stock).toBe(2);
  const fresh = (await preview().expect(201)).body;
  const [order, retry] = await Promise.all([place(fresh).expect(201), place(fresh).expect(201)]);
  expect(order.body.total).toBe(6200);
  expect(order.body.shippingAddress).toEqual(fresh.shippingAddress);
  expect(retry.body.id).toBe(order.body.id);
  expect((await place(fresh).expect(201)).body.id).toBe(order.body.id);
  expect(await db.order.count({ where: { userId: id } })).toBe(1);
  expect((await db.product.findUniqueOrThrow({ where: { id: sku } })).stock).toBe(0);
  expect((await request(server).get('/api/cart').auth(shopper, { type: 'bearer' }).expect(200)).body).toEqual([]);
  await request(server).get('/api/orders/' + order.body.id).auth(shopper, { type: 'bearer' }).expect(200);
  const other = await request(server).post('/api/auth/store/login')
    .send({ email: 'customer@example.test', password: 'thread-customer' }).expect(201);
  await request(server).get('/api/orders/' + order.body.id).auth(other.body.token, { type: 'bearer' }).expect(404);
  const orders = await request(server).get('/api/admin/orders').auth(admin, { type: 'bearer' }).expect(200);
  expect(orders.body.find((item: { id: string }) => item.id === order.body.id)?.shippingAddress).toEqual(fresh.shippingAddress);
  await preview().expect(400);
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

test('ログイン先・アカウントのロール・接続元が一致しない認証を拒否する', async () => {
  const server = app.getHttpServer();
  const customer = { email, password: 'thread-check' };
  const operator = { email: 'admin@example.test', password: 'thread-admin' };
  const counterpart = await request(server).post('/api/auth/admin/login').send(customer).expect(401);
  const wrongPassword = await request(server).post('/api/auth/admin/login').send({ ...operator, password: 'wrong' }).expect(401);
  const unknown = await request(server).post('/api/auth/admin/login').send({ ...operator, email: 'unknown@example.test' }).expect(401);
  expect(counterpart.body).toEqual(wrongPassword.body);
  expect(counterpart.body).toEqual(unknown.body);
  expect(counterpart.body.token).toBeUndefined();
  await request(server).post('/api/auth/store/login').send(operator).expect(401);
  await request(server).post('/api/auth/admin/login').set('Origin', 'http://localhost:5174').send(operator).expect(401);
  await request(server).post('/api/auth/store/login').set('Origin', 'http://localhost:5175').send(customer).expect(401);
  await request(server).post('/api/auth/store/login').set('Origin', 'http://localhost:5174').send(customer).expect(201);
  await request(server).post('/api/auth/admin/login').set('Origin', 'http://localhost:5175').send(operator).expect(201);
});

test('用途の異なるセッション、期限切れトークン、無許可オリジンを受け付けない', async () => {
  const server = app.getHttpServer();
  await request(server).get('/api/auth/store/session').auth(shopper, { type: 'bearer' }).expect(200);
  await request(server).get('/api/auth/admin/session').auth(admin, { type: 'bearer' }).expect(200);
  await request(server).get('/api/auth/admin/session').auth(shopper, { type: 'bearer' }).expect(403);
  await request(server).get('/api/auth/store/session').auth(admin, { type: 'bearer' }).expect(403);
  await request(server).get('/api/admin/orders').expect(401);
  await request(server).get('/api/admin/orders').auth(shopper, { type: 'bearer' }).expect(403);
  await request(server).get('/api/cart').auth(admin, { type: 'bearer' }).expect(403);
  await request(server).post('/api/orders').auth(admin, { type: 'bearer' }).expect(403);
  await request(server).get('/api/admin/orders').set('Origin', 'http://localhost:5174').auth(admin, { type: 'bearer' }).expect(403);
  const jwt = app.get(JwtService);
  const expired = jwt.sign({ sub: id, exp: Math.floor(Date.now() / 1000) - 10 }, { issuer: 'thread-api', audience: 'thread-store' });
  const incorrectAudience = jwt.sign({ sub: id }, { issuer: 'thread-api', audience: 'thread-admin', expiresIn: '1m' });
  const legacy = jwt.sign({ sub: id }, { expiresIn: '1m' });
  for (const token of [expired, incorrectAudience, legacy, 'invalid']) {
    await request(server).get('/api/cart').auth(token, { type: 'bearer' }).expect(401);
  }
  await request(server).options('/api/admin/orders').set('Origin', 'http://localhost:5175')
    .set('Access-Control-Request-Method', 'GET').expect(204).expect('Access-Control-Allow-Origin', 'http://localhost:5175');
  const other = await request(server).get('/api/products').set('Origin', 'http://localhost:9999').expect(200);
  expect(other.headers['access-control-allow-origin']).toBeUndefined();
});
