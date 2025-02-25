import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Req, HttpStatus } from '@nestjs/common';

import { CreateRequsitionDto } from './dto/create-requsition.dto';
import { UpdateRequsitionDto } from './dto/update-requsition.dto';
import { RequisitionService } from './requsition.service';
import { extractOptions } from '../../../helpers/queryHelper';

@Controller('v1/requisition')
export class RequsitionController {
  constructor(private readonly requsitionService: RequisitionService) {}

  @Post()
  create(@Body() createRequsitionDto: CreateRequsitionDto,@Req() req:Request) {
    const organizationId=req.headers['x-organization-id']
    return this.requsitionService.createRequisition(createRequsitionDto,organizationId);
  }
  @Get()
  async getAllRequisition(@Query() query,@Req() req:Request){
    const organizationId=req.headers['x-organization-id']
    const paginationOptions = extractOptions(query, ['limit', 'page', 'sortBy', 'sortOrder']);
    const filterOptions = extractOptions(query, ['searchTerm', 'filterByCustomerType']);
    const result= await this.requsitionService.getAllRequisition(paginationOptions,filterOptions,organizationId);
    return {
      success:true,
      statusCode:HttpStatus.OK,
      message:'Requisition retrieved successfully',
      data:result?.data,
      meta: {
        page: result?.page,
        limit: result?.limit,
        total: result?.total
      }
   }
  }


  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.requsitionService.getRequisitionWithOrders(id);
  }

}
