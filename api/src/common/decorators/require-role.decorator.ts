import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../generated/prisma/client';

/** コントローラーまたはハンドラーに必要なロールを指定する */
export const RequireRole = (role: Role) => SetMetadata('requiredRole', role);
