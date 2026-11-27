import type { CartItem, Product } from '@thread/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useMatch } from 'react-router-dom';
import { api } from '@thread/shared';
import { useSession } from '@thread/shared/session';
import { useGuestCart } from './guest-cart';

type CartState = {
    items?: CartItem[];
    loading: boolean;
    loadError: string;
};

type CartActions = {
    refresh: () => void;
    addProduct: (product: Product, quantity: number) => Promise<void>;
    changeQuantity: (productId: string, quantity: number) => Promise<void>;
    removeProduct: (productId: string) => Promise<void>;
    guestItems: CartItem[];
    clearGuestCartIfMatch: (signature: string) => void;
};

const CartContext = createContext<(CartState & CartActions) | null>(null);

/** EC 内でカート数量と一覧の再取得を共有する */
export function CartProvider({ children }: { children: ReactNode }) {
    const { session, checking } = useSession();
    const guest = useGuestCart();
    const token = session?.token;
    const cartPage = useMatch('/cart');
    const addressPage = useMatch('/checkout');
    const cartView = cartPage?.pathname ?? addressPage?.pathname;
    const [snapshot, setSnapshot] = useState<CartState & { token: string }>();
    const [revision, setRevision] = useState(0);
    const refresh = useCallback(() => setRevision((value) => value + 1), []);

    useEffect(() => {
        if (!token) return;
        const controller = new AbortController();
        setSnapshot((previous) => ({
            token,
            items: previous?.token === token ? previous.items : undefined,
            loading: true,
            loadError: ''
        }));
        void api<CartItem[]>('/cart', { signal: controller.signal, cache: 'no-store' }, token).then(
            (items) => {
                if (!controller.signal.aborted) setSnapshot({ token, items, loading: false, loadError: '' });
            },
            (cause: Error) => {
                if (!controller.signal.aborted) setSnapshot({ token, loading: false, loadError: cause.message });
            }
        );
        return () => controller.abort();
    }, [token, cartView, revision]);

    /**
     * 会員カートの変更を API に保存して一覧を再取得する
     */
    async function updateMemberCart(productId: string, method: 'POST' | 'PUT' | 'DELETE', quantity?: number) {
        const body = quantity === undefined ? undefined : JSON.stringify({ quantity });
        await api('/cart/' + encodeURIComponent(productId), { method, body }, token);
        refresh();
    }

    const current = token && snapshot?.token === token ? snapshot : undefined;
    return (
        <CartContext.Provider
            value={{
                items: token ? current?.items : checking ? undefined : guest.items,
                loading: checking || (token ? current?.loading ?? true : false),
                loadError: current?.loadError ?? '',
                refresh,
                guestItems: guest.items,
                clearGuestCartIfMatch: guest.clearIfMatch,
                addProduct: async (product, quantity) => {
                    if (token) await updateMemberCart(product.id, 'POST', quantity);
                    else guest.add(product, quantity);
                },
                changeQuantity: async (productId, quantity) => {
                    if (token) await updateMemberCart(productId, 'PUT', quantity);
                    else guest.setQuantity(productId, quantity);
                },
                removeProduct: async (productId) => {
                    if (token) await updateMemberCart(productId, 'DELETE');
                    else guest.remove(productId);
                }
            }}
        >
            {children}
        </CartContext.Provider>
    );
}

/** EC の各画面から共有カート状態を参照する */
export function useCart() {
    return useContext(CartContext)!;
}
