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
  async createOrUpdate(userPermissions: UserPermission[]): Promise<UserPermission[]> {
   

      try {
    if (userPermissions.length === 0) {
      throw new Error('No user permissions provided');
    }
    const userId = userPermissions[0].userId;

    await this.userPermissionRepository.delete({ userId });
      const results = await Promise.all(
        userPermissions.map(async (userPermissionDto) => {
          const existingRecord = await this.userPermissionRepository.findOne({
            where: {
              userId: userPermissionDto.userId,
              permissionId: userPermissionDto.permissionId,
            }
          });
          if (existingRecord) {
            const updatedRecord = {
              ...existingRecord, 
              ...userPermissionDto 
            };
            return this.userPermissionRepository.save(updatedRecord);
          } else {
            return this.userPermissionRepository.save(userPermissionDto);
          }
        })
      );
  
      return results;
    } catch (error) {
      console.error('Error creating or updating user permissions:', error);
      throw new Error('Failed to create or update user permissions');
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
