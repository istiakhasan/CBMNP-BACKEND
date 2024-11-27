import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Users } from './entities/user.entity';
import { Repository } from 'typeorm';

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

  async findAll() {
    const result = await this.userRepository.find({
      relations: ['userPermissions', 'userPermissions.permission'],
    });
    return result;
  }

  async findOne(id: number) {
    const result = await this.userRepository.findOne({
      where: { id },
      relations: ['userPermissions', 'userPermissions.permission'],
    });
  
    if (!result) {
      throw new Error(`User with ID ${id} not found`);
    }
  
    // Map the permissions into an array of labels
    const permissions = result.userPermissions.map(
      (userPermission) => userPermission.permission.label
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
  

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
