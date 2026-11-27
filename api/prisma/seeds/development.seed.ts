import { PrismaService } from '../../src/database/prisma.service';
import { hashPassword } from '../../src/modules/auth/password';
import { developmentCatalog } from './development-catalog';

const db = new PrismaService();
const products = [
    {
        code: 'linen-shirt',
        name: 'リネンブレンドシャツ',
        category: 'tops',
        description: '軽く風を通す、ゆとりのある一枚。',
        price: 6800,
        stock: 14
    },
    {
        code: 'cotton-tee',
        name: 'ヘビーコットン T シャツ',
        category: 'tops',
        description: '丈夫で透けにくいコットン素材。',
        price: 2900,
        stock: 0
    },
    {
        code: 'field-jacket',
        name: 'フィールドジャケット',
        category: 'outerwear',
        description: '季節の変わり目に重ねやすいジャケット。',
        price: 14800,
        stock: 3
    },
    {
        code: 'tapered-pants',
        name: 'テーパードトラウザー',
        category: 'bottoms',
        description: '腰回りにはゆとりを、裾はすっきり。',
        price: 9200,
        stock: 12
    },
    {
        code: 'canvas-tote',
        name: 'キャンバストート',
        category: 'accessories',
        description: '毎日の荷物が入る厚手のトート。',
        price: 3900,
        stock: 10
    },
    {
        code: 'draft-coat',
        name: 'ウールコート（発売前）',
        category: 'outerwear',
        description: '発売準備中の管理用商品。',
        price: 24000,
        stock: 5,
        isPublished: false
    }
];

/** 標準の商品と演習用アカウント・受注を既存レコードを保持しながら投入する */
async function seed() {
    const categories = new Map((await db.productCategory.findMany()).map(({ id, code }) => [code, id]));
    const data = [...products, ...developmentCatalog()].map(({ category, ...product }) => ({
        ...product,
        categoryId: categories.get(category)!
    }));
    const existing = new Set((await db.product.findMany({
        where: { code: { in: data.map((product) => product.code) } },
        select: { code: true }
    })).map(({ code }) => code));
    await db.product.createMany({ data: data.filter(({ code }) => !existing.has(code)), skipDuplicates: true });

    // 既存アカウントを変更せず、EC サイト専用の顧客を初期登録する。
    const customer = await db.customer.upsert({
        where: { email: 'customer@example.test' },
        create: { email: 'customer@example.test', lastName: '山田', firstName: '花子', passwordHash: hashPassword('thread-customer') },
        update: {}
    });
    // 管理画面専用の運営アカウント。
    await db.member.upsert({
        where: { email: 'admin@example.test' },
        create: {
            email: 'admin@example.test',
            lastName: '店舗管理者',
            passwordHash: hashPassword('thread-admin')
        },
        update: {}
    });
    const tote = await db.product.findUniqueOrThrow({ where: { code: 'canvas-tote' } });
    await db.order.upsert({
        where: { reference: 'demo-order' },
        create: {
            reference: 'demo-order',
            customerId: customer.id,
            total: 3900,
            status: 'SHIPPED',
            shippingAddress: {
                create: {
                    name: '山田 花子',
                    postalCode: '100-0001',
                    prefecture: '東京都',
                    city: '千代田区',
                    line1: '演習用住所 1-1',
                    phone: '000-0000-0000'
                }
            },
            items: { create: { productId: tote.id, name: 'キャンバストート', unitPrice: 3900, quantity: 1 } }
        },
        update: {}
    });
}
seed()
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
