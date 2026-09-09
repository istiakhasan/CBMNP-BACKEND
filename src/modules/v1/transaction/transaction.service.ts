import { Injectable } from '@nestjs/common';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from './entities/transaction.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  create(createTransactionDto: CreateTransactionDto) {
    return 'This action adds a new transaction';
  }

  async findAll(organizationId: string, query: any = {}) {
    const {
      page = 1,
      limit = 10,
      searchProducts,
      searchTerm,
      productId,
      locationId,
      warehouseId,
      type,
    } = query;

    const qb = this.transactionRepository
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.product', 'product')
      .leftJoinAndSelect('tx.location', 'location')
      .where('tx.organizationId = :organizationId', { organizationId });

    if (productId) {
      qb.andWhere('tx.productId = :productId', { productId });
    }

    const locId = locationId || warehouseId;
    if (locId) {
      qb.andWhere('tx.locationId = :locId', { locId });
    }

    if (type && (type === 'IN' || type === 'OUT')) {
      qb.andWhere('tx.type = :type', { type });
    }

    const search = searchProducts || searchTerm;
    if (search) {
      qb.andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search OR tx.referenceNumber ILIKE :search OR tx.remarks ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await qb
      .orderBy('tx.transactionDate', 'DESC')
      .skip((Number(page) - 1) * Number(limit))
      .take(Number(limit))
      .getManyAndCount();

    return { data, total };
  }

  async findByProductId(id: string, organizationId?: string, query: any = {}) {
    const { page = 1, limit = 20, locationId, warehouseId, type } = query;

    const qb = this.transactionRepository
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.product', 'product')
      .leftJoinAndSelect('tx.location', 'location')
      .where('tx.productId = :id', { id });

    if (organizationId) {
      qb.andWhere('tx.organizationId = :organizationId', { organizationId });
    }

    const locId = locationId || warehouseId;
    if (locId) {
      qb.andWhere('tx.locationId = :locId', { locId });
    }

    if (type && (type === 'IN' || type === 'OUT')) {
      qb.andWhere('tx.type = :type', { type });
    }

    const [data, total] = await qb
      .orderBy('tx.transactionDate', 'DESC')
      .skip((Number(page) - 1) * Number(limit))
      .take(Number(limit))
      .getManyAndCount();

    return { data, total };
  }

  findOne(id: number) {
    return `This action returns a #${id} transaction`;
  }

  update(id: number, updateTransactionDto: UpdateTransactionDto) {
    return `This action updates a #${id} transaction`;
  }

  remove(id: number) {
    return `This action removes a #${id} transaction`;
  }
}
