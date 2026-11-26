import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../api/src/app.module';
import { configure } from '../api/src/app.config';
import { PrismaService } from '../api/src/database/prisma.service';

let app: INestApplication;
let db: PrismaService;
let admin: string;
let customer: string;
let queries = 0;
const fixture = 'grade-operations-';
const auth = { type: 'bearer' } as const;
const http = () => request(app.getHttpServer());
const report = (day: string) => http().get('/api/admin/reports/daily-sales').query({ day }).auth(admin, auth);
const sales = () => http().get('/api/admin/reports/product-sales').query({ category: 'tops' }).auth(admin, auth);
const productId = (index: number) => fixture + String(index).padStart(2, '0');
const day = '2092-08-18';
const nextDay = '2092-08-19';
let originalLogLevel: string | undefined;

beforeAll(async () => {
    originalLogLevel = process.env.THREAD_LOG_LEVEL;
    process.env.THREAD_LOG_LEVEL = 'debug';
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    if (originalLogLevel === undefined) delete process.env.THREAD_LOG_LEVEL;
    else process.env.THREAD_LOG_LEVEL = originalLogLevel;
    app = module.createNestApplication();
    configure(app);
    await app.init();
    db = app.get(PrismaService);
    db.$on('query', () => {
        queries++;
    });
    const adminLogin = await http()
        .post('/api/auth/admin/login')
        .send({ email: 'admin@example.test', password: 'thread-admin' })
        .expect(201);
    admin = adminLogin.body.token;
    const customerLogin = await http()
        .post('/api/auth/store/login')
        .send({ email: 'customer@example.test', password: 'thread-customer' })
        .expect(201);
    customer = customerLogin.body.token;
    const owner = await db.user.findUniqueOrThrow({ where: { email: 'customer@example.test' } });
    await db.product.createMany({
        data: Array.from({ length: 25 }, (_, index) => ({
            id: productId(index),
            name: '売上集計の採点商品',
            description: '採点用',
            stock: 20,
            price: 600,
            category: 'tops',
            isPublished: index !== 2
        }))
    });
    for (const [suffix, createdAt, total, status, quantity] of [
        ['before', '2092-08-17T23:59:59.999Z', 600, 'SHIPPED', 1],
        ['start', day + 'T00:00:00.000Z', 1200, 'PLACED', 2],
        ['end', day + 'T23:59:59.999Z', 1800, 'SHIPPED', 3],
        ['after', nextDay + 'T00:00:00.000Z', 2400, 'SHIPPED', 4]
    ] as const) {
        await db.order.create({
            data: {
                id: fixture + suffix,
                userId: owner.id,
                createdAt: new Date(createdAt),
                total,
                status,
                items: { create: { productId: productId(2), name: '売上集計の採点商品', unitPrice: 600, quantity } }
            }
        });
    }
});

afterAll(async () => {
    if (!app || !db) return;
    await db.order.deleteMany({ where: { id: { startsWith: fixture } } });
    await db.product.deleteMany({ where: { id: { startsWith: fixture } } });
    await app.close();
});

test('DEV-141 criterion-1: 売上のない日はゼロを返す', async () => {
    await report('2092-08-15').expect(200, { day: '2092-08-15', orders: 0, total: 0 });
});
test('DEV-141 criterion-2: 注文がある日は件数と合計を返す', async () => {
    await report(nextDay).expect(200, { day: nextDay, orders: 1, total: 2400 });
});
test('DEV-141 criterion-3: 不正な日付と権限なしを拒否する', async () => {
    await report('2092-02-31').expect(400);
    await http()
        .get('/api/admin/reports/daily-sales?day=' + day)
        .auth(customer, auth)
        .expect(403);
});
test('DEV-142 criterion-1: 前日末尾と翌日開始の注文をそれぞれ計上する', async () => {
    await report('2092-08-17').expect(200, { day: '2092-08-17', orders: 1, total: 600 });
    await report(nextDay).expect(200, { day: nextDay, orders: 1, total: 2400 });
});
test('DEV-142 criterion-2: 翌日ゼロ時の注文を除外する', async () => {
    await report(day).expect(200, { day, orders: 2, total: 3000 });
});
test('DEV-142 criterion-3: 翌日に同じ注文を一度だけ計上する', async () => {
    await report(nextDay).expect(200, { day: nextDay, orders: 1, total: 2400 });
});
test('DEV-143 criterion-1: 明細の販売点数を商品別に集計しゼロ件も返す', async () => {
    const result = await sales().expect(200);
    const rows = result.body.filter(({ id }: { id: string }) => id.startsWith(fixture));
    expect(rows).toEqual(
        Array.from({ length: 25 }, (_, index) => ({
            id: productId(index),
            name: '売上集計の採点商品',
            unitsSold: index === 2 ? 10 : 0
        }))
    );
});
test('DEV-143 criterion-2: 対象商品の増加にかかわらず DB への問い合わせが4回以内', async () => {
    queries = 0;
    const result = await sales().expect(200);
    expect(result.body.length).toBeGreaterThanOrEqual(25);
    expect(queries).toBeGreaterThan(0);
    expect(queries).toBeLessThanOrEqual(4);
});
test('DEV-143 criterion-3: カテゴリーで絞り込み権限と入力を検証する', async () => {
    await http()
        .get('/api/admin/reports/product-sales?category=outerwear')
        .auth(admin, auth)
        .expect(200)
        .expect(({ body }) => expect(body.map(({ id }: { id: string }) => id)).not.toContain(productId(0)));
    await http().get('/api/admin/reports/product-sales?category=invalid').auth(admin, auth).expect(400);
    await http().get('/api/admin/reports/product-sales?category=tops').auth(customer, auth).expect(403);
});
