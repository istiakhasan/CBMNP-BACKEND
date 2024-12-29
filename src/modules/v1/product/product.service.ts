import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entity/product.entity';
import { plainToInstance } from 'class-transformer';
import paginationHelpers from 'src/helpers/paginationHelpers';



@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async createProduct(payload: any): Promise<Product> {
    return await this.productRepository.save(payload);
  }

  async getProducts(options,filterOptions) {
     const {page,limit,skip,sortBy,sortOrder}=   paginationHelpers(options)
        const queryBuilder = this.productRepository.createQueryBuilder('product')
            .take(limit)
            .skip(skip)
            .orderBy(`product.${sortBy}`, sortOrder);
    
        // Search
        if (filterOptions?.searchTerm) {
            const searchTerm = `%${filterOptions.searchTerm}%`;
            queryBuilder.andWhere(
                '(customers.customerName LIKE :searchTerm OR customers.customer_Id LIKE :searchTerm OR customers.customerPhoneNumber LIKE :searchTerm)',
                { searchTerm }
            );
        }
    
        // Filter by customerType
        if (filterOptions?.filterByCustomerType) {
            queryBuilder.andWhere('customers.customerType = :customerType', {
                customerType: filterOptions.filterByCustomerType,
            });
        }
    
        // Execute query
        const [data, total] = await queryBuilder.getManyAndCount();
        const modifyData = plainToInstance(Product, data);
        return {
            data: modifyData,
            total,
            page,
            limit,
        };
  }

  async getProductById(id: number): Promise<Product> {
    console.log(id,"check");
    return await this.productRepository.findOne({ where: { id } });
  }
}
