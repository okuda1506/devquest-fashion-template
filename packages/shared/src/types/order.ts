import type { orderLabels } from '../constants/order-status';

export type ShippingAddress = {
    name: string;
    postalCode: string;
    prefecture: string;
    city: string;
    line1: string;
    line2: string;
    phone: string;
};

export type Order = {
    id: string;
    orderNumber?: string;
    status: keyof typeof orderLabels;
    total: number;
    createdAt: string;
    shippingAddress?: ShippingAddress | null;
    items: { id: string; name: string; quantity: number; unitPrice: number }[];
};
