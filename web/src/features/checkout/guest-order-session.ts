import { api } from '@thread/shared';

export const guestCheckoutPath = '/checkout/guest';
const accessKeyStorage = 'thread:guest-order-access';
const pendingStorage = 'thread:guest-order-pending';

type PendingOrder = { id: string; cartSignature: string };
let accessKey: string | undefined;
let pendingOrder: PendingOrder | undefined;

/**
 * 同じタブで注文を照会できるように 256 ビットの参照キーを維持する
 */
function guestAuthorization() {
    if (!accessKey) {
        try {
            const saved = sessionStorage.getItem(accessKeyStorage);
            if (saved && /^[0-9a-f]{64}$/.test(saved)) accessKey = saved;
        } catch {
            // タブを閉じるまではメモリ上のキーを使う
        }
        if (!accessKey) {
            accessKey = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
                byte.toString(16).padStart(2, '0')
            ).join('');
            try {
                sessionStorage.setItem(accessKeyStorage, accessKey);
            } catch {
                // ストレージに書けない場合も現在のページでは注文できる
            }
        }
    }
    return 'Guest ' + accessKey;
}

/**
 * ゲスト用の参照キーをヘッダーだけに添えて注文 API を呼ぶ
 */
export function guestOrderApi<T>(path: string, options: RequestInit = {}) {
    return api<T>('/guest-orders' + path, {
        ...options,
        headers: { Authorization: guestAuthorization() },
        cache: 'no-store'
    });
}

/**
 * 注文処理が切断された場合に同じ注文を照会できるように識別子を保存する
 */
export function rememberGuestOrder(order: PendingOrder) {
    if (readPendingGuestOrder()?.id === order.id) return;
    pendingOrder = order;
    try {
        sessionStorage.setItem(pendingStorage, JSON.stringify(order));
    } catch {
        // 現在のページ内では再照会できる
    }
}

/**
 * 注文結果が不明な注文の識別子を復元する
 */
export function readPendingGuestOrder() {
    if (pendingOrder) return pendingOrder;
    try {
        const saved = JSON.parse(sessionStorage.getItem(pendingStorage) ?? 'null');
        if (typeof saved?.id === 'string' && typeof saved.cartSignature === 'string') {
            pendingOrder = saved as PendingOrder;
        }
    } catch {
        // 復元できる注文がないものとして購入手続きを表示する
    }
    return pendingOrder;
}

/**
 * 確定を確認した注文の記録を消し 対応するカートの識別値を返す
 */
export function forgetGuestOrder(id: string) {
    const order = readPendingGuestOrder();
    if (order?.id !== id) return;
    pendingOrder = undefined;
    try {
        sessionStorage.removeItem(pendingStorage);
    } catch {
        // メモリ上の記録は破棄済み
    }
    return order.cartSignature;
}
