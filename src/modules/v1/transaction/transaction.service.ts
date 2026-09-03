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
    private readonly transactionRepository:Repository<Transaction>
  ){}
  create(createTransactionDto: CreateTransactionDto) {
    return 'This action adds a new transaction';
  }

  async findAll(organizationId:string, query: any = {}) {
    const { page = 1, limit = 10, productId, locationId } = query;
    const where: any = { organizationId };
    if (productId) where.productId = productId;
    if (locationId || query.warehouseId) where.locationId = locationId || query.warehouseId;

    const [data, total] = await this.transactionRepository.findAndCount({
      where,
      relations:['product','location'],
      order: { transactionDate: 'DESC' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    return { data, total };
  }
  async findByProductId(id:string, organizationId?: string, query: any = {}) {
    const { page = 1, limit = 20, locationId, warehouseId } = query;
    const where: any = { productId: id };
    if (organizationId) where.organizationId = organizationId;
    if (locationId || warehouseId) where.locationId = locationId || warehouseId;

    const [data, total] = await this.transactionRepository.findAndCount({
      where,
      relations:['product','location'],
      order: { transactionDate: 'DESC' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

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
