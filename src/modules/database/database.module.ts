import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',            
      host: process.env.DB_HOST,   
      port: 5432,                  
      username: "postgres", 
      password: "root", 
      database: "cmb_np",     
      entities: [join(process.cwd(), '/dist/**/*.entity.js')],                       
      synchronize: true,                   
      logging: false,  
    }),
  ],
})
export class DatabaseModule {}
