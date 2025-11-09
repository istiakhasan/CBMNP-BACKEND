
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Thana } from '../../thana/entities/thana.entity';
@Entity({ name: 'delivary_charge' }) // database name
export class DelivaryCharge {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Thana, (thana) => thana.delivaryCharges, {
    onDelete: 'SET NULL',
  })
  thana: Thana;

  @Column({ type: 'int', nullable: true })
  thana_id: number; // Keeping the existing column to avoid issues

  @Column({ type: 'int', nullable: true, comment: 'Reguler Prices' })
  prices: number;
  @Column({
    type: 'int',
    nullable: true,
    comment: 'Express Prices',
    default: 0,
  })
  expressPrices: number;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  public created_at: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  public updated_at: Date;
}
