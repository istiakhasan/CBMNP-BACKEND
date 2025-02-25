import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import paginationHelpers from '../../../helpers/paginationHelpers';
import { Category } from './entity/category.entity';
import { ApiError } from '../../../middleware/ApiError';



@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async createCategory(payload: Category): Promise<Category> {
    const isExist=await this.categoryRepository.findOne({
      where:{label:payload?.label}
    })
    if(isExist){
      throw new ApiError(HttpStatus.BAD_REQUEST,"Category is already in list")
    }
    return await this.categoryRepository.save(payload);
  }

  async getCategory(options,filterOptions) {
     const {page,limit,skip,sortBy,sortOrder}=   paginationHelpers(options)
        const queryBuilder = this.categoryRepository.createQueryBuilder('categories')
            .take(limit)
            .skip(skip)
            .orderBy(`categories.${sortBy}`, sortOrder);
    
        // Search
        if (filterOptions?.searchTerm) {
            const searchTerm = `%${filterOptions.searchTerm}%`;
            queryBuilder.andWhere(
                '(categories.label LIKE :searchTerm)',
                { searchTerm }
            );
        }

        const [data, total] = await queryBuilder.getManyAndCount();
        const modifyData = plainToInstance(Category, data);
        return {
            data: modifyData,
            total,
            page,
            limit,
        };
  }

  async getProductById(id: number): Promise<Category> {
    return await this.categoryRepository.findOne({ where: { id } });
  }
  async updateCategoryById(id: number,data:Partial<Category>) {
    const result= await this.categoryRepository.update({id},data);
    console.log(result);
    if(result?.affected>0){
      return await this.categoryRepository.findOne({where:{id}})
    }
    else{
      return null
    }
  }
}
