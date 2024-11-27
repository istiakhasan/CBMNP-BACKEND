import { Injectable } from '@nestjs/common';
import { CreateUserpermissionDto } from './dto/create-userpermission.dto';
import { UpdateUserpermissionDto } from './dto/update-userpermission.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { UserPermission } from './entities/userpermission.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UserpermissionService {
  constructor(
    @InjectRepository(UserPermission)
    private readonly userPermissionRepository: Repository<UserPermission>,
  ) {}
 async create(createUserpermissionDto: CreateUserpermissionDto) {
   const result=await this.userPermissionRepository.save(createUserpermissionDto)
    return result
  }

  findAll() {
    return `This action returns all userpermission`;
  }

  findOne(id: number) {
    return `This action returns a #${id} userpermission`;
  }

  update(id: number, updateUserpermissionDto: UpdateUserpermissionDto) {
    return `This action updates a #${id} userpermission`;
  }

  remove(id: number) {
    return `This action removes a #${id} userpermission`;
  }
}
