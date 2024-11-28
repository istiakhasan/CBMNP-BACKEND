import { HttpStatus, Injectable } from '@nestjs/common';
import { Permission } from './entities/permission.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiError } from 'src/middleware/ApiError';
import { v4 as uuidv4 } from 'uuid';
@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}
  async create(createPermissionDto: Permission) {
    const isexist = await this.permissionRepository.findOne({
      where: {
        label: createPermissionDto.label,
      },
    });
    if (isexist) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'Permission label already exist',
      );
    }
    const result = await this.permissionRepository.save(createPermissionDto);
    return result;
  }

 async findAll() {
    const result=await this.permissionRepository.find()
    const transformed = Object.values(
      result.reduce((acc, { base, label, id }) => {
        console.log(acc, "check");
        if (!acc[base]) {
          acc[base] = {
            title: base,
            key: uuidv4(),
            children: [],
          };
        }
        acc[base].children.push({
          title: label,
          key: id, 
        });
        return acc;
      }, {})
    );
    
    console.log(transformed);
    
    
    return transformed
  }

  findOne(id: number) {
    return `This action returns a #${id} permission`;
  }

  update(id: number, updatePermissionDto: Permission) {
    return `This action updates a #${id} permission`;
  }

  remove(id: number) {
    return `This action removes a #${id} permission`;
  }
}
