import type { Prisma } from '../../generated/prisma/client';

export const productCategory = { productCategory: { select: { code: true } } } satisfies Prisma.ProductInclude;

/**
 * 旧版の商品 URL やブラウザ内に保存された商品コードを現行コードへ移す
 */
export function normalizeProductCode(code: string) {
    const bulk = /^large-seed-product-(\d{6})$/.exec(code);
    if (bulk) return 'TH-B-' + String(Number(bulk[1]) + 1).padStart(6, '0');
    const standard = /^thread-catalog-(\d{3,4})$/.exec(code);
    if (standard) return 'TH-C-' + standard[1].padStart(4, '0');
    return code;
}

/**
 * EC と管理画面が利用する商品コードとカテゴリコードを返す
 */
export function productView({
    code, name, description, productCategory: category, price, stock, isPublished
}: Prisma.ProductGetPayload<{ include: typeof productCategory }>) {
    return { id: code, name, description, category: category.code, price, stock, isPublished };
}
