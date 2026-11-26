import type { Product } from '@thread/shared';

export function product(id: string, price: number, stock: number, category = 'tops'): Product {
    return { id, name: '商品 ' + id, description: '演習用', category, price, stock, isPublished: true };
}
