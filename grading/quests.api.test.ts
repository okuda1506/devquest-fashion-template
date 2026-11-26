import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../api/src/app.module';
import { configure } from '../api/src/app.config';
import { PrismaService } from '../api/src/database/prisma.service';
import { hashPassword } from '../api/src/modules/auth/password';

let app: INestApplication;
let db: PrismaService;
let admin: string;
let user: string;
let other: string;
let shopper: string;
let otherShopper: string;
let prefix: string;
const auth = { type: 'bearer' } as const;
const address = {
    name: '演習 購入者',
    postalCode: '100-0001',
    prefecture: '東京都',
    city: '千代田区',
    line1: '1-2',
    line2: '',
    phone: '09012345678'
};

const http = () => request(app.getHttpServer());
const catalog = () => http().get('/api/products');
const adminProducts = () => http().get('/api/admin/products').auth(admin, auth);
const adminOrders = () => http().get('/api/admin/orders').auth(admin, auth);
const myOrders = () => http().get('/api/orders').auth(shopper, auth);
const inventory = (id: string) =>
    http()
        .patch('/api/admin/inventory/' + id)
        .auth(admin, auth);
const adjust = (id: string, delta: number) => inventory(id + '/adjust').send({ delta });
const status = (id: string) =>
    http()
        .patch('/api/admin/orders/' + id)
        .auth(admin, auth);
const adminOrder = (id: string) =>
    http()
        .get('/api/admin/orders/' + id)
        .auth(admin, auth);
const preview = () => http().post('/api/orders/preview').auth(shopper, auth).send({ shippingAddress: address });
const place = (quote: { checkoutId: string; version: string }) =>
    http()
        .post('/api/orders')
        .auth(shopper, auth)
        .send({ checkoutId: quote.checkoutId, version: quote.version, shippingAddress: address });
const cart = (id: string, quantity: number) =>
    http()
        .put('/api/cart/' + id)
        .auth(shopper, auth)
        .send({ quantity })
        .expect(200);
const itemIds = (items: { id: string }[]) => items.map(({ id }) => id);
const stock = async (id: string) => (await db.product.findUniqueOrThrow({ where: { id } })).stock;

beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configure(app);
    await app.init();
    db = app.get(PrismaService);
    admin = (
        await http()
            .post('/api/auth/admin/login')
            .send({ email: 'admin@example.test', password: 'thread-admin' })
            .expect(201)
    ).body.token;
});

beforeEach(async () => {
    prefix = 'quest-' + randomUUID();
    async function account(suffix: string) {
        const email = prefix + suffix + '@example.test';
        const { id } = await db.user.create({
            data: { email, name: '演習の顧客', passwordHash: hashPassword('thread-quest') }
        });
        const { body } = await http()
            .post('/api/auth/store/login')
            .send({ email, password: 'thread-quest' })
            .expect(201);
        return [id, body.token];
    }
    [user, shopper] = await account('-a');
    [other, otherShopper] = await account('-b');
});

afterEach(async () => {
    const where = { userId: { in: [user, other] } };
    await db.cartItem.deleteMany({ where });
    await db.order.deleteMany({ where });
    await db.product.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.user.deleteMany({ where: { id: where.userId } });
});

afterAll(async () => {
    await app?.close();
});

async function product(suffix = 'item', price = 1000, stock = 4, isPublished = true, category = 'tops') {
    const id = prefix + '-' + suffix;
    await db.product.create({ data: { id, name: id, description: '採点用', category, price, stock, isPublished } });
    return id;
}
async function order(
    suffix: string,
    options: { owner?: string; createdAt?: string; shipped?: boolean; item?: string } = {}
) {
    const id = prefix + '-' + suffix;
    await db.order.create({
        data: {
            id,
            userId: options.owner ?? user,
            total: 1000,
            status: options.shipped ? 'SHIPPED' : 'PLACED',
            createdAt: options.createdAt,
            items: options.item
                ? { create: { productId: options.item, quantity: 2, unitPrice: 500, name: '購入時の商品名' } }
                : undefined
        }
    });
    return id;
}
function criteria(id: number, checks: Record<number, () => Promise<void>>) {
    for (const [condition, check] of Object.entries(checks))
        test(`DEV-${id} criterion-${condition}: API の応答と保存結果`, check);
}

