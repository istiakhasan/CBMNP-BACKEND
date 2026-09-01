import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JournalEntryType } from '../entities/journal-entry.entity';

export class CreateJournalItemDto {
  @IsUUID()
  @IsNotEmpty()
  accountId: string;

  @IsNumber()
  @Min(0)
  debit: number;

  @IsNumber()
  @Min(0)
  credit: number;

  @IsString()
  @IsOptional()
  memo?: string;
}

export class CreateJournalEntryDto {
  @IsDateString()
  @IsNotEmpty()
  entryDate: string;

  @IsEnum(JournalEntryType)
  @IsOptional()
  entryType?: JournalEntryType;

  @IsString()
  @IsOptional()
  referenceType?: string;

  @IsString()
  @IsOptional()
  referenceId?: string;

  @IsString()
  @IsNotEmpty()
  narration: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateJournalItemDto)
  items: CreateJournalItemDto[];
}
