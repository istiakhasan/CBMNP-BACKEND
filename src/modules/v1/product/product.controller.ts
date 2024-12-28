import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseInterceptors,
  UploadedFiles,
  HttpStatus,
  Query
} from '@nestjs/common';
import { ProductService } from './product.service';
import { Product } from './entity/product.entity';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ZodPipe } from 'src/middleware/ZodPipe';
import { ProductSchema } from './product.validation';
import { ApiError } from 'src/middleware/ApiError';
import { uploadFiles } from 'src/util/file-upload.util';
import { extractOptions } from 'src/helpers/queryHelper';

import sendResponse, { IResponse } from 'src/util/sendResponse';
import { Response } from 'express';
import { catchAsync } from 'src/hoc/createAsync';

@Controller('v1/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'images', maxCount: 10 },
      // { name: 'example', maxCount: 1 },
    ]),
  )
  async createProduct(
    @Body(new ZodPipe(ProductSchema)) data: Omit<Product, 'images'>,
    @UploadedFiles() files: { images?: Express.Multer.File[] },
  ) {
    return catchAsync(async () => {
      if (!files?.images || files.images.length === 0) {
        throw new ApiError(HttpStatus.BAD_REQUEST, 'Please select at least one image');
      }
      const images = await uploadFiles(files.images, './uploads');
      const result = await this.productService.createProduct({ ...data, images });
      return {
        success: true,
        message: 'Product created successfully',
        status: HttpStatus.OK,
        data: result,
      };
    });
  }
  
  @Get()
  async getProducts(@Query() query) {
    return catchAsync(async () => {
      const paginationOptions = extractOptions(query, ['limit', 'page', 'sortBy', 'sortOrder']);
      const filterOptions = extractOptions(query, ['searchTerm', 'filterByCustomerType']);
      const result = await this.productService.getProducts(paginationOptions, filterOptions);
      return {
        success: true,
        status: HttpStatus.OK,
        message: 'Products retrieved successfully',
        data: result?.data,
        meta: {
          total: result?.total,
          page: result?.page,
          limit: result?.limit,
        },
      };
    });
  }
  

  @Get(':id')
  async getProductById(@Param('id') id: number): Promise<Product> {
    return await this.productService.getProductById(id);
  }
}
