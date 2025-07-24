import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { DelivaryChargeService } from './delivary_charge.service';





@Controller('v1/delivary-charge')
export class DelivaryChargeController {
  constructor(private readonly delivaryChargeService: DelivaryChargeService) {}

  @Post()
  create(@Body() createDelivaryChargeDto: any[]) {
    return this.delivaryChargeService.create(createDelivaryChargeDto);
  }

  @Post('bulk-create')
  async bulkCreate(@Body() bulkCreateDto: any[]) {
    return this.delivaryChargeService.bulkCreate(bulkCreateDto);
  }

  @Get()
  findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.delivaryChargeService.findAll(
      page ? +page : null,
      limit ? +limit : null,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.delivaryChargeService.findOne(+id);
  }

  @Patch('bulk-update')
  async bulkUpdate(@Body() bulkUpdateDto: any) {
    return this.delivaryChargeService.bulkUpdate(bulkUpdateDto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDelivaryChargeDto: any,
  ) {
    return this.delivaryChargeService.update(+id, updateDelivaryChargeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.delivaryChargeService.remove(+id);
  }
}
