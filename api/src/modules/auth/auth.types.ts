import type { Role } from './auth.config';

type Viewer = { id: number; role: Role };

export type AuthRequest = { headers: { authorization?: string; origin?: string }; viewer: Viewer };
