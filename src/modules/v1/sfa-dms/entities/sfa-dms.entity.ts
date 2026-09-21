import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

abstract class SfaBaseEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) organizationId: string;
  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' }) updatedAt: Date;
}

@Entity('sfa_territories')
@Index(['organizationId', 'code'], { unique: true })
export class SfaTerritory extends SfaBaseEntity {
  @Column() code: string;
  @Column() name: string;
  @Column({ nullable: true }) division: string;
  @Column({ nullable: true }) district: string;
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
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) creditLimit: number;
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
  @Column({ default: 'Planned' }) status: string;
  @Column({ nullable: true, type: 'text' }) note: string;
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
  @Column({ default: 'Draft' }) status: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) grossAmount: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) discountAmount: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) netAmount: number;
  @Column({ nullable: true, type: 'text' }) note: string;
}

@Entity('dms_sales_order_items')
@Index(['orderId', 'productId'], { unique: true })
export class DmsSalesOrderItem extends SfaBaseEntity {
  @Index() @Column({ type: 'uuid' }) orderId: string;
  @Column({ type: 'uuid' }) productId: string;
  @Column({ type: 'int' }) quantity: number;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) unitPrice: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) discountAmount: number;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) lineTotal: number;
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
  @Column({ default: 'Submitted' }) status: string;
  @Column({ nullable: true, type: 'text' }) note: string;
}

@Entity('sfa_sales_targets')
@Index(['organizationId', 'salesRepId', 'period'], { unique: true })
export class SfaSalesTarget extends SfaBaseEntity {
  @Column() salesRepId: string;
  @Column() period: string;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) salesTarget: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) collectionTarget: number;
  @Column({ type: 'int', default: 0 }) visitTarget: number;
}
