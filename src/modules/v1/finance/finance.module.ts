import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankAccount } from './entities/bank-account.entity';
import { ExpenseCategory } from './entities/expense-category.entity';
import { Expense } from './entities/expense.entity';
import { FundTransfer } from './entities/fund-transfer.entity';
import { CustomerLedgerEntry } from './entities/customer-ledger-entry.entity';
import { SupplierBill } from './entities/supplier-bill.entity';
import { SupplierPayment } from './entities/supplier-payment.entity';
import { BankStatement } from './entities/bank-statement.entity';
import { BankStatementItem } from './entities/bank-statement-item.entity';
import { Customers } from '../customers/entities/customers.entity';
import { Supplier } from '../supplier/entities/supplier.entity';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BankAccount,
      ExpenseCategory,
      Expense,
      FundTransfer,
      CustomerLedgerEntry,
      SupplierBill,
      SupplierPayment,
      BankStatement,
      BankStatementItem,
      Customers,
      Supplier,
    ]),
    AccountingModule,
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
