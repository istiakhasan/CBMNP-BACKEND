import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { BankAccount, BankAccountType } from './entities/bank-account.entity';
import { Expense, ExpenseStatus } from './entities/expense.entity';
import { ExpenseCategory } from './entities/expense-category.entity';
import { FundTransfer } from './entities/fund-transfer.entity';
import { CustomerLedgerEntry, CustomerLedgerType } from './entities/customer-ledger-entry.entity';
import { SupplierBill, SupplierBillStatus } from './entities/supplier-bill.entity';
import { SupplierPayment } from './entities/supplier-payment.entity';
import { BankStatement, ReconciliationStatus } from './entities/bank-statement.entity';
import { BankStatementItem } from './entities/bank-statement-item.entity';
import { Customers } from '../customers/entities/customers.entity';
import { Supplier } from '../supplier/entities/supplier.entity';
import { JournalService } from '../accounting/services/journal.service';
import { JournalEntryType } from '../accounting/entities/journal-entry.entity';

@Injectable()
export class FinanceService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(BankAccount)
    private readonly bankAccountRepo: Repository<BankAccount>,
    @InjectRepository(ExpenseCategory)
    private readonly expenseCategoryRepo: Repository<ExpenseCategory>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(FundTransfer)
    private readonly fundTransferRepo: Repository<FundTransfer>,
    @InjectRepository(CustomerLedgerEntry)
    private readonly customerLedgerRepo: Repository<CustomerLedgerEntry>,
    @InjectRepository(SupplierBill)
    private readonly supplierBillRepo: Repository<SupplierBill>,
    @InjectRepository(SupplierPayment)
    private readonly supplierPaymentRepo: Repository<SupplierPayment>,
    @InjectRepository(BankStatement)
    private readonly bankStatementRepo: Repository<BankStatement>,
    @InjectRepository(BankStatementItem)
    private readonly bankStatementItemRepo: Repository<BankStatementItem>,
    @InjectRepository(Customers)
    private readonly customerRepo: Repository<Customers>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    private readonly journalService: JournalService,
  ) {}

  // ================= BANK & CASH ACCOUNTS =================
  async createBankAccount(data: Partial<BankAccount>, organizationId: string): Promise<BankAccount> {
    const existing = await this.bankAccountRepo.findOne({
      where: { organizationId, accountNumber: data.accountNumber?.trim() },
    });
    if (existing) {
      throw new BadRequestException(`Bank account #${data.accountNumber} already registered`);
    }

    const account = this.bankAccountRepo.create({
      ...data,
      currentBalance: Number(data.openingBalance || 0),
      organizationId,
    });
    return this.bankAccountRepo.save(account);
  }

  async getBankAccounts(organizationId: string): Promise<BankAccount[]> {
    return this.bankAccountRepo.find({
      where: { organizationId },
      order: { accountType: 'ASC', accountName: 'ASC' },
      relations: ['linkedGlAccount'],
    });
  }

  // ================= EXPENSES =================
  async createExpenseCategory(data: Partial<ExpenseCategory>, organizationId: string): Promise<ExpenseCategory> {
    const category = this.expenseCategoryRepo.create({
      ...data,
      organizationId,
    });
    return this.expenseCategoryRepo.save(category);
  }

  async getExpenseCategories(organizationId: string): Promise<ExpenseCategory[]> {
    return this.expenseCategoryRepo.find({
      where: { organizationId },
      order: { name: 'ASC' },
      relations: ['linkedGlAccount'],
    });
  }

  async createExpense(data: any, organizationId: string, userId?: string): Promise<Expense> {
    return this.dataSource.transaction(async (manager) => {
      const year = new Date(data.expenseDate || new Date()).getFullYear();
      const prefix = `EXP-${year}-`;

      const lastExp = await manager
        .createQueryBuilder(Expense, 'exp')
        .where('exp.organizationId = :organizationId', { organizationId })
        .andWhere('exp.expenseNumber LIKE :prefix', { prefix: `${prefix}%` })
        .orderBy('exp.createdAt', 'DESC')
        .setLock('pessimistic_write')
        .getOne();

      let nextSeq = 1;
      if (lastExp && lastExp.expenseNumber.startsWith(prefix)) {
        const parsed = parseInt(lastExp.expenseNumber.replace(prefix, ''), 10);
        if (!isNaN(parsed)) nextSeq = parsed + 1;
      }

      const expenseNumber = `${prefix}${nextSeq.toString().padStart(6, '0')}`;
      const amount = Number(data.amount || 0);

      const expense = manager.create(Expense, {
        ...data,
        expenseNumber,
        amount,
        status: ExpenseStatus.PAID,
        createdById: userId,
        organizationId,
      });

      const savedExpense = await manager.save(expense);

      // Decrement Bank/Cash account balance if payment account was selected
      if (data.bankAccountId) {
        const bankAcc = await manager.findOne(BankAccount, {
          where: { id: data.bankAccountId, organizationId },
        });
        if (bankAcc) {
          bankAcc.currentBalance = Number(bankAcc.currentBalance || 0) - amount;
          await manager.save(bankAcc);
        }
      }

      return savedExpense;
    });
  }

  async getExpenses(
    options: { page?: number; limit?: number; categoryId?: string; startDate?: string; endDate?: string; status?: ExpenseStatus },
    organizationId: string,
  ) {
    const page = Number(options.page) || 1;
    const limit = Number(options.limit) || 20;
    const skip = (page - 1) * limit;

    const qb = this.expenseRepo
      .createQueryBuilder('exp')
      .where('exp.organizationId = :organizationId', { organizationId })
      .leftJoinAndSelect('exp.expenseCategory', 'category')
      .leftJoinAndSelect('exp.bankAccount', 'bankAccount')
      .orderBy('exp.expenseDate', 'DESC')
      .addOrderBy('exp.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (options.categoryId) {
      qb.andWhere('exp.expenseCategoryId = :catId', { catId: options.categoryId });
    }
    if (options.startDate) {
      qb.andWhere('exp.expenseDate >= :sDate', { sDate: options.startDate });
    }
    if (options.endDate) {
      qb.andWhere('exp.expenseDate <= :eDate', { eDate: options.endDate });
    }
    if (options.status) {
      qb.andWhere('exp.status = :status', { status: options.status });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  // ================= FUND TRANSFERS =================
  async transferFunds(data: any, organizationId: string, userId?: string): Promise<FundTransfer> {
    const amount = Number(data.amount || 0);
    if (amount <= 0) {
      throw new BadRequestException('Transfer amount must be greater than zero');
    }

    if (data.fromBankAccountId === data.toBankAccountId) {
      throw new BadRequestException('Source and destination accounts must be different');
    }

    return this.dataSource.transaction(async (manager) => {
      const fromAcc = await manager.findOne(BankAccount, {
        where: { id: data.fromBankAccountId, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      const toAcc = await manager.findOne(BankAccount, {
        where: { id: data.toBankAccountId, organizationId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!fromAcc || !toAcc) {
        throw new NotFoundException('One or both bank accounts not found');
      }

      if (Number(fromAcc.currentBalance || 0) < amount) {
        throw new BadRequestException(
          `Insufficient funds in ${fromAcc.accountName}. Available: ${fromAcc.currentBalance} Tk`,
        );
      }

      fromAcc.currentBalance = Number(fromAcc.currentBalance || 0) - amount;
      toAcc.currentBalance = Number(toAcc.currentBalance || 0) + amount;

      await manager.save(BankAccount, [fromAcc, toAcc]);

      const year = new Date().getFullYear();
      const transferNumber = `FT-${year}-${Date.now().toString().slice(-6)}`;

      const transfer = manager.create(FundTransfer, {
        transferNumber,
        transferDate: data.transferDate || new Date().toISOString().split('T')[0],
        fromBankAccountId: data.fromBankAccountId,
        toBankAccountId: data.toBankAccountId,
        amount,
        transactionFee: Number(data.transactionFee || 0),
        referenceNumber: data.referenceNumber,
        note: data.note,
        createdById: userId,
        organizationId,
      });

      return manager.save(transfer);
    });
  }

  // ================= ACCOUNTS RECEIVABLE (AR) =================
  async getCustomerLedger(customerId: string, organizationId: string, startDate?: string, endDate?: string) {
    const customer = await this.customerRepo.findOne({
      where: { id: customerId as any },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const qb = this.customerLedgerRepo
      .createQueryBuilder('entry')
      .where('entry.customerId = :customerId', { customerId })
      .andWhere('entry.organizationId = :organizationId', { organizationId })
      .orderBy('entry.entryDate', 'ASC')
      .addOrderBy('entry.createdAt', 'ASC');

    if (startDate) qb.andWhere('entry.entryDate >= :startDate', { startDate });
    if (endDate) qb.andWhere('entry.entryDate <= :endDate', { endDate });

    const entries = await qb.getMany();

    let balance = 0;
    let totalInvoiced = 0;
    let totalPaid = 0;

    const formatted = entries.map((e) => {
      const debit = Number(e.debit || 0);
      const credit = Number(e.credit || 0);
      totalInvoiced += debit;
      totalPaid += credit;
      balance += debit - credit;
      return {
        ...e,
        debit,
        credit,
        runningBalance: balance,
      };
    });

    return {
      customer: {
        id: customer.id,
        name: customer.customerName,
        phone: customer.customerPhoneNumber,
      },
      totalInvoiced,
      totalPaid,
      outstandingBalance: balance,
      entries: formatted,
    };
  }

  async getCustomerAgingReport(organizationId: string) {
    const entries = await this.customerLedgerRepo
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.customer', 'customer')
      .where('entry.organizationId = :organizationId', { organizationId })
      .getMany();

    const now = new Date().getTime();
    const customerMap = new Map<string, any>();

    entries.forEach((e) => {
      const custId = String(e.customerId);
      if (!customerMap.has(custId)) {
        customerMap.set(custId, {
          customerId: custId,
          customerName: e.customer?.customerName || 'Customer',
          phone: e.customer?.customerPhoneNumber || '',
          current: 0, // 0-30 days
          days31to60: 0,
          days61to90: 0,
          over90: 0,
          totalDue: 0,
        });
      }

      const row = customerMap.get(custId);
      const net = Number(e.debit || 0) - Number(e.credit || 0);
      const daysOld = Math.floor((now - new Date(e.entryDate).getTime()) / (1000 * 60 * 60 * 24));

      if (daysOld <= 30) {
        row.current += net;
      } else if (daysOld <= 60) {
        row.days31to60 += net;
      } else if (daysOld <= 90) {
        row.days61to90 += net;
      } else {
        row.over90 += net;
      }
      row.totalDue += net;
    });

    return Array.from(customerMap.values()).filter((c) => c.totalDue > 0);
  }

  // ================= ACCOUNTS PAYABLE (AP) =================
  async createSupplierBill(data: any, organizationId: string, userId?: string): Promise<SupplierBill> {
    const totalAmount = Number(data.totalAmount || 0);
    const year = new Date().getFullYear();
    const billNumber = `BILL-${year}-${Date.now().toString().slice(-6)}`;

    const bill = this.supplierBillRepo.create({
      ...data,
      billNumber,
      totalAmount,
      paidAmount: 0,
      dueAmount: totalAmount,
      status: SupplierBillStatus.UNPAID,
      createdById: userId,
      organizationId,
    }) as unknown as SupplierBill;

    return this.supplierBillRepo.save(bill);
  }

  async recordSupplierPayment(data: any, organizationId: string, userId?: string): Promise<SupplierPayment> {
    const amount = Number(data.amount || 0);
    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    return this.dataSource.transaction(async (manager) => {
      const bankAcc = await manager.findOne(BankAccount, {
        where: { id: data.bankAccountId, organizationId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!bankAcc || Number(bankAcc.currentBalance || 0) < amount) {
        throw new BadRequestException('Insufficient balance in chosen bank account');
      }

      bankAcc.currentBalance = Number(bankAcc.currentBalance || 0) - amount;
      await manager.save(bankAcc);

      const year = new Date().getFullYear();
      const paymentNumber = `SP-${year}-${Date.now().toString().slice(-6)}`;

      const payment = manager.create(SupplierPayment, {
        paymentNumber,
        paymentDate: data.paymentDate || new Date().toISOString().split('T')[0],
        supplierId: data.supplierId,
        supplierBillId: data.supplierBillId,
        bankAccountId: data.bankAccountId,
        amount,
        referenceNumber: data.referenceNumber,
        notes: data.notes,
        createdById: userId,
        organizationId,
      });

      if (data.supplierBillId) {
        const bill = await manager.findOne(SupplierBill, {
          where: { id: data.supplierBillId, organizationId },
        });
        if (bill) {
          bill.paidAmount = Number(bill.paidAmount || 0) + amount;
          bill.dueAmount = Math.max(0, Number(bill.totalAmount || 0) - bill.paidAmount);
          bill.status =
            bill.dueAmount === 0
              ? SupplierBillStatus.PAID
              : SupplierBillStatus.PARTIALLY_PAID;
          await manager.save(bill);
        }
      }

      return manager.save(payment);
    });
  }

  async getSupplierBills(organizationId: string, supplierId?: string) {
    const where: any = { organizationId };
    if (supplierId) where.supplierId = supplierId;
    return this.supplierBillRepo.find({
      where,
      order: { billDate: 'DESC' },
      relations: ['supplier'],
    });
  }

  async getSupplierLedger(supplierId: string, organizationId: string) {
    const bills = await this.supplierBillRepo.find({
      where: { supplierId, organizationId },
      order: { billDate: 'ASC' },
    });
    const payments = await this.supplierPaymentRepo.find({
      where: { supplierId, organizationId },
      order: { paymentDate: 'ASC' },
      relations: ['bankAccount'],
    });

    const supplier = await this.supplierRepo.findOne({
      where: { id: supplierId as any },
    });

    const totalBilled = bills.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalDue = totalBilled - totalPaid;

    return {
      supplier,
      totalBilled,
      totalPaid,
      totalDue,
      bills,
      payments,
    };
  }

  // ================= BANK RECONCILIATION =================
  async createBankStatement(data: any, organizationId: string): Promise<BankStatement> {
    const statement = this.bankStatementRepo.create({
      statementName: data.statementName,
      bankAccountId: data.bankAccountId,
      startDate: data.startDate,
      endDate: data.endDate,
      openingBalance: Number(data.openingBalance || 0),
      closingBalance: Number(data.closingBalance || 0),
      status: ReconciliationStatus.UNRECONCILED,
      organizationId,
    });

    const saved = await this.bankStatementRepo.save(statement);

    if (data.items && Array.isArray(data.items)) {
      const items = data.items.map((item: any) =>
        this.bankStatementItemRepo.create({
          statementId: saved.id,
          transactionDate: item.transactionDate,
          description: item.description,
          referenceNumber: item.referenceNumber,
          depositAmount: Number(item.depositAmount || 0),
          withdrawalAmount: Number(item.withdrawalAmount || 0),
          isMatched: false,
          organizationId,
        }),
      );
      await this.bankStatementItemRepo.save(items);
    }

    return this.bankStatementRepo.findOne({
      where: { id: saved.id },
      relations: ['items'],
    }) as Promise<BankStatement>;
  }

  async matchStatementItem(itemId: string, organizationId: string, matchData: any) {
    const item = await this.bankStatementItemRepo.findOne({
      where: { id: itemId, organizationId },
    });
    if (!item) throw new NotFoundException('Statement item not found');

    item.isMatched = true;
    item.matchedReferenceType = matchData.matchedReferenceType;
    item.matchedReferenceId = matchData.matchedReferenceId;

    return this.bankStatementItemRepo.save(item);
  }
}
