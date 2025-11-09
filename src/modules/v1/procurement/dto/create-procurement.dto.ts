import { IsUUID, IsArray, IsBoolean, IsNumber, IsOptional, IsString, IsEnum } from 'class-validator';

class ProcurementItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  orderedQuantity: number;

  @IsNumber()
  receivedQuantity: number;

  @IsNumber()
  damageQuantity: number;

  @IsNumber()
  unitPrice: number;
}

export class CreateProcurementDto {
  @IsUUID()
  supplierId: string;

  @IsArray()
  items: ProcurementItemDto[];

  @IsBoolean()
  billGenerated: boolean;

  @IsOptional()
  @IsNumber()
  billAmount?: number;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsString()
  receivedBy: string;
  @IsString()
  organizationId: string;

  @IsOptional()
  @IsEnum(['Pending', 'Processing', 'Completed', 'Cancelled'])
  status: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
