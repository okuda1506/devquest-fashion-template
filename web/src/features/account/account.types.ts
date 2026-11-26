import type { ShippingAddress } from '@thread/shared';

export type CustomerProfile = {
    email: string;
    lastName: string;
    firstName: string | null;
    lastNameKana: string | null;
    firstNameKana: string | null;
    phone: string | null;
};

export type CustomerAddress = ShippingAddress & { id: string };
