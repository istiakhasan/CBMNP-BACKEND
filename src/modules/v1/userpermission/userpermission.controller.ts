import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Put, HttpStatus } from '@nestjs/common';
import { UserpermissionService } from './userpermission.service';
import { CreateUserpermissionDto } from './dto/create-userpermission.dto';
import { UpdateUserpermissionDto } from './dto/update-userpermission.dto';
import { UserPermission } from './entities/userpermission.entity';

@Controller('v1/userpermission')
export class UserpermissionController {
  constructor(private readonly userpermissionService: UserpermissionService) {}

  @Put()
 async create(@Body() createUserpermissionDto: UserPermission[]) {


    const result=await this.userpermissionService.createOrUpdate(createUserpermissionDto);
    return {
      success:true,
      statusCode:HttpStatus.OK,
      message:'Permisson grant successfully',
      data:result,
   }
  }

  @Get()
  findAll() {
    return this.userpermissionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userpermissionService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserpermissionDto: UpdateUserpermissionDto) {
    return this.userpermissionService.update(+id, updateUserpermissionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userpermissionService.remove(+id);
  }
}
