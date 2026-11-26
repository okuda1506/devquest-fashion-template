import { PartialType } from '@nestjs/swagger';
import { ProductFields } from './product-fields.dto';

/**
 * 指定された項目だけを商品マスタに反映するための入力
 */
export class UpdateProduct extends PartialType(ProductFields, { skipNullProperties: false }) {}
