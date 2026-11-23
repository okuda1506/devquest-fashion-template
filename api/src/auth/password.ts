import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}

export function verifyPassword(password: string, hash: string) {
  const [salt, key] = hash.split(':');
  if (!salt || !key || !/^[0-9a-f]{128}$/.test(key)) return false;
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(key, 'hex'));
}
