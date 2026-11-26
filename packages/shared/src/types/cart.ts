import type { Product } from './product';

export type CartItem = { productId: string; product: Product; quantity: number };
