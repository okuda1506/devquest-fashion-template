import { type ShippingAddress } from '@thread/shared';

export type Line = { productId?: string; id?: string; name: string; unitPrice: number; quantity: number };

export type CheckoutReview = {
    items: Line[];
    total: number;
    shippingAddress: ShippingAddress;
    checkoutId: string;
    email?: string;
    version: string;
};

export type CheckoutContext = {
    address?: ShippingAddress;
    review?: CheckoutReview;
    setAddress: (address?: ShippingAddress) => void;
    setReview: (review?: CheckoutReview) => void;
} & (
    | { guest?: false; token: string }
    | { guest: true; token?: never; email: string; setEmail: (email: string) => void }
);
