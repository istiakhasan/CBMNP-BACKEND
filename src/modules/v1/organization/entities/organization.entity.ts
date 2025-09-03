import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Users } from "../../user/entities/user.entity";
import { ApiProperty } from "@nestjs/swagger";

@Entity({ name: 'organizations' })
export class Organization {
  @ApiProperty({ example: 'a3f83a7a-1c2d-4b6e-8eaa-9f02f64c52df', description: 'Unique ID of the organization' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Organic Foods Ltd', description: 'Name of the organization' })
  @Column({ nullable: true, unique: true })
  name: string;

  @ApiProperty({ example: '+8801712345678', description: 'Phone number of the organization', required: false })
  @Column({ nullable: true })
  phone: string;

  @ApiProperty({ example: 'info@organicfoods.com', description: 'Email address of the organization', required: false })
  @Column({ nullable: true })
  email: string;

  @ApiProperty({ example: 'Dhaka, Bangladesh', description: 'Address of the organization', required: false })
  @Column({ nullable: true })
  address: string;

  @ApiProperty({ example: 'https://example.com/logo.png', description: 'Logo URL of the organization', required: false })
  @Column({ nullable: true })
  logo: string;

  @OneToMany(() => Users, (user) => user.organization)
  users: Users[];

  @ApiProperty({ example: '2025-09-03T12:00:00Z', description: 'Created timestamp' })
  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt: Date;

  @ApiProperty({ example: '2025-09-03T12:30:00Z', description: 'Last updated timestamp' })
  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt: Date;
}
