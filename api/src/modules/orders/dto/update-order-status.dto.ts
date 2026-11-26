import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OrderStatus } from '../../../generated/prisma/client';

/**
 * 管理画面から更新可能な注文ステータスを定義する
 */
export class StatusDto {
    @ApiProperty({ enum: OrderStatus }) @IsEnum(OrderStatus) status!: OrderStatus;
}
