import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Account,
  AccountCategory,
  AccountType,
} from '../entities/account.entity';
import { JournalItem } from '../entities/journal-item.entity';
import { JournalEntry, JournalEntryStatus } from '../entities/journal-entry.entity';

@Injectable()
export class FinancialReportsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(JournalItem)
    private readonly journalItemRepository: Repository<JournalItem>,
    @InjectRepository(JournalEntry)
    private readonly journalEntryRepository: Repository<JournalEntry>,
  ) {}

  /**
   * GENERAL LEDGER REPORT
   * Returns opening balance, line item movements, and running balance for a specific account.
   */
  async getGeneralLedger(
    accountId: string,
    organizationId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const account = await this.accountRepository.findOne({
      where: { id: accountId, organizationId },
    });

    if (!account) {
      throw new NotFoundException(`Account not found`);
    }

    const isDebitNormal =
      account.accountType === AccountType.ASSET ||
      account.accountType === AccountType.EXPENSE;

    // 1. Calculate Opening Balance before startDate
    let openingBalance = 0;
    if (startDate) {
      const openingRaw = await this.journalItemRepository
        .createQueryBuilder('item')
        .innerJoin('item.journalEntry', 'jv')
        .where('item.accountId = :accountId', { accountId })
        .andWhere('item.organizationId = :organizationId', { organizationId })
        .andWhere('jv.status = :status', { status: JournalEntryStatus.POSTED })
        .andWhere('jv.entryDate < :startDate', { startDate })
        .select('COALESCE(SUM(item.debit), 0)', 'totalDebit')
        .addSelect('COALESCE(SUM(item.credit), 0)', 'totalCredit')
        .getRawOne();

      const debit = Number(openingRaw?.totalDebit || 0);
      const credit = Number(openingRaw?.totalCredit || 0);
      openingBalance = isDebitNormal ? debit - credit : credit - debit;
    }

    // 2. Fetch transactions within date range
    const queryBuilder = this.journalItemRepository
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.journalEntry', 'jv')
      .where('item.accountId = :accountId', { accountId })
      .andWhere('item.organizationId = :organizationId', { organizationId })
      .andWhere('jv.status = :status', { status: JournalEntryStatus.POSTED })
      .orderBy('jv.entryDate', 'ASC')
      .addOrderBy('jv.createdAt', 'ASC');

    if (startDate) {
      queryBuilder.andWhere('jv.entryDate >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('jv.entryDate <= :endDate', { endDate });
    }

    const items = await queryBuilder.getMany();

    let currentBalance = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const transactions = items.map((item) => {
      const debit = Number(item.debit || 0);
      const credit = Number(item.credit || 0);
      totalDebit += debit;
      totalCredit += credit;

      if (isDebitNormal) {
        currentBalance += debit - credit;
      } else {
        currentBalance += credit - debit;
      }

      return {
        id: item.id,
        entryNumber: item.journalEntry.entryNumber,
        entryDate: item.journalEntry.entryDate,
        referenceType: item.journalEntry.referenceType,
        referenceId: item.journalEntry.referenceId,
        narration: item.journalEntry.narration,
        memo: item.memo,
        debit,
        credit,
        runningBalance: currentBalance,
      };
    });

    return {
      account: {
        id: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        accountCategory: account.accountCategory,
      },
      startDate: startDate || 'Beginning',
      endDate: endDate || 'Latest',
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance: currentBalance,
      transactions,
    };
  }

  /**
   * TRIAL BALANCE
   * Lists all accounts with their debit/credit balances as of a given date and verifies equality.
   */
  async getTrialBalance(organizationId: string, asOfDate?: string) {
    const targetDate = asOfDate || new Date().toISOString().split('T')[0];

    const accounts = await this.accountRepository.find({
      where: { organizationId },
      order: { accountCode: 'ASC' },
    });

    const queryBuilder = this.journalItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.journalEntry', 'jv')
      .where('item.organizationId = :organizationId', { organizationId })
      .andWhere('jv.status = :status', { status: JournalEntryStatus.POSTED })
      .andWhere('jv.entryDate <= :targetDate', { targetDate })
      .select('item.accountId', 'accountId')
      .addSelect('COALESCE(SUM(item.debit), 0)', 'totalDebit')
      .addSelect('COALESCE(SUM(item.credit), 0)', 'totalCredit')
      .groupBy('item.accountId');

    const rawRows = await queryBuilder.getRawMany();
    const itemMap = new Map<string, { debit: number; credit: number }>();
    rawRows.forEach((row) => {
      itemMap.set(row.accountId, {
        debit: Number(row.totalDebit || 0),
        credit: Number(row.totalCredit || 0),
      });
    });

    let totalTrialDebit = 0;
    let totalTrialCredit = 0;

    const rows = accounts
      .map((acc) => {
        const item = itemMap.get(acc.id) || { debit: 0, credit: 0 };
        const rawDebit = item.debit;
        const rawCredit = item.credit;

        let debitBalance = 0;
        let creditBalance = 0;

        const isDebitNormal =
          acc.accountType === AccountType.ASSET ||
          acc.accountType === AccountType.EXPENSE;

        if (isDebitNormal) {
          const net = rawDebit - rawCredit;
          if (net >= 0) {
            debitBalance = net;
          } else {
            creditBalance = Math.abs(net);
          }
        } else {
          const net = rawCredit - rawDebit;
          if (net >= 0) {
            creditBalance = net;
          } else {
            debitBalance = Math.abs(net);
          }
        }

        totalTrialDebit += debitBalance;
        totalTrialCredit += creditBalance;

        return {
          id: acc.id,
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          accountType: acc.accountType,
          accountCategory: acc.accountCategory,
          debit: debitBalance,
          credit: creditBalance,
        };
      })
      .filter((r) => r.debit !== 0 || r.credit !== 0);

    const difference = Math.abs(totalTrialDebit - totalTrialCredit);
    const isBalanced = difference <= 0.01;

    return {
      asOfDate: targetDate,
      rows,
      totalDebit: totalTrialDebit,
      totalCredit: totalTrialCredit,
      difference,
      isBalanced,
    };
  }

  /**
   * PROFIT & LOSS STATEMENT (Income Statement)
   * Multi-step: Operating Revenue, Cost of Sales, Gross Profit, Operating Expenses, Net Profit.
   */
  async getProfitAndLoss(
    organizationId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const sDate = startDate || `${new Date().getFullYear()}-01-01`;
    const eDate = endDate || new Date().toISOString().split('T')[0];

    const rawBalances = await this.journalItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.journalEntry', 'jv')
      .innerJoin('item.account', 'acc')
      .where('item.organizationId = :organizationId', { organizationId })
      .andWhere('jv.status = :status', { status: JournalEntryStatus.POSTED })
      .andWhere('jv.entryDate >= :sDate AND jv.entryDate <= :eDate', {
        sDate,
        eDate,
      })
      .andWhere('acc.accountType IN (:...types)', {
        types: [AccountType.REVENUE, AccountType.EXPENSE],
      })
      .select('acc.id', 'id')
      .addSelect('acc.accountCode', 'accountCode')
      .addSelect('acc.accountName', 'accountName')
      .addSelect('acc.accountType', 'accountType')
      .addSelect('acc.accountCategory', 'accountCategory')
      .addSelect('COALESCE(SUM(item.debit), 0)', 'totalDebit')
      .addSelect('COALESCE(SUM(item.credit), 0)', 'totalCredit')
      .groupBy('acc.id')
      .addGroupBy('acc.accountCode')
      .addGroupBy('acc.accountName')
      .addGroupBy('acc.accountType')
      .addGroupBy('acc.accountCategory')
      .orderBy('acc.accountCode', 'ASC')
      .getRawMany();

    const revenues: any[] = [];
    const costOfSales: any[] = [];
    const operatingExpenses: any[] = [];
    const otherExpenses: any[] = [];

    let totalRevenue = 0;
    let totalCostOfSales = 0;
    let totalOperatingExpenses = 0;

    rawBalances.forEach((row) => {
      const debit = Number(row.totalDebit || 0);
      const credit = Number(row.totalCredit || 0);

      if (row.accountType === AccountType.REVENUE) {
        // Revenue normal balance is credit: Net = credit - debit
        const amount = credit - debit;
        revenues.push({
          id: row.id,
          accountCode: row.accountCode,
          accountName: row.accountName,
          category: row.accountCategory,
          amount,
        });
        totalRevenue += amount;
      } else if (row.accountCategory === AccountCategory.COST_OF_SALES) {
        // COGS normal balance is debit: Net = debit - credit
        const amount = debit - credit;
        costOfSales.push({
          id: row.id,
          accountCode: row.accountCode,
          accountName: row.accountName,
          category: row.accountCategory,
          amount,
        });
        totalCostOfSales += amount;
      } else {
        // Other Operating & Administrative Expenses
        const amount = debit - credit;
        operatingExpenses.push({
          id: row.id,
          accountCode: row.accountCode,
          accountName: row.accountName,
          category: row.accountCategory,
          amount,
        });
        totalOperatingExpenses += amount;
      }
    });

    const grossProfit = totalRevenue - totalCostOfSales;
    const netProfit = grossProfit - totalOperatingExpenses;
    const netMarginPercentage =
      totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0;

    return {
      period: { startDate: sDate, endDate: eDate },
      revenues,
      totalRevenue,
      costOfSales,
      totalCostOfSales,
      grossProfit,
      operatingExpenses,
      totalOperatingExpenses,
      netProfit,
      netMarginPercentage,
    };
  }

  /**
   * BALANCE SHEET STATEMENT
   * Assets = Liabilities + Equity (incorporating net profit/loss into equity).
   */
  async getBalanceSheet(organizationId: string, asOfDate?: string) {
    const targetDate = asOfDate || new Date().toISOString().split('T')[0];

    // 1. Calculate all Account balances up to targetDate
    const rawBalances = await this.journalItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.journalEntry', 'jv')
      .innerJoin('item.account', 'acc')
      .where('item.organizationId = :organizationId', { organizationId })
      .andWhere('jv.status = :status', { status: JournalEntryStatus.POSTED })
      .andWhere('jv.entryDate <= :targetDate', { targetDate })
      .select('acc.id', 'id')
      .addSelect('acc.accountCode', 'accountCode')
      .addSelect('acc.accountName', 'accountName')
      .addSelect('acc.accountType', 'accountType')
      .addSelect('acc.accountCategory', 'accountCategory')
      .addSelect('COALESCE(SUM(item.debit), 0)', 'totalDebit')
      .addSelect('COALESCE(SUM(item.credit), 0)', 'totalCredit')
      .groupBy('acc.id')
      .addGroupBy('acc.accountCode')
      .addGroupBy('acc.accountName')
      .addGroupBy('acc.accountType')
      .addGroupBy('acc.accountCategory')
      .orderBy('acc.accountCode', 'ASC')
      .getRawMany();

    const currentAssets: any[] = [];
    const nonCurrentAssets: any[] = [];
    const currentLiabilities: any[] = [];
    const longTermLiabilities: any[] = [];
    const equityItems: any[] = [];

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let netProfitCumulative = 0;

    rawBalances.forEach((row) => {
      const debit = Number(row.totalDebit || 0);
      const credit = Number(row.totalCredit || 0);

      if (row.accountType === AccountType.ASSET) {
        const balance = debit - credit;
        totalAssets += balance;
        if (row.accountCategory === AccountCategory.CURRENT_ASSET) {
          currentAssets.push({
            id: row.id,
            accountCode: row.accountCode,
            accountName: row.accountName,
            balance,
          });
        } else {
          nonCurrentAssets.push({
            id: row.id,
            accountCode: row.accountCode,
            accountName: row.accountName,
            balance,
          });
        }
      } else if (row.accountType === AccountType.LIABILITY) {
        const balance = credit - debit;
        totalLiabilities += balance;
        if (row.accountCategory === AccountCategory.CURRENT_LIABILITY) {
          currentLiabilities.push({
            id: row.id,
            accountCode: row.accountCode,
            accountName: row.accountName,
            balance,
          });
        } else {
          longTermLiabilities.push({
            id: row.id,
            accountCode: row.accountCode,
            accountName: row.accountName,
            balance,
          });
        }
      } else if (row.accountType === AccountType.EQUITY) {
        const balance = credit - debit;
        totalEquity += balance;
        equityItems.push({
          id: row.id,
          accountCode: row.accountCode,
          accountName: row.accountName,
          balance,
        });
      } else if (row.accountType === AccountType.REVENUE) {
        // Revenue increases cumulative profit
        netProfitCumulative += credit - debit;
      } else if (row.accountType === AccountType.EXPENSE) {
        // Expenses decrease cumulative profit
        netProfitCumulative -= debit - credit;
      }
    });

    // Add cumulative net profit/loss to Equity section
    equityItems.push({
      id: 'retained-earnings-cumulative',
      accountCode: '3200-CALC',
      accountName: 'Current Period & Retained Net Profit',
      balance: netProfitCumulative,
    });
    totalEquity += netProfitCumulative;

    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
    const difference = Math.abs(totalAssets - totalLiabilitiesAndEquity);
    const isBalanced = difference <= 0.01;

    return {
      asOfDate: targetDate,
      assets: {
        currentAssets,
        totalCurrentAssets: currentAssets.reduce((sum, i) => sum + i.balance, 0),
        nonCurrentAssets,
        totalNonCurrentAssets: nonCurrentAssets.reduce((sum, i) => sum + i.balance, 0),
        totalAssets,
      },
      liabilities: {
        currentLiabilities,
        totalCurrentLiabilities: currentLiabilities.reduce((sum, i) => sum + i.balance, 0),
        longTermLiabilities,
        totalLongTermLiabilities: longTermLiabilities.reduce((sum, i) => sum + i.balance, 0),
        totalLiabilities,
      },
      equity: {
        items: equityItems,
        totalEquity,
      },
      totalLiabilitiesAndEquity,
      isBalanced,
      difference,
    };
  }
}
