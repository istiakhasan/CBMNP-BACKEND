import {Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';


@Entity({ name: 'warehouse' })
export class Warehouse {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({nullable:true,unique:true})
  name:string
  @Column({nullable:true})
  location:string
  @Column({nullable:true})
  contactPerson:string
  @Column({nullable:true})
  phone:string
  @Column({nullable:true})
  organizationId:string
  @CreateDateColumn({type:'timestamp',default:()=>'CURRENT_TIMESTAMP(6)'})
  createdAt: Date;
  @UpdateDateColumn({type:'timestamp',default:()=>'CURRENT_TIMESTAMP(6)',onUpdate:'CURRENT_TIMESTAMP(6)'})
  updatedAt: Date;
}
