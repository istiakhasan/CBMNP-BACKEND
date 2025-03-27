import { Controller, Get, Post, Body, Patch, Param, Delete, Req, HttpStatus } from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Supplier } from './entities/supplier.entity';
import { IResponse } from '../../../util/sendResponse';
import { catchAsync } from '../../../hoc/createAsync';

@Controller('v1/supplier')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Post()
    create(@Body() createSupplierDto: Supplier,@Req() req:Request) {
      const organizationId=req.headers['x-organization-id']
      return catchAsync(async (): Promise<IResponse<Supplier>> => {
        const result = await this.supplierService.create({...createSupplierDto,organizationId});
        return {
          success: true,
          message: 'Supplier created successfully',
          statusCode: HttpStatus.OK,
          data: result,
        };
      });
    }



    @Get('/options')
    async warehouseOptions(@Req() req:Request){
      const organizationId=req.headers['x-organization-id']
     return catchAsync(async(): Promise<IResponse<Supplier[]>>=>{
      const result = await this.supplierService.loadOptions(organizationId);
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Warehouse options retrieved successfully',
        data: result
      };
     })
    }

  @Get()
  findAll() {
    return this.supplierService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.supplierService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSupplierDto: UpdateSupplierDto) {
    return this.supplierService.update(+id, updateSupplierDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.supplierService.remove(+id);
  }
}