criteria(105, {
    1: async () => {
        const id = await product('adjust', 1000, 2);
        await adjust(id, 3).expect(200);
        expect(await stock(id)).toBe(5);
        await adjust(id, -1).expect(200);
        expect(await stock(id)).toBe(4);
    },
    2: async () => {
        const id = await product('adjust', 1000, 2);
        await adjust(id, -3).expect(409);
        expect(await stock(id)).toBe(2);
    },
    3: async () => {
        const id = await product('adjust', 1000, 2);
        await adjust(id, 0).expect(400);
        await adjust(id, 1.5).expect(400);
        await Promise.all([adjust(id, 2).expect(200), adjust(id, 3).expect(200)]);
        expect(await stock(id)).toBe(7);
    }
});

async function pricedProducts() {
    const a = await product('a', 900);
    const b = await product('b', 12100);
    const c = await product('c', 900);
    await product('draft', 0, 2, false);
    await product('bottoms', 0, 2, true, 'bottoms');
    return { a, b, c, query: { q: prefix, category: 'tops' } };
}
criteria(106, {
    1: async () => {
        const { a, b, c, query } = await pricedProducts();
        for (const [index, expected] of [a, c, b].entries()) {
            const { body } = await catalog()
                .query({ ...query, sort: 'price-asc', limit: 1, page: index + 1 })
                .expect(200);
            expect(itemIds(body.items)).toEqual([expected]);
        }
    },
    2: async () => {
        const { a, b, c, query } = await pricedProducts();
        for (const sort of ['price-desc', undefined]) {
            const { body } = await catalog()
                .query({ ...query, sort })
                .expect(200);
            expect(itemIds(body.items)).toEqual(sort ? [b, a, c] : [a, b, c]);
        }
    },
    3: async () => {
        const { query } = await pricedProducts();
        const { body } = await catalog()
            .query({ ...query, sort: 'price-asc', limit: 1 })
            .expect(200);
        expect(body.total).toBe(3);
        await catalog().query({ sort: 'unknown' }).expect(400);
    }
});

async function dates() {
    const a = await order('before', { createdAt: '2024-05-01T14:59:59Z' });
    const b = await order('first', { createdAt: '2024-05-01T15:00:00Z' });
    const c = await order('last', { createdAt: '2024-05-02T14:59:59Z' });
    const d = await order('after', { createdAt: '2024-05-02T15:00:00Z' });
    return { a, b, c, d };
}
const ownFixtures = (data: { id: string }[]) => itemIds(data).filter((id) => id.startsWith(prefix));
criteria(115, {
    1: async () => {
        const { b, c } = await dates();
        const { body } = await adminOrders().query({ from: '2024-05-02', to: '2024-05-02' }).expect(200);
        expect(ownFixtures(body)).toEqual([c, b]);
    },
    2: async () => {
        const { a, b, c, d } = await dates();
        expect(ownFixtures((await adminOrders().query({ from: '2024-05-02' }).expect(200)).body)).toEqual([d, c, b]);
        expect(ownFixtures((await adminOrders().query({ to: '2024-05-02' }).expect(200)).body)).toEqual([c, b, a]);
    },
    3: async () => {
        await adminOrders().query({ from: '2024-02-30' }).expect(400);
        await adminOrders().query({ from: '2024-05-03', to: '2024-05-02' }).expect(400);
        await http().get('/api/admin/orders?to=2024-05-02').expect(401);
    }
});

criteria(116, {
    1: async () => {
        const a = await product('a', 100, 0);
        const b = await product('b', 100, 3, false);
        await product('c', 100, 4);
        expect(ownFixtures((await adminProducts().query({ maxStock: 3 }).expect(200)).body)).toEqual([a, b]);
    },
    2: async () => {
        const a = await product('a', 100, 0);
        const b = await product('b', 100, 1);
        expect(ownFixtures((await adminProducts().query({ maxStock: 0 }).expect(200)).body)).toEqual([a]);
        expect(ownFixtures((await adminProducts().expect(200)).body)).toEqual([a, b]);
    },
    3: async () => {
        await adminProducts().query({ maxStock: -1 }).expect(400);
        await adminProducts().query({ maxStock: 1.5 }).expect(400);
        await http().get('/api/admin/products?maxStock=3').auth(shopper, auth).expect(403);
    }
});

