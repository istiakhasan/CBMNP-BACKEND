import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateProcurementDto } from './dto/create-procurement.dto';
import { Supplier } from '../supplier/entities/supplier.entity';
import { ProcurementItem } from './entities/procurementItem.entity';
import { Procurement } from './entities/procurement.entity';
import { InvoiceCounter } from './entities/invoice-counter.entity';
import paginationHelpers from '../../../helpers/paginationHelpers';
import { plainToInstance } from 'class-transformer';
import { InventoryService } from '../inventory/inventory.service';


@Injectable()
export class ProcurementService {
  constructor(
    private readonly inventoryService: InventoryService,
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
        totalPrice: item.orderedQuantity * item.unitPrice,
      });
    });

    await this.procurementItemRepo.save(items);
    procurement.items = items;
    
    return procurement;
  }

  async getAllProcurements(options,organizationId,filterOptions) {
    const {limit,skip,sortBy,sortOrder,page}=paginationHelpers(options)
    const queryBuilder = this.procurementRepo.createQueryBuilder('procurement')
    .where('procurement.organizationId = :organizationId', { organizationId })
    .leftJoinAndSelect('procurement.supplier','supplier')
    .leftJoinAndSelect('procurement.items','items')
    .leftJoinAndSelect('items.product','product')
    .take(limit)
    .skip(skip)
    .orderBy(`procurement.${sortBy}`, sortOrder);
    if (filterOptions?.status) {
      queryBuilder.andWhere('procurement.status = :status', {
        status: filterOptions.status,
      });
    }
    const [data, total] = await queryBuilder.getManyAndCount();
    const modifyData = plainToInstance(Procurement, data);
    return  {
      data:modifyData,
      page,
      limit,
      total
    }
  }
  async getReports(organizationId, filterOptions) {
    const queryBuilder = this.procurementRepo.createQueryBuilder('procurement')
      .where('procurement.organizationId = :organizationId', { organizationId })
      .leftJoinAndSelect('procurement.supplier', 'supplier')
      .leftJoinAndSelect('procurement.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      // .leftJoinAndSelect('product.inventoryItems', 'inventoryItems')
      // .leftJoinAndSelect('inventoryItems.location', 'warehouse')
      .orderBy('procurement.createdAt', 'DESC');
  
    if (filterOptions?.status) {
      queryBuilder.andWhere('procurement.status = :status', {
        status: filterOptions.status,
      });
    }
    console.log(filterOptions,"filter");
    if (filterOptions?.startDate && filterOptions?.endDate) {
      console.log(filterOptions,"filter");
      const localStartDate = new Date(filterOptions.startDate);
      const utcStartDate = new Date(
        Date.UTC(
          localStartDate.getFullYear(),
          localStartDate.getMonth(),
          localStartDate.getDate(),
          0, 0, 0, 0 
        )
      );
      
      const localEndDate = new Date(filterOptions.endDate);
      const utcEndDate = new Date(
        Date.UTC(
          localEndDate.getFullYear(),
          localEndDate.getMonth(),
          localEndDate.getDate(),
          23, 59, 59, 999 
        )
      );
      
      queryBuilder.andWhere(
        'procurement.createdAt BETWEEN :startDate AND :endDate',
        {
          startDate: utcStartDate.toISOString(),
          endDate: utcEndDate.toISOString(),
        }
      );
    }
    
    
  
    const [data, total] = await queryBuilder.getManyAndCount();
    const modifyData = plainToInstance(Procurement, data);
    
    return {
      data: modifyData,
      total,
    };
  }
  

  async getProcurementById(id: string) {
    const procurement = await this.procurementRepo.findOne({ where: { id }, relations: ['items'] });
    if (!procurement) throw new NotFoundException('Procurement not found');
    return procurement;
  }

  async bulkUpdate(payload){
    const {poIds,status}=payload
    const procurements = await this.procurementRepo.find({
      where: { id: In(poIds) },
    });

    if (procurements.length === 0) {
      throw new NotFoundException('No procurements  found for given IDs');
    }


    const result = await this.procurementRepo.update({ id: In(poIds) }, { status });
    if (result.affected === 0) {
      throw new NotFoundException('No procurements found for given IDs');
    }
    return {
      message: 'Bulk update successful',
      affected: result.affected,
    };

  }
  async receiveOrder(payload, organizationId) {
    const { poIds, stock } = payload;
    await Promise.all(
      stock.map(async(item) =>
      await  this.inventoryService.addProductToInventory({ ...item, organizationId })
      )
    );
    await Promise.all(
      poIds.map(async({ id, productId, receivedQuantity }) =>
       await this.procurementItemRepo.update({ id, productId }, { receivedQuantity })
      )
    );
  }
  
}
