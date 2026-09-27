import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export abstract class SfaBaseEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) organizationId: string;
  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' }) updatedAt: Date;
}

@Entity('dms_regions')
@Index(['organizationId', 'code'], { unique: true })
export class DmsRegion extends SfaBaseEntity {
  @Column() code: string;
  @Column() name: string;
  @Column({ default: true }) active: boolean;
}

@Entity('dms_areas')
@Index(['organizationId', 'code'], { unique: true })
export class DmsArea extends SfaBaseEntity {
  @Column() code: string;
  @Column() name: string;
  @Index() @Column({ type: 'uuid' }) regionId: string;
  @Column({ default: true }) active: boolean;
}

@Entity('sfa_territories')
@Index(['organizationId', 'code'], { unique: true })
export class SfaTerritory extends SfaBaseEntity {
  @Column() code: string;
  @Column() name: string;
  @Column({ nullable: true }) division: string;
  @Column({ nullable: true }) district: string;
  @Index() @Column({ type: 'uuid', nullable: true }) areaId: string;
  @Column({ default: true }) active: boolean;
}

@Entity('dms_distributors')
@Index(['organizationId', 'code'], { unique: true })
export class DmsDistributor extends SfaBaseEntity {
  @Column() code: string;
  @Column() name: string;
  @Index() @Column({ nullable: true }) territoryId: string;
  @Column({ nullable: true }) warehouseId: string;
  @Column({ nullable: true }) contactName: string;
  @Column({ nullable: true }) phone: string;
  @Column({ nullable: true }) email: string;
  @Column({ nullable: true, type: 'text' }) address: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) creditLimit: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) securityDeposit: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) outstandingBalance: number;
  @Column({ nullable: true }) tradeLicenseNumber: string;
  @Column({ nullable: true }) tinNumber: string;
  @Column({ nullable: true }) nidNumber: string;
  @Column({ type: 'date', nullable: true }) agreementStartDate: string;
  @Column({ type: 'date', nullable: true }) agreementEndDate: string;
  @Column({ default: 'Draft' }) onboardingStatus: string;
  @Column({ nullable: true }) blockedReason: string;
  @Column({ default: true }) active: boolean;
}

@Entity('dms_retailers')
@Index(['organizationId', 'code'], { unique: true })
export class DmsRetailer extends SfaBaseEntity {
  @Column() code: string;
  @Column() name: string;
  @Index() @Column({ nullable: true }) distributorId: string;
  @Index() @Column({ nullable: true }) territoryId: string;
  @Column({ nullable: true }) ownerName: string;
  @Column({ nullable: true }) phone: string;
  @Column({ nullable: true, type: 'text' }) address: string;
  @Column({ default: 'Grocery' }) channel: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) creditLimit: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) outstandingBalance: number;
  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true }) latitude: number;
  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true }) longitude: number;
  @Column({ default: true }) active: boolean;
}

@Entity('sfa_routes')
@Index(['organizationId', 'code'], { unique: true })
export class SfaRoute extends SfaBaseEntity {
  @Column() code: string;
  @Column() name: string;
  @Index() @Column({ nullable: true }) territoryId: string;
  @Column({ nullable: true }) assignedUserId: string;
  @Column({ nullable: true }) visitDay: string;
  @Column({ default: true }) active: boolean;
}

@Entity('sfa_field_attendance')
@Index(['organizationId', 'salesRepId', 'date'], { unique: true })
export class SfaFieldAttendance extends SfaBaseEntity {
  @Index() @Column() salesRepId: string;
  @Column({ type: 'date' }) date: string;
  @Column({ type: 'timestamp', nullable: true }) checkInTime: Date;
  @Column({ type: 'timestamp', nullable: true }) checkOutTime: Date;
  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true }) checkInLatitude: number;
  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true }) checkInLongitude: number;
  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true }) checkOutLatitude: number;
  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true }) checkOutLongitude: number;
  @Column({ default: 'Present' }) status: string;
  @Column({ type: 'int', default: 0 }) totalVisits: number;
  @Column({ nullable: true, type: 'text' }) remarks: string;
}