criteria(125, {
    1: async () => {
        const { a, c, query } = await pricedProducts();
        const { body } = await catalog()
            .query({ ...query, minPrice: 900, maxPrice: 900 })
            .expect(200);
        expect(itemIds(body.items)).toEqual([a, c]);
    },
    2: async () => {
        const { a, b, query } = await pricedProducts();
        const { body } = await catalog()
            .query({ ...query, maxPrice: 900, limit: 1 })
            .expect(200);
        expect(body.total).toBe(2);
        expect(itemIds(body.items)).toEqual([a]);
        expect(
            itemIds(
                (
                    await catalog()
                        .query({ ...query, minPrice: 901 })
                        .expect(200)
                ).body.items
            )
        ).toEqual([b]);
    },
    3: async () => {
        for (const query of [{ minPrice: 10, maxPrice: 1 }, { minPrice: -1 }, { maxPrice: 0.5 }]) {
            await catalog().query(query).expect(400);
        }
    }
});

async function stocks() {
    const a = await product('empty', 100, 0);
    const b = await product('ready', 100, 1);
    await product('private', 100, 1, false);
    return { a, b };
}
criteria(126, {
    1: async () => {
        const { b } = await stocks();
        const { body } = await catalog().query({ q: prefix, inStock: 'true' }).expect(200);
        expect(itemIds(body.items)).toEqual([b]);
        expect(body.total).toBe(1);
    },
    2: async () => {
        const { a } = await stocks();
        expect(itemIds((await catalog().query({ q: prefix, inStock: 'false' }).expect(200)).body.items)).toEqual([a]);
    },
    3: async () => {
        const { a, b } = await stocks();
        expect(itemIds((await catalog().query({ q: prefix }).expect(200)).body.items)).toEqual([a, b]);
        await catalog().query({ inStock: 'sometimes' }).expect(400);
    }
});

criteria(127, {
    1: async () => {
        const placed = await order('placed');
        await order('shipped', { shipped: true });
        expect(ownFixtures((await adminOrders().query({ status: 'PLACED' }).expect(200)).body)).toEqual([placed]);
    },
    2: async () => {
        await order('placed');
        const shipped = await order('shipped', { shipped: true });
        expect(ownFixtures((await adminOrders().query({ status: 'SHIPPED' }).expect(200)).body)).toEqual([shipped]);
    },
    3: async () => {
        const { b, c } = await dates();
        await order('done', { shipped: true, createdAt: '2024-05-02T12:00:00Z' });
        expect(
            ownFixtures(
                (await adminOrders().query({ status: 'PLACED', from: '2024-05-02', to: '2024-05-02' }).expect(200)).body
            )
        ).toEqual([c, b]);
        await adminOrders().query({ status: 'INVALID' }).expect(400);
    }
});

const summary = () => http().get('/api/admin/inventory/summary').auth(admin, auth);
criteria(128, {
    1: async () => {
        const { body } = await summary().expect(200);
        expect(body).toMatchObject({
            totalProducts: expect.any(Number),
            outOfStock: expect.any(Number),
            lowStock: expect.any(Number)
        });
        expect(body.totalProducts).toBe(await db.product.count());
        expect(body.outOfStock).toBe(await db.product.count({ where: { stock: 0 } }));
        expect(body.lowStock).toBe(await db.product.count({ where: { stock: { gte: 1, lte: 3 } } }));
    },
    2: async () => {
        const { body: before } = await summary().expect(200);
        await product('zero', 100, 0);
        await product('low', 100, 3, false);
        await product('high', 100, 4);
        const { body } = await summary().expect(200);
        expect(body).toMatchObject({
            totalProducts: before.totalProducts + 3,
            outOfStock: before.outOfStock + 1,
            lowStock: before.lowStock + 1
        });
    },
    3: async () => {
        await summary().expect(200);
        await http().get('/api/admin/inventory/summary').expect(401);
        await http().get('/api/admin/inventory/summary').auth(shopper, auth).expect(403);
    }
});

const related = (id: string) => http().get('/api/products/' + id + '/related');
criteria(129, {
    1: async () => {
        const source = await product('source', 100, 4, true, 'accessories');
        const match = await product('match', 100, 4, true, 'accessories');
        const hidden = await product('hidden', 100, 4, false, 'accessories');
        const wrong = await product('wrong', 100, 4, true, 'tops');
        const { body } = await related(source).expect(200);
        expect(itemIds(body)).toContain(match);
        expect(itemIds(body)).not.toContain(hidden);
        expect(itemIds(body)).not.toContain(wrong);
    },
    2: async () => {
        const source = await product('source');
        await Promise.all(['a', 'b', 'c', 'd'].map((id) => product(id)));
        const expected = await db.product.findMany({
            where: { category: 'tops', isPublished: true, id: { not: source } },
            orderBy: { id: 'asc' },
            take: 3
        });
        expect(itemIds((await related(source).expect(200)).body)).toEqual(itemIds(expected));
    },
    3: async () => {
        const source = await product();
        const hidden = await product('hidden', 100, 4, false);
        await related(source).expect(200);
        await related(hidden).expect(404);
        await related(prefix + '-missing').expect(404);
    }
});

