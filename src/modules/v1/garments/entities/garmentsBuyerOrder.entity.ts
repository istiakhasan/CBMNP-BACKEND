import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { GarmentsBOM } from './garmentsBom.entity';
import { GarmentsPO } from './garmentsPo.entity';

@Entity('garments_buyer_orders')
export class GarmentsBuyerOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ unique: true })
  orderNo: string; // e.g. ORD-2026-1001 or SMP-2026-1001

  @Column()
  buyerName: string;

  @Column({ default: 'BULK' })
  orderType: string; // 'BULK' | 'SAMPLE'

  @Column({ nullable: true })
  sampleType: string; // 'Proto Sample' | 'Fit Sample' | 'SMS (Salesman Sample)' | 'PPS (Pre-Production)' | 'TOP Sample' | 'Counter Sample' | 'Photo Shoot'

  @Column({ nullable: true })
  sampleStatus: string; // 'pending' | 'pattern_making' | 'in_sample_room' | 'measurement_qc' | 'dispatched' | 'approved' | 'revision_needed' | 'rejected'

  @Column({ nullable: true })
  sampleSize: string; // e.g. 'M', 'L', 'S, M, L, XL'

  @Column({ type: 'date', nullable: true })
  sampleDeadline: string; // Sample target dispatch date

  @Column({ type: 'text', nullable: true })
  techPackRef: string; // Tech Pack document reference / CAD drawing ID

  @Column({ type: 'text', nullable: true })
  buyerFeedback: string; // Fit comments & revisions from buyer

  @Column({ nullable: true })
  styleName: string;

  @Column({ nullable: true })
  itemType: string;

  @Column({ nullable: true })
  season: string;

  @Column({ type: 'int', default: 0 })
  orderQuantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ type: 'date', nullable: true })
  deliveryDate: string;

  @Column({ default: 'pending' })
  status: string; // 'pending' | 'running' | 'completed' | 'cancelled'

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  contactPerson: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  organizationId: string;

  @OneToMany(() => GarmentsBOM, (bom) => bom.order)
  boms: GarmentsBOM[];

  @OneToMany(() => GarmentsPO, (po) => po.order)
  pos: GarmentsPO[];

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt: Date;
}
