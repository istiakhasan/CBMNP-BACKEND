import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entity/product.entity';



@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async createProduct(payload: any): Promise<Product> {
    return await this.productRepository.save(payload);
  }

  async getProducts(): Promise<Product[]> {
    return await this.productRepository.find();
  }

  async getProductById(id: number): Promise<Product> {
    return await this.productRepository.findOne({ where: { id } });
  }
}
