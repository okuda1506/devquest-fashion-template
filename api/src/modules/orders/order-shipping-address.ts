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
    include: { items: true, shippingAddress: { select: shippingAddressFields } },
    omit: { guestAccessHash: true }
} satisfies Prisma.OrderDefaultArgs;
