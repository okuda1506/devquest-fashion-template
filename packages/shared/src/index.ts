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

/**
 * 共通 API に JSON を送受信し認証拒否時に現在のセッションを照合するイベントを送る
 *
 * @param path API 接頭辞を除いたリクエスト先
 * @param options メソッド・送信データ・中断通知などの Fetch 設定
 * @param token 認証が必要な操作に使用するセッショントークン
 * @returns 応答本文の JSON。JSON がなければ null を返す
 * @throws Error 接続できない場合または API が失敗を返した場合
 */
export async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
    const headers = new Headers(options.headers);
    const requestId = globalThis.crypto?.randomUUID?.();
    if (requestId) headers.set('X-Thread-Request-Id', requestId);
    const started = performance.now();
    /** リクエストの結果を入力値やレスポンス本文を含めず開発者ツールへ記録する */
    function log(level: 'debug' | 'warn' | 'error', reason: string, status?: number, id: string | undefined = requestId) {
        if (options.signal?.aborted || (level === 'debug' && !import.meta.env.DEV)) return;
        console[level](JSON.stringify({
            at: new Date().toISOString(),
            level,
            event: 'api.request',
            requestId: id,
            method: options.method ?? 'GET',
            status,
            reason,
            elapsedMs: Math.round(performance.now() - started)
        }));
    }
    if (options.body) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', 'Bearer ' + token);
    const response = await fetch('/api' + path, { ...options, headers }).catch(() => {
        log('error', 'network_failure');
        throw new Error('API に接続できませんでした。');
    });
    const body = await response.json().catch(() => null);
    const id = response.headers?.get('x-thread-request-id') ?? requestId;
    log(response.ok ? 'debug' : response.status >= 500 ? 'error' : 'warn',
        response.ok ? 'completed' : response.status === 401 || response.status === 403 ? 'access_denied' : 'http_failure',
        response.status, id);
    if (!response.ok) {
        if (token && (response.status === 401 || response.status === 403)) {
            rejectedSessions.dispatchEvent(new CustomEvent('rejected', { detail: token }));
        }
        throw new Error(typeof body?.message === 'string' ? body.message : '処理に失敗しました。');
    }
    return body as T;
}
