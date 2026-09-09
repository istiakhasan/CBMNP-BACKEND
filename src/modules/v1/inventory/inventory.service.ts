import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../product/entity/product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Inventory } from './entities/inventory.entity';
import { InventoryItem } from './entities/inventoryitem.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Inventory)
    private readonly inventoryRepository: Repository<Inventory>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    private readonly dataSource: DataSource,
  ) {}

  async addProductToInventory(
    createTransactionDto: any,
  ): Promise<Inventory & { type?: boolean }> {
    const {
      productId,
      quantity = 0,
      type,
      inventoryItems,
      expiredQuantity = 0,
      wastageQuantity = 0,
      organizationId,
      referenceNumber,
      remarks: userRemarks,
      performedByName,
    } = createTransactionDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: productId },
      });
      if (!product) {
        throw new Error('Product not found');
      }

      let inventory = await queryRunner.manager.findOne(Inventory, {
        where: { productId },
      });

      if (!inventory) {
        inventory = queryRunner.manager.create(Inventory, {
          productId,
          organizationId,
          stock: 0,
          expiredQuantity: 0,
          wastageQuantity: 0,
        });
        await queryRunner.manager.save(inventory);
      }

      if (inventoryItems && inventoryItems.length > 0) {
        const itemsToSave = await Promise.all(
          inventoryItems.map(async (item: any) => {
            let isExist = await queryRunner.manager.findOne(InventoryItem, {
              where: {
                productId: item?.productId,
                locationId: item?.locationId,
              },
            });

            const itemQty = Number(item.quantity || 0);
            const itemWastage = Number(item.wastageQuantity || 0);
            const itemExpired = Number(item.expiredQuantity || 0);

            if (isExist) {
              isExist.quantity = type
                ? Number(isExist.quantity || 0) + itemQty
                : Number(isExist.quantity || 0) - itemQty;
              isExist.wastageQuantity = type
                ? Number(isExist.wastageQuantity || 0) + itemWastage
                : Number(isExist.wastageQuantity || 0) - itemWastage;
              isExist.expiredQuantity = type
                ? Number(isExist.expiredQuantity || 0) + itemExpired
                : Number(isExist.expiredQuantity || 0) - itemExpired;

              const inventoryItemTransaction = queryRunner.manager.create(
                'Transaction',
                {
                  productId: item.productId,
                  quantity: itemQty,
                  totalAmount: Number(product.regularPrice || 0) * itemQty,
                  type: type ? 'IN' : 'OUT',
                  inventoryId: inventory.productId,
                  locationId: item.locationId,
                  organizationId,
                  referenceType: type ? 'MANUAL_STOCK_IN' : 'MANUAL_STOCK_OUT',
                  referenceNumber: referenceNumber || null,
                  remarks:
                    userRemarks ||
                    `${type ? 'Manual Stock Added (+)' : 'Manual Stock Deducted (-)'} in warehouse inventory`,
                  performedByName: performedByName || 'Admin',
                },
              );
              await queryRunner.manager.save(inventoryItemTransaction);
              return isExist;
            } else {
              const a = queryRunner.manager.create(InventoryItem, {
                ...item,
                inventory: inventory,
                quantity: itemQty,
                wastageQuantity: itemWastage,
                expiredQuantity: itemExpired,
              });

              const inventoryItemTransaction = queryRunner.manager.create(
                'Transaction',
                {
                  productId: item.productId,
                  quantity: itemQty,
                  totalAmount: Number(product.regularPrice || 0) * itemQty,
                  type: type ? 'IN' : 'OUT',
                  inventoryId: inventory.productId,
                  locationId: item.locationId,
                  organizationId,
                  referenceType: type ? 'MANUAL_STOCK_IN' : 'MANUAL_STOCK_OUT',
                  referenceNumber: referenceNumber || null,
                  remarks:
                    userRemarks ||
                    `${type ? 'Initial Warehouse Stock Added (+)' : 'Stock Deducted (-)'}`,
                  performedByName: performedByName || 'Admin',
                },
              );
              await queryRunner.manager.save(inventoryItemTransaction);
              return a;
            }
          }),
        );
        await queryRunner.manager.save(InventoryItem, itemsToSave);

        // Recompute master stock from all warehouse items
        const allWarehouseItems = await queryRunner.manager.find(InventoryItem, {
          where: { productId },
        });
        inventory.stock = allWarehouseItems.reduce(
          (sum, wItem) => sum + Number(wItem.quantity || 0),
          0,
        );
      } else {
        const directQty = Number(quantity || 0);
        inventory.stock = type
          ? Number(inventory.stock || 0) + directQty
          : Number(inventory.stock || 0) - directQty;
        inventory.expiredQuantity = type
          ? Number(inventory.expiredQuantity || 0) + Number(expiredQuantity || 0)
          : Number(inventory.expiredQuantity || 0) - Number(expiredQuantity || 0);
        inventory.wastageQuantity = type
          ? Number(inventory.wastageQuantity || 0) + Number(wastageQuantity || 0)
          : Number(inventory.wastageQuantity || 0) - Number(wastageQuantity || 0);

        const transaction = queryRunner.manager.create('Transaction', {
          productId,
          quantity: directQty,
          organizationId,
          totalAmount: Number(product.regularPrice || 0) * directQty,
          type: type ? 'IN' : 'OUT',
          inventoryId: inventory.productId,
          referenceType: type ? 'MANUAL_STOCK_IN' : 'MANUAL_STOCK_OUT',
          referenceNumber: referenceNumber || null,
          remarks:
            userRemarks ||
            `${type ? 'Master Inventory Stock Added (+)' : 'Master Inventory Stock Deducted (-)'}`,
          performedByName: performedByName || 'Admin',
        });
        await queryRunner.manager.save(transaction);
      }

      const result = await queryRunner.manager.save(inventory);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async loadInventory(organizationId: string, query: any) {
    const { page = 1, limit = 10, searchProducts, warehouseId } = query;

    const qb = this.inventoryRepository
      .createQueryBuilder('inventory')
      .leftJoinAndSelect('inventory.product', 'product')
      .leftJoinAndSelect('inventory.transactions', 'transactions')
      .leftJoinAndSelect('inventory.inventoryItems', 'inventoryItems')
      .leftJoinAndSelect('inventoryItems.location', 'location')
      .where('inventory.organizationId = :organizationId', { organizationId });

    if (searchProducts) {
      qb.andWhere(
        '(product.name ILIKE :search OR product.sku ILIKE :search)',
        { search: `%${searchProducts}%` },
      );
    }

    if (warehouseId) {
      qb.andWhere('location.id = :warehouseId', { warehouseId });
    }

    const [data, total] = await qb
      .skip((Number(page) - 1) * Number(limit))
      .take(Number(limit))
      .getManyAndCount();

    const syncedData = data.map((inv) => {
      if (inv.inventoryItems && inv.inventoryItems.length > 0) {
        const computedStock = inv.inventoryItems.reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0,
        );
        inv.stock = computedStock;
      }
      return inv;
    });

    return { data: syncedData, total };
  }

  async loadInventoryByProductId(productId: string) {
    const result = await this.inventoryRepository.findOne({
      where: { productId: productId },
      relations: ['product', 'inventoryItems', 'inventoryItems.location'],
      order: { createdAt: 'DESC' },
    });

    return result;
  }

  async loadInventoryByWarehouseProduct(query: any) {
    const { productId, locationId } = query;
    const result = await this.inventoryItemRepository.findOne({
      where: { productId: productId, locationId: locationId },
      relations: ['product', 'location'],
      order: { createdAt: 'DESC' },
    });

    return result;
  }

  async getWarehouseWiseStock(organizationId: string, warehouseId?: string) {
    const query = this.inventoryItemRepository
      .createQueryBuilder('inventoryItem')
      .leftJoin('inventoryItem.location', 'warehouse')
      .leftJoin('inventoryItem.product', 'product')
      .where('warehouse.organizationId = :organizationId', { organizationId })
      .select([
        'warehouse.id AS warehouseId',
        'warehouse.name AS warehouseName',
        'product.id AS productId',
        'product.name AS productName',
        'SUM(inventoryItem.quantity) AS totalQuantity',
        'SUM(inventoryItem.processing) AS totalProcessing',
        'SUM(inventoryItem.hoildQue) AS totalHoldQueue',
        'SUM(inventoryItem.orderQue) AS totalOrderQueue',
      ]);

    if (warehouseId) {
      query.andWhere('warehouse.id = :warehouseId', { warehouseId });
    }

    const result = await query
      .groupBy('warehouse.id')
      .addGroupBy('warehouse.name')
      .addGroupBy('product.id')
      .addGroupBy('product.name')
      .getRawMany();

    return result;
  }
}
