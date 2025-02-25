import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { ZodPipe } from '../../../middleware/ZodPipe';
import { CreatePermissionSchema } from './permission.validation';
import { Permission } from './entities/permission.entity';

@Controller('v1/permission')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post()
 async create(@Body(new ZodPipe(CreatePermissionSchema)) createPermissionDto) {
    const result=await this.permissionService.create(createPermissionDto);
    return {
       success:true,
       statusCode:HttpStatus.OK,
       message:'Permission successfully',
       data:result
    }
  }

  @Get()
 async findAll() {
    const result=await this.permissionService.findAll();
    return {
      success:true,
      statusCode:HttpStatus.OK,
      message:'Permission retrived successfully',
      data:result
   }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.permissionService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePermissionDto: Permission) {
    return this.permissionService.update(+id, updatePermissionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.permissionService.remove(+id);
  }
}
