import { HttpStatus, Injectable } from '@nestjs/common';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { Warehouse } from './entities/warehouse.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiError } from 'src/middleware/ApiError';
import paginationHelpers from 'src/helpers/paginationHelpers';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class WarehouseService {
  constructor(
  @InjectRepository(Warehouse)
  private readonly warehouse:Repository<Warehouse>
  ){}
  async create(createWarehouseDto: Warehouse) {
    const isExist=await this.warehouse.findOne({where:{name:createWarehouseDto.name}})
    if(isExist){
      throw new ApiError(HttpStatus.BAD_REQUEST,'Name already exist')
    }
    return await this.warehouse.save(createWarehouseDto)
  }

  async findAll(options,filterOptions) {
    const {page,limit,skip,sortBy,sortOrder}=paginationHelpers(options)
    const queryBuilder=this.warehouse.createQueryBuilder('warehouse')
    .take(limit)
    .skip(skip)
    .orderBy(`warehouse.${sortBy}`,sortOrder)
   console.log(filterOptions);

   if (filterOptions?.searchTerm) {
    const searchTerm = `%${filterOptions.searchTerm}%`;

    // Use LOWER function to perform a case-insensitive search
    queryBuilder.andWhere(
      'LOWER(warehouse.name) LIKE LOWER(:searchTerm)',
      { searchTerm },
    );
  }

    const [data, total] = await queryBuilder.getManyAndCount();
    const modifyData = plainToInstance(Warehouse, data);
    return {
      data:modifyData,
      total,
      page,
      limit
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} warehouse`;
  }

  update(id: number, updateWarehouseDto: UpdateWarehouseDto) {
    return `This action updates a #${id} warehouse`;
  }

  remove(id: number) {
    return `This action removes a #${id} warehouse`;
  }
}
