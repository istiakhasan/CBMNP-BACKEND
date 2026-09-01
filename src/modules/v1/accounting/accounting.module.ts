import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { JournalEntry } from './entities/journal-entry.entity';
import { JournalItem } from './entities/journal-item.entity';
import { FiscalPeriod } from './entities/fiscal-period.entity';
import { AccountService } from './services/account.service';
import { JournalService } from './services/journal.service';
import { FinancialReportsService } from './services/financial-reports.service';
import { AccountController } from './controllers/account.controller';
import { JournalController } from './controllers/journal.controller';
import { FinancialReportsController } from './controllers/financial-reports.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Account,
      JournalEntry,
      JournalItem,
      FiscalPeriod,
    ]),
  ],
  controllers: [
    AccountController,
    JournalController,
    FinancialReportsController,
  ],
  providers: [
    AccountService,
    JournalService,
    FinancialReportsService,
  ],
  exports: [
    AccountService,
    JournalService,
    FinancialReportsService,
  ],
})
export class AccountingModule {}
