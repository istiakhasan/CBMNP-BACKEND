import { PartialType } from '@nestjs/mapped-types';
import { CreateProcurementDto } from './create-procurement.dto';

export class UpdateProcurementDto extends PartialType(CreateProcurementDto) {}
