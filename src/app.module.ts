import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './modules/v1/user/user.module';
import { PermissionModule } from './modules/v1/permission/permission.module';
// import { DatabaseModule } from './modules/database/database.module';
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
import { TransactionModule } from './modules/v1/transaction/transaction.module';
import { InventoryModule } from './modules/v1/inventory/inventory.module';
import { WarehouseModule } from './modules/v1/warehouse/warehouse.module';
import { AuthModule } from './modules/v1/auth/auth.module';
import { CommentModule } from './modules/v1/Comments/comment.module';
import { OrganizationModule } from './modules/v1/organization/organization.module';
import { RequsitionModule } from './modules/v1/requsition/requsition.module';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { ShopifyModule } from './modules/v1/shopify/shopify.module';
import { SupplierModule } from './modules/v1/supplier/supplier.module';
import { ProcurementModule } from './modules/v1/procurement/procurement.module';
import { PermissionService } from './modules/v1/permission/permission.service';
import { DeliveryPartnerModule } from './modules/v1/delivery-partner/delivery-partner.module';
import { DashboardModule } from './modules/v1/dashboard/dashboard.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/api/v1/images/',
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    UserModule,
    PermissionModule,
    DatabaseModule,
    UserpermissionModule,
    ProductModule,
    OrderModule,
    CustomerModule,
    StatusModule,
    CategoryModule,
    InventoryModule,
    TransactionModule,
    WarehouseModule,
    AuthModule,
    CommentModule,
    OrganizationModule,
    OrganizationModule,
    RequsitionModule,
    ShopifyModule,
    SupplierModule,
    ProcurementModule,
    PermissionModule,
    DeliveryPartnerModule,
    DashboardModule
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
export class AppModule implements OnApplicationBootstrap {
  constructor(private readonly permissionService: PermissionService) {}

  async onApplicationBootstrap() {
    await this.permissionService.seedData();
  }
}
