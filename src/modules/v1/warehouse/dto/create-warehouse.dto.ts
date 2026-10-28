
import { IsString, IsUUID, IsPhoneNumber, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateWarehouseDto {
  @IsNotEmpty()
  @IsString()
  readonly name: string;

  @IsNotEmpty()
  @IsString()
  readonly location: string;

  @IsNotEmpty()
  @IsString()
  readonly contactPerson: string;

  @IsNotEmpty()
  @IsPhoneNumber('BD', { message: 'Phone number must be valid for Bangladesh.' }) // Replace 'BD' with appropriate locale if needed
  readonly phone: string;

  @IsOptional()
  @IsString()
  readonly shopifyLocationId?: string;
}



