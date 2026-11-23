import { randomUUID } from 'node:crypto';
import { BadRequestException, Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OrderStatus, Prisma } from '../generated/prisma/client';
import { RequireRole, AuthGuard, AuthModule, CurrentUser } from '../auth/auth';
import { Db } from '../db';
import { checkoutVersion, normalizeAddress, PlaceOrderDto, PreviewOrderDto } from './checkout';

class StatusDto {
  @ApiProperty({ enum: OrderStatus }) @IsEnum(OrderStatus) status!: OrderStatus;
}

@Injectable()
class OrdersRepository {
  constructor(private readonly db: Db) {}
  list(userId?: string) {
    return this.db.order.findMany({ where: { userId }, include: { items: true }, orderBy: { createdAt: 'desc' } });
  }
  find(userId: string, id: string) {
    return this.db.order.findFirst({ where: { id, userId }, include: { items: true } });
  }
  cart(userId: string, source: Pick<Prisma.TransactionClient, 'cartItem'> = this.db) {
    return source.cartItem.findMany({ where: { userId }, include: { product: true }, orderBy: { productId: 'asc' } });
  }
  adminList() {
    return this.db.order.findMany({
      include: { items: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  update(id: string, status: OrderStatus) { return this.db.order.updateMany({ where: { id }, data: { status } }); }
  transact<T>(process: (db: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(process, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

@Injectable()
class OrdersService {
  constructor(private readonly repo: OrdersRepository) {}
  list(userId?: string) { return this.repo.list(userId); }
  adminList() { return this.repo.adminList(); }
  async update(id: string, status: OrderStatus) {
    if (!(await this.repo.update(id, status)).count) throw new NotFoundException('注文が見つかりません。');
    return { updated: true };
  }
  async detail(userId: string, id: string) {
    const order = await this.repo.find(userId, id);
    if (!order) throw new NotFoundException('注文が見つかりません。');
    return order;
  }

  private async quote(userId: string, input: PreviewOrderDto, db?: Prisma.TransactionClient) {
    const cart = await this.repo.cart(userId, db);
    if (!cart.length) throw new BadRequestException('カートに商品がありません。');
    const items = cart.map(({ product, quantity }) => {
      if (!product.isPublished || product.stock < quantity) {
        throw new ConflictException(`${product.name} は現在、この数量で注文できません。カートを確認してください。`);
      }
      return { productId: product.id, name: product.name, unitPrice: product.price, quantity };
    });
    const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    if (total > 2147483647) throw new BadRequestException('一度に注文できる金額を超えています。数量を調整してください。');
    const shippingAddress = normalizeAddress(input.shippingAddress);
    return { items, total, shippingAddress, version: checkoutVersion(items, shippingAddress) };
  }

  async preview(userId: string, input: PreviewOrderDto) {
    return { ...await this.quote(userId, input), checkoutId: randomUUID() };
  }

  async place(userId: string, input: PlaceOrderDto) {
    // 同じ確認画面から通信を再試行した場合は、確定済みの注文を返す。
    const existingOrder = await this.repo.find(userId, input.checkoutId);
    if (existingOrder) return existingOrder;
    try {
      return await this.repo.transact(async db => {
        const { items, total, shippingAddress, version } = await this.quote(userId, input, db);
        if (input.version !== version) {
          throw new ConflictException('カートまたは配送先の内容が変わりました。注文内容を確認し直してください。');
        }
        for (const item of items) {
          // 在庫の確認と減算を同じ更新で行い、他の注文と競合しても負数にしない。
          const updated = await db.product.updateMany({
            where: { id: item.productId, isPublished: true, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (!updated.count) throw new ConflictException(`${item.name} の在庫が不足しています。`);
        }
        const order = await db.order.create({
          data: { id: input.checkoutId, userId, total, shippingAddress, items: { create: items } },
          include: { items: true },
        });
        await db.cartItem.deleteMany({ where: { userId } });
        return order;
      });
    } catch (cause) {
      // 別リクエストで先に確定した場合も、注文があれば同じ結果を返す。
      const committed = await this.repo.find(userId, input.checkoutId);
      if (committed) return committed;
      if (cause instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(cause.code)) {
        throw new ConflictException('在庫またはカートが更新されました。内容を確認してください。');
      }
      throw cause;
    }
  }
}

@ApiTags('注文')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@RequireRole('CUSTOMER')
@Controller('orders')
class OrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Get() list(@CurrentUser() user: { id: string }) { return this.orders.list(user.id); }
  @Get(':id') detail(@CurrentUser() user: { id: string }, @Param('id') id: string) { return this.orders.detail(user.id, id); }
  @Post('preview') preview(@CurrentUser() user: { id: string }, @Body() input: PreviewOrderDto) {
    return this.orders.preview(user.id, input);
  }
  @Post() place(@CurrentUser() user: { id: string }, @Body() input: PlaceOrderDto) {
    return this.orders.place(user.id, input);
  }
}

@ApiTags('管理・注文')
@ApiBearerAuth()
@RequireRole('ADMIN')
@UseGuards(AuthGuard)
@Controller('admin/orders')
class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Get() list() { return this.orders.adminList(); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: StatusDto) { return this.orders.update(id, dto.status); }
}

@Module({ imports: [AuthModule], controllers: [OrdersController, AdminOrdersController], providers: [OrdersRepository, OrdersService] })
export class OrdersModule {}
