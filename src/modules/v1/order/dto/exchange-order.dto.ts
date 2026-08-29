// src/module/order/dto/exchange-order.dto.ts
import {
  IsString,
  IsInt,
  IsPositive,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';

export class ExchangeOrderDto {
  @IsString()
  @IsNotEmpty()
  oldProductId: string;

  @IsInt()
  @IsPositive()
  oldQuantity: number;

  @IsString()
  @IsNotEmpty()
  newProductId: string;

  @IsInt()
  @IsPositive()
  newQuantity: number;

  @IsOptional()
  @IsString()
  reason?: string;
}