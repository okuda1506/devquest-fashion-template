import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsObject, ValidateIf, ValidateNested } from 'class-validator';
import { PaymentMethod } from '../../../generated/prisma/client';
import { mockCards } from '../mock-cards';
import type { TestCard } from '../payment-provider';

/**
 * テスト専用の固定値だけを受け付ける
 */
class MockCardDto implements TestCard {
    @ApiProperty() @IsIn([mockCards.approved, mockCards.declined]) number!: string;
    @ApiProperty() @IsIn([mockCards.expiry]) expiry!: string;
    @ApiProperty() @IsIn([mockCards.securityCode]) securityCode!: string;
}

/**
 * 支払い方法と模擬決済に使うカード指定を受け取る
 */
export class CheckoutPaymentDto {
    @ApiProperty({ enum: PaymentMethod })
    @IsIn(Object.values(PaymentMethod))
    method!: PaymentMethod;

    @ApiPropertyOptional({ type: MockCardDto })
    @ValidateIf(({ method, card }) => method === PaymentMethod.CREDIT_CARD || card !== undefined)
    @IsObject()
    @ValidateNested()
    @Type(() => MockCardDto)
    card?: MockCardDto;
}
