import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';

@Module({
  controllers: [TransactionController],
  providers: [TransactionService],
  imports:[TypeOrmModule.forFeature([Transaction])]
})
export class TransactionModule {}
