import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { WarehousePickList } from './warehouse-pick-list.entity';
import { Product } from '../../product/entity/product.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity({ name: 'pick_list_items' })
export class PickListItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  pickListId: string;

  @ManyToOne(() => WarehousePickList, (pl) => pl.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pickListId' })
  pickList: WarehousePickList;

  @Column({ type: 'uuid', nullable: false })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column({ type: 'int', nullable: false })
  totalQuantityToPick: number;

  @Column({ type: 'int', default: 0 })
  pickedQuantity: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  suggestedBinLocation: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt: Date;
}
