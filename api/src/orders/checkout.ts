import { createHash } from 'node:crypto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDefined, IsHash, IsNotEmpty, IsObject, IsString, IsUUID, Matches, MaxLength, ValidateIf, ValidateNested } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

class ShippingAddressDto {
  @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @ApiProperty() @Transform(trim) @IsString() @Matches(/^\d{3}-?\d{4}$/) postalCode!: string;
  @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(12) prefecture!: string;
  @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100) city!: string;
  @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(120) line1!: string;
  @ApiPropertyOptional() @ValidateIf((_, value) => value !== undefined)
  @Transform(trim) @IsString() @MaxLength(120) line2?: string;
  @ApiProperty() @Transform(trim) @IsString() @Matches(/^(?:\d-?){9,10}\d$/) phone!: string;
}

export class PreviewOrderDto {
  @ApiProperty({ type: ShippingAddressDto }) @IsDefined() @IsObject() @ValidateNested() @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;
}

export class PlaceOrderDto extends PreviewOrderDto {
  @ApiProperty() @IsUUID('4') checkoutId!: string;
  @ApiProperty() @IsHash('sha256') version!: string;
}

export type CheckoutItem = { productId: string; name: string; unitPrice: number; quantity: number };

export function normalizeAddress(address: ShippingAddressDto) {
  const postal = address.postalCode.replace('-', '');
  return {
    name: address.name, postalCode: postal.slice(0, 3) + '-' + postal.slice(3), prefecture: address.prefecture,
    city: address.city, line1: address.line1, line2: address.line2 ?? '', phone: address.phone,
  };
}

export function checkoutVersion(items: CheckoutItem[], shipping: ReturnType<typeof normalizeAddress>) {
  const entries = [...items].sort((a, b) => a.productId.localeCompare(b.productId))
    .map(({ productId, name, unitPrice, quantity }) => [productId, name, unitPrice, quantity]);
  const address = [shipping.name, shipping.postalCode, shipping.prefecture, shipping.city, shipping.line1, shipping.line2, shipping.phone];
  return createHash('sha256').update(JSON.stringify([entries, address])).digest('hex');
}
