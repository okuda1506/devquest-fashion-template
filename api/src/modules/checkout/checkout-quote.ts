import { createHash } from 'node:crypto';
import type { ShippingAddressDto } from './dto/shipping-address.dto';

export type CheckoutItem = { productId: string; name: string; unitPrice: number; quantity: number };

/** 郵便番号の表記と建物名の省略値を統一する */
export function normalizeAddress(address: ShippingAddressDto) {
    const postal = address.postalCode.replace('-', '');
    return {
        name: address.name,
        postalCode: postal.slice(0, 3) + '-' + postal.slice(3),
        prefecture: address.prefecture,
        city: address.city,
        line1: address.line1,
        line2: address.line2 ?? '',
        phone: address.phone
    };
}

/** 商品明細と配送先から注文確認時の内容を識別するハッシュを作る */
export function checkoutVersion(items: CheckoutItem[], shipping: ReturnType<typeof normalizeAddress>) {
    // 行の取得順が変わっても同じ内容なら同一のバージョンになるよう商品 ID で整列する
    const entries = [...items]
        .sort((a, b) => a.productId.localeCompare(b.productId))
        .map(({ productId, name, unitPrice, quantity }) => [productId, name, unitPrice, quantity]);
    const address = [
        shipping.name,
        shipping.postalCode,
        shipping.prefecture,
        shipping.city,
        shipping.line1,
        shipping.line2,
        shipping.phone
    ];
    return createHash('sha256')
        .update(JSON.stringify([entries, address]))
        .digest('hex');
}
