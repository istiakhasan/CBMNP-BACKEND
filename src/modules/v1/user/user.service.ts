import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Users } from './entities/user.entity';
import { Brackets, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
  ) {}
  async create(data: Users) {
    const lastCustomer = await this.userRepository
    .createQueryBuilder('user')
    .orderBy('user.createdAt', 'DESC') 
    .getOne();
    const lastUserId=lastCustomer?.userId?.substring(2)
     const currentId =lastUserId || (0).toString().padStart(9, '0'); //000000
     let incrementedId = (parseInt(currentId) + 1).toString().padStart(9, '0');
     incrementedId = `R-${incrementedId}`;
    const result = await this.userRepository.save({...data,userId:incrementedId});
    return result;
  }

  async findAll(options: any, filterOptions: any) {
    const page = Number(options.page || 1);
    const limit = Number(options.limit || 10);
    const skip = (page - 1) * limit;
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = (options.sortOrder || 'DESC').toUpperCase();

    const queryBuilder = this.userRepository.createQueryBuilder('users');

    // Debugging inputs
    console.log('Filter Options:', filterOptions?.searchTerm);
    console.log('Sort By:', sortBy, 'Order:', sortOrder);

    // Search Term Filter
    if (filterOptions?.searchTerm) {
      const searchTerm = `%${filterOptions.searchTerm.toString()}%`;
      queryBuilder.andWhere(
        '(users.name LIKE :searchTerm OR users.userId LIKE :searchTerm)',
        { searchTerm }
      );
    }

    // Role Filter
    if (filterOptions?.role) {
      queryBuilder.andWhere('users.role = :role', {
        role: filterOptions.role,
      });
    }

    queryBuilder
      .orderBy(`users.${sortBy}`, sortOrder) 
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    const modifyData = plainToInstance(Users, data);

    // Return paginated result
    return {
      data: modifyData,
      total,
      page,
      limit,
    };
  }


  async findOne(id: string) {
    const result = await this.userRepository.findOne({
      where: { userId:id },
      relations: ['userPermissions', 'userPermissions.permission'],
    });
  
    if (!result) {
      throw new Error(`User with ID ${id} not found`);
    }
  
    // Map the permissions into an array of labels
    const permissions = result.userPermissions.map(
      (userPermission) => {
        return {
          permissinId:userPermission.permissionId,
          label:userPermission.permission.label
        }
      }
    );
  
    // Return the transformed data
    return {
      id: result.id,
      name: result.name,
      phone: result.phone,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      permission: permissions,
    };
  }
  

  update(id: number, updateUserDto: Users) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
