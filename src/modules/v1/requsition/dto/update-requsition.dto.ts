import { PartialType } from '@nestjs/mapped-types';
import { CreateRequsitionDto } from './create-requsition.dto';

export class UpdateRequsitionDto extends PartialType(CreateRequsitionDto) {}
