import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  Account,
  AccountCategory,
  AccountType,
} from '../entities/account.entity';
import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';

export interface AccountTreeNode extends Account {
  children: AccountTreeNode[];
  balance?: number;
}

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  async create(createDto: CreateAccountDto, organizationId: string): Promise<Account> {
    const existing = await this.accountRepository.findOne({
      where: {
        organizationId,
        accountCode: createDto.accountCode.trim(),
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Account with code '${createDto.accountCode}' already exists in this organization`,
      );
    }

    if (createDto.parentAccountId) {
      const parent = await this.accountRepository.findOne({
        where: { id: createDto.parentAccountId, organizationId },
      });
      if (!parent) {
        throw new NotFoundException('Parent account not found');
      }
    }

    const account = this.accountRepository.create({
      ...createDto,
      accountCode: createDto.accountCode.trim(),
      organizationId,
    });

    return this.accountRepository.save(account);
  }

  async findAll(organizationId: string): Promise<Account[]> {
    return this.accountRepository.find({
      where: { organizationId },
      order: { accountCode: 'ASC' },
      relations: ['parentAccount'],
    });
  }

  async getAccountsTree(organizationId: string): Promise<AccountTreeNode[]> {
    let accounts = await this.accountRepository.find({
      where: { organizationId },
      order: { accountCode: 'ASC' },
    });

    // Auto-seed default Chart of Accounts if organization has zero accounts
    if (accounts.length === 0) {
      await this.seedDefaultAccountsForOrg(organizationId);
      accounts = await this.accountRepository.find({
        where: { organizationId },
        order: { accountCode: 'ASC' },
      });
    }

    const balances = await this.calculateAllAccountBalances(organizationId);

    const accountMap = new Map<string, AccountTreeNode>();
    accounts.forEach((acc) => {
      accountMap.set(acc.id, {
        ...acc,
        children: [],
        balance: balances.get(acc.id) || 0,
      });
    });

    const rootNodes: AccountTreeNode[] = [];

    accountMap.forEach((node) => {
      if (node.parentAccountId && accountMap.has(node.parentAccountId)) {
        accountMap.get(node.parentAccountId)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  }

  async findOne(id: string, organizationId: string): Promise<Account> {
    const account = await this.accountRepository.findOne({
      where: { id, organizationId },
      relations: ['parentAccount', 'children'],
    });

    if (!account) {
      throw new NotFoundException(`Account with ID '${id}' not found`);
    }

    return account;
  }

  async update(
    id: string,
    updateDto: UpdateAccountDto,
    organizationId: string,
  ): Promise<Account> {
    const account = await this.findOne(id, organizationId);

    if (account.isSystemAccount && updateDto.accountCode && updateDto.accountCode !== account.accountCode) {
      throw new BadRequestException('Cannot modify code of a system account');
    }

    if (updateDto.accountCode && updateDto.accountCode !== account.accountCode) {
      const existing = await this.accountRepository.findOne({
        where: {
          organizationId,
          accountCode: updateDto.accountCode.trim(),
        },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException(
          `Account code '${updateDto.accountCode}' already in use`,
        );
      }
    }

    Object.assign(account, updateDto);
    return this.accountRepository.save(account);
  }

  async remove(id: string, organizationId: string): Promise<{ success: boolean; message: string }> {
    const account = await this.findOne(id, organizationId);

    if (account.isSystemAccount) {
      throw new BadRequestException('System default accounts cannot be deleted');
    }

    const childCount = await this.accountRepository.count({
      where: { parentAccountId: id, organizationId },
    });

    if (childCount > 0) {
      throw new BadRequestException(
        'Cannot delete account that has child sub-accounts. Move or delete child accounts first.',
      );
    }

    await this.accountRepository.remove(account);
    return { success: true, message: 'Account deleted successfully' };
  }

  async calculateAllAccountBalances(organizationId: string): Promise<Map<string, number>> {
    const rawBalances = await this.accountRepository
      .createQueryBuilder('acc')
      .leftJoin('acc.journalItems', 'item')
      .leftJoin('item.journalEntry', 'entry')
      .where('acc.organizationId = :organizationId', { organizationId })
      .andWhere('(entry.status = :status OR entry.id IS NULL)', { status: 'Posted' })
      .select('acc.id', 'id')
      .addSelect('acc.accountType', 'accountType')
      .addSelect('COALESCE(SUM(item.debit), 0)', 'totalDebit')
      .addSelect('COALESCE(SUM(item.credit), 0)', 'totalCredit')
      .groupBy('acc.id')
      .addGroupBy('acc.accountType')
      .getRawMany();

    const balanceMap = new Map<string, number>();

    rawBalances.forEach((row) => {
      const debit = Number(row.totalDebit || 0);
      const credit = Number(row.totalCredit || 0);
      // Assets & Expenses increase on Debit (+), decrease on Credit (-)
      // Liabilities, Equity & Revenue increase on Credit (+), decrease on Debit (-)
      let netBalance = 0;
      if (row.accountType === AccountType.ASSET || row.accountType === AccountType.EXPENSE) {
        netBalance = debit - credit;
      } else {
        netBalance = credit - debit;
      }
      balanceMap.set(row.id, netBalance);
    });

    return balanceMap;
  }

  async seedDefaultAccountsForOrg(organizationId: string): Promise<void> {
    const defaultAccounts: Array<{
      code: string;
      name: string;
      type: AccountType;
      category: AccountCategory;
      parentCode?: string;
      isSystem?: boolean;
      desc: string;
    }> = [
      // ASSETS (1000 - 1999)
      { code: '1000', name: 'Assets', type: AccountType.ASSET, category: AccountCategory.CURRENT_ASSET, isSystem: true, desc: 'Root Assets' },
      { code: '1100', name: 'Current Assets', type: AccountType.ASSET, category: AccountCategory.CURRENT_ASSET, parentCode: '1000', isSystem: true, desc: 'Liquid assets' },
      { code: '1110', name: 'Cash on Hand', type: AccountType.ASSET, category: AccountCategory.CURRENT_ASSET, parentCode: '1100', isSystem: true, desc: 'Petty cash and cash drawers' },
      { code: '1120', name: 'Bank Accounts', type: AccountType.ASSET, category: AccountCategory.CURRENT_ASSET, parentCode: '1100', isSystem: true, desc: 'Corporate and operating bank accounts' },
      { code: '1130', name: 'Mobile Financial Services (bKash/Nagad/Rocket)', type: AccountType.ASSET, category: AccountCategory.CURRENT_ASSET, parentCode: '1100', isSystem: true, desc: 'MFS merchant wallets' },
      { code: '1140', name: 'Accounts Receivable (Customers)', type: AccountType.ASSET, category: AccountCategory.CURRENT_ASSET, parentCode: '1100', isSystem: true, desc: 'Outstanding customer balances and COD in transit' },
      { code: '1150', name: 'Inventory Asset', type: AccountType.ASSET, category: AccountCategory.CURRENT_ASSET, parentCode: '1100', isSystem: true, desc: 'Stock valuation asset account' },
      { code: '1200', name: 'Non-Current Assets', type: AccountType.ASSET, category: AccountCategory.NON_CURRENT_ASSET, parentCode: '1000', isSystem: true, desc: 'Fixed and long-term assets' },
      { code: '1210', name: 'Office Equipment & Technology', type: AccountType.ASSET, category: AccountCategory.NON_CURRENT_ASSET, parentCode: '1200', desc: 'Computers, printers, machinery' },
      { code: '1220', name: 'Furniture & Fixtures', type: AccountType.ASSET, category: AccountCategory.NON_CURRENT_ASSET, parentCode: '1200', desc: 'Warehouse and office furniture' },

      // LIABILITIES (2000 - 2999)
      { code: '2000', name: 'Liabilities', type: AccountType.LIABILITY, category: AccountCategory.CURRENT_LIABILITY, isSystem: true, desc: 'Root Liabilities' },
      { code: '2100', name: 'Current Liabilities', type: AccountType.LIABILITY, category: AccountCategory.CURRENT_LIABILITY, parentCode: '2000', isSystem: true, desc: 'Short term obligations' },
      { code: '2110', name: 'Accounts Payable (Suppliers)', type: AccountType.LIABILITY, category: AccountCategory.CURRENT_LIABILITY, parentCode: '2100', isSystem: true, desc: 'Outstanding vendor purchase bills' },
      { code: '2120', name: 'Salaries & Wages Payable', type: AccountType.LIABILITY, category: AccountCategory.CURRENT_LIABILITY, parentCode: '2100', isSystem: true, desc: 'Accrued employee payroll' },
      { code: '2130', name: 'VAT & Tax Payable', type: AccountType.LIABILITY, category: AccountCategory.CURRENT_LIABILITY, parentCode: '2100', isSystem: true, desc: 'Collected sales tax & VAT' },
      { code: '2200', name: 'Long-Term Liabilities', type: AccountType.LIABILITY, category: AccountCategory.LONG_TERM_LIABILITY, parentCode: '2000', desc: 'Bank loans and long term debt' },

      // EQUITY (3000 - 3999)
      { code: '3000', name: 'Equity', type: AccountType.EQUITY, category: AccountCategory.EQUITY, isSystem: true, desc: 'Owner equity' },
      { code: '3100', name: 'Owner Capital / Share Capital', type: AccountType.EQUITY, category: AccountCategory.EQUITY, parentCode: '3000', isSystem: true, desc: 'Paid in capital' },
      { code: '3200', name: 'Retained Earnings', type: AccountType.EQUITY, category: AccountCategory.EQUITY, parentCode: '3000', isSystem: true, desc: 'Accumulated net profit/loss' },

      // REVENUE (4000 - 4999)
      { code: '4000', name: 'Revenue', type: AccountType.REVENUE, category: AccountCategory.OPERATING_REVENUE, isSystem: true, desc: 'Income accounts' },
      { code: '4100', name: 'Sales Revenue', type: AccountType.REVENUE, category: AccountCategory.OPERATING_REVENUE, parentCode: '4000', isSystem: true, desc: 'E-Commerce and POS product sales' },
      { code: '4200', name: 'Shipping & Delivery Income', type: AccountType.REVENUE, category: AccountCategory.OPERATING_REVENUE, parentCode: '4000', isSystem: true, desc: 'Customer shipping fees collected' },
      { code: '4300', name: 'Discounts Given', type: AccountType.REVENUE, category: AccountCategory.OPERATING_REVENUE, parentCode: '4000', desc: 'Contra revenue for promotional discounts' },
      { code: '4900', name: 'Other Income', type: AccountType.REVENUE, category: AccountCategory.OTHER_INCOME, parentCode: '4000', desc: 'Interest and miscellaneous revenue' },

      // EXPENSES (5000 - 5999)
      { code: '5000', name: 'Expenses', type: AccountType.EXPENSE, category: AccountCategory.OPERATING_EXPENSE, isSystem: true, desc: 'Expense accounts' },
      { code: '5100', name: 'Cost of Goods Sold (COGS)', type: AccountType.EXPENSE, category: AccountCategory.COST_OF_SALES, parentCode: '5000', isSystem: true, desc: 'Direct product purchase cost' },
      { code: '5200', name: 'Courier & Shipping Charges Expense', type: AccountType.EXPENSE, category: AccountCategory.OPERATING_EXPENSE, parentCode: '5000', isSystem: true, desc: 'Steadfast/Pathao courier fees paid' },
      { code: '5300', name: 'Packaging & Fulfillment Expense', type: AccountType.EXPENSE, category: AccountCategory.OPERATING_EXPENSE, parentCode: '5000', desc: 'Boxes, bubble wrap, labels' },
      { code: '5400', name: 'Sales Agent Commission Expense', type: AccountType.EXPENSE, category: AccountCategory.MARKETING_EXPENSE, parentCode: '5000', desc: 'Commissions paid to agents' },
      { code: '5500', name: 'Salaries & Benefits Expense', type: AccountType.EXPENSE, category: AccountCategory.ADMINISTRATIVE_EXPENSE, parentCode: '5000', desc: 'Staff compensation' },
      { code: '5600', name: 'Office & Warehouse Rent', type: AccountType.EXPENSE, category: AccountCategory.ADMINISTRATIVE_EXPENSE, parentCode: '5000', desc: 'Facility rental expenses' },
      { code: '5700', name: 'Utilities (Electricity, Internet, Water)', type: AccountType.EXPENSE, category: AccountCategory.ADMINISTRATIVE_EXPENSE, parentCode: '5000', desc: 'Utility bills' },
      { code: '5800', name: 'Advertising & Marketing (Meta/Google Ads)', type: AccountType.EXPENSE, category: AccountCategory.MARKETING_EXPENSE, parentCode: '5000', desc: 'Digital marketing and ad spend' },
      { code: '5900', name: 'Bank & MFS Gateway Charges', type: AccountType.EXPENSE, category: AccountCategory.FINANCIAL_EXPENSE, parentCode: '5000', desc: 'Payment processing fees' },
      { code: '5950', name: 'Inventory Wastage & Damage Expense', type: AccountType.EXPENSE, category: AccountCategory.OPERATING_EXPENSE, parentCode: '5000', desc: 'Stock write-offs and damaged goods' },
    ];

    const savedAccounts = new Map<string, string>(); // code -> id

    for (const item of defaultAccounts) {
      const parentId = item.parentCode ? savedAccounts.get(item.parentCode) : undefined;
      const account = this.accountRepository.create({
        accountCode: item.code,
        accountName: item.name,
        accountType: item.type,
        accountCategory: item.category,
        parentAccountId: parentId,
        isSystemAccount: item.isSystem || false,
        description: item.desc,
        organizationId,
      });
      const saved = await this.accountRepository.save(account);
      savedAccounts.set(item.code, saved.id);
    }
  }
}
