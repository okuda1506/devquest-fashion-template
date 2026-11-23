import { Body, ConflictException, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { Db } from '../db';
import { Prisma } from '../generated/prisma/client';
import { AuthGuard, AuthModule, CurrentUser, RequireRole } from '../auth/auth';

const MAX_CART_QUANTITY = 99;

class QuantityDto {
  @ApiProperty() @IsInt() @Min(1) @Max(MAX_CART_QUANTITY) quantity!: number;
}

@Injectable()
class CartRepository {
  constructor(private readonly db: Db) {}
  list(userId: string) { return this.db.cartItem.findMany({ where: { userId }, include: { product: true }, orderBy: { productId: 'asc' } }); }
  findProduct(id: string, source: Pick<Prisma.TransactionClient, 'product'> = this.db) {
    return source.product.findFirst({ where: { id, isPublished: true } });
  }
  put(userId: string, productId: string, quantity: number, source: Pick<Prisma.TransactionClient, 'cartItem'> = this.db) {
    return source.cartItem.upsert({
      where: { userId_productId: { userId, productId } }, update: { quantity }, create: { userId, productId, quantity },
    });
  }
  remove(userId: string, productId: string) { return this.db.cartItem.deleteMany({ where: { userId, productId } }); }
  transact<T>(process: (db: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(process, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

@Injectable()
class CartService {
  constructor(private readonly repo: CartRepository) {}
  list(userId: string) { return this.repo.list(userId); }
  async put(userId: string, id: string, qty: number) {
    if (!await this.repo.findProduct(id)) throw new NotFoundException('商品が見つかりません。');
    return this.repo.put(userId, id, qty);
  }
  async add(userId: string, productId: string, quantity: number) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.repo.transact(async db => {
          const product = await this.repo.findProduct(productId, db);
          if (!product) throw new NotFoundException('商品が見つかりません。');
          const current = await db.cartItem.findUnique({ where: { userId_productId: { userId, productId } } });
          const next = (current?.quantity ?? 0) + quantity;
          if (next > Math.min(product.stock, MAX_CART_QUANTITY)) {
            throw new ConflictException('在庫またはカートの上限を超える数量は追加できません。');
          }
          return this.repo.put(userId, productId, next, db);
        });
      } catch (cause) {
        if (!(cause instanceof Prisma.PrismaClientKnownRequestError) || !['P2034', 'P2002'].includes(cause.code)) throw cause;
      }
    }
    throw new ConflictException('カートが更新されました。もう一度追加してください。');
  }
  async remove(userId: string, id: string) { await this.repo.remove(userId, id); return { removed: true }; }
}

@ApiTags('カート')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@RequireRole('CUSTOMER')
@Controller('cart')
class CartController {
  constructor(private readonly cart: CartService) {}
  @Get() list(@CurrentUser() user: { id: string }) { return this.cart.list(user.id); }
  @Post(':id') add(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: QuantityDto) {
    return this.cart.add(user.id, id, dto.quantity);
  }
  @Put(':id') put(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: QuantityDto) {
    return this.cart.put(user.id, id, dto.quantity);
  }
  @Delete(':id') remove(@CurrentUser() user: { id: string }, @Param('id') id: string) { return this.cart.remove(user.id, id); }
}

@Module({ imports: [AuthModule], controllers: [CartController], providers: [CartRepository, CartService] })
export class CartModule {}
