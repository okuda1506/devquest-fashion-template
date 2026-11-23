import { Db } from '../src/db';
import { hashPassword } from '../src/auth/password';

const db = new Db();
const products = [
  { id: 'linen-shirt', name: 'リネンブレンドシャツ', category: 'tops', description: '軽く風を通す、ゆとりのある一枚。', price: 6800, stock: 14 },
  { id: 'cotton-tee', name: 'ヘビーコットン T シャツ', category: 'tops', description: '丈夫で透けにくいコットン素材。', price: 2900, stock: 0 },
  { id: 'field-jacket', name: 'フィールドジャケット', category: 'outerwear', description: '季節の変わり目に重ねやすいジャケット。', price: 14800, stock: 3 },
  { id: 'tapered-pants', name: 'テーパードトラウザー', category: 'bottoms', description: '腰回りにはゆとりを、裾はすっきり。', price: 9200, stock: 12 },
  { id: 'canvas-tote', name: 'キャンバストート', category: 'accessories', description: '毎日の荷物が入る厚手のトート。', price: 3900, stock: 10 },
  { id: 'draft-coat', name: 'ウールコート（発売前）', category: 'outerwear', description: '発売準備中の管理用商品。', price: 24000, stock: 5, isPublished: false },
];

async function seed() {
  for (const product of products) await db.product.upsert({ where: { id: product.id }, create: product, update: {} });
  const customer = await db.user.upsert({
    where: { email: 'customer@example.test' },
    create: { email: 'customer@example.test', name: '山田 花子', passwordHash: hashPassword('thread-customer') },
    update: {},
  });
  await db.user.upsert({
    where: { email: 'admin@example.test' },
    create: { email: 'admin@example.test', name: '店舗管理者', passwordHash: hashPassword('thread-admin'), role: 'ADMIN' },
    update: {},
  });
  await db.order.upsert({
    where: { id: 'demo-order' },
    create: { id: 'demo-order', userId: customer.id, total: 3900, status: 'SHIPPED',
      items: { create: { productId: 'canvas-tote', name: 'キャンバストート', unitPrice: 3900, quantity: 1 } } },
    update: {},
  });
}
seed().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
