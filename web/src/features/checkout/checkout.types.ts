import { type ShippingAddress } from '@thread/shared';

export type Line = { productId?: string; id?: string; name: string; unitPrice: number; quantity: number };

export type CheckoutReview = {
    items: Line[];
    total: number;
    shippingAddress: ShippingAddress;
    checkoutId: string;
    version: string;
};

export type CheckoutContext = {
    token: string;
    address?: ShippingAddress;
    review?: CheckoutReview;
    setAddress: (address?: ShippingAddress) => void;
    setReview: (review?: CheckoutReview) => void;
};