@Entity('sfa_field_visits')
@Index(['organizationId', 'visitDate'])
export class SfaFieldVisit extends SfaBaseEntity {
  @Index() @Column() retailerId: string;
  @Column({ nullable: true }) distributorId: string;
  @Column({ nullable: true }) routeId: string;
  @Index() @Column() salesRepId: string;
  @Column({ type: 'date' }) visitDate: string;
  @Column({ type: 'timestamp', nullable: true }) checkInAt: Date;
  @Column({ type: 'timestamp', nullable: true }) checkOutAt: Date;
  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true }) checkInLatitude: number;
  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true }) checkInLongitude: number;
  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true }) checkOutLatitude: number;
  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true }) checkOutLongitude: number;
  @Column({ default: 'Planned' }) status: string;
  @Column({ default: 'Pending' }) outcome: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) orderAmount: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) collectionAmount: number;
  @Column({ nullable: true, type: 'text' }) note: string;
  @Column({ nullable: true }) photoUrl: string;
}

@Entity('dms_sales_orders')
@Index(['organizationId', 'orderNumber'], { unique: true })
@Index(['organizationId', 'orderDate'])
export class DmsSalesOrder extends SfaBaseEntity {
  @Column() orderNumber: string;
  @Index() @Column() retailerId: string;
  @Column({ nullable: true }) distributorId: string;
  @Column({ nullable: true }) territoryId: string;
  @Column() salesRepId: string;
  @Column({ type: 'date' }) orderDate: string;
  @Column({ type: 'date', nullable: true }) deliveryDate: string;
  @Column({ default: 'Draft' }) status: string;
  @Column({ default: 'Unpaid' }) paymentStatus: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) grossAmount: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) discountAmount: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) taxAmount: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) netAmount: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) paidAmount: number;
  @Column({ nullable: true, type: 'text' }) deliveryAddress: string;
  @Column({ nullable: true, type: 'text' }) note: string;
}

@Entity('dms_sales_order_items')
@Index(['orderId', 'productId'], { unique: true })
export class DmsSalesOrderItem extends SfaBaseEntity {
  @Index() @Column({ type: 'uuid' }) orderId: string;
  @Column({ type: 'uuid' }) productId: string;
  @Column({ nullable: true }) productName: string;
  @Column({ nullable: true }) productSku: string;
  @Column({ nullable: true, default: 'PCS' }) uom: string;
  @Column({ type: 'int' }) quantity: number;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) unitPrice: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) discountAmount: number;
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 }) taxRate: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) taxAmount: number;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) lineTotal: number;
}

@Entity('dms_primary_orders')
@Index(['organizationId', 'orderNumber'], { unique: true })
@Index(['organizationId', 'orderDate'])
export class DmsPrimaryOrder extends SfaBaseEntity {
  @Column() orderNumber: string;
  @Index() @Column({ type: 'uuid' }) distributorId: string;
  @Column({ nullable: true }) warehouseId: string;
  @Column({ type: 'date' }) orderDate: string;
  @Column({ type: 'date', nullable: true }) expectedDeliveryDate: string;
  @Column({ default: 'Draft' }) status: string;
  @Column({ default: 'Unpaid' }) paymentStatus: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) grossAmount: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) discountAmount: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) taxAmount: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) netAmount: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) paidAmount: number;
  @Column({ nullable: true }) challanNumber: string;
  @Column({ nullable: true }) invoiceNumber: string;
  @Column({ nullable: true, type: 'text' }) notes: string;
}

@Entity('dms_primary_order_items')
@Index(['orderId', 'productId'], { unique: true })
export class DmsPrimaryOrderItem extends SfaBaseEntity {
  @Index() @Column({ type: 'uuid' }) orderId: string;
  @Column({ type: 'uuid' }) productId: string;
  @Column({ nullable: true }) productName: string;
  @Column({ nullable: true }) productSku: string;
  @Column({ nullable: true, default: 'PCS' }) uom: string;
  @Column({ type: 'int' }) quantity: number;
  @Column({ type: 'int', default: 0 }) allocatedQuantity: number;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) unitPrice: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) discountAmount: number;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) lineTotal: number;
}

@Entity('dms_distributor_inventory')
@Index(['organizationId', 'distributorId', 'productId'], { unique: true })
export class DmsDistributorInventory extends SfaBaseEntity {
  @Index() @Column({ type: 'uuid' }) distributorId: string;
  @Index() @Column({ type: 'uuid' }) productId: string;
  @Column({ nullable: true }) productName: string;
  @Column({ nullable: true }) productSku: string;
  @Column({ nullable: true, default: 'PCS' }) uom: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) availableQuantity: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) reservedQuantity: number;
  @Column({ type: 'timestamp', nullable: true }) lastRestockedAt: Date;
}

