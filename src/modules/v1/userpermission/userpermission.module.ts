import { Module } from '@nestjs/common';
import { UserpermissionService } from './userpermission.service';
import { UserpermissionController } from './userpermission.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserPermission } from './entities/userpermission.entity';

@Module({
  imports:[
    TypeOrmModule.forFeature([UserPermission]),
  ],
  controllers: [UserpermissionController],
  providers: [UserpermissionService],
})
export class UserpermissionModule {}
