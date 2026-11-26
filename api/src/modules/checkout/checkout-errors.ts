import { ConflictException, HttpStatus } from '@nestjs/common';

export const checkoutMessages = {
    guestAccessRequired: 'ゲスト注文を確認できません。購入したブラウザのタブで開いてください。',
    missingProducts: '購入できなくなった商品があります。カートを確認してください。',
    emptyCart: 'カートに商品がありません。',
    totalLimit: '一度に注文できる金額を超えています。数量を調整してください。',
    unavailableQuantity: (name: string) => `${name} は現在、この数量で注文できません。カートを確認してください。`,
    insufficientStock: (name: string) => `${name} の在庫が不足しています。`,
    changed: 'カートまたは配送先の内容が変わりました。注文内容を確認し直してください。',
    concurrentUpdate: '在庫またはカートが更新されました。内容を確認してください。'
} as const;

type CheckoutConflictCode = 'INSUFFICIENT_STOCK' | 'PRODUCT_UNAVAILABLE' | 'CHECKOUT_CHANGED' | 'CONCURRENT_UPDATE';

/** 既存のHTTPエラー形式に購入処理のエラーコードを追加する */
export function checkoutConflict(code: CheckoutConflictCode, message: string) {
    return new ConflictException({ message, error: 'Conflict', statusCode: HttpStatus.CONFLICT, code });
}
