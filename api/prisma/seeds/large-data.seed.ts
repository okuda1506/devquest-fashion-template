import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../src/database/prisma.service';
import { hashPassword } from '../../src/modules/auth/password';
import { sampleCustomerName } from './sample-customers';

const productCount = 3000;
const orderCount = 30000;
const customerCount = 600;
const start = Date.UTC(2025, 5, 5);
const catalog = [
    ['tops', 'コットンシャツ'],
    ['outerwear', 'ワークジャケット'],
    ['bottoms', 'テーパードパンツ'],
    ['accessories', 'キャンバストート']
] as const;
const collection = ['ベーシック', 'リラックス', 'ライトウェイト', 'ウォッシュド', 'デイリー'];

/** 同じ初期値から毎回同じ整数列を生成する */
function sequence() {
    let state = 42941;
    return (limit: number) => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return Math.floor((state / 2 ** 32) * limit);
    };
}

const orderReference = (index: number) => 'large-seed-order-' + String(index).padStart(6, '0');

/**
 * 商品コード・メール・注文参照キーで大量の架空データを一括投入する
 *
 * 既存レコードを上書きせず トランザクションで投入途中の状態を防ぐ
 * 演習用顧客のパスワードにはログインに使えないランダム値を使用する
 */
async function seedLarge(db: PrismaService) {
    const next = sequence();
    const products = Array.from({ length: productCount }, (_, index) => {
        const [category, model] = catalog[index % catalog.length];
        return {
            code: 'TH-B-' + String(index + 1).padStart(6, '0'),
            name: `${collection[next(collection.length)]} ${model} ${index + 1}`,
            description: '大規模データ演習用の商品',
            category,
            price: 900 + next(390) * 100,
            stock: index % 9 === 0 ? 0 : 1 + next(240),
            isPublished: index % 13 !== 0
        };
    });
    const passwordHash = hashPassword(randomBytes(32).toString('hex'));
    const customers = Array.from({ length: customerCount }, (_, index) => ({
        ...sampleCustomerName(index),
        email: `large-seed-${index}@example.test`,
        passwordHash
    }));
    await db.$transaction(
        async (tx) => {
            const categories = new Map((await tx.productCategory.findMany()).map(({ id, code }) => [code, id]));
            const existingProducts = new Set((await tx.product.findMany({
                where: { code: { startsWith: 'TH-B-' } },
                select: { code: true }
            })).map(({ code }) => code));
            const existingCustomers = new Set((await tx.customer.findMany({
                where: { email: { startsWith: 'large-seed-' } },
                select: { email: true }
            })).map(({ email }) => email));
            await tx.product.createMany({
                data: products
                    .filter(({ code }) => !existingProducts.has(code))
                    .map(({ category, ...product }) => ({ ...product, categoryId: categories.get(category)! })),
                skipDuplicates: true
            });
            await tx.customer.createMany({
                data: customers.filter(({ email }) => !existingCustomers.has(email)),
                skipDuplicates: true
            });
            const existingOrders = new Set((await tx.order.findMany({
                where: { reference: { startsWith: 'large-seed-order-' } },
                select: { reference: true }
            })).map(({ reference }) => reference));
            if (Array.from({ length: orderCount }, (_, index) => orderReference(index)).every((key) => existingOrders.has(key))) return;

            const productIds = new Map((await tx.product.findMany({
                where: { code: { in: products.map((product) => product.code) } },
                select: { id: true, code: true }
            })).map(({ id, code }) => [code, id]));
            const customerIds = new Map((await tx.customer.findMany({
                where: { email: { in: customers.map((customer) => customer.email) } },
                select: { id: true, email: true }
            })).map(({ id, email }) => [email, id]));
            for (let offset = 0; offset < orderCount; offset += 500) {
                const batch = Array.from({ length: 500 }, (_, row) => {
                    const index = offset + row;
                    const reference = orderReference(index);
                    const items = Array.from({ length: 1 + next(4) }, () => {
                        const product = products[next(productCount)];
                        return {
                            productId: productIds.get(product.code)!,
                            name: product.name,
                            unitPrice: product.price,
                            quantity: index % 97 === 0 ? 50 + next(100) : 1 + next(5)
                        };
                    });
                    const age = next(540);
                    return {
                        order: {
                            reference,
                            customerId: customerIds.get(customers[next(customerCount)].email)!,
                            status: age > 14 || next(3) === 0 ? ('SHIPPED' as const) : ('PLACED' as const),
                            createdAt: new Date(start + age * 86400000 + next(86400000)),
                            total: items.reduce((total, item) => total + item.unitPrice * item.quantity, 0)
                        },
                        items
                    };
                });
                const pending = batch.map(({ order }) => order).filter(({ reference }) => !existingOrders.has(reference));
                if (!pending.length) continue;
                const inserted = await tx.order.createManyAndReturn({
                    data: pending,
                    select: { id: true, reference: true },
                    skipDuplicates: true
                });
                const ids = new Map(inserted.map(({ id, reference }) => [reference, id]));
                const lines = batch.flatMap(({ order, items }) => {
                    const orderId = ids.get(order.reference);
                    return orderId === undefined ? [] : items.map((item) => ({ ...item, orderId }));
                });
                if (lines.length) await tx.orderItem.createMany({ data: lines });
            }
        },
        { timeout: 120000 }
    );
}

const db = new PrismaService();
seedLarge(db)
    .then(() => console.info('大量データを確認しました。商品 %d 件、受注 %d 件', productCount, orderCount))
    .catch(() => {
        console.error('大量データを投入できませんでした。開発用 DB の接続とマイグレーションを確認してください。');
        process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
