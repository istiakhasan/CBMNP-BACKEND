import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class FinancialReportQueryDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsDateString()
  @IsOptional()
  asOfDate?: string;

  @IsUUID()
  @IsOptional()
  accountId?: string;
}
