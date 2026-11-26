import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartController } from './controllers/cart.controller';
import { CartRepository } from './cart.repository';
import { CartService } from './cart.service';

/** 認証済みカートの API と永続化を構成する */
@Module({ imports: [AuthModule], controllers: [CartController], providers: [CartRepository, CartService] })
export class CartModule {}
