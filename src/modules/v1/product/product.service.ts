import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository,DataSource } from 'typeorm';
import { Product } from './entity/product.entity';
import { plainToInstance } from 'class-transformer';
import paginationHelpers from 'src/helpers/paginationHelpers';
import { ApiError } from 'src/middleware/ApiError';
import { ProductImages } from './entity/image.entity';
import axios from 'axios';



@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductImages)
    private readonly productImageRepository: Repository<ProductImages>,
    private readonly dataSource: DataSource,
  ) {}

  async createSimpleProduct(payload: any): Promise<Product> {
    return await this.productRepository.save(payload);
  }

  async createVariantProduct(createProductDto: Product): Promise<Product> {
    return await this.dataSource.transaction(async (manager) => {
      const { variants, ...baseProductData } = createProductDto;
      const variantEntities = variants.map((variant) =>
        this.productRepository.create({
          ...variant,
          isBaseProduct: false,
        }),
      );
      const savedVariants = await manager.save(variantEntities);

      const baseProduct = this.productRepository.create({
        ...baseProductData,
        isBaseProduct: true,
        variants: savedVariants,
      });
      const savedBaseProduct = await manager.save(baseProduct);
  
      savedBaseProduct.variants = savedVariants;
      return savedBaseProduct;
    });
  }
  

  async getProducts(options,filterOptions) {
     const {page,limit,skip,sortBy,sortOrder}=   paginationHelpers(options)
     const queryBuilder = this.productRepository.createQueryBuilder('product')
     .leftJoinAndSelect('product.category', 'category') 
     .leftJoinAndSelect('product.attributes', 'attributes') 
     .leftJoinAndSelect('product.images', 'images') 
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

  async getProductById(id: string) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['category', 'attributes', 'variants','images'],
    });
  
    if (!product) {
      throw new ApiError(HttpStatus.BAD_GATEWAY, 'Product does not exist');
    }
  
 
    let result;
    if (product.baseProductId) {
      const baseProduct = await this.productRepository.findOne({
        where: { id: product.baseProductId },
        relations: ['category', 'attributes', 'variants'],
      });
  
      if (baseProduct) {
        const productIds = [
          { id: baseProduct.id, name: baseProduct.name },
          ...baseProduct.variants?.map(item => ({
            id: item.id,
            name: item.name,
          })) || [],
        ];
  
        result = {
          ids: productIds,
          data: product,
        };
      } else {
        throw new ApiError(HttpStatus.BAD_REQUEST, 'Base product does not exist');
      }
    } else {
      result = {
        ids: [
          ...(product?.isBaseProduct ? [{ id: product.id, name: product.name }] : []),
          ...(product.variants?.map(item => ({
            id: item.id,
            name: item.name,
          })) || []),
        ],
        data: product,
      };
    }
  
    return result;
  }
  
  async updateProductById(id: string, data: Product): Promise<Product> {
    const existingProduct = await this.productRepository.findOne({ where: { id } });
    if (!existingProduct) {
        throw new ApiError(HttpStatus.BAD_GATEWAY, 'Product does not exist');
    }
    if (data.images) {
        await this.productImageRepository.delete({ productId: id });
        for (const image of data.images) {
            await this.productImageRepository.save({
                productId: id,
                url: image.url,
                delete_url: image.delete_url,
            });
        }
        delete data.images;
    }
    const result = await this.productRepository.update({ id }, data);
    if (result.affected > 0) {
        return await this.productRepository.findOne({
            where: { id },
            relations: ['images'],
        });
    } else {
        return null;
    }
}

  async countProducts() {
    const rawStatuses = await this.productRepository
      .createQueryBuilder('products')
      .select('COALESCE(products.active, false)', 'status')
      .addSelect('COUNT(products.id)', 'count')
      .groupBy('COALESCE(products.active, false)')
      .getRawMany();
  
    const totalOrders = await this.productRepository
      .createQueryBuilder('products')
      .select('COALESCE(COUNT(products.id), 0)', 'count')
      .getRawOne();
  
    const variantProducts = await this.productRepository
      .createQueryBuilder('product')
      .select("'Variant'", 'status') 
      .addSelect('COUNT(product.id)', 'count')
      .where('product.productType = :type', { type: 'Variant' })
      .getRawOne();
      console.log(variantProducts,"check");
  
    // Transform the raw statuses
    const statuses = rawStatuses.map(item => ({
      status: item.status ? 'Active' : 'Inactive',
      count: Number(item.count),
    }));
  
    // Add total count and variant count to the results
    const result = [
      ...statuses,
      { status: 'Total', count: Number(totalOrders?.count || 0) },
      ...(variantProducts ? [{ status: 'Variant', count: Number(variantProducts.count) }] : []),
    ];
  
    console.log(result, 'Result');
    return result;
  }

  async deleteProductImageService(deleteUrl:string){
 
    const deleteImage = async () => {
      const deleteUrl = "https://ibb.co/P6dLKwB/f1276341a76e23561be64e9b33afa48a";
    
      try {
        const response = await axios.get(deleteUrl);
        console.log("Image deleted successfully", response.data);
      } catch (error) {
        console.error("Error deleting image:", error.message);
      }
    };
    
    deleteImage();
    
  }
  
}
