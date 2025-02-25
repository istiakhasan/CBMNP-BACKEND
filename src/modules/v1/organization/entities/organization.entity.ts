import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Users } from "../../user/entities/user.entity";

@Entity({name:'organizations'})
export class Organization {
   @PrimaryGeneratedColumn('uuid')
     id: string;
     @Column({nullable:true,unique:true})
     name:string
     @Column({nullable:true})
     phone:string
     @Column({nullable:true})
     address:string
     @Column({nullable:true})
     logo:string
     @OneToMany(()=>Users,(user)=>user.organization)
     users:Users[]
     @CreateDateColumn({type:'timestamp',default:()=>'CURRENT_TIMESTAMP(6)'})
     createdAt: Date;
     @UpdateDateColumn({type:'timestamp',default:()=>'CURRENT_TIMESTAMP(6)',onUpdate:'CURRENT_TIMESTAMP(6)'})
     updatedAt: Date; 
}
