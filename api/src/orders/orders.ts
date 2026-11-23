import { BadRequestException, Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OrderStatus, Prisma } from '../generated/prisma/client';
import { AdminOnly, AuthGuard, AuthModule, CurrentUser } from '../auth/auth';
import { Db } from '../db';

class StatusDto {
  @ApiProperty({ enum: OrderStatus }) @IsEnum(OrderStatus) status!: OrderStatus;
}

@Injectable()
class OrdersRepository {
  constructor(private readonly db: Db) {}
  list(userId?: string) {
    return this.db.order.findMany({ where: { userId }, include: { items: true }, orderBy: { createdAt: 'desc' } });
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
  async place(userId: string) {
    try {
      return await this.repo.transact(async (db) => {
        const cart = await db.cartItem.findMany({ where: { userId }, include: { product: true }, orderBy: { productId: 'asc' } });
        if (!cart.length) throw new BadRequestException('カートに商品がありません。');
        const items = [];
        for (const { product, quantity } of cart) {
          // 在庫の確認と減算を同じ更新で行い、他の注文と競合しても負数にしない。
          const updated = await db.product.updateMany({
            where: { id: product.id, isPublished: true, stock: { gte: quantity } },
            data: { stock: { decrement: quantity } },
          });
          if (!updated.count) throw new ConflictException(`${product.name} の在庫が不足しています。`);
          items.push({ productId: product.id, name: product.name, unitPrice: product.price, quantity });
        }
        const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        const order = await db.order.create({ data: { userId, total, items: { create: items } }, include: { items: true } });
        await db.cartItem.deleteMany({ where: { userId } });
        return order;
      });
    } catch (cause) {
      if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === 'P2034') {
        throw new ConflictException('在庫またはカートが更新されました。内容を確認してください。');
      }
      throw cause;
    }
  }
}

@ApiTags('注文')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('orders')
class OrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Get() list(@CurrentUser() user: { id: string }) { return this.orders.list(user.id); }
  @Post() place(@CurrentUser() user: { id: string }) { return this.orders.place(user.id); }
}

@ApiTags('管理・注文')
@ApiBearerAuth()
@AdminOnly()
@UseGuards(AuthGuard)
@Controller('admin/orders')
class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Get() list() { return this.orders.adminList(); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: StatusDto) { return this.orders.update(id, dto.status); }
}

@Module({ imports: [AuthModule], controllers: [OrdersController, AdminOrdersController], providers: [OrdersRepository, OrdersService] })
export class OrdersModule {}
