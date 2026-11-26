import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * ログイン時の照合とセッション確認に必要なアカウントを取得する
 */
@Injectable()
export class AuthRepository {
    /**
     * 認証と権限確認に使う共通 DB 接続を受け取る
     */
    constructor(private readonly db: PrismaService) {}

    /**
     * メールアドレスから資格情報の照合に使うアカウントを取得する
     */
    findByEmail(email: string) {
        return this.db.user.findUnique({ where: { email } });
    }

    /**
     * セッションに対応するアカウント ID と現在の権限を取得する
     */
    findViewer(id: string) {
        return this.db.user.findUnique({ where: { id }, select: { id: true, role: true } });
    }
}
