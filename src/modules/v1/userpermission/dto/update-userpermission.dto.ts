import { PartialType } from '@nestjs/mapped-types';
import { CreateUserpermissionDto } from './create-userpermission.dto';

export class UpdateUserpermissionDto extends PartialType(CreateUserpermissionDto) {}
