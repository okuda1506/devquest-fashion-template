import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configure } from '../src/app.config';
import { PrismaService } from '../src/database/prisma.service';
import { hashPassword } from '../src/modules/auth/password';
import { mockCards } from '../src/modules/payments/mock-cards';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../src/modules/payments/payment-provider';

const shippingAddress = {
    name: '検証 花子',
    postalCode: '100-0001',
    prefecture: '東京都',
    city: '千代田区',
    line1: '試験住所 1-1',
    phone: '000-0000-0000'
};
const cardPayment = (number: string) => ({
    method: 'CREDIT_CARD',
    card: { number, expiry: mockCards.expiry, securityCode: mockCards.securityCode }
});
const stock = 8;
const price = 5250;

let app: INestApplication;
let db: PrismaService;
let customerId: number | undefined;
let sku: string;
let shopper: string;
let admin: string;
let charge: jest.SpiedFunction<PaymentProvider['charge']>;
let originalLogLevel: string | undefined;

const http = () => request(app.getHttpServer());
const authorization = () => ({ Authorization: 'Bearer ' + shopper });

beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configure(app);
    await app.init();
    db = app.get(PrismaService);
    admin = (await http().post('/api/auth/admin/login')
        .send({ email: 'admin@example.test', password: 'thread-admin' }).expect(201)).body.token;
});

beforeEach(async () => {
    sku = 'payment-check-' + randomUUID();
    await db.product.create({
        data: { code: sku, name: '決済検証用商品', description: '', price, stock, productCategory: { connect: { code: 'tops' } } }
    });
    const email = sku + '@example.test';
    const password = 'local-payment-test';
    const customer = await db.customer.create({
        data: { email, lastName: '決済検証', passwordHash: hashPassword(password) }
    });
    customerId = customer.id;
    shopper = (await http().post('/api/auth/store/login').send({ email, password }).expect(201)).body.token;
    charge = jest.spyOn(app.get<PaymentProvider>(PAYMENT_PROVIDER), 'charge');
    originalLogLevel = process.env.THREAD_LOG_LEVEL;
});

afterEach(async () => {
    jest.restoreAllMocks();
    if (originalLogLevel === undefined) delete process.env.THREAD_LOG_LEVEL;
    else process.env.THREAD_LOG_LEVEL = originalLogLevel;
    const product = await db.product.findUnique({ where: { code: sku } });
    if (product) await db.order.deleteMany({ where: { items: { some: { productId: product.id } } } });
    if (customerId) await db.customer.delete({ where: { id: customerId } });
    if (product) await db.product.delete({ where: { id: product.id } });
    customerId = undefined;
});

afterAll(async () => {
    await app?.close();
});

/**
 * 会員カートに商品を入れて確定 API の共通入力を返す
 */
async function memberQuote() {
    await http().post('/api/cart/' + sku).set(authorization()).send({ quantity: 1 }).expect(201);
    const { body } = await http().post('/api/orders/preview').set(authorization()).send({ shippingAddress }).expect(201);
    return { checkoutId: body.checkoutId, version: body.version, shippingAddress: body.shippingAddress };
}

test('会員は模擬決済の否認後に同じ見積もりでやり直せる', async () => {
    process.env.THREAD_LOG_LEVEL = 'info';
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const quote = await memberQuote();

    await http().post('/api/orders').set(authorization())
        .send({ ...quote, payment: cardPayment(mockCards.declined) }).expect(402)
        .expect(({ body }) => expect(body.code).toBe('PAYMENT_DECLINED'));
    expect(await db.order.findUnique({ where: { reference: quote.checkoutId } })).toBeNull();
    expect((await db.product.findUniqueOrThrow({ where: { code: sku } })).stock).toBe(stock);
    await http().get('/api/cart').set(authorization()).expect(200)
        .expect(({ body }) => expect(body).toMatchObject([{ quantity: 1 }]));

    const { body: approved } = await http().post('/api/orders').set(authorization())
        .send({ ...quote, payment: cardPayment(mockCards.approved) }).expect(201);
    expect(approved).toMatchObject({
        orderNumber: expect.stringMatching(/^TH-\d+$/),
        paymentMethod: 'CREDIT_CARD',
        paymentStatus: 'PAID',
        paymentPaidAt: expect.any(String),
        paymentTransactionId: 'mock_' + quote.checkoutId
    });
    expect(charge).toHaveBeenLastCalledWith(expect.objectContaining({ amount: price }));
    const { body: history } = await http().get('/api/orders').set(authorization()).expect(200);
    expect(history.find((order: { id: string }) => order.id === approved.id)).toMatchObject({
        paymentMethod: 'CREDIT_CARD',
        paymentStatus: 'PAID'
    });
    const { body: adminOrders } = await http().get('/api/admin/orders').auth(admin, { type: 'bearer' }).expect(200);
    expect(adminOrders.find((order: { id: string }) => order.id === approved.id)).toMatchObject({
        paymentPaidAt: approved.paymentPaidAt,
        paymentTransactionId: approved.paymentTransactionId
    });
    const events = [...info.mock.calls, ...warn.mock.calls].map(([message]) => JSON.parse(String(message)));
    expect(events).toEqual(expect.arrayContaining([
        expect.objectContaining({ event: 'payments.started', orderId: quote.checkoutId, at: expect.any(String) }),
        expect.objectContaining({ event: 'payments.failed', errorCode: 'PAYMENT_DECLINED',
            orderId: quote.checkoutId, transactionId: approved.paymentTransactionId }),
        expect.objectContaining({ event: 'payments.succeeded', orderId: quote.checkoutId,
            transactionId: approved.paymentTransactionId })
    ]));
    expect(JSON.stringify(events)).not.toContain(mockCards.approved);
    expect(JSON.stringify(events)).not.toContain(mockCards.declined);
    expect(JSON.stringify(events)).not.toContain('securityCode');
});

