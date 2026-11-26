import { Injectable } from '@nestjs/common';
import type { Surface } from '../../config/environment';
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
    findByEmail(email: string, surface: Surface) {
        return surface === 'admin'
            ? this.db.member.findUnique({ where: { email } })
            : this.db.customer.findUnique({ where: { email } });
    }

    /**
     * セッションの利用先に対応するアカウントが現存するか確認する
     */
    findViewer(id: string, surface: Surface) {
        const query = { where: { id }, select: { id: true } };
        return surface === 'admin' ? this.db.member.findUnique(query) : this.db.customer.findUnique(query);
    }
}
