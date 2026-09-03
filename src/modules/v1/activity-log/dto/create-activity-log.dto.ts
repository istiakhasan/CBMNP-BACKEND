import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateActivityLogDto {
  @IsString()
  module: string;

  @IsString()
  action: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  userName?: string;
}