criteria(130, {
    1: async () => {
        const item = await product();
        const id = await order('receipt', { item, owner: other });
        expect((await adminOrder(id).expect(200)).body).toMatchObject({
            id,
            items: [{ productId: item, unitPrice: 500, quantity: 2 }],
            user: { name: '演習の顧客', email: prefix + '-b@example.test' }
        });
    },
    2: async () => {
        await adminOrder(await order('valid')).expect(200);
        await adminOrder(prefix + '-missing').expect(404);
    },
    3: async () => {
        const id = await order('valid');
        await adminOrder(id).expect(200);
        await http()
            .get('/api/admin/orders/' + id)
            .expect(401);
        await http()
            .get('/api/admin/orders/' + id)
            .auth(shopper, auth)
            .expect(403);
    }
});

async function checkoutFixture() {
    const a = await product('a');
    const b = await product('b');
    await cart(a, 2);
    await cart(b, 2);
    const { body } = await preview().expect(201);
    await db.product.update({ where: { id: a }, data: { stock: 1 } });
    return { a, b, quote: body };
}
criteria(108, {
    1: async () => {
        const { a } = await checkoutFixture();
        expect((await preview().expect(409)).body).toMatchObject({ code: 'INSUFFICIENT_STOCK', productIds: [a] });
    },
    2: async () => {
        const { a, quote } = await checkoutFixture();
        expect((await place(quote).expect(409)).body).toMatchObject({ code: 'INSUFFICIENT_STOCK', productIds: [a] });
        expect(await db.order.count({ where: { userId: user } })).toBe(0);
    },
    3: async () => {
        const { a, b, quote } = await checkoutFixture();
        const c = await product('c');
        await cart(c, 1);
        await db.product.update({ where: { id: b }, data: { stock: 0 } });
        const { body } = await place(quote).expect(409);
        expect(body.productIds).toEqual(expect.arrayContaining([a, b]));
        expect(body.productIds).toHaveLength(2);
        expect(await stock(c)).toBe(4);
    }
});

criteria(109, {
    1: async () => {
        const id = await order('ready', { shipped: true });
        await order('pending');
        await order('other', { shipped: true, owner: other });
        expect(itemIds((await myOrders().query({ status: 'SHIPPED' }).expect(200)).body)).toEqual([id]);
    }
});

criteria(117, {
    1: async () => {
        const id = await product('price', 4999);
        await cart(id, 1);
        expect((await preview().expect(201)).body).toMatchObject({ subtotal: 4999, shippingFee: 500, total: 5499 });
        await db.product.update({ where: { id }, data: { price: 5000 } });
        expect((await preview().expect(201)).body).toMatchObject({ subtotal: 5000, shippingFee: 0, total: 5000 });
    },
    2: async () => {
        const id = await product('price', 2500);
        await cart(id, 1);
        const quote = (await preview().expect(201)).body;
        const { body } = await place(quote).expect(201);
        expect(body.total).toBe(3000);
        expect((await db.order.findUniqueOrThrow({ where: { id: body.id } })).total).toBe(3000);
    }
});

criteria(135, {
    1: async () => {
        const id = await order('target');
        await order('another');
        await order('target-other', { owner: other });
        expect(itemIds((await myOrders().query({ number: 'target' }).expect(200)).body)).toEqual([id]);
    },
    2: async () => {
        const id = await order('target-shipped', { shipped: true });
        const pending = await order('target-placed');
        await order('another', { shipped: true });
        expect(itemIds((await myOrders().query({ number: 'target', status: 'SHIPPED' }).expect(200)).body)).toEqual([
            id
        ]);
        expect(itemIds((await myOrders().query({ number: '   ' }).expect(200)).body)).toContain(pending);
    }
});

const favorites = (token = shopper) => http().get('/api/favorites').auth(token, auth);
const addFavorite = (id: string, token = shopper) =>
    http()
        .post('/api/favorites/' + id)
        .auth(token, auth);
