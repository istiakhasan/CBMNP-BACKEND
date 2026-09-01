import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  JournalEntry,
  JournalEntryStatus,
  JournalEntryType,
} from '../entities/journal-entry.entity';
import { JournalItem } from '../entities/journal-item.entity';
import { Account } from '../entities/account.entity';
import { FiscalPeriod } from '../entities/fiscal-period.entity';
import { CreateJournalEntryDto } from '../dto/create-journal-entry.dto';

@Injectable()
export class JournalService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(JournalEntry)
    private readonly journalEntryRepository: Repository<JournalEntry>,
    @InjectRepository(JournalItem)
    private readonly journalItemRepository: Repository<JournalItem>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(FiscalPeriod)
    private readonly fiscalPeriodRepository: Repository<FiscalPeriod>,
  ) {}

  async create(
    createDto: CreateJournalEntryDto,
    organizationId: string,
    userId?: string,
  ): Promise<JournalEntry> {
    // 1. Double-Entry Verification: sum(debit) MUST equal sum(credit)
    let totalDebit = 0;
    let totalCredit = 0;

    for (const item of createDto.items) {
      const debit = Number(item.debit || 0);
      const credit = Number(item.credit || 0);

      if (debit > 0 && credit > 0) {
        throw new BadRequestException(
          'A single journal item line cannot have both a debit and a credit amount',
        );
      }
      if (debit <= 0 && credit <= 0) {
        throw new BadRequestException(
          'Each journal line must specify a positive debit or credit amount',
        );
      }

      totalDebit += debit;
      totalCredit += credit;
    }

    // Allow a tiny floating point difference due to JS math before rounding
    const difference = Math.abs(totalDebit - totalCredit);
    if (difference > 0.001) {
      throw new BadRequestException(
        `Journal entry is out of balance. Total Debit (${totalDebit.toFixed(2)}) must equal Total Credit (${totalCredit.toFixed(2)}). Variance: ${difference.toFixed(2)}`,
      );
    }

    // 2. Check Fiscal Period Lock
    const closedPeriod = await this.fiscalPeriodRepository.findOne({
      where: {
        organizationId,
        isClosed: true,
      },
    });

    if (closedPeriod) {
      const entryDate = new Date(createDto.entryDate);
      const periodStart = new Date(closedPeriod.startDate);
      const periodEnd = new Date(closedPeriod.endDate);
      if (entryDate >= periodStart && entryDate <= periodEnd) {
        throw new BadRequestException(
          `Cannot post entry. The fiscal period '${closedPeriod.periodName}' is locked for entries between ${closedPeriod.startDate} and ${closedPeriod.endDate}`,
        );
      }
    }

    // 3. Verify that all referenced accounts exist and belong to the organization
    const accountIds = createDto.items.map((i) => i.accountId);
    const accounts = await this.accountRepository.find({
      where: { id: In(accountIds), organizationId },
    });

    if (accounts.length !== new Set(accountIds).size) {
      throw new BadRequestException(
        'One or more selected accounts are invalid or do not belong to this organization',
      );
    }

    // 4. Generate sequential voucher number in transaction
    return this.dataSource.transaction(async (manager) => {
      const year = new Date(createDto.entryDate).getFullYear();
      const prefix = `JV-${year}-`;

      const lastEntry = await manager
        .createQueryBuilder(JournalEntry, 'jv')
        .where('jv.organizationId = :organizationId', { organizationId })
        .andWhere('jv.entryNumber LIKE :prefix', { prefix: `${prefix}%` })
        .orderBy('jv.createdAt', 'DESC')
        .setLock('pessimistic_write')
        .getOne();

      let nextSequence = 1;
      if (lastEntry && lastEntry.entryNumber.startsWith(prefix)) {
        const lastSeqStr = lastEntry.entryNumber.replace(prefix, '');
        const parsed = parseInt(lastSeqStr, 10);
        if (!isNaN(parsed)) {
          nextSequence = parsed + 1;
        }
      }

      const entryNumber = `${prefix}${nextSequence.toString().padStart(6, '0')}`;

      const journalEntry = manager.create(JournalEntry, {
        entryNumber,
        entryDate: createDto.entryDate,
        entryType: createDto.entryType || JournalEntryType.MANUAL_JOURNAL,
        referenceType: createDto.referenceType,
        referenceId: createDto.referenceId,
        narration: createDto.narration,
        status: JournalEntryStatus.POSTED,
        totalAmount: totalDebit,
        organizationId,
        createdById: userId,
        postedAt: new Date(),
      });

      const savedEntry = await manager.save(journalEntry);

      const items = createDto.items.map((item) =>
        manager.create(JournalItem, {
          journalEntryId: savedEntry.id,
          accountId: item.accountId,
          debit: Number(item.debit || 0),
          credit: Number(item.credit || 0),
          memo: item.memo,
          organizationId,
        }),
      );

      await manager.save(JournalItem, items);

      savedEntry.items = items;
      return savedEntry;
    });
  }

  async findAll(
    options: { page?: number; limit?: number; searchTerm?: string; startDate?: string; endDate?: string; status?: JournalEntryStatus },
    organizationId: string,
  ) {
    const page = Number(options.page) || 1;
    const limit = Number(options.limit) || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.journalEntryRepository
      .createQueryBuilder('jv')
      .where('jv.organizationId = :organizationId', { organizationId })
      .leftJoinAndSelect('jv.items', 'items')
      .leftJoinAndSelect('items.account', 'account')
      .orderBy('jv.entryDate', 'DESC')
      .addOrderBy('jv.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (options.searchTerm) {
      queryBuilder.andWhere(
        '(jv.entryNumber ILIKE :search OR jv.narration ILIKE :search OR jv.referenceId ILIKE :search)',
        { search: `%${options.searchTerm}%` },
      );
    }

    if (options.startDate) {
      queryBuilder.andWhere('jv.entryDate >= :startDate', {
        startDate: options.startDate,
      });
    }

    if (options.endDate) {
      queryBuilder.andWhere('jv.entryDate <= :endDate', {
        endDate: options.endDate,
      });
    }

    if (options.status) {
      queryBuilder.andWhere('jv.status = :status', {
        status: options.status,
      });
    }

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, organizationId: string): Promise<JournalEntry> {
    const entry = await this.journalEntryRepository.findOne({
      where: { id, organizationId },
      relations: ['items', 'items.account'],
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry with ID '${id}' not found`);
    }

    return entry;
  }

  async void(id: string, organizationId: string, userId?: string): Promise<JournalEntry> {
    const entry = await this.findOne(id, organizationId);

    if (entry.status === JournalEntryStatus.VOID) {
      throw new BadRequestException('Journal entry is already void');
    }

    entry.status = JournalEntryStatus.VOID;
    entry.narration = `[VOIDED by ${userId || 'User'}] ${entry.narration}`;
    return this.journalEntryRepository.save(entry);
  }
}
