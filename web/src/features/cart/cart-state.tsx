import type { CartItem } from '@thread/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useMatch } from 'react-router-dom';
import { api } from '../../api';
import { useSession } from '../auth/session';

type CartState = {
    items?: CartItem[];
    loading: boolean;
    loadError: string;
};

const CartContext = createContext<(CartState & { refresh: () => void }) | null>(null);

/** EC 内でカート数量と一覧の再取得を共有する */
export function CartProvider({ children }: { children: ReactNode }) {
    const { session } = useSession();
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

    const current = snapshot?.token === token ? snapshot : undefined;
    return (
        <CartContext.Provider
            value={{
                items: current?.items,
                loading: current?.loading ?? !!token,
                loadError: current?.loadError ?? '',
                refresh
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
