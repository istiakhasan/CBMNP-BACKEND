import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GarmentsBOM } from './garmentsBom.entity';
import { GarmentsInventory } from './garmentsInventory.entity';

@Entity('garments_material_issues')
export class GarmentsMaterialIssue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  bomId: string;

  @ManyToOne(() => GarmentsBOM, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bomId' })
  bom: GarmentsBOM;

  @Column()
  inventoryId: string;

  @ManyToOne(() => GarmentsInventory, (inv) => inv.issues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventoryId' })
  inventory: GarmentsInventory;

  @Column({ default: 'ISSUE' }) // 'ISSUE' | 'RETURN'
  type: string;

  @Column({ type: 'decimal', precision: 14, scale: 3 })
  qty: number;

  @Column({ nullable: true })
  lineNo: string; // e.g. Line 04, Cutting Table 02

  @Column({ nullable: true })
  lotNumber: string;

  @Column({ nullable: true })
  issuedBy: string;

  @Column({ nullable: true })
  receivedBy: string;

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ nullable: true })
  organizationId: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt: Date;
}
