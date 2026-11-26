import type { Role } from '../../generated/prisma/client';

type Viewer = { id: string; role: Role };

export type AuthRequest = { headers: { authorization?: string; origin?: string }; viewer: Viewer };
