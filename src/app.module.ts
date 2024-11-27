import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './modules/v1/user/user.module';
import { PermissionModule } from './modules/v1/permission/permission.module';
import { DatabaseModule } from './modules/database/database.module';
import { GlobalExceptionFilter } from './middleware/globalErrorHandler';
import { APP_FILTER } from '@nestjs/core';
import { UserpermissionModule } from './modules/v1/userpermission/userpermission.module';

@Module({
  imports: [UserModule, PermissionModule,DatabaseModule, UserpermissionModule],
  controllers: [AppController],
  providers: [AppService,{
    useClass:GlobalExceptionFilter,
    provide:APP_FILTER
  }],
})
export class AppModule {}
