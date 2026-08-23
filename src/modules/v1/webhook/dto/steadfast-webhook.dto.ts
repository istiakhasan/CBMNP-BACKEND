import { IsNumber, IsOptional, IsString } from 'class-validator';

export class SteadfastWebhookDto {
  @IsOptional()
  @IsString()
  notification_type?: string;

  @IsOptional()
  @IsNumber()
  consignment_id?: number;

  @IsOptional()
  @IsString()
  invoice?: string;

  @IsOptional()
  @IsNumber()
  cod_amount?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  delivery_charge?: number;

  @IsOptional()
  @IsString()
  tracking_code?: string;

  @IsOptional()
  @IsString()
  tracking_message?: string;

  @IsOptional()
  @IsString()
  updated_at?: string;

  @IsOptional()
  @IsString()
  tracking_id?: string; // Steadfast এই নামেও পাঠায়
}
