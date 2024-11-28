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
  async create(createUserpermissionDtos: UserPermission[]) {
    try {
      // Use the repository's `save` method to save multiple records at once
      const results = await this.userPermissionRepository.save(createUserpermissionDtos);
      return results;
    } catch (error) {
      // Handle error appropriately
      console.error('Error saving user permissions:', error);
      throw new Error('Failed to save user permissions');
    }
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
