import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';

import { CreateRequsitionDto } from './dto/create-requsition.dto';
import { UpdateRequsitionDto } from './dto/update-requsition.dto';
import { RequisitionService } from './requsition.service';

@Controller('v1/requisition')
export class RequsitionController {
  constructor(private readonly requsitionService: RequisitionService) {}

  @Post()
  create(@Body() createRequsitionDto: CreateRequsitionDto) {
    return this.requsitionService.createRequisition(createRequsitionDto);
  }


  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.requsitionService.getRequisitionWithOrders(id);
  }

}
