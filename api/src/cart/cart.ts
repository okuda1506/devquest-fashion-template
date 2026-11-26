import {
    Body,
    ConflictException,
    Controller,
    Delete,
    Get,
    Injectable,
    Module,
    NotFoundException,
    Param,
    Post,
    Put,
    UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { Db } from '../db';
import { Prisma } from '../generated/prisma/client';
import { AuthGuard, AuthModule, CurrentUser, RequireRole } from '../auth/auth';

const MAX_CART_QUANTITY = 99;

/** カート操作で受け付ける商品数量の範囲を定義する */
class QuantityDto {
    @ApiProperty() @IsInt() @Min(1) @Max(MAX_CART_QUANTITY) quantity!: number;
}

/** ユーザー別のカート明細と対象商品の永続化を担当する */
@Injectable()
class CartRepository {
    /** カート明細を操作する DB クライアントを受け取る */
    constructor(private readonly db: Db) {}
    /** 商品情報付きのカート明細を商品 ID 順に取得する */
    list(userId: string) {
        return this.db.cartItem.findMany({
            where: { userId },
            include: { product: true },
            orderBy: { productId: 'asc' }
        });
    }
    /** 追加または数量変更の対象になる公開商品を取得する */
    findProduct(id: string, source: Pick<Prisma.TransactionClient, 'product'> = this.db) {
        return source.product.findFirst({ where: { id, isPublished: true } });
    }
    /** ユーザーと商品の複合キーで明細の数量を設定する */
    put(
        userId: string,
        productId: string,
        quantity: number,
        source: Pick<Prisma.TransactionClient, 'cartItem'> = this.db
    ) {
        return source.cartItem.upsert({
            where: { userId_productId: { userId, productId } },
            update: { quantity },
            create: { userId, productId, quantity }
        });
    }
    /** 対象のユーザーと商品に一致する明細を削除する */
    remove(userId: string, productId: string) {
        return this.db.cartItem.deleteMany({ where: { userId, productId } });
    }
    /**
     * カート数量の読み取りと更新を同じ直列化可能トランザクションで処理する
     *
     * @param process トランザクション用クライアントを使う処理
     * @returns コミットされた処理の結果
     */
    transact<T>(process: (db: Prisma.TransactionClient) => Promise<T>) {
        return this.db.$transaction(process, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
}

/** カートへの追加・数量指定・削除に必要な業務ルールを適用する */
@Injectable()
class CartService {
    /** カート操作とトランザクションに使うリポジトリを受け取る */
    constructor(private readonly repo: CartRepository) {}
    /** 指定ユーザーのカート明細を返す */
    list(userId: string) {
        return this.repo.list(userId);
    }
    /**
     * 公開商品であることを確認してカート数量を指定値に置き換える
     *
     * @param userId カートの所有者
     * @param id 対象商品の ID
     * @param qty 更新後の数量
     * @returns 作成または更新されたカート明細
     * @throws NotFoundException 公開中の対象商品が存在しない場合
     */
    async put(userId: string, id: string, qty: number) {
        if (!(await this.repo.findProduct(id))) throw new NotFoundException('商品が見つかりません。');
        return this.repo.put(userId, id, qty);
    }
    /**
     * 現在の数量に加算して在庫数とカート上限を両方守る
     *
     * 同時更新による直列化競合または一意制約違反は最大3回まで試行する
     *
     * @param userId カートの所有者
     * @param productId 追加対象の商品 ID
     * @param quantity 現在の数量へ加算する点数
     * @returns 更新されたカート明細
     * @throws NotFoundException 公開中の対象商品が存在しない場合
     * @throws ConflictException 在庫不足・数量上限超過・同時更新で追加できない場合
     */
    async add(userId: string, productId: string, quantity: number) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                return await this.repo.transact(async (db) => {
                    const product = await this.repo.findProduct(productId, db);
                    if (!product) throw new NotFoundException('商品が見つかりません。');
                    const current = await db.cartItem.findUnique({
                        where: { userId_productId: { userId, productId } }
                    });
                    const next = (current?.quantity ?? 0) + quantity;
                    if (next > Math.min(product.stock, MAX_CART_QUANTITY)) {
                        throw new ConflictException('在庫またはカートの上限を超える数量は追加できません。');
                    }
                    return this.repo.put(userId, productId, next, db);
                });
            } catch (cause) {
                // 同時追加で起きる直列化競合と複合キー重複だけを再試行する
                if (
                    !(cause instanceof Prisma.PrismaClientKnownRequestError) ||
                    !['P2034', 'P2002'].includes(cause.code)
                )
                    throw cause;
            }
        }
        throw new ConflictException('カートが更新されました。もう一度追加してください。');
    }
    /**
     * 指定商品の明細をカートから取り除く
     *
     * @param userId カートの所有者
     * @param id 削除対象の商品 ID
     * @returns 明細の有無にかかわらず removed が true の結果
     */
    async remove(userId: string, id: string) {
        await this.repo.remove(userId, id);
        return { removed: true };
    }
}

/** ログイン済みの顧客向けにカート操作を公開する */
@ApiTags('カート')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@RequireRole('CUSTOMER')
@Controller('cart')
class CartController {
    /** 顧客のカート操作を実行するサービスを受け取る */
    constructor(private readonly cart: CartService) {}
    /** ログイン中の顧客のカートを返す */
    @Get() list(@CurrentUser() user: { id: string }) {
        return this.cart.list(user.id);
    }
    /** 商品を指定した数量だけカートに追加する */
    @Post(':id') add(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: QuantityDto) {
        return this.cart.add(user.id, id, dto.quantity);
    }
    /** 商品明細の数量を指定値に置き換える */
    @Put(':id') put(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: QuantityDto) {
        return this.cart.put(user.id, id, dto.quantity);
    }
    /** 商品を顧客のカートから取り除く */
    @Delete(':id') remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
        return this.cart.remove(user.id, id);
    }
}

/** 認証済みカートの API と永続化を構成する */
@Module({ imports: [AuthModule], controllers: [CartController], providers: [CartRepository, CartService] })
export class CartModule {}
