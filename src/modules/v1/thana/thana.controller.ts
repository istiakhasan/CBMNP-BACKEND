import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ThanaService } from './thana.service';
import { AuthGuard } from 'src/middleware/auth.guard';
import { Roles } from 'src/middleware/roles.decorator';

@Controller('thana')
export class ThanaController {
  constructor(private readonly thanaService: ThanaService) {}

  @Post()
  create(@Body() createThanaDto: any) {
    return this.thanaService.create(createThanaDto);
  }

  @Get()
  findAll() {
    return this.thanaService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.thanaService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateThanaDto: any) {
    return this.thanaService.update(+id, updateThanaDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.thanaService.remove(+id);
  }
}
