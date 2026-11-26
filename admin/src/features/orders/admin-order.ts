import type { Order } from '@thread/shared';

export type AdminOrder = Order & {
    isGuest?: boolean;
    user: { name: string; email: string };
};
