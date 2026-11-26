/**
 * セッション確立後に戻るストア内の画面を選ぶ
 */
export function loginDestination(state: { returnTo?: unknown } | null, fallback = '/') {
    const requested = state?.returnTo;
    if (requested === '/checkout' || requested === '/cart' || requested === '/orders' || requested === '/account') {
        return requested;
    }
    return fallback;
}
