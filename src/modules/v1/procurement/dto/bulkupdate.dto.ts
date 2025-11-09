import { IsEnum, IsNotEmpty, IsString, IsArray, ArrayNotEmpty, IsNumber } from 'class-validator';

enum Status {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export class BulkUpdateDto {
  @IsEnum(Status, { message: 'Status must be one of: pending, approved, rejected' })
  @IsNotEmpty()
  status: Status;

  @IsString()
  @IsNotEmpty()
  updateBy: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  poids: number[];
}
