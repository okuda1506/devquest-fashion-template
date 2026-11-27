import { useCallback, useRef, useState } from 'react';
import type { CartItem, Product } from '@thread/shared';

const storageKey = 'thread:guest-cart';
const maximumQuantity = 99;
const maximumProducts = 100;

/**
 * ゲストカートをタブから復元する
 */
function readGuestCart(): CartItem[] {
    try {
        const entries = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]');
        if (Array.isArray(entries)) {
            return entries.filter((item) =>
                typeof item?.productId === 'string' &&
                item.product?.id === item.productId &&
                Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= maximumQuantity
            );
        }
    } catch {
        // ストレージが利用できない場合はページ内のカートを使う
    }
    return [];
}

/**
 * 見積もりと確定に必要な商品 ID と数量だけを抽出する
 */
export function guestCartLines(items: CartItem[]) {
    return items.map(({ productId, quantity }) => ({ productId, quantity }));
}

/**
 * 注文確定中にカートが別の内容へ変わったかを判定する値を作る
 */
export function guestCartSignature(items: CartItem[]) {
    return JSON.stringify(guestCartLines(items));
}

/**
 * ゲストのカートを同じタブの再読み込み後も復元する
 */
export function useGuestCart() {
    const [items, setItems] = useState(readGuestCart);
    const current = useRef(items);

    const save = useCallback((next: CartItem[]) => {
        current.current = next;
        setItems(next);
        try {
            sessionStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
            // 現在のページでは引き続きカートを利用できる
        }
    }, []);

    /**
     * 在庫数と数量上限の範囲で商品を追加する
     */
    function add(product: Product, quantity: number) {
        const existing = current.current.find((item) => item.productId === product.id);
        const next = (existing?.quantity ?? 0) + quantity;
        if (!product.isPublished || quantity < 1 || next > Math.min(product.stock, maximumQuantity)) {
            throw new Error('在庫またはカートの上限を超える数量は追加できません。');
        }
        if (!existing && current.current.length >= maximumProducts) {
            throw new Error('ゲストのカートには100種類まで追加できます。');
        }
        const item = { productId: product.id, product, quantity: next };
        save(existing
            ? current.current.map((previous) => previous.productId === product.id ? item : previous)
            : [...current.current, item]);
    }

    /**
     * 指定した商品の数量を変更する
     */
    function setQuantity(productId: string, quantity: number) {
        save(current.current.map((item) => item.productId === productId ? { ...item, quantity } : item));
    }

    /**
     * ゲストのカートから指定した商品を取り除く
     */
    function remove(productId: string) {
        save(current.current.filter((item) => item.productId !== productId));
    }

    const clearIfMatch = useCallback((signature: string) => {
        if (guestCartSignature(current.current) === signature) save([]);
    }, [save]);

    return { items, add, setQuantity, remove, clearIfMatch };
}