criteria(110, {
    1: async () => {
        const id = await product();
        await addFavorite(id).expect(201);
        await addFavorite(id).expect(201);
        expect(itemIds((await favorites().expect(200)).body)).toEqual([id]);
    },
    2: async () => {
        const id = await product();
        await addFavorite(id).expect(201);
        await addFavorite(id, otherShopper).expect(201);
        await http()
            .delete('/api/favorites/' + id)
            .auth(shopper, auth)
            .expect(200);
        expect((await favorites().expect(200)).body).toEqual([]);
        expect(itemIds((await favorites(otherShopper).expect(200)).body)).toEqual([id]);
    },
    3: async () => {
        const id = await product('hidden', 100, 4, false);
        await http().get('/api/favorites').expect(401);
        await addFavorite(id).expect(404);
        await addFavorite(prefix + '-missing').expect(404);
    }
});

const audit = (id: string) =>
    http()
        .get('/api/admin/inventory/' + id + '/history')
        .auth(admin, auth);
criteria(111, {
    1: async () => {
        const id = await product();
        await inventory(id).send({ stock: 7, reason: '検品後の入荷' }).expect(200);
        expect((await audit(id).expect(200)).body).toMatchObject([{ before: 4, after: 7, reason: '検品後の入荷' }]);
    },
    2: async () => {
        const id = await product();
        await inventory(id).send({ stock: 7 }).expect(200);
        await inventory(id).send({ stock: 8, reason: '追加' }).expect(200);
        const { body } = await audit(id).expect(200);
        expect(body).toMatchObject([
            { after: 8, operatorId: expect.any(String), createdAt: expect.any(String) },
            { after: 7 }
        ]);
        const operator = await db.user.findUniqueOrThrow({ where: { email: 'admin@example.test' } });
        expect(body[0].operatorId).toBe(operator.id);
        expect(Date.parse(body[0].createdAt)).toBeGreaterThanOrEqual(Date.parse(body[1].createdAt));
    },
    3: async () => {
        const id = await product();
        await inventory(id).send({ stock: 7, expectedStock: 9 }).expect(409);
        expect((await audit(id).expect(200)).body).toEqual([]);
        await http()
            .get('/api/admin/inventory/' + id + '/history')
            .auth(shopper, auth)
            .expect(403);
    }
});

const alertsPath = '/api/admin/inventory/alerts';
async function alerts(id: string) {
    const { body } = await http().get(alertsPath).auth(admin, auth).expect(200);
    return body.filter((item: { productId: string }) => item.productId === id);
}
criteria(119, {
    1: async () => {
        const id = await product();
        await inventory(id).send({ stock: 3 }).expect(200);
        expect(await alerts(id)).toMatchObject([{ productId: id }]);
    },
    2: async () => {
        const id = await product();
        for (const stock of [3, 2, 1]) await inventory(id).send({ stock }).expect(200);
        expect(await alerts(id)).toHaveLength(1);
        for (const stock of [5, 3]) await inventory(id).send({ stock }).expect(200);
        expect(await alerts(id)).toHaveLength(2);
    },
    3: async () => {
        const id = await product();
        await cart(id, 1);
        await place((await preview().expect(201)).body).expect(201);
        expect(await alerts(id)).toHaveLength(1);
        await http().get(alertsPath).auth(shopper, auth).expect(403);
    }
});

const email = (id: string, token = shopper) =>
    http()
        .post('/api/orders/' + id + '/confirmation-email')
        .auth(token, auth);
criteria(120, {
    1: async () => {
        const id = await order('ours');
        expect((await email(id).expect(202)).body).toMatchObject({ requestId: expect.any(String), status: 'QUEUED' });
    },
    2: async () => {
        const id = await order('ours');
        const second = await order('another');
        const [a, b] = await Promise.all([email(id).expect(202), email(id).expect(202)]);
        expect(a.body.requestId).toBe(b.body.requestId);
        expect((await email(second).expect(202)).body.requestId).not.toBe(a.body.requestId);
    },
    3: async () => {
        const id = await order('ours');
        await email(id, otherShopper).expect(404);
        await http()
            .post('/api/orders/' + id + '/confirmation-email')
            .expect(401);
    }
});