@Entity('sfa_collections')
@Index(['organizationId', 'collectionDate'])
export class SfaCollection extends SfaBaseEntity {
  @Index() @Column() retailerId: string;
  @Column({ nullable: true }) distributorId: string;
  @Column() salesRepId: string;
  @Column({ type: 'date' }) collectionDate: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) amount: number;
  @Column() paymentMethod: string;
  @Column({ nullable: true }) referenceNumber: string;
  @Column({ nullable: true }) bankName: string;
  @Column({ nullable: true }) chequeNumber: string;
  @Column({ type: 'date', nullable: true }) chequeDate: string;
  @Column({ type: 'date', nullable: true }) depositDate: string;
  @Column({ default: 'Submitted' }) status: string;
  @Column({ nullable: true }) verifiedBy: string;
  @Column({ type: 'timestamp', nullable: true }) verifiedAt: Date;
  @Column({ nullable: true, type: 'text' }) note: string;
}

@Entity('dms_schemes')
@Index(['organizationId', 'code'], { unique: true })
export class DmsScheme extends SfaBaseEntity {
  @Column() code: string;
  @Column() name: string;
  @Column({ default: 'Percentage' }) schemeType: string;
  @Column({ type: 'int', default: 1 }) minQuantity: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) minOrderAmount: number;
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 }) discountPercentage: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) flatDiscount: number;
  @Column({ nullable: true }) freeProductId: string;
  @Column({ type: 'int', default: 0 }) freeQuantity: number;
  @Column({ type: 'date', nullable: true }) startDate: string;
  @Column({ type: 'date', nullable: true }) endDate: string;
  @Column({ default: true }) active: boolean;
  @Column({ nullable: true, type: 'text' }) description: string;
}

@Entity('dms_delivery_trips')
@Index(['organizationId', 'tripNumber'], { unique: true })
export class DmsDeliveryTrip extends SfaBaseEntity {
  @Column() tripNumber: string;
  @Index() @Column({ nullable: true }) distributorId: string;
  @Column({ nullable: true }) driverName: string;
  @Column({ nullable: true }) driverPhone: string;
  @Column({ nullable: true }) vehicleNumber: string;
  @Column({ type: 'date' }) tripDate: string;
  @Column({ default: 'Scheduled' }) status: string;
  @Column({ type: 'int', default: 0 }) totalOrders: number;
  @Column({ type: 'int', default: 0 }) deliveredOrders: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) totalAmount: number;
  @Column({ nullable: true, type: 'text' }) note: string;
}

@Entity('dms_delivery_trip_orders')
@Index(['tripId', 'orderId'], { unique: true })
export class DmsDeliveryTripOrder extends SfaBaseEntity {
  @Index() @Column({ type: 'uuid' }) tripId: string;
  @Index() @Column({ type: 'uuid' }) orderId: string;
  @Column({ type: 'int', default: 0 }) sequence: number;
  @Column({ default: 'Pending' }) deliveryStatus: string;
  @Column({ nullable: true }) failureReason: string;
  @Column({ type: 'timestamp', nullable: true }) deliveredAt: Date;
}

@Entity('dms_returns')
@Index(['organizationId', 'returnNumber'], { unique: true })
export class DmsReturn extends SfaBaseEntity {
  @Column() returnNumber: string;
  @Index() @Column({ nullable: true }) distributorId: string;
  @Index() @Column() retailerId: string;
  @Column({ type: 'date' }) returnDate: string;
  @Column({ default: 'Damage' }) returnType: string;
  @Column({ default: 'Pending' }) status: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) totalAmount: number;
  @Column({ nullable: true, type: 'text' }) note: string;
}

@Entity('dms_return_items')
export class DmsReturnItem extends SfaBaseEntity {
  @Index() @Column({ type: 'uuid' }) returnId: string;
  @Column({ type: 'uuid' }) productId: string;
  @Column({ nullable: true }) productName: string;
  @Column({ type: 'int' }) quantity: number;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) unitPrice: number;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) lineTotal: number;
  @Column({ nullable: true }) reason: string;
}

@Entity('sfa_sales_targets')
@Index(['organizationId', 'salesRepId', 'period'], { unique: true })
export class SfaSalesTarget extends SfaBaseEntity {
  @Column() salesRepId: string;
  @Column({ nullable: true }) distributorId: string;
  @Column() period: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) salesTarget: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) collectionTarget: number;
  @Column({ type: 'int', default: 0 }) visitTarget: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) achievedSales: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) achievedCollection: number;
  @Column({ type: 'int', default: 0 }) achievedVisits: number;
}
