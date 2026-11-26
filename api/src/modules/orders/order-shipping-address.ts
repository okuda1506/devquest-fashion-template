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