const csv = '/api/admin/orders/export.csv';
criteria(136, {
    1: async () => {
        await order('demo');
        const result = await http()
            .get(csv)
            .auth(admin, auth)
            .expect(200)
            .expect('Content-Type', /text\/csv/);
        expect(result.text.trim().split(/\r?\n/)[0]).toBe('orderId,status,total');
    },
    2: async () => {
        const placed = await order('placed');
        const shipped = await order('shipped', { shipped: true });
        const { text } = await http().get(csv).auth(admin, auth).query({ status: 'PLACED' }).expect(200);
        expect(
            text
                .trim()
                .split(/\r?\n/)
                .filter((line) => line.includes(placed))
        ).toEqual([placed + ',PLACED,1000']);
        expect(text).not.toContain(shipped);
    },
    3: async () => {
        await http().get(csv).auth(shopper, auth).expect(403);
        await http().get(csv).auth(admin, auth).query({ status: 'BAD' }).expect(400);
    }
});

criteria(137, {
    1: async () => {
        const item = await product();
        const id = await order('cancel', { item });
        await status(id).send({ status: 'CANCELLED' }).expect(200);
        expect(await stock(item)).toBe(6);
        expect((await adminOrder(id).expect(200)).body.status).toBe('CANCELLED');
    },
    2: async () => {
        const item = await product();
        const id = await order('cancel', { item });
        for (let i = 0; i < 2; i++) await status(id).send({ status: 'CANCELLED' }).expect(200);
        expect(await stock(item)).toBe(6);
    },
    3: async () => {
        const item = await product();
        const id = await order('shipment', { item });
        await status(id).send({ status: 'SHIPPED' }).expect(200);
        await status(id).send({ status: 'CANCELLED' }).expect(409);
        expect(await stock(item)).toBe(4);
        expect((await adminOrder(id).expect(200)).body.status).toBe('SHIPPED');
    }
});

criteria(138, {
    1: async () => {
        const id = await order('shipment');
        await status(id).send({ status: 'SHIPPED', trackingNumber: 'P-0123' }).expect(200);
        expect((await adminOrder(id).expect(200)).body.trackingNumber).toBe('P-0123');
    },
    2: async () => {
        const id = await order('shipment');
        const detail = () =>
            http()
                .get('/api/orders/' + id)
                .auth(shopper, auth);
        expect((await detail().expect(200)).body.trackingNumber).toBeNull();
        await status(id).send({ status: 'SHIPPED', trackingNumber: 'P-0123' }).expect(200);
        expect((await detail().expect(200)).body.trackingNumber).toBe('P-0123');
    },
    3: async () => {
        const id = await order('shipment');
        await status(id).send({ status: 'SHIPPED', trackingNumber: 'X Y' }).expect(400);
        await status(id)
            .send({ status: 'SHIPPED', trackingNumber: 'X'.repeat(31) })
            .expect(400);
        expect((await adminOrder(id).expect(200)).body.status).toBe('PLACED');
    }
});

const batch = (token = admin) => http().post('/api/admin/inventory/batch').auth(token, auth);
criteria(139, {
    1: async () => {
        const a = await product('a');
        const b = await product('b');
        await batch()
            .send([
                { productId: a, stock: 7, expectedStock: 4 },
                { productId: b, stock: 9, expectedStock: 4 }
            ])
            .expect(201);
        expect(await Promise.all([stock(a), stock(b)])).toEqual([7, 9]);
    },
    2: async () => {
        const a = await product('a');
        const b = await product('b');
        await batch()
            .send([
                { productId: a, stock: 7, expectedStock: 4 },
                { productId: b, stock: 9, expectedStock: 3 }
            ])
            .expect(409);
        expect(await Promise.all([stock(a), stock(b)])).toEqual([4, 4]);
    },
    3: async () => {
        const id = await product();
        const change = { productId: id, stock: 7, expectedStock: 4 };
        await batch().send([]).expect(400);
        await batch().send([change, change]).expect(400);
        await batch(shopper).send([change]).expect(403);
    }
});

const retire = (id: string, token = admin) =>
    http()
        .delete('/api/admin/products/' + id)
        .auth(token, auth);
criteria(140, {
    1: async () => {
        const id = await product();
        await retire(id).expect(200);
        await http()
            .get('/api/products/' + id)
            .expect(404);
        expect((await db.product.findUniqueOrThrow({ where: { id } })).isPublished).toBe(false);
    },
    2: async () => {
        const item = await product();
        const id = await order('before-retirement', { item });
        await retire(item).expect(200);
        expect((await adminOrder(id).expect(200)).body.items).toMatchObject([
            { productId: item, name: '購入時の商品名', quantity: 2 }
        ]);
        expect(await db.product.count({ where: { id: item } })).toBe(1);
    },
    3: async () => {
        const id = await product();
        await retire(prefix + '-missing').expect(404);
        await retire(id, shopper).expect(403);
    }
});
