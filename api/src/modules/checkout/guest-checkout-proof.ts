import { createHash, createHmac } from 'node:crypto';
import { jwtSecret } from '../../config/environment';

/**
 * ゲストの注文参照キーを DB 照合用のハッシュに変換する
 */
export function guestAccessHash(authorization?: string) {
    const key = /^Guest ([0-9a-f]{64})$/.exec(authorization ?? '')?.[1];
    return key && createHash('sha256').update(key).digest('hex');
}

/**
 * 見積もりの署名を注文 ID・ゲスト・メールアドレスに結びつける
 */
export function guestCheckoutVersion(id: string, accessHash: string, email: string, cartVersion: string) {
    return createHmac('sha256', jwtSecret())
        .update(JSON.stringify(['thread-guest-checkout', id, accessHash, email, cartVersion]))
        .digest('hex');
}
