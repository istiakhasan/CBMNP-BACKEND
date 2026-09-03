import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { WarehouseLocation } from './entities/warehouse-location.entity';
import { StockTransfer, StockTransferStatus } from './entities/stock-transfer.entity';
import { StockTransferItem } from './entities/stock-transfer-item.entity';
import { StockAdjustment, AdjustmentStatus } from './entities/stock-adjustment.entity';
import { StockAdjustmentItem } from './entities/stock-adjustment-item.entity';
import { ProductBatch } from './entities/product-batch.entity';
import { ProductReorderRule } from './entities/reorder-rule.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { InventoryItem } from '../inventory/entities/inventoryitem.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Product } from '../product/entity/product.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';

@Injectable()
export class InventoryOperationsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(WarehouseLocation)
    private readonly locationRepo: Repository<WarehouseLocation>,
    @InjectRepository(StockTransfer)
    private readonly transferRepo: Repository<StockTransfer>,
    @InjectRepository(StockTransferItem)
    private readonly transferItemRepo: Repository<StockTransferItem>,
    @InjectRepository(StockAdjustment)
    private readonly adjustmentRepo: Repository<StockAdjustment>,
    @InjectRepository(StockAdjustmentItem)
    private readonly adjustmentItemRepo: Repository<StockAdjustmentItem>,
    @InjectRepository(ProductBatch)
    private readonly batchRepo: Repository<ProductBatch>,
    @InjectRepository(ProductReorderRule)
    private readonly reorderRuleRepo: Repository<ProductReorderRule>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepo: Repository<InventoryItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
  ) {}

  private async ensureMasterInventory(manager: any, productId: string, organizationId: string): Promise<Inventory> {
    let inventory = await manager.findOne(Inventory, {
      where: { productId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!inventory) {
      inventory = manager.create(Inventory, {
        productId,
        organizationId,
        stock: 0,
        orderQue: 0,
        hoildQue: 0,
        processing: 0,
        wastageQuantity: 0,
        expiredQuantity: 0,
      });
      inventory = await manager.save(inventory);
    }

    return inventory;
  }

  // ================= BIN / RACK / SHELF LOCATIONS =================
  async createLocation(data: Partial<WarehouseLocation>, organizationId: string): Promise<WarehouseLocation> {
    const loc = this.locationRepo.create({ ...data, organizationId });
    return this.locationRepo.save(loc);
  }

  async getLocations(warehouseId: string, organizationId: string): Promise<WarehouseLocation[]> {
    return this.locationRepo.find({
      where: { warehouseId, organizationId },
      order: { locationCode: 'ASC' },
    });
  }

  // ================= INTER-WAREHOUSE STOCK TRANSFERS =================
  async createTransfer(data: any, organizationId: string, userId?: string): Promise<StockTransfer> {
    if (data.fromWarehouseId === data.toWarehouseId) {
      throw new BadRequestException('Source and destination warehouses must be different');
    }

    const year = new Date().getFullYear();
    const transferNumber = `ST-${year}-${Date.now().toString().slice(-6)}`;

    const transfer = this.transferRepo.create({
      transferNumber,
      transferDate: data.transferDate || new Date().toISOString().split('T')[0],
      fromWarehouseId: data.fromWarehouseId,
      toWarehouseId: data.toWarehouseId,
      status: StockTransferStatus.DRAFT,
      notes: data.notes,
      createdById: userId,
      organizationId,
    });

    const saved = await this.transferRepo.save(transfer);

    if (data.items && Array.isArray(data.items)) {
      const items = data.items.map((i: any) =>
        this.transferItemRepo.create({
          stockTransferId: saved.id,
          productId: i.productId,
          requestedQuantity: Number(i.requestedQuantity || 0),
          dispatchedQuantity: 0,
          receivedQuantity: 0,
          batchNumber: i.batchNumber,
          organizationId,
        }),
      );
      await this.transferItemRepo.save(items);
    }

    return this.transferRepo.findOne({
      where: { id: saved.id },
      relations: ['items', 'items.product', 'fromWarehouse', 'toWarehouse'],
    }) as Promise<StockTransfer>;
  }

  async dispatchTransfer(transferId: string, organizationId: string, userId?: string): Promise<StockTransfer> {
    return this.dataSource.transaction(async (manager) => {
      const transfer = await manager.findOne(StockTransfer, {
        where: { id: transferId, organizationId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!transfer) throw new NotFoundException('Stock transfer not found');
      if (transfer.status !== StockTransferStatus.DRAFT && transfer.status !== StockTransferStatus.APPROVED) {
        throw new BadRequestException(`Cannot dispatch transfer with status '${transfer.status}'`);
      }

      const items = await manager.find(StockTransferItem, {
        where: { stockTransferId: transfer.id },
      });
      transfer.items = items;

      // Deduct stock from source warehouse
      for (const item of transfer.items) {
        const qtyToDispatch = item.requestedQuantity;
        const sourceInv = await manager.findOne(InventoryItem, {
          where: { locationId: transfer.fromWarehouseId, productId: item.productId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!sourceInv || Number(sourceInv.quantity || 0) < qtyToDispatch) {
          throw new BadRequestException(
            `Insufficient stock for product in source warehouse. Available: ${sourceInv?.quantity || 0}, Requested: ${qtyToDispatch}`,
          );
        }

        sourceInv.quantity = Number(sourceInv.quantity || 0) - qtyToDispatch;
        await manager.save(sourceInv);
        await manager.save(
          manager.create(Transaction, {
            productId: item.productId,
            quantity: qtyToDispatch,
            totalAmount: 0,
            type: 'OUT',
            inventoryId: item.productId,
            locationId: transfer.fromWarehouseId,
            organizationId,
            referenceType: 'STOCK_TRANSFER_OUT',
            referenceNumber: transfer.transferNumber,
            remarks: `Stock dispatched from source warehouse for transfer ${transfer.transferNumber}`,
            performedById: userId,
          }),
        );

        item.dispatchedQuantity = qtyToDispatch;
        await manager.save(item);
      }

      transfer.status = StockTransferStatus.DISPATCHED;
      transfer.dispatchDate = new Date().toISOString().split('T')[0];
      transfer.approvedById = userId;

      return manager.save(transfer);
    });
  }

  async receiveTransfer(transferId: string, receivedItems: any[], organizationId: string, userId?: string): Promise<StockTransfer> {
    return this.dataSource.transaction(async (manager) => {
      const transfer = await manager.findOne(StockTransfer, {
        where: { id: transferId, organizationId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!transfer) throw new NotFoundException('Stock transfer not found');
      if (transfer.status !== StockTransferStatus.DISPATCHED && transfer.status !== StockTransferStatus.IN_TRANSIT) {
        throw new BadRequestException(`Cannot receive transfer with status '${transfer.status}'`);
      }

      const items = await manager.find(StockTransferItem, {
        where: { stockTransferId: transfer.id },
      });
      transfer.items = items;

      for (const item of transfer.items) {
        const receivedEntry = receivedItems?.find((r: any) => r.itemId === item.id || r.productId === item.productId);
        const qtyReceived = receivedEntry ? Number(receivedEntry.quantity || 0) : item.dispatchedQuantity;

        // Increment stock at destination warehouse
        let destInv = await manager.findOne(InventoryItem, {
          where: { locationId: transfer.toWarehouseId, productId: item.productId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!destInv) {
          const masterInventory = await this.ensureMasterInventory(manager, item.productId, organizationId);
          destInv = manager.create(InventoryItem, {
            locationId: transfer.toWarehouseId,
            productId: item.productId,
            inventoryId: masterInventory.id,
            quantity: qtyReceived,
            orderQue: 0,
            hoildQue: 0,
            processing: 0,
            wastageQuantity: 0,
            expiredQuantity: 0,
          });
        } else {
          destInv.quantity = Number(destInv.quantity || 0) + qtyReceived;
        }

        await manager.save(destInv);
        await manager.save(
          manager.create(Transaction, {
            productId: item.productId,
            quantity: qtyReceived,
            totalAmount: 0,
            type: 'IN',
            inventoryId: item.productId,
            locationId: transfer.toWarehouseId,
            organizationId,
            referenceType: 'STOCK_TRANSFER_IN',
            referenceNumber: transfer.transferNumber,
            remarks: `Stock received into destination warehouse for transfer ${transfer.transferNumber}`,
            performedById: userId,
          }),
        );

        item.receivedQuantity = qtyReceived;
        await manager.save(item);
      }

      transfer.status = StockTransferStatus.RECEIVED;
      transfer.receiveDate = new Date().toISOString().split('T')[0];
      transfer.receivedById = userId;

      return manager.save(transfer);
    });
  }

  async getTransfers(organizationId: string) {
    return this.transferRepo.find({
      where: { organizationId },
      order: { transferDate: 'DESC', createdAt: 'DESC' },
      relations: ['fromWarehouse', 'toWarehouse', 'items', 'items.product'],
    });
  }

  // ================= STOCK ADJUSTMENT & PHYSICAL COUNT =================
  async createAdjustment(data: any, organizationId: string, userId?: string): Promise<StockAdjustment> {
    const year = new Date().getFullYear();
    const adjustmentNumber = `ADJ-${year}-${Date.now().toString().slice(-6)}`;

    const adjustment = this.adjustmentRepo.create({
      adjustmentNumber,
      adjustmentDate: data.adjustmentDate || new Date().toISOString().split('T')[0],
      warehouseId: data.warehouseId,
      reason: data.reason,
      status: AdjustmentStatus.PENDING_APPROVAL,
      notes: data.notes,
      createdById: userId,
      organizationId,
    });

    const saved = await this.adjustmentRepo.save(adjustment);

    if (data.items && Array.isArray(data.items)) {
      const items = data.items.map((i: any) => {
        const sysQty = Number(i.systemQuantity || 0);
        const countQty = Number(i.countedQuantity || 0);
        const variance = countQty - sysQty;
        const unitCost = Number(i.unitCost || 0);
        return this.adjustmentItemRepo.create({
          stockAdjustmentId: saved.id,
          productId: i.productId,
          systemQuantity: sysQty,
          countedQuantity: countQty,
          varianceQuantity: variance,
          unitCost,
          totalVarianceValue: variance * unitCost,
          itemNote: i.itemNote,
          organizationId,
        });
      });
      await this.adjustmentItemRepo.save(items);
    }

    return this.adjustmentRepo.findOne({
      where: { id: saved.id },
      relations: ['items', 'items.product', 'warehouse'],
    }) as Promise<StockAdjustment>;
  }

  async approveAdjustment(adjustmentId: string, organizationId: string, userId?: string): Promise<StockAdjustment> {
    return this.dataSource.transaction(async (manager) => {
      const adj = await manager.findOne(StockAdjustment, {
        where: { id: adjustmentId, organizationId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!adj) throw new NotFoundException('Adjustment record not found');
      if (adj.status !== AdjustmentStatus.PENDING_APPROVAL) {
        throw new BadRequestException(`Adjustment already processed with status '${adj.status}'`);
      }

      const items = await manager.find(StockAdjustmentItem, {
        where: { stockAdjustmentId: adj.id },
      });
      adj.items = items;

      for (const item of adj.items) {
        let inv = await manager.findOne(InventoryItem, {
          where: { locationId: adj.warehouseId, productId: item.productId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!inv) {
          const masterInventory = await this.ensureMasterInventory(manager, item.productId, organizationId);
          inv = manager.create(InventoryItem, {
            locationId: adj.warehouseId,
            productId: item.productId,
            inventoryId: masterInventory.id,
            quantity: item.countedQuantity,
            orderQue: 0,
            hoildQue: 0,
            processing: 0,
            wastageQuantity: 0,
            expiredQuantity: 0,
          });
        } else {
          inv.quantity = item.countedQuantity; // Reconcile to physically counted stock
        }

        await manager.save(inv);
        const adjustmentDelta = Number(item.countedQuantity || 0) - Number(item.systemQuantity || 0);
        if (adjustmentDelta !== 0) {
          await manager.save(
            manager.create(Transaction, {
              productId: item.productId,
              quantity: Math.abs(adjustmentDelta),
              totalAmount: Math.abs(Number(item.totalVarianceValue || 0)),
              type: adjustmentDelta > 0 ? 'IN' : 'OUT',
              inventoryId: item.productId,
              locationId: adj.warehouseId,
              organizationId,
              referenceType: 'STOCK_ADJUSTMENT',
              referenceNumber: adj.adjustmentNumber,
              remarks: `Stock adjusted from ${item.systemQuantity} to ${item.countedQuantity}. Reason: ${adj.reason}`,
              performedById: userId,
            }),
          );
        }

        // Synchronize master Inventory stock across all warehouses for this product
        const allWarehouseItems = await manager.find(InventoryItem, {
          where: { productId: item.productId },
        });
        const totalStockAcrossWarehouses = allWarehouseItems.reduce(
          (sum, wItem) => sum + Number(wItem.quantity || 0),
          0,
        );

        let masterInventory = await manager.findOne(Inventory, {
          where: { productId: item.productId },
        });

        if (!masterInventory) {
          masterInventory = manager.create(Inventory, {
            productId: item.productId,
            organizationId,
            stock: totalStockAcrossWarehouses,
            wastageQuantity: 0,
            expiredQuantity: 0,
          });
        } else {
          masterInventory.stock = totalStockAcrossWarehouses;
        }

        const savedMasterInv = await manager.save(masterInventory);

        if (!inv.inventoryId) {
          inv.inventoryId = savedMasterInv.id;
          await manager.save(inv);
        }
      }

      adj.status = AdjustmentStatus.APPROVED;
      adj.approvedById = userId;

      return manager.save(adj);
    });
  }

  async getAdjustments(organizationId: string) {
    return this.adjustmentRepo.find({
      where: { organizationId },
      order: { adjustmentDate: 'DESC' },
      relations: ['warehouse', 'items', 'items.product'],
    });
  }

  // ================= BATCH / LOT & EXPIRY =================
  async createBatch(data: Partial<ProductBatch>, organizationId: string): Promise<ProductBatch> {
    const batch = this.batchRepo.create({ ...data, currentQuantity: data.initialQuantity, organizationId });
    return this.batchRepo.save(batch);
  }

  async getExpiringBatchesReport(organizationId: string, daysThreshold: number = 90) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysThreshold);
    const dateStr = futureDate.toISOString().split('T')[0];

    return this.batchRepo.find({
      where: {
        organizationId,
        expiryDate: LessThanOrEqual(dateStr),
        currentQuantity: MoreThan(0),
      },
      order: { expiryDate: 'ASC' },
      relations: ['product', 'warehouse'],
    });
  }

  // ================= LOW STOCK & REORDER ALERTS =================
  async setReorderRule(data: Partial<ProductReorderRule>, organizationId: string): Promise<ProductReorderRule> {
    if (!data.productId || !data.warehouseId) {
      throw new BadRequestException('Product and warehouse are required for reorder rules');
    }

    const minStockLevel = Number(data.minStockLevel ?? 0);
    const maxStockLevel = Number(data.maxStockLevel ?? 0);
    const reorderQuantity = Number(data.reorderQuantity ?? 0);

    if (maxStockLevel < minStockLevel) {
      throw new BadRequestException('Maximum stock level must be greater than or equal to minimum stock level');
    }

    if (reorderQuantity < 1) {
      throw new BadRequestException('Reorder quantity must be at least 1');
    }

    let rule = await this.reorderRuleRepo.findOne({
      where: { organizationId, productId: data.productId, warehouseId: data.warehouseId },
    });

    if (rule) {
      Object.assign(rule, data, { minStockLevel, maxStockLevel, reorderQuantity });
    } else {
      rule = this.reorderRuleRepo.create({ ...data, minStockLevel, maxStockLevel, reorderQuantity, organizationId });
    }
    return this.reorderRuleRepo.save(rule);
  }

  async getReorderRules(organizationId: string): Promise<ProductReorderRule[]> {
    return this.reorderRuleRepo.find({
      where: { organizationId },
      order: { updatedAt: 'DESC' },
      relations: ['product', 'warehouse'],
    });
  }

  async getLowStockAlerts(organizationId: string) {
    const items = await this.inventoryItemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.location', 'location')
      .where('product.organizationId = :organizationId', { organizationId })
      .getMany();

    const rules = await this.reorderRuleRepo.find({
      where: { organizationId, isAlertActive: true },
    });

    const ruleMap = new Map<string, number>();
    rules.forEach((r) => ruleMap.set(`${r.productId}-${r.warehouseId}`, r.minStockLevel));

    const lowStockItems: any[] = [];

    items.forEach((item) => {
      const minLevel = ruleMap.get(`${item.productId}-${item.locationId}`) || 10;
      const currentStock = Number(item.quantity || 0);
      if (currentStock <= minLevel) {
        lowStockItems.push({
          productId: item.productId,
          productName: item.product?.name,
          sku: item.product?.sku,
          warehouseId: item.locationId,
          warehouseName: item.location?.name,
          currentStock,
          minStockLevel: minLevel,
          deficit: minLevel - currentStock,
        });
      }
    });

    return lowStockItems;
  }

  // ================= INVENTORY VALUATION & DEAD STOCK =================
  async getInventoryValuation(organizationId: string, warehouseId?: string) {
    const qb = this.inventoryItemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.location', 'location')
      .where('product.organizationId = :organizationId', { organizationId });

    if (warehouseId) {
      qb.andWhere('item.locationId = :warehouseId', { warehouseId });
    }

    const rawItems = await qb.getMany();

    let totalValuation = 0;
    let totalRetailValuation = 0;
    let totalUnits = 0;
    let lowStockCount = 0;

    const valuationByWarehouse = new Map<string, { warehouseName: string; units: number; value: number }>();
    const itemsList: any[] = [];

    rawItems.forEach((item) => {
      const qty = Number(item.quantity || 0);
      const product = item.product as any;
      const cost = Number(product?.purchasePrice || product?.regularPrice || 0);
      const retailPrice = Number(product?.salePrice || product?.retailPrice || product?.regularPrice || cost);
      const itemCostVal = qty * cost;
      const itemRetailVal = qty * retailPrice;
      const isLow = qty <= 10;

      if (isLow) lowStockCount += 1;
      totalUnits += qty;
      totalValuation += itemCostVal;
      totalRetailValuation += itemRetailVal;

      const whName = item.location?.name || 'Default Warehouse';
      if (!valuationByWarehouse.has(whName)) {
        valuationByWarehouse.set(whName, { warehouseName: whName, units: 0, value: 0 });
      }
      const wh = valuationByWarehouse.get(whName)!;
      wh.units += qty;
      wh.value += itemCostVal;

      itemsList.push({
        productId: item.productId,
        productName: product?.name || 'Unknown Product',
        sku: product?.sku || 'N/A',
        warehouseId: item.locationId,
        warehouseName: whName,
        totalQuantity: qty,
        averageCost: cost,
        totalCostValuation: itemCostVal,
        totalRetailValuation: itemRetailVal,
        isLowStock: isLow,
      });
    });

    return {
      summary: {
        totalSkus: itemsList.length,
        totalQuantity: totalUnits,
        totalCostValuation: totalValuation,
        totalRetailValuation: totalRetailValuation,
        lowStockCount,
      },
      totalUnits,
      totalValuation,
      byWarehouse: Array.from(valuationByWarehouse.values()),
      items: itemsList,
    };
  }
}
