import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../modules/auth/auth.config';

/** コントローラーまたはハンドラーに必要なロールを指定する */
export const RequireRole = (role: Role) => SetMetadata('requiredRole', role);
