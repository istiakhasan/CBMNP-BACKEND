import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { AccountCategory, AccountType } from '../entities/account.entity';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  accountCode: string;

  @IsString()
  @IsNotEmpty()
  accountName: string;

  @IsEnum(AccountType)
  @IsNotEmpty()
  accountType: AccountType;

  @IsEnum(AccountCategory)
  @IsNotEmpty()
  accountCategory: AccountCategory;

  @IsUUID()
  @IsOptional()
  parentAccountId?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
