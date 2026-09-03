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
    if (userPermissions.length === 0) {
      throw new Error('No user permissions provided');
    }

    try {
      // Pure upsert — শুধু frontend থেকে যেই (userId, permissionId) pair
      // পাঠানো হয়েছে, সেগুলোই insert/update হবে। conflict হলে
      // (already exists) সেই row-টা untouched থাকে — কারো existing
      // permission delete হয় না, শুধু নতুন যোগ হয়।
      await this.userPermissionRepository.upsert(userPermissions, {
        conflictPaths: ['userId', 'permissionId'],
        skipUpdateIfNoValuesChanged: true,
      });

      // upsert() নিজে থেকে saved entities ফেরত দেয় না, তাই affected
      // userId গুলোর জন্য fresh data query করে রেসপন্সে পাঠাচ্ছি।
      const userIds = Array.from(new Set(userPermissions.map((p) => p.userId)));
      return this.userPermissionRepository.find({
        where: userIds.map((userId) => ({ userId })),
      });
    } catch (error) {
      console.error('Error creating or updating user permissions:', error);
      throw error;
    }
  }

  async replaceUserPermissions(
    userId: string,
    permissionIds: number[],
  ): Promise<UserPermission[]> {
    const uniquePermissionIds = Array.from(
      new Set((permissionIds || []).map((permissionId) => Number(permissionId))),
    ).filter((permissionId) => Number.isFinite(permissionId));

    await this.userPermissionRepository.manager.transaction(async (manager) => {
      await manager.delete(UserPermission, { userId: userId as any });

      if (uniquePermissionIds.length) {
        const permissions = uniquePermissionIds.map((permissionId) =>
          manager.create(UserPermission, {
            userId: userId as any,
            permissionId,
          }),
        );
        await manager.save(UserPermission, permissions);
      }
    });

    return this.userPermissionRepository.find({
      where: { userId: userId as any },
      relations: ['permission'],
    });
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
