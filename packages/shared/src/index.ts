export type Product = {
    id: string;
    name: string;
    category: string;
    description: string;
    price: number;
    stock: number;
    isPublished: boolean;
};
export const categories: Record<string, string> = {
    tops: 'トップス',
    outerwear: 'アウター',
    bottoms: 'ボトムス',
    accessories: '小物'
};

export type CartItem = { productId: string; product: Product; quantity: number };
export type ShippingAddress = {
    name: string;
    postalCode: string;
    prefecture: string;
    city: string;
    line1: string;
    line2: string;
    phone: string;
};
export const orderLabels = { PLACED: '注文受付済み', SHIPPED: '発送済み' };
export type Order = {
    id: string;
    status: keyof typeof orderLabels;
    total: number;
    createdAt: string;
    shippingAddress?: ShippingAddress | null;
    items: { id: string; name: string; quantity: number; unitPrice: number }[];
};

/** 金額を日本円の表示文字列に整形する */
export const yen = (price: number) =>
    new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(price);

export const rejectedSessions = new EventTarget();

/** 共通 API に JSON を送受信してセッション拒否を呼び出し元へ伝える */
export async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
    const headers = new Headers(options.headers);
    if (options.body) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', 'Bearer ' + token);
    const response = await fetch('/api' + path, { ...options, headers }).catch(() => {
        throw new Error('API に接続できませんでした。');
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
        if (token && (response.status === 401 || response.status === 403)) {
            rejectedSessions.dispatchEvent(new CustomEvent('rejected', { detail: token }));
        }
        throw new Error(typeof body?.message === 'string' ? body.message : '処理に失敗しました。');
    }
    return body as T;
}
