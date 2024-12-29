import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './modules/v1/user/user.module';
import { PermissionModule } from './modules/v1/permission/permission.module';
import { DatabaseModule } from './modules/database/database.module';
import { GlobalExceptionFilter } from './middleware/globalErrorHandler';
import { APP_FILTER } from '@nestjs/core';
import { UserpermissionModule } from './modules/v1/userpermission/userpermission.module';
import { ProductModule } from './modules/v1/product/product.module';
import { OrderModule } from './modules/v1/order/order.module';
import { CustomerModule } from './modules/v1/customers/customers.module';
import { StatusModule } from './modules/v1/status/status.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { CategoryModule } from './modules/v1/category/category.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/api/v1/images/',
    }),
    UserModule,
    PermissionModule,
    DatabaseModule,
    UserpermissionModule,
    ProductModule,
    OrderModule,
    CustomerModule,
    StatusModule,
    CategoryModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      useClass: GlobalExceptionFilter,
      provide: APP_FILTER,
    },
  ],
})
export class AppModule {}
