
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { District } from '../../districts/entities/district.entity';
import { DelivaryCharge } from '../../delivary_charge/entities/delivary_charge.entity';
@Entity({ name: 'thana' }) // database name
export class Thana {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true, comment: 'Thana Bangla Name' })
  name_bn: string;

  @ManyToOne((type) => District, (district) => district.thana_info)
  district: District;

  @Column({ type: 'varchar', nullable: true, comment: 'Thana English Name' })
  name_en: string;

  @OneToMany(() => DelivaryCharge, (delivaryCharge) => delivaryCharge.thana)
  delivaryCharges: DelivaryCharge[];

  @Column({ type: 'int', nullable: true })
  auth_id: number;
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
