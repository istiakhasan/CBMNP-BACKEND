import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quotation } from './entities/quotation.entity';
import { QuotationItem } from './entities/quotation-item.entity';
import { Coupon } from './entities/coupon.entity';
import { CouponUsage } from './entities/coupon-usage.entity';
import { CustomerCreditProfile } from './entities/customer-credit-profile.entity';
import { PosRegisterSession } from './entities/pos-register-session.entity';
import { PosCashMovement } from './entities/pos-cash-movement.entity';
import { Order } from '../order/entities/order.entity';
import { Products as OrderProduct } from '../order/entities/products.entity';
import { Customers } from '../customers/entities/customers.entity';
import { SalesOperationsService } from './sales-operations.service';
import { SalesOperationsController } from './sales-operations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Quotation,
      QuotationItem,
      Coupon,
      CouponUsage,
      CustomerCreditProfile,
      PosRegisterSession,
      PosCashMovement,
      Order,
      OrderProduct,
      Customers,
    ]),
  ],
  controllers: [SalesOperationsController],
  providers: [SalesOperationsService],
  exports: [SalesOperationsService],
})
export class SalesOperationsModule {}