test('テストカード以外・不正な有効期限やコード・金額改変を拒否する', async () => {
    const quote = await memberQuote();
    for (const payment of [
        cardPayment('0000000000000000'),
        { method: 'CREDIT_CARD', card: { ...cardPayment(mockCards.approved).card, expiry: '01/27' } },
        { method: 'CREDIT_CARD', card: { ...cardPayment(mockCards.approved).card, securityCode: '999' } },
        { method: 'CREDIT_CARD' },
        { method: 'CASH_ON_DELIVERY', card: cardPayment(mockCards.approved).card }
    ]) {
        await http().post('/api/orders').set(authorization()).send({ ...quote, payment }).expect(400);
    }
    await http().post('/api/orders').set(authorization())
        .send({ ...quote, amount: 1, payment: cardPayment(mockCards.approved) }).expect(400);
    await db.product.update({ where: { code: sku }, data: { price: price + 100 } });
    await http().post('/api/orders').set(authorization())
        .send({ ...quote, payment: cardPayment(mockCards.approved) }).expect(409);
    expect(charge).not.toHaveBeenCalled();
    expect(await db.order.findUnique({ where: { reference: quote.checkoutId } })).toBeNull();
    expect((await db.product.findUniqueOrThrow({ where: { code: sku } })).stock).toBe(stock);
});

test('ゲストが同時送信や応答後に再送しても決済と在庫減算が重複しない', async () => {
    const headers = { Authorization: 'Guest ' + randomBytes(32).toString('hex') };
    const input = { shippingAddress, email: 'private-guest@example.test', items: [{ productId: sku, quantity: 2 }] };
    const { body: preview } = await http().post('/api/guest-orders/preview').set(headers).send(input).expect(201);
    const payload = { ...input, checkoutId: preview.checkoutId, version: preview.version, payment: cardPayment(mockCards.approved) };
    const submit = () => http().post('/api/guest-orders').set(headers).send(payload).expect(201);
    const [first, second] = await Promise.all([submit(), submit()]);
    const replay = await submit();
    expect(first.body.id).toBe(second.body.id);
    expect(first.body.paymentTransactionId).toBe(second.body.paymentTransactionId);
    expect(first.body.paymentTransactionId).toBe(replay.body.paymentTransactionId);
    expect(charge).toHaveBeenCalledTimes(1);
    expect(charge).toHaveBeenCalledWith(expect.objectContaining({ amount: price * 2 }));
    expect(await db.order.count({ where: { reference: preview.checkoutId, paymentStatus: 'PAID' } })).toBe(1);
    expect((await db.product.findUniqueOrThrow({ where: { code: sku } })).stock).toBe(stock - 2);
});

test('既存形式と代引きの指定ではカード決済を呼ばず支払い待ちになる', async () => {
    const quote = await memberQuote();
    const { body } = await http().post('/api/orders').set(authorization()).send(quote).expect(201);
    expect(body).toMatchObject({
        paymentMethod: 'CASH_ON_DELIVERY', paymentStatus: 'PENDING',
        paymentPaidAt: null, paymentTransactionId: null
    });
    await http().post('/api/orders').set(authorization())
        .send({ ...quote, payment: { method: 'CASH_ON_DELIVERY' } }).expect(201)
        .expect(({ body: replay }) => expect(replay.id).toBe(body.id));
    expect(charge).not.toHaveBeenCalled();
});

test('プロバイダー障害でも注文は保存せず内部エラーを応答へ流さない', async () => {
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    const quote = await memberQuote();
    charge.mockRejectedValueOnce(new Error('external provider private detail'));
    const { body } = await http().post('/api/orders').set(authorization())
        .send({ ...quote, payment: cardPayment(mockCards.approved) }).expect(503);
    expect(body.code).toBe('PAYMENT_UNAVAILABLE');
    expect(JSON.stringify(body)).not.toContain('external provider private detail');
    const events = errorLog.mock.calls.map(([message]) => JSON.parse(String(message)));
    expect(events).toEqual(expect.arrayContaining([
        expect.objectContaining({ event: 'payments.failed', orderId: quote.checkoutId, errorCode: 'PAYMENT_UNAVAILABLE' })
    ]));
    expect(JSON.stringify(events)).not.toContain('external provider private detail');
    expect(await db.order.findUnique({ where: { reference: quote.checkoutId } })).toBeNull();
    expect((await db.product.findUniqueOrThrow({ where: { code: sku } })).stock).toBe(stock);
});
