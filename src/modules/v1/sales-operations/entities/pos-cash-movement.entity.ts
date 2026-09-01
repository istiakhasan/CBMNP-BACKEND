import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PosRegisterSession } from './pos-register-session.entity';
import { Organization } from '../../organization/entities/organization.entity';

export enum CashMovementType {
  CASH_IN = 'CashIn',
  CASH_OUT = 'CashOut',
}

@Entity({ name: 'pos_cash_movements' })
export class PosCashMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  sessionId: string;

  @ManyToOne(() => PosRegisterSession, (s) => s.movements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: PosRegisterSession;

  @Column({
    type: 'enum',
    enum: CashMovementType,
    nullable: false,
  })
  type: CashMovementType;

  @Column({
    type: 'numeric',
    precision: 18,
    scale: 2,
    nullable: false,
  })
  amount: number;

  @Column({ type: 'varchar', length: 255, nullable: false })
  reason: string; // e.g. "Petty cash for cleaning supplies" or "Initial float top-up"

  @Column({ type: 'varchar', length: 100, nullable: true })
  createdById: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;
}
