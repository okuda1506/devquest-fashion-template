import type { Order } from '@thread/shared';

export type AdminOrder = Order & {
    user: { name: string; email: string };
};
