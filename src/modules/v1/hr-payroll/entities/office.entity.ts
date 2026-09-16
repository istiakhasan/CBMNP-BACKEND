import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'hr_offices' })
@Index(['organizationId', 'name'], { unique: true })
export class HrOffice {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ type: 'text', nullable: true }) address: string;
  @Column({ type: 'decimal', precision: 10, scale: 7 }) latitude: number;
  @Column({ type: 'decimal', precision: 10, scale: 7 }) longitude: number;
  @Column({ type: 'int', default: 100 }) radiusMeters: number;
  @Column({ default: true }) isActive: boolean;
  @Column({ type: 'uuid' }) organizationId: string;
}
