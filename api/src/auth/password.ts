import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * scrypt で保存用のパスワードハッシュを生成する
 *
 * @param password ハッシュ化する平文パスワード
 * @param salt ソルト。省略時は暗号学的乱数から生成
 * @returns ソルトと16進ハッシュをコロンで連結した保存値
 */
export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
    return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}

/**
 * 保存済みのソルトを使ってパスワードを照合する
 *
 * @param password ログイン時の入力値
 * @param hash ソルトを含む保存値
 * @returns 保存値の形式が正しくハッシュが一致した場合に true
 */
export function verifyPassword(password: string, hash: string) {
    const [salt, key] = hash.split(':');
    if (!salt || !key || !/^[0-9a-f]{128}$/.test(key)) return false;
    return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(key, 'hex'));
}
