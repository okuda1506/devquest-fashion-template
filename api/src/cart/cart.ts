import { Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { Db } from '../db';
import { AuthGuard, AuthModule, CurrentUser, RequireRole } from '../auth/auth';

class QuantityDto {
  @ApiProperty() @IsInt() @Min(1) @Max(99) quantity!: number;
}

@Injectable()
class CartRepository {
  constructor(private readonly db: Db) {}
  list(userId: string) { return this.db.cartItem.findMany({ where: { userId }, include: { product: true }, orderBy: { productId: 'asc' } }); }
  findProduct(id: string) { return this.db.product.findFirst({ where: { id, isPublished: true } }); }
  put(userId: string, productId: string, quantity: number) {
    return this.db.cartItem.upsert({
      where: { userId_productId: { userId, productId } }, update: { quantity }, create: { userId, productId, quantity },
    });
  }
  remove(userId: string, productId: string) { return this.db.cartItem.deleteMany({ where: { userId, productId } }); }
}

@Injectable()
class CartService {
  constructor(private readonly repo: CartRepository) {}
  list(userId: string) { return this.repo.list(userId); }
  async put(userId: string, id: string, qty: number) {
    if (!await this.repo.findProduct(id)) throw new NotFoundException('商品が見つかりません。');
    return this.repo.put(userId, id, qty);
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
  @Put(':id') put(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: QuantityDto) {
    return this.cart.put(user.id, id, dto.quantity);
  }
  @Delete(':id') remove(@CurrentUser() user: { id: string }, @Param('id') id: string) { return this.cart.remove(user.id, id); }
}

@Module({ imports: [AuthModule], controllers: [CartController], providers: [CartRepository, CartService] })
export class CartModule {}
