import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthRequest } from '../../modules/auth/auth.types';

/** 認証ガードがリクエストに付与した利用者をハンドラーへ渡す */
export const CurrentUser = createParamDecorator(
    (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthRequest>().viewer
);
