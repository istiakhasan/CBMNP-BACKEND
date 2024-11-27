import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UserpermissionService } from './userpermission.service';
import { CreateUserpermissionDto } from './dto/create-userpermission.dto';
import { UpdateUserpermissionDto } from './dto/update-userpermission.dto';
import { UserPermission } from './entities/userpermission.entity';

@Controller('v1/userpermission')
export class UserpermissionController {
  constructor(private readonly userpermissionService: UserpermissionService) {}

  @Post()
  create(@Body() createUserpermissionDto: UserPermission) {
   
    return this.userpermissionService.create(createUserpermissionDto);
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
