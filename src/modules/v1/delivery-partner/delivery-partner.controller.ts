import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpStatus,
  Query,
  Req,
} from '@nestjs/common';
import { DeliveryPartnerService } from './delivery-partner.service';
import { CreateDeliveryPartnerDto } from './dto/create-delivery-partner.dto';
import { UpdateDeliveryPartnerDto } from './dto/update-delivery-partner.dto';
import { catchAsync } from 'src/hoc/createAsync';
import { IResponse } from 'src/util/sendResponse';
import { DeliveryPartner } from './entities/delivery-partner.entity';
import { extractOptions } from 'src/helpers/queryHelper';

@Controller('v1/delivery-partner')
export class DeliveryPartnerController {
  constructor(
    private readonly deliveryPartnerService: DeliveryPartnerService,
  ) {}

  @Post('create')
  create(@Body() createDeliveryPartnerDto: CreateDeliveryPartnerDto) {
    return catchAsync(async (): Promise<IResponse<DeliveryPartner>> => {
      const result = await this.deliveryPartnerService.create(
        createDeliveryPartnerDto,
      );
      return {
        message: 'Configure Shopify  successfully',
        statusCode: HttpStatus.OK,
        data: result,
        success: true,
      };
    });
  }

  @Get()
  async getPartner(@Query() query,@Req() req:Request) {
    const organizationId=req.headers['x-organization-id']
    return catchAsync(async ():Promise<IResponse<DeliveryPartner[]>> => {
      const paginationOptions = extractOptions(query, ['limit', 'page', 'sortBy', 'sortOrder']);
      const filterOptions = extractOptions(query, ['searchTerm', 'filterByCustomerType']);
      const result = await this.deliveryPartnerService.getPartner(paginationOptions, filterOptions,organizationId);
      return {
        success: true,
        statusCode: HttpStatus.OK,
        message: 'Delivery partner retrieved successfully',
        data: result?.data,
        meta: {
          total: result?.total,
          page: result?.page,
          limit: result?.limit,
        },
      };
    });
  }

  @Get('/options')
  async warehouseOptions(@Req() req:Request){
    const organizationId=req.headers['x-organization-id']
   return catchAsync(async(): Promise<IResponse<{label:string;value:string}[]>>=>{
    const result = await this.deliveryPartnerService.loadOptions(organizationId);
    return {
      success: true,
      statusCode: HttpStatus.OK,
      message: 'Delivery Partner options retrieved successfully',
      data: result
    };
   })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deliveryPartnerService.findOne(+id);
  }

  @Patch(':id')
   async update(@Param('id') id: string,@Body() data:any) {
 
     return catchAsync(async ():Promise<IResponse<DeliveryPartner>> => {
       const result = await this.deliveryPartnerService.update(id,data);
       return {
         success: true,
         statusCode: HttpStatus.OK,
         message: 'Partner update successfully',
         data: result,
       };
     });
   }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deliveryPartnerService.remove(+id);
  }
}
