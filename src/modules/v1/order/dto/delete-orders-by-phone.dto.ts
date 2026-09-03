import { ArrayNotEmpty, IsArray, IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class DeleteOrdersByPhoneDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  orderIds: number[];

  @IsBoolean()
  confirm: boolean;
}
