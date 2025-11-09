import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { In } from 'typeorm';
import { DataSource } from 'typeorm';
import axios from 'axios';
import { ApiError } from 'src/middleware/ApiError';
import { Order } from 'src/modules/v1/order/entities/order.entity';
import { Products } from 'src/modules/v1/order/entities/products.entity';
import { OrdersLog } from 'src/modules/v1/order/entities/orderlog.entity';
import { Inventory } from 'src/modules/v1/inventory/entities/inventory.entity';
import { InventoryItem } from 'src/modules/v1/inventory/entities/inventoryitem.entity';
import { DeliveryPartner } from 'src/modules/v1/delivery-partner/entities/delivery-partner.entity';
import { RequisitionService } from 'src/modules/v1/requsition/requsition.service';

@Injectable()
export class OrderServiceV2 {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Products)
    private readonly productsRepository: Repository<Products>,
    @InjectRepository(OrdersLog)
    private readonly orderLogsRepository: Repository<OrdersLog>,
    @InjectRepository(Inventory)
    private readonly inventoryRepository: Repository<Inventory>,
    @InjectRepository(InventoryItem)
    private readonly InventoryItemItemRepository: Repository<InventoryItem>,
    @InjectRepository(DeliveryPartner)
    private readonly deliveryPartnerRepository: Repository<DeliveryPartner>,
    private readonly requisitionService: RequisitionService,
  ) {}

