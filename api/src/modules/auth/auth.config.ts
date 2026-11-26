import { Role } from '../../generated/prisma/client';
import type { Surface } from '../../config/environment';

export const roles = { store: Role.CUSTOMER, admin: Role.ADMIN } satisfies Record<Surface, Role>;

export const audiences = { CUSTOMER: 'thread-store', ADMIN: 'thread-admin' } satisfies Record<Role, string>;

export const issuer = 'thread-api';

export const sessionLifetimeSeconds = 60 * 60;
