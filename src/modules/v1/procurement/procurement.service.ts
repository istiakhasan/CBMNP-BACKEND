import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProcurementDto } from './dto/create-procurement.dto';
import { Supplier } from '../supplier/entities/supplier.entity';
import { ProcurementItem } from './entities/procurementItem.entity';
import { Procurement } from './entities/procurement.entity';
import { InvoiceCounter } from './entities/invoice-counter.entity';
import paginationHelpers from 'src/helpers/paginationHelpers';
import { extractOptions } from 'src/helpers/queryHelper';
import { plainToInstance } from 'class-transformer';


@Injectable()
export class ProcurementService {
  constructor(
    @InjectRepository(Procurement) private procurementRepo: Repository<Procurement>,
    @InjectRepository(ProcurementItem) private procurementItemRepo: Repository<ProcurementItem>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    @InjectRepository(InvoiceCounter) private invoiceCounterRepo: Repository<InvoiceCounter>
  ) {}



  async generateInvoiceNumber(): Promise<string> {
    let counter = await this.invoiceCounterRepo.findOne({ where: {} });

    if (!counter) {
      counter = this.invoiceCounterRepo.create({ lastInvoiceNumber: 1000 }); // Start from 1000
      await this.invoiceCounterRepo.save(counter);
    }

    counter.lastInvoiceNumber += 1;
    await this.invoiceCounterRepo.save(counter);

    return `INV-${counter.lastInvoiceNumber}`;
  }

  async createProcurement(dto: Partial<CreateProcurementDto>) {
    const supplier = await this.supplierRepo.findOne({ where: { id: dto.supplierId } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    const invoiceNumber = await this.generateInvoiceNumber();
    const procurement = this.procurementRepo.create({
      supplier,
      billGenerated: dto.billGenerated,
      billAmount: dto.billAmount,
      invoiceNumber,
      // receivedBy: dto.receivedBy,
      status: "Pending",
      notes: dto.notes,
      organizationId: dto.organizationId
    });

    await this.procurementRepo.save(procurement);

    const items = dto.items.map(item => {
      return this.procurementItemRepo.create({
        procurement,
        ...item,
        totalPrice: item.receivedQuantity * item.unitPrice,
      });
    });

    await this.procurementItemRepo.save(items);
    procurement.items = items;
    
    return procurement;
  }

  async getAllProcurements(options,organizationId) {
    
    const {limit,skip,sortBy,sortOrder,page}=paginationHelpers(options)
    const queryBuilder = this.procurementRepo.createQueryBuilder('procurement')
    .where('procurement.organizationId = :organizationId', { organizationId })
    .leftJoinAndSelect('procurement.supplier','supplier')
    .take(limit)
    .skip(skip)
    .orderBy(`procurement.${sortBy}`, sortOrder);

     const [data, total] = await queryBuilder.getManyAndCount();
     const modifyData = plainToInstance(Procurement, data);
    return  {
      data:modifyData,
      page,
      limit,
      total
    }
  }

  async getProcurementById(id: string) {
    const procurement = await this.procurementRepo.findOne({ where: { id }, relations: ['items'] });
    if (!procurement) throw new NotFoundException('Procurement not found');
    return procurement;
  }
}
