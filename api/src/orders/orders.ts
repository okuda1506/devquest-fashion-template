import { randomUUID } from 'node:crypto';
import {
    BadRequestException,
    Body,
    ConflictException,
    Controller,
    Get,
    Injectable,
    Module,
    NotFoundException,
    Param,
    Patch,
    Post,
    UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OrderStatus, Prisma } from '../generated/prisma/client';
import { RequireRole, AuthGuard, AuthModule, CurrentUser } from '../auth/auth';
import { Db } from '../db';
import { logEvent } from '../logging';
import { checkoutVersion, normalizeAddress, PlaceOrderDto, PreviewOrderDto } from './checkout';

/** 管理画面から更新可能な注文ステータスを定義する */
class StatusDto {
    @ApiProperty({ enum: OrderStatus }) @IsEnum(OrderStatus) status!: OrderStatus;
}

/** 注文とカートの読み取りおよび注文確定トランザクションを担当する */
@Injectable()
class OrdersRepository {
    /** カートと注文を同じ DB で操作するクライアントを受け取る */
    constructor(private readonly db: Db) {}
    /** 注文を明細付きで新しい順に取得する */
    list(userId?: string) {
        return this.db.order.findMany({ where: { userId }, include: { items: true }, orderBy: { createdAt: 'desc' } });
    }
    /** 注文 ID と顧客 ID の組み合わせで注文を取得する */
    find(userId: string, id: string) {
        return this.db.order.findFirst({ where: { id, userId }, include: { items: true } });
    }
    /** 見積もりに必要な商品情報付きのカート明細を取得する */
    cart(userId: string, source: Pick<Prisma.TransactionClient, 'cartItem'> = this.db) {
        return source.cartItem.findMany({
            where: { userId },
            include: { product: true },
            orderBy: { productId: 'asc' }
        });
    }
    /** 管理画面の受注一覧に必要な注文・明細・顧客連絡先を取得する */
    adminList() {
        return this.db.order.findMany({
            include: { items: true, user: { select: { name: true, email: true } } },
            orderBy: { createdAt: 'desc' }
        });
    }
    /** 指定した注文を新しいステータスに変更する */
    update(id: string, status: OrderStatus) {
        return this.db.order.updateMany({ where: { id }, data: { status } });
    }
    /** 在庫・注文・カートにまたがる処理を単一トランザクションとして実行する */
    transact<T>(process: (db: Prisma.TransactionClient) => Promise<T>) {
        return this.db.$transaction(process, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
}

/** 顧客向けの注文確認・確定と運営向けの受注管理を担当する */
@Injectable()
class OrdersService {
    /** 注文履歴の参照と確定に使うリポジトリを受け取る */
    constructor(private readonly repo: OrdersRepository) {}
    /** 対象顧客の注文履歴を返す */
    list(userId?: string) {
        return this.repo.list(userId);
    }
    /** 顧客情報付きの受注データを管理画面に返す */
    adminList() {
        return this.repo.adminList();
    }
    /**
     * 既存注文の発送ステータスを変更する
     *
     * @param id 更新対象の注文 ID
     * @param status 変更先のステータス
     * @returns 更新成功を示す結果
     * @throws NotFoundException 対象注文が存在しない場合
     */
    async update(id: string, status: OrderStatus) {
        if (!(await this.repo.update(id, status)).count) throw new NotFoundException('注文が見つかりません。');
        return { updated: true };
    }
    /**
     * 注文 ID を指定して対象顧客の注文だけを取得する
     *
     * @param userId 注文を参照する顧客 ID
     * @param id 対象の注文 ID
     * @returns 明細を含む注文
     * @throws NotFoundException 注文がないか顧客本人の注文ではない場合
     */
    async detail(userId: string, id: string) {
        const order = await this.repo.find(userId, id);
        if (!order) throw new NotFoundException('注文が見つかりません。');
        return order;
    }

    /**
     * 最新のカートから見積もりを作り配送先と注文内容の照合値を計算する
     *
     * @param userId 注文する顧客の ID
     * @param input 見積もりに使用する配送先
     * @param db 確定処理で使用するトランザクション用クライアント
     * @returns 明細・合計・正規化した配送先と照合値
     * @throws BadRequestException カートが空か注文金額が上限を超える場合
     * @throws ConflictException 非公開または在庫不足で購入できない商品がある場合
     */
    private async quote(userId: string, input: PreviewOrderDto, db?: Prisma.TransactionClient) {
        const cart = await this.repo.cart(userId, db);
        if (!cart.length) throw new BadRequestException('カートに商品がありません。');
        const items = cart.map(({ product, quantity }) => {
            if (!product.isPublished || product.stock < quantity) {
                throw new ConflictException(
                    `${product.name} は現在、この数量で注文できません。カートを確認してください。`
                );
            }
            return { productId: product.id, name: product.name, unitPrice: product.price, quantity };
        });
        const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        if (total > 2147483647)
            throw new BadRequestException('一度に注文できる金額を超えています。数量を調整してください。');
        const shippingAddress = normalizeAddress(input.shippingAddress);
        return { items, total, shippingAddress, version: checkoutVersion(items, shippingAddress) };
    }

    /** 注文内容と確定リクエストの再送に使う識別子を返す */
    async preview(userId: string, input: PreviewOrderDto) {
        return { ...(await this.quote(userId, input)), checkoutId: randomUUID() };
    }

    /**
     * 見積もりと現在のカートが一致する場合に在庫・注文・カートの更新をまとめて確定する
     *
     * 同じ確認 ID を同じ顧客が再送した場合は保存済みの注文を返す
     *
     * @param userId 注文する顧客の ID
     * @param input 確認 ID・照合値・配送先
     * @returns 確定した注文と明細
     * @throws BadRequestException カートが空か注文金額が上限を超える場合
     * @throws ConflictException 商品を購入できないか確認内容が変わった場合。または同時更新で確定できない場合
     */
    async place(userId: string, input: PlaceOrderDto) {
        // タイムアウト後に同じ確認 ID を再送した場合は確定済みの注文を返す
        const existingOrder = await this.repo.find(userId, input.checkoutId);
        if (existingOrder) {
            logEvent('info', 'orders.place', { reason: 'already_committed' });
            return existingOrder;
        }
        try {
            const order = await this.repo.transact(async (db) => {
                const { items, total, shippingAddress, version } = await this.quote(userId, input, db);
                if (input.version !== version) {
                    throw new ConflictException(
                        'カートまたは配送先の内容が変わりました。注文内容を確認し直してください。'
                    );
                }
                for (const item of items) {
                    // 在庫の条件判定と減算を同一の SQL 更新にまとめて売り越しを防ぐ
                    const updated = await db.product.updateMany({
                        where: { id: item.productId, isPublished: true, stock: { gte: item.quantity } },
                        data: { stock: { decrement: item.quantity } }
                    });
                    if (!updated.count) throw new ConflictException(`${item.name} の在庫が不足しています。`);
                }
                const order = await db.order.create({
                    data: { id: input.checkoutId, userId, total, shippingAddress, items: { create: items } },
                    include: { items: true }
                });
                await db.cartItem.deleteMany({ where: { userId } });
                return order;
            });
            logEvent('info', 'orders.place', { reason: 'committed' });
            return order;
        } catch (cause) {
            // 同じ確認 ID の別リクエストが先に確定した場合はその注文を返す
            const committed = await this.repo.find(userId, input.checkoutId);
            if (committed) {
                logEvent('info', 'orders.place', { reason: 'concurrent_commit' });
                return committed;
            }
            const reason = cause instanceof BadRequestException ? 'invalid_cart'
                : cause instanceof ConflictException ? 'cart_or_stock_changed'
                : cause instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(cause.code)
                  ? 'concurrent_update' : 'unexpected_failure';
            logEvent(reason === 'unexpected_failure' ? 'error' : 'warn', 'orders.place', { reason });
            if (cause instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(cause.code)) {
                throw new ConflictException('在庫またはカートが更新されました。内容を確認してください。');
            }
            throw cause;
        }
    }
}

/** 顧客自身の注文確認・確定・履歴参照を提供する */
@ApiTags('注文')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@RequireRole('CUSTOMER')
@Controller('orders')
class OrdersController {
    /** 顧客向けの注文確認と確定を実行するサービスを受け取る */
    constructor(private readonly orders: OrdersService) {}
    /** ログイン中の顧客が行った注文を一覧表示する */
    @Get() list(@CurrentUser() user: { id: string }) {
        return this.orders.list(user.id);
    }
    /** ログイン中の顧客が行った指定注文を取得する */
    @Get(':id') detail(@CurrentUser() user: { id: string }, @Param('id') id: string) {
        return this.orders.detail(user.id, id);
    }
    /** 入力された配送先とカートで注文内容を確認する */
    @Post('preview') preview(@CurrentUser() user: { id: string }, @Body() input: PreviewOrderDto) {
        return this.orders.preview(user.id, input);
    }
    /** 確認時の識別子とバージョンを使って注文を確定する */
    @Post() place(@CurrentUser() user: { id: string }, @Body() input: PlaceOrderDto) {
        return this.orders.place(user.id, input);
    }
}

/** 管理者向けに受注一覧とステータス変更を提供する */
@ApiTags('管理・注文')
@ApiBearerAuth()
@RequireRole('ADMIN')
@UseGuards(AuthGuard)
@Controller('admin/orders')
class AdminOrdersController {
    /** 管理用の注文参照と更新を実行するサービスを受け取る */
    constructor(private readonly orders: OrdersService) {}
    /** 運営に必要な全顧客の受注を一覧取得する */
    @Get() list() {
        return this.orders.adminList();
    }
    /** 指定した注文の発送ステータスを更新する */
    @Patch(':id') update(@Param('id') id: string, @Body() dto: StatusDto) {
        return this.orders.update(id, dto.status);
    }
}

/** 店舗管理と EC の注文機能を同じ業務サービスに接続する */
@Module({
    imports: [AuthModule],
    controllers: [OrdersController, AdminOrdersController],
    providers: [OrdersRepository, OrdersService]
})
export class OrdersModule {}
