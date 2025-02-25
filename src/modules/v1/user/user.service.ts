import {  Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Users } from './entities/user.entity';
import {  Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import paginationHelpers from '../../../helpers/paginationHelpers';
import * as bcryptjs from 'bcrypt';
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
  ) {}
  async create(data: Users) {
  //  const isEmailExist=await this.userRepository.findOne({where:{email:data?.email}})
  //  if(isEmailExist){
  //   throw new ApiError(HttpStatus.BAD_REQUEST,'Email Already Exist')
  //  }
  //  const isPhoneNumberExist=await this.userRepository.findOne({where:{phone:data?.phone}})
  //  if(isPhoneNumberExist){
  //   throw new ApiError(HttpStatus.BAD_REQUEST,'Phone Number Already Exist')
  //  }

    const lastCustomer = await this.userRepository
    .createQueryBuilder('user')
    .orderBy('user.createdAt', 'DESC') 
    .getOne();
    const lastUserId=lastCustomer?.userId?.substring(2)
     const currentId =lastUserId || (0).toString().padStart(9, '0'); //000000
     let incrementedId = (parseInt(currentId) + 1).toString().padStart(9, '0');
     incrementedId = `R-${incrementedId}`;

     const {password,...rest}=data
     const hashPassword=await bcryptjs.hash(password,12)
    
    const result = await this.userRepository.save({...rest,userId:incrementedId,password:hashPassword});
    return result;
  }

  async findAll(options: any, filterOptions: any,organizationId:any) {
    const {skip,sortBy,sortOrder,limit,page}=paginationHelpers(options)

    const queryBuilder = this.userRepository.createQueryBuilder('users')
    .where('users.organizationId = :organizationId', { organizationId });
    queryBuilder.select(['users.id', 'users.name','users.userId','users.role','users.active','users.phone','users.address','users.email','users.createdAt']);

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
  

  async update(id: string, updateUserDto: Partial<Users>) {
    const user = await this.userRepository.findOneBy({userId: id });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.userRepository.update({userId:id}, updateUserDto);
    return this.userRepository.findOne({
      where:{userId:id},
      select:['userId','name','updatedAt','active']
    });
  }


  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
