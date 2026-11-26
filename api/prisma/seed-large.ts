import { randomBytes } from 'node:crypto';
import { Db } from '../src/db';
import { hashPassword } from '../src/auth/password';

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

const seedId = (type: string, number: number) => `large-seed-${type}-${String(number).padStart(6, '0')}`;

/**
 * 一意な固定 ID で大量の架空データを一括投入する
 *
 * 既存レコードを上書きせず トランザクションで投入途中の状態を防ぐ
 * 演習用顧客のパスワードにはログインに使えないランダム値を使用する
 */
async function seedLarge(db: Db) {
    const next = sequence();
    const products = Array.from({ length: productCount }, (_, index) => {
        const [category, model] = catalog[index % catalog.length];
        return {
            id: seedId('product', index),
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
        id: seedId('customer', index),
        name: '演習用顧客 ' + (index + 1),
        email: `large-seed-${index}@example.test`,
        passwordHash
    }));
    await db.$transaction(
        async (tx) => {
            await tx.product.createMany({ data: products, skipDuplicates: true });
            await tx.user.createMany({ data: customers, skipDuplicates: true });
            for (let offset = 0; offset < orderCount; offset += 500) {
                const batch = Array.from({ length: 500 }, (_, row) => {
                    const index = offset + row;
                    const id = seedId('order', index);
                    const items = Array.from({ length: 1 + next(4) }, (_, position) => {
                        const product = products[next(productCount)];
                        return {
                            id: id + '-' + position,
                            orderId: id,
                            productId: product.id,
                            name: product.name,
                            unitPrice: product.price,
                            quantity: index % 97 === 0 ? 50 + next(100) : 1 + next(5)
                        };
                    });
                    const age = next(540);
                    return {
                        order: {
                            id,
                            userId: customers[next(customerCount)].id,
                            status: age > 14 || next(3) === 0 ? ('SHIPPED' as const) : ('PLACED' as const),
                            createdAt: new Date(start + age * 86400000 + next(86400000)),
                            total: items.reduce((total, item) => total + item.unitPrice * item.quantity, 0)
                        },
                        items
                    };
                });
                await tx.order.createMany({ data: batch.map(({ order }) => order), skipDuplicates: true });
                await tx.orderItem.createMany({ data: batch.flatMap(({ items }) => items), skipDuplicates: true });
            }
        },
        { timeout: 120000 }
    );
}

const db = new Db();
seedLarge(db)
    .then(() => console.info('大量データを確認しました。商品 %d 件、受注 %d 件', productCount, orderCount))
    .catch(() => {
        console.error('大量データを投入できませんでした。開発用 DB の接続とマイグレーションを確認してください。');
        process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