async changeStatusBulk(
  orderIds: number[],
  mainData: any,
  organizationId: string,
) {
  const { currentStatus, ...data } = mainData;
  const orders = await this.orderRepository.find({
    where: { id: In(orderIds) },
    relations: ['status'],
  });

  if (orders.length !== orderIds.length) {
    throw new ApiError(HttpStatus.BAD_REQUEST, 'Some orders do not exist');
  }

  // Helper: update inventory and inventory items
  const updateInventory = async (
    order: any,
    updateFn: (inv: any, invItem: any, qty: number) => Promise<void>,
  ) => {
    const products = await this.productsRepository.find({
      where: { orderId: order.id },
    });

    for (const product of products) {
      const inventory = await this.inventoryRepository.findOne({
        where: { productId: product.productId },
      });

      const inventoryItem = await this.InventoryItemItemRepository.findOne({
        where: { productId: product.productId, locationId: order.locationId },
      });

      await updateFn(inventory, inventoryItem, product.productQuantity);
    }
  };

  // Helper: transaction wrapper
  const runInTransaction = async (callback: () => Promise<void>) => {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await callback();
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to update inventory',
      );
    } finally {
      await queryRunner.release();
    }
  };

  // Status-specific handlers
  const statusHandlers: Record<number, () => Promise<void>> = {
    7: async () => {
      await runInTransaction(async () => {
        const currierPayload = orders.map((op) => ({
          invoice: op?.invoiceNumber,
          recipient_name: op?.receiverName,
          recipient_phone: op?.receiverPhoneNumber,
          recipient_address: op?.receiverAddress,
          cod_amount: op?.totalReceiveAbleAmount,
          note: op?.deliveryNote || 'N/A',
        }));

        for (const order of orders) {
          await updateInventory(order, async (inv, invItem, qty) => {
            if (inv) {
              await this.inventoryRepository.update(
                { productId: inv.productId },
                { processing: inv.processing - qty, stock: inv.stock - qty },
              );
            }
            if (invItem) {
              await this.InventoryItemItemRepository.update(
                { productId: invItem.productId, locationId: order.locationId },
                { processing: invItem.processing - qty, quantity: invItem.quantity - qty },
              );
            }
          });
        }

        const currierCompany = await this.deliveryPartnerRepository.findOne({
          where: { organizationId, id: orders[0]?.currier },
        });

        if (currierCompany?.partnerName === 'SteadFast') {
          await axios.post(
            'https://portal.packzy.com/api/v1/create_order/bulk-order',
            currierPayload,
            {
              headers: {
                'Api-Key': currierCompany.api_key,
                'Secret-Key': currierCompany.secret_key,
              },
            },
          );
        }

        await this.orderRepository.update(
          { id: In(orderIds) },
          { intransitTime: new Date() },
        );
      });
    },

    5: async () => {
      await this.requisitionService.createRequisition(
        { orderIds, userId: data?.userId },
        organizationId,
      );
      await this.orderRepository.update(
        { id: In(orderIds) },
        { storeTime: new Date() },
      );
    },

    6: async () => {
      await this.orderRepository.update(
        { id: In(orderIds) },
        { packingTime: new Date() },
      );
    },

    4: async () => {
      if (currentStatus === 2) {
        await runInTransaction(async () => {
          for (const order of orders) {
            await updateInventory(order, async (inv, invItem, qty) => {
              if (inv) {
                await this.inventoryRepository.update(
                  { productId: inv.productId },
                  { orderQue: inv.orderQue - qty },
                );
              }
              if (invItem) {
                await this.InventoryItemItemRepository.update(
                  { productId: invItem.productId, locationId: order.locationId },
                  { orderQue: invItem.orderQue - qty },
                );
              }
            });
          }
        });
      } else if ([5, 6].includes(currentStatus)) {
        await runInTransaction(async () => {
          for (const order of orders) {
            await updateInventory(order, async (inv, invItem, qty) => {
              if (inv) {
                await this.inventoryRepository.update(
                  { productId: inv.productId },
                  { processing: inv.processing - qty },
                );
              }
              if (invItem) {
                await this.InventoryItemItemRepository.update(
                  { productId: invItem.productId, locationId: order.locationId },
                  { processing: invItem.processing - qty },
                );
              }
            });
          }
        });
      }
    },

    3: async () => {
      if (currentStatus === 2) {
        await runInTransaction(async () => {
          for (const order of orders) {
            await updateInventory(order, async (inv, invItem, qty) => {
              if (inv) {
                await this.inventoryRepository.update(
                  { productId: inv.productId },
                  {
                    orderQue: inv.orderQue - qty,
                    hoildQue: inv.hoildQue + qty,
                  },
                );
              }
              if (invItem) {
                await this.InventoryItemItemRepository.update(
                  { productId: invItem.productId, locationId: order.locationId },
                  {
                    orderQue: invItem.orderQue - qty,
                    hoildQue: invItem.hoildQue + qty,
                  },
                );
              }
            });
          }
        });
      } else if ([5, 6].includes(currentStatus)) {
        await runInTransaction(async () => {
          for (const order of orders) {
            await updateInventory(order, async (inv, invItem, qty) => {
              if (inv) {
                await this.inventoryRepository.update(
                  { productId: inv.productId },
                  {
                    processing: inv.processing - qty,
                    hoildQue: inv.hoildQue + qty,
                  },
                );
              }
              if (invItem) {
                await this.InventoryItemItemRepository.update(
                  { productId: invItem.productId, locationId: order.locationId },
                  {
                    processing: invItem.processing - qty,
                    hoildQue: invItem.hoildQue + qty,
                  },
                );
              }
            });
          }
        });
      } else if (currentStatus === 1) {
        await runInTransaction(async () => {
          for (const order of orders) {
            await updateInventory(order, async (inv, invItem, qty) => {
              if (!inv?.hoildQue) {
                await this.inventoryRepository.update({ productId: inv.productId }, { hoildQue: 0 });
              }
              await this.inventoryRepository.increment(
                { productId: inv.productId },
                'hoildQue',
                qty,
              );

              if (!invItem) {
                const newItem = this.InventoryItemItemRepository.create({
                  locationId: order.locationId,
                  productId: inv.productId,
                  quantity: 0,
                  orderQue: qty,
                  inventoryId: inv.id,
                });
                await this.InventoryItemItemRepository.save(newItem);
              } else {
                if (!invItem?.hoildQue) {
                  await this.InventoryItemItemRepository.update(
                    { productId: invItem.productId, locationId: order.locationId },
                    { hoildQue: 0 },
                  );
                }
                await this.InventoryItemItemRepository.increment(
                  { productId: invItem.productId, locationId: order.locationId },
                  'hoildQue',
                  qty,
                );
              }
            });
          }
        });
      }
    },

    2: async () => {
      if ([1, 4].includes(currentStatus)) {
        await runInTransaction(async () => {
          for (const order of orders) {
            await updateInventory(order, async (inv, invItem, qty) => {
              if (!inv?.orderQue) {
                await this.inventoryRepository.update({ productId: inv.productId }, { orderQue: 0 });
              }
              await this.inventoryRepository.increment(
                { productId: inv.productId },
                'orderQue',
                qty,
              );

              if (!invItem) {
                const newItem = this.InventoryItemItemRepository.create({
                  locationId: order.locationId,
                  productId: inv.productId,
                  quantity: 0,
                  orderQue: qty,
                  inventoryId: inv.id,
                });
                await this.InventoryItemItemRepository.save(newItem);
              } else {
                if (!invItem?.orderQue) {
                  await this.InventoryItemItemRepository.update(
                    { productId: invItem.productId, locationId: order.locationId },
                    { orderQue: 0 },
                  );
                }
                await this.InventoryItemItemRepository.increment(
                  { productId: invItem.productId, locationId: order.locationId },
                  'orderQue',
                  qty,
                );
              }
            });
          }
        });
      }
    },
  };

  // Run status-specific handler
  if (statusHandlers[data?.statusId]) {
    await statusHandlers[data.statusId]();
  }

  // Final update and logging
  await this.orderRepository.update(
    { id: In(orderIds) },
    { ...data, previousStatus: currentStatus },
  );

  const updatedOrders = await this.orderRepository.find({
    where: { id: In(orderIds) },
    relations: ['status'],
  });

  const orderLogs = orders.map((order, index) => ({
    orderId: order.id,
    agentId: data.agentId,
    action: `Order Status changed to ${updatedOrders[index].status.label} from ${order.status.label}`,
    previousValue: null,
  }));

  await this.orderLogsRepository.save(orderLogs);
  return updatedOrders;
}




}
