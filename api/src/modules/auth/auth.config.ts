import type { Role } from '../../generated/prisma/client';
import type { Surface } from './origins';

export const roles = { store: 'CUSTOMER', admin: 'ADMIN' } satisfies Record<Surface, Role>;

export const audiences = { CUSTOMER: 'thread-store', ADMIN: 'thread-admin' } satisfies Record<Role, string>;

export const issuer = 'thread-api';

export const sessionLifetimeSeconds = 60 * 60;

export const loginDenied = 'メールアドレスまたはパスワードが正しくありません。';
