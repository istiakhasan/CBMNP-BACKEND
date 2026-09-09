import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CreateProcurementDto } from './dto/create-procurement.dto';
import { Supplier } from '../supplier/entities/supplier.entity';
import { ProcurementItem } from './entities/procurementItem.entity';
import { Procurement } from './entities/procurement.entity';
import { InvoiceCounter } from './entities/invoice-counter.entity';
import { Product } from '../product/entity/product.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { InventoryItem } from '../inventory/entities/inventoryitem.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import paginationHelpers from '../../../helpers/paginationHelpers';
import { plainToInstance } from 'class-transformer';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class ProcurementService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly inventoryService: InventoryService,
    @InjectRepository(Procurement)
    private procurementRepo: Repository<Procurement>,
    @InjectRepository(ProcurementItem)
    private procurementItemRepo: Repository<ProcurementItem>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    @InjectRepository(InvoiceCounter)
    private invoiceCounterRepo: Repository<InvoiceCounter>,
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
    const supplier = await this.supplierRepo.findOne({
      where: { id: dto.supplierId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    const invoiceNumber = await this.generateInvoiceNumber();
    const procurement = this.procurementRepo.create({
      supplier,
      billGenerated: dto.billGenerated,
      billAmount: dto.billAmount,
      invoiceNumber,
      // receivedBy: dto.receivedBy,
      status: 'Pending',
      notes: dto.notes,
      organizationId: dto.organizationId,
    });

    await this.procurementRepo.save(procurement);

    const items = dto.items.map((item) => {
      const qty = Number(item.orderedQuantity || 0);
      const price = Number(item.unitPrice || 0);
      return this.procurementItemRepo.create({
        procurement,
        ...item,
        orderedQuantity: qty,
        receivedQuantity: item.receivedQuantity ?? 0,
        damageQuantity: item.damageQuantity ?? 0,
        unitPrice: price,
        totalPrice: qty * price,
      });
    });

    await this.procurementItemRepo.save(items);
    procurement.items = items;

    return procurement;
  }

  async getAllProcurements(options, organizationId, filterOptions) {
    const { limit, skip, sortBy, sortOrder, page } = paginationHelpers(options);
    const queryBuilder = this.procurementRepo
      .createQueryBuilder('procurement')
      .where('procurement.organizationId = :organizationId', { organizationId })
      .leftJoinAndSelect('procurement.supplier', 'supplier')
      .leftJoin('procurement.createdBy', 'createdBy') // change to leftJoin
      .addSelect([
        'createdBy.id',
        'createdBy.name',
        'createdBy.email',
        // add other specific fields you need from createdBy
      ])
      .leftJoinAndSelect('procurement.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
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
    return {
      data: modifyData,
      page,
      limit,
      total,
    };
  }
  async getReports(organizationId, filterOptions) {
    const queryBuilder = this.procurementRepo
      .createQueryBuilder('procurement')
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
    if (filterOptions?.startDate && filterOptions?.endDate) {
      const localStartDate = new Date(filterOptions.startDate);
      const utcStartDate = new Date(
        Date.UTC(
          localStartDate.getFullYear(),
          localStartDate.getMonth(),
          localStartDate.getDate(),
          0,
          0,
          0,
          0,
        ),
      );

      const localEndDate = new Date(filterOptions.endDate);
      const utcEndDate = new Date(
        Date.UTC(
          localEndDate.getFullYear(),
          localEndDate.getMonth(),
          localEndDate.getDate(),
          23,
          59,
          59,
          999,
        ),
      );

      queryBuilder.andWhere(
        'procurement.createdAt BETWEEN :startDate AND :endDate',
        {
          startDate: utcStartDate.toISOString(),
          endDate: utcEndDate.toISOString(),
        },
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
    const procurement = await this.procurementRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!procurement) throw new NotFoundException('Procurement not found');
    return procurement;
  }

  async bulkUpdate(payload) {
    const { poIds, status } = payload;
    const procurements = await this.procurementRepo.find({
      where: { id: In(poIds) },
    });

    if (procurements.length === 0) {
      throw new NotFoundException('No procurements  found for given IDs');
    }

    const result = await this.procurementRepo.update(
      { id: In(poIds) },
      { status },
    );
    if (result.affected === 0) {
      throw new NotFoundException('No procurements found for given IDs');
    }
    return {
      message: 'Bulk update successful',
      affected: result.affected,
    };
  }
  async receiveOrder(payload: any, organizationId: string) {
    const { poIds, stock, procurementId } = payload;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const procurement = await queryRunner.manager.findOne(Procurement, {
        where: { id: procurementId, organizationId },
        relations: ['items', 'items.product', 'supplier'],
      });

      if (!procurement) {
        throw new NotFoundException('Procurement order not found');
      }

      // Map warehouse location from stock payload
      const locationMap: Record<string, string> = {};
      if (Array.isArray(stock)) {
        for (const s of stock) {
          const locId = s.inventoryItems?.[0]?.locationId || s.locationId;
          if (s.productId && locId) {
            locationMap[s.productId] = locId;
          }
        }
      }

      if (Array.isArray(poIds)) {
        for (const poItemUpdate of poIds) {
          const poItem = procurement.items?.find(
            (item) =>
              item.id === poItemUpdate.id ||
              item.productId === poItemUpdate.productId,
          );

          if (!poItem) continue;

          const existingReceived = Number(poItem.receivedQuantity || 0);
          const targetReceived = Number(poItemUpdate.receivedQuantity || 0);
          const orderedQty = Number(poItem.orderedQuantity || 0);

          if (targetReceived > orderedQty) {
            throw new BadRequestException(
              `Cannot receive ${targetReceived} items. Ordered quantity is ${orderedQty}.`,
            );
          }

          const deltaQty = targetReceived - existingReceived;
          if (deltaQty <= 0) {
            // Already processed / duplicate request - skip adding extra stock
            continue;
          }

          // 1. Update ProcurementItem receivedQuantity
          poItem.receivedQuantity = targetReceived;
          await queryRunner.manager.save(ProcurementItem, poItem);

          // 2. Update Master Inventory
          let inventory = await queryRunner.manager.findOne(Inventory, {
            where: { productId: poItem.productId, organizationId },
          });

          if (!inventory) {
            inventory = queryRunner.manager.create(Inventory, {
              productId: poItem.productId,
              organizationId,
              stock: 0,
              expiredQuantity: 0,
              wastageQuantity: 0,
            });
            await queryRunner.manager.save(Inventory, inventory);
          }

          inventory.stock = Number(inventory.stock || 0) + deltaQty;
          await queryRunner.manager.save(Inventory, inventory);

          // 3. Update Warehouse InventoryItem
          const locationId = locationMap[poItem.productId];
          if (locationId) {
            let invItem = await queryRunner.manager.findOne(InventoryItem, {
              where: { productId: poItem.productId, locationId },
            });

            if (invItem) {
              invItem.quantity = Number(invItem.quantity || 0) + deltaQty;
            } else {
              invItem = queryRunner.manager.create(InventoryItem, {
                productId: poItem.productId,
                locationId,
                inventoryId: inventory.id,
                inventory,
                quantity: deltaQty,
                expiredQuantity: 0,
                wastageQuantity: 0,
              });
            }
            await queryRunner.manager.save(InventoryItem, invItem);

            // 4. Create Audit Transaction Record
            const transaction = queryRunner.manager.create(Transaction, {
              productId: poItem.productId,
              inventoryId: inventory.productId,
              locationId,
              quantity: deltaQty,
              organizationId,
              totalAmount: deltaQty * Number(poItem.unitPrice || 0),
              type: 'IN',
              referenceType: 'PURCHASE_RECEIPT',
              referenceNumber: procurement.invoiceNumber,
              remarks: `Purchase Order (${procurement.invoiceNumber}) Goods Received (+${deltaQty}) into warehouse`,
              performedByName: 'Procurement Receiver',
            });
            await queryRunner.manager.save(Transaction, transaction);
          }
        }
      }

      // 5. Update overall Procurement status
      const allCompleted = procurement.items?.every(
        (item) =>
          Number(item.receivedQuantity || 0) >=
          Number(item.orderedQuantity || 0),
      );
      procurement.status = allCompleted ? 'Completed' : 'Approved';
      await queryRunner.manager.save(Procurement, procurement);

      await queryRunner.commitTransaction();
      return procurement;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createDirectPurchase(dto: any, organizationId: string) {
    let supplier: Supplier | null = null;
    if (dto.supplierId) {
      supplier = await this.supplierRepo.findOne({
        where: { id: dto.supplierId },
      });
    }

    const invoiceNumber = await this.generateInvoiceNumber();
    const procurement = this.procurementRepo.create({
      supplier: supplier || undefined,
      billGenerated: true,
      billAmount: dto.billAmount || 0,
      invoiceNumber: `DIR-${invoiceNumber}`,
      status: 'Completed',
      notes: dto.notes || 'Direct Spot Purchase',
      organizationId,
    });

    const savedProcurement = await this.procurementRepo.save(procurement);

    const items = (dto.items || []).map((item: any) => {
      const qty = Number(item.orderedQuantity || item.quantity || 0);
      const price = Number(item.unitPrice || 0);
      return this.procurementItemRepo.create({
        procurement: savedProcurement,
        productId: item.productId,
        orderedQuantity: qty,
        receivedQuantity: qty,
        damageQuantity: 0,
        unitPrice: price,
        totalPrice: qty * price,
      });
    });

    const savedItems = await this.procurementItemRepo.save(items);
    savedProcurement.items = savedItems;

    // Direct Stock Entry into specified warehouse
    if (dto.warehouseId && Array.isArray(dto.items)) {
      for (const item of dto.items) {
        const qty = Number(item.orderedQuantity || item.quantity || 0);
        const price = Number(item.unitPrice || 0);
        if (qty > 0 && item.productId) {
          await this.inventoryService.addProductToInventory({
            productId: item.productId,
            quantity: qty,
            expiredQuantity: 0,
            wastageQuantity: 0,
            type: true,
            organizationId,
            referenceType: 'DIRECT_PURCHASE',
            referenceNumber: savedProcurement.invoiceNumber,
            remarks: `Direct Spot Purchase (${savedProcurement.invoiceNumber}) deposited into warehouse`,
            performedByName: 'Direct Purchase System',
            inventoryItems: [
              {
                locationId: dto.warehouseId,
                productId: item.productId,
                quantity: qty,
                expiredQuantity: 0,
                wastageQuantity: 0,
              },
            ],
          });
        }
      }
    }

    return savedProcurement;
  }
}
