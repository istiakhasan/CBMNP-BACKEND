import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ProductService } from './product.service';
import { Product } from './entity/product.entity';



@Controller('v1/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  async createProduct(@Body() payload: any): Promise<Product> {
    return await this.productService.createProduct(payload);
  }

  @Get()
  async getProducts(): Promise<Product[]> {
    return await this.productService.getProducts();
  }

  @Get(':id')
  async getProductById(@Param('id') id: number): Promise<Product> {
    return await this.productService.getProductById(id);
  }
}
