import type { Prisma } from '../../generated/prisma/client';

export const shippingAddressFields = {
    name: true,
    postalCode: true,
    prefecture: true,
    city: true,
    line1: true,
    line2: true,
    phone: true
} satisfies Prisma.OrderShippingAddressSelect;

// ゲスト注文を参照するためのハッシュは API の応答に含めない
export const orderDetails = {
    include: {
        items: { include: { product: { select: { code: true } } } },
        shippingAddress: { select: shippingAddressFields }
    },
    omit: { guestAccessHash: true }
} satisfies Prisma.OrderDefaultArgs;

/**
 * 注文番号を表示し 注文照会と再送には既存の公開識別子を使う
 */
export function orderView({ id, reference, items, ...order }: Prisma.OrderGetPayload<typeof orderDetails>) {
    return {
        ...order,
        id: reference,
        orderNumber: 'TH-' + String(id).padStart(8, '0'),
        items: items.map(({ id: lineId, product, name, unitPrice, quantity }) => ({
            id: String(lineId), productId: product.code, name, unitPrice, quantity
        }))
    };
}
