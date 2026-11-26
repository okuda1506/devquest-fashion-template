import { Prisma } from '../generated/prisma/client';

const conflictingWriteCodes = ['P2034', 'P2002'];

/** 直列化競合または一意制約違反による更新失敗かを判定する */
export function isConflictingWrite(cause: unknown) {
    return cause instanceof Prisma.PrismaClientKnownRequestError && conflictingWriteCodes.includes(cause.code);
}
