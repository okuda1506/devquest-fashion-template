import type { Surface } from '../../config/environment';

export const roles = { store: 'CUSTOMER', admin: 'ADMIN' } as const satisfies Record<Surface, string>;

export type Role = (typeof roles)[Surface];

export const audiences = { CUSTOMER: 'thread-store', ADMIN: 'thread-admin' } satisfies Record<Role, string>;

export const issuer = 'thread-api-v2';

export const sessionLifetimeSeconds = 60 * 60;
