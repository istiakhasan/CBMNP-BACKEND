import { BadRequestException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import * as ExcelJS from 'exceljs';
import { Logger } from '@nestjs/common';
import { Products } from './entities/products.entity';
import paginationHelpers from '../../../helpers/paginationHelpers';
import { plainToInstance } from 'class-transformer';
import { Product } from '../product/entity/product.entity';
import { OrderStatus } from '../status/entities/status.entity';
import { Customers } from '../customers/entities/customers.entity';
import { In } from 'typeorm';
import { Users } from '../user/entities/user.entity';
import { ApiError } from '../../../middleware/ApiError';
import { PaymentHistory } from './entities/paymentHistory.entity';
import { OrdersLog } from './entities/orderlog.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { InventoryItem } from '../inventory/entities/inventoryitem.entity';
import { DataSource } from 'typeorm';
import { RequisitionService } from '../requsition/requsition.service';
import axios from 'axios';
import { DeliveryPartner } from '../delivery-partner/entities/delivery-partner.entity';
import { OrderProductReturn } from './entities/return_damage.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Response } from 'express';
import * as _ from 'lodash';
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(OrderStatus)
    private readonly statusRepository: Repository<OrderStatus>,
    @InjectRepository(Customers)
    private readonly customerRepository: Repository<Customers>,
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    @InjectRepository(Products)
    private readonly productsRepository: Repository<Products>,
    @InjectRepository(PaymentHistory)
    private readonly paymentHistoryRepository: Repository<PaymentHistory>,
    @InjectRepository(OrdersLog)
    private readonly orderLogsRepository: Repository<OrdersLog>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Inventory)
    private readonly inventoryRepository: Repository<Inventory>,
    @InjectRepository(InventoryItem)
    private readonly InventoryItemItemRepository: Repository<InventoryItem>,
    @InjectRepository(DeliveryPartner)
    private readonly deliveryPartnerRepository: Repository<DeliveryPartner>,
    @InjectRepository(OrderProductReturn)
    private readonly orderProductReturnRepository: Repository<OrderProductReturn>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,

    private readonly requisitionService: RequisitionService,
  ) {}
 // আগের generateOrderNumber() টা এই দিয়ে replace করুন
// ---------- Shared helper: organization এর prefix বের করা ----------
private async getOrganizationPrefix(
  manager: EntityManager,
  organizationId: string,
): Promise<string> {
  const organization = await manager.findOne(Organization, {
    where: { id: organizationId },
  });
  return organization?.invoicePrefix || 'ORD';
}

// ---------- Order Number ----------
async generateOrderNumber(organizationId: string): Promise<string> {
  return this.dataSource.transaction(async (manager) => {
    const prefix = await this.getOrganizationPrefix(manager, organizationId);

    const lastOrder = await manager
      .createQueryBuilder(Order, 'order')
      .setLock('pessimistic_write')
      .where('order.organizationId = :organizationId', { organizationId })
      .andWhere('order.orderNumber LIKE :prefix', { prefix: `${prefix}-%` })
      .orderBy('order.id', 'DESC')
      .take(1)
      .getOne();

    let nextNumber = 10000; // order number এর default starting point আগের মতোই রাখলাম
    if (lastOrder?.orderNumber) {
      const lastNumStr = lastOrder.orderNumber.replace(`${prefix}-`, '');
      const lastNum = parseInt(lastNumStr, 10);
      if (!isNaN(lastNum)) nextNumber = lastNum + 1;
    }

    // 8-digit zero-padded number, e.g. 00010000, 00010001 ...
    return `${prefix}-${nextNumber.toString().padStart(8, '0')}`;
  });
}

// ---------- Invoice Number ----------
async generateInvoiceNumber(organizationId: string): Promise<string> {
  return this.dataSource.transaction(async (manager) => {
    const prefix = await this.getOrganizationPrefix(manager, organizationId);

    const lastOrder = await manager
      .createQueryBuilder(Order, 'order')
      .setLock('pessimistic_write')
      .where('order.organizationId = :organizationId', { organizationId })
      .andWhere('order.invoiceNumber LIKE :prefix', { prefix: `${prefix}-%` })
      .orderBy('order.id', 'DESC')
      .take(1)
      .getOne();

    let nextNumber = 1;
    if (lastOrder?.invoiceNumber) {
      const lastNumStr = lastOrder.invoiceNumber.replace(`${prefix}-`, '');
      const lastNum = parseInt(lastNumStr, 10);
      if (!isNaN(lastNum)) nextNumber = lastNum + 1;
    }

    // 8-digit zero-padded number, e.g. 00000001, 00000002 ...
    return `${prefix}-${nextNumber.toString().padStart(8, '0')}`;
  });
}

  async createOrder(payload: Order, organizationId: string) {
    const {
      customerId,
      receiverPhoneNumber,
      products,
      discount = 0,
      paymentHistory = [],
      shippingCharge = 0,
      ...rest
    } = payload;

    if (!products || products.length === 0) {
      throw new Error('Order must include at least one product');
    }

    if (
      !organizationId ||
      !(await this.organizationRepository.findOne({
        where: { id: organizationId },
      }))
    ) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'You are not authorized ');
    }

    const validatedProducts: any[] = [];
    let productValue = 0;

    for (const product of products) {
      const existingProduct = await this.productRepository.findOne({
        where: { id: product.productId },
      });
      if (!existingProduct) {
        throw new NotFoundException(
          `Product with ID ${product.productId} not found`,
        );
      }

      const subtotal = product.productQuantity * existingProduct.salePrice;
      productValue += subtotal;

      validatedProducts.push({
        productId: product.productId,
        productQuantity: product.productQuantity,
        productPrice: existingProduct.salePrice,
        subtotal,
      });
    }
    const totalPaidAmount = paymentHistory.reduce(
      (total, payment) => total + Number(payment.paidAmount),
      0,
    );
    const grandTotal = productValue + Number(shippingCharge) - Number(discount);
    const totalReceivableAmount = grandTotal - totalPaidAmount;

    // generate invoice number
const orderNumber = await this.generateOrderNumber(organizationId);
const incrementedId = await this.generateInvoiceNumber(organizationId);
    const result = await this.orderRepository.save({
      orderNumber,
      paymentHistory: paymentHistory,
      customerId,
      receiverPhoneNumber,
      products: validatedProducts,
      currier: payload.currier,
      orderSource: payload.orderSource,
      shippingCharge,
      totalPrice: grandTotal,
      productValue,
      totalPaidAmount,
      totalReceiveAbleAmount: totalReceivableAmount,
      discount,
      invoiceNumber: incrementedId,
      organizationId,
      ...rest,
    });

    await this.orderLogsRepository.save({
      orderId: result.id,
      agentId: payload.agentId,
      action: 'The Order created',
      previousValue: null,
    });
    // if order status approved then this section will be execute
    // if (payload?.statusId === 2) {
    //   for (const item of products) {
    //     const { productId, productQuantity } = item;
    //     const existingInventory = await this.inventoryRepository.findOne({
    //       where: { productId },
    //     });
    //     if (!existingInventory?.orderQue) {
    //       await this.inventoryRepository.update({ productId }, { orderQue: 0 });
    //     }
    //     await this.inventoryRepository.increment(
    //       { productId },
    //       'orderQue',
    //       productQuantity,
    //     );

    //     const existingInventoryItem =
    //       await this.InventoryItemItemRepository.findOne({
    //         where: { productId, locationId: rest?.locationId },
    //       });

    //     //
    //     if (!existingInventoryItem) {
    //       const newInventoryItems =
    //         await this.InventoryItemItemRepository.create({
    //           locationId: rest?.locationId,
    //           productId: productId,
    //           quantity: 0,
    //           orderQue: productQuantity,
    //           inventoryId: existingInventory.id,
    //         });

    //       await this.InventoryItemItemRepository.save(newInventoryItems);
    //     } else {
    //       if (!existingInventoryItem?.orderQue) {
    //         await this.InventoryItemItemRepository.update(
    //           { productId, locationId: rest?.locationId },
    //           { orderQue: 0 },
    //         );
    //       }

    //       await this.InventoryItemItemRepository.increment(
    //         { productId, locationId: rest?.locationId },
    //         'orderQue',
    //         productQuantity,
    //       );
    //     }
    //   }
    // }
if (payload?.statusId === 2) {
  for (const item of products) {
    const { productId, productQuantity } = item;

    let existingInventory = await this.inventoryRepository.findOne({
      where: { productId },
    });

    // Inventory না থাকলে create
    if (!existingInventory) {
      existingInventory = await this.inventoryRepository.save({
        productId,
        organizationId,
        orderQue: productQuantity,
        hoildQue: 0,
        processing: 0,
        stock: 0,
      });
    } else {
      await this.inventoryRepository.increment(
        { productId },
        'orderQue',
        productQuantity,
      );
    }

    // location অবশ্যই লাগবে
    if (!rest?.locationId) {
      throw new BadRequestException(
        `Location is required for product ${productId}`,
      );
    }

    const existingInventoryItem =
      await this.InventoryItemItemRepository.findOne({
        where: {
          productId,
          locationId: rest.locationId,
        },
      });

    if (!existingInventoryItem) {
      const newInventoryItem =
        this.InventoryItemItemRepository.create({
          locationId: rest.locationId,
          productId,
          quantity: 0,
          orderQue: productQuantity,
          inventoryId: existingInventory.id,
        });

      await this.InventoryItemItemRepository.save(newInventoryItem);
    } else {
      await this.InventoryItemItemRepository.increment(
        {
          productId,
          locationId: rest.locationId,
        },
        'orderQue',
        productQuantity,
      );
    }
  }
}
    // if order status hold then this section will be execute
    if (payload?.statusId === 3) {
      for (const item of products) {
        const { productId, productQuantity } = item;
        const existingInventory = await this.inventoryRepository.findOne({
          where: { productId },
        });
        if (!existingInventory?.hoildQue) {
          await this.inventoryRepository.update({ productId }, { hoildQue: 0 });
        }
        await this.inventoryRepository.increment(
          { productId },
          'hoildQue',
          productQuantity,
        );

        const existingInventoryItem =
          await this.InventoryItemItemRepository.findOne({
            where: { productId, locationId: rest?.locationId },
          });

        //
        if (!existingInventoryItem) {
          const newInventoryItems =
            await this.InventoryItemItemRepository.create({
              locationId: rest?.locationId,
              productId: productId,
              quantity: 0,
              hoildQue: productQuantity,
              inventoryId: existingInventory.id,
            });

          await this.InventoryItemItemRepository.save(newInventoryItems);
        } else {
          if (!existingInventoryItem?.hoildQue) {
            await this.InventoryItemItemRepository.update(
              { productId, locationId: rest?.locationId },
              { hoildQue: 0 },
            );
          }

          await this.InventoryItemItemRepository.increment(
            { productId, locationId: rest?.locationId },
            'hoildQue',
            productQuantity,
          );
        }
      }
    }
    return result;
  }
  async createPosOrder(payload: Order, organizationId: string) {
    const {
      customerId,
      receiverPhoneNumber,
      products,
      discount = 0,
      paymentHistory = [],
      shippingCharge = 0,
      ...rest
    } = payload;

    if (!products || products.length === 0) {
      throw new Error('Order must include at least one product');
    }

    if (
      !organizationId ||
      !(await this.organizationRepository.findOne({
        where: { id: organizationId },
      }))
    ) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'You are not authorized ');
    }

    const orderNumber =await this.generateOrderNumber(organizationId);
    const validatedProducts: any[] = [];
    let productValue = 0;

    for (const product of products) {
      const existingProduct = await this.productRepository.findOne({
        where: { id: product.productId },
      });
      if (!existingProduct) {
        throw new NotFoundException(
          `Product with ID ${product.productId} not found`,
        );
      }

      const subtotal = product.productQuantity * existingProduct.salePrice;
      productValue += subtotal;

      validatedProducts.push({
        productId: product.productId,
        productQuantity: product.productQuantity,
        productPrice: existingProduct.salePrice,
        subtotal,
      });
    }
    const totalPaidAmount = paymentHistory.reduce(
      (total, payment) => total + Number(payment.paidAmount),
      0,
    );
    const grandTotal = productValue + Number(shippingCharge) - Number(discount);
    const totalReceivableAmount = grandTotal - totalPaidAmount;

  const incrementedId = await this.generateInvoiceNumber(organizationId);
    const result = await this.orderRepository.save({
      orderNumber,
      paymentHistory: paymentHistory,
      customerId,
      receiverPhoneNumber,
      products: validatedProducts,
      currier: payload.currier,
      orderSource: payload.orderSource,
      shippingCharge,
      totalPrice: grandTotal,
      productValue,
      totalPaidAmount,
      totalReceiveAbleAmount: totalReceivableAmount,
      discount,
      invoiceNumber: incrementedId,
      organizationId,
      ...rest,
    });
    await this.orderLogsRepository.save({
      orderId: result.id,
      agentId: payload.agentId,
      action: 'The Order created',
      previousValue: null,
    });
    if (payload?.statusId === 8) {
      for (const item of products) {
        const { productId, productQuantity } = item;
        const existingInventory = await this.inventoryRepository.findOne({
          where: { productId },
        });
        if (!existingInventory?.orderQue) {
          await this.inventoryRepository.update({ productId }, { orderQue: 0 });
        }
        await this.inventoryRepository.decrement(
          { productId },
          'stock',
          productQuantity,
        );

        const existingInventoryItem =
          await this.InventoryItemItemRepository.findOne({
            where: { productId, locationId: rest?.locationId },
          });

        //
        if (!existingInventoryItem) {
          const newInventoryItems =
            await this.InventoryItemItemRepository.create({
              locationId: rest?.locationId,
              productId: productId,
              quantity: 0,
              inventoryId: existingInventory.id,
            });

          await this.InventoryItemItemRepository.save(newInventoryItems);
        } else {
          if (!existingInventoryItem?.orderQue) {
            await this.InventoryItemItemRepository.update(
              { productId, locationId: rest?.locationId },
              { orderQue: 0 },
            );
          }

          await this.InventoryItemItemRepository.decrement(
            { productId, locationId: rest?.locationId },
            'quantity',
            productQuantity,
          );
        }
      }
    }

    return await this.orderRepository.findOne({
      where: { id: result.id },
      relations: {
        products: { product: true },
      },
    });
  }

  async getOrders(options, filterOptions, organizationId,includeProducts = false) {
    const { page, limit, sortBy, sortOrder, skip } = paginationHelpers(options);
    const queryBuilder = this.orderRepository
      .createQueryBuilder('orders')
      .where('orders.organizationId = :organizationId', { organizationId })
  
  if (includeProducts) {
    queryBuilder.leftJoinAndSelect('orders.products', 'products');
    queryBuilder.leftJoinAndSelect('products.product', 'product');
  }
  if (filterOptions?.searchTerm) {
  const searchTerm = `%${filterOptions.searchTerm.toString()}%`;

  queryBuilder.andWhere(
    '(orders.invoiceNumber LIKE :searchTerm OR orders.receiverPhoneNumber LIKE :searchTerm)',
    {
      searchTerm,
    },
  );
}

    if (filterOptions?.startDate && filterOptions?.endDate) {
      queryBuilder.andWhere(
        'orders.intransitTime BETWEEN :startDate AND :endDate',
        {
          startDate: new Date(filterOptions.startDate),
          endDate: new Date(filterOptions.endDate),
        },
      );
    }
    if (filterOptions?.createdAtStart && filterOptions?.createdAtEnd) {
      queryBuilder.andWhere(
        'orders.createdAt BETWEEN :createdAtStart AND :createdAtEnd',
        {
          createdAtStart: new Date(filterOptions.createdAtStart),
          createdAtEnd: new Date(filterOptions.createdAtEnd),
        },
      );
    }

    // filter by products
    if (filterOptions?.productId) {
      queryBuilder.leftJoin('orders.products', 'product');
    }
    let productIds = filterOptions?.productId;
    if (productIds) {
      productIds = Array.isArray(productIds) ? productIds : [productIds];
      queryBuilder.andWhere('product.productId IN (:...productIds)', {
        productIds,
      });
    }
    // if (filterOptions?.statusId) {
    //   queryBuilder.andWhere('orders.statusId = :statusId', {
    //     statusId: filterOptions.statusId,
    //   });
    // }
    let statusIdss = filterOptions?.statusId;
    if (statusIdss) {
      statusIdss = Array.isArray(statusIdss) ? statusIdss : [statusIdss];
      console.log(statusIdss, 'abcd');
      statusIdss = statusIdss.map(Number); // Convert to number[]
      queryBuilder.andWhere('orders.statusId IN (:...statusIdss)', {
        statusIdss,
      });
    }
    let curierIds = filterOptions?.currier;
    if (curierIds) {
      curierIds = Array.isArray(curierIds) ? curierIds : [curierIds];
      queryBuilder.andWhere('orders.currier IN (:...curierIds)', {
        curierIds,
      });
    }
    // if (filterOptions?.currier) {
    //   queryBuilder.andWhere('orders.currier = :currier', {
    //     currier: filterOptions.currier,
    //   });
    // }

    let locationIds = filterOptions?.locationId;
    if (locationIds) {
      locationIds = Array.isArray(locationIds) ? locationIds : [locationIds];
      queryBuilder.andWhere('orders.locationId IN (:...locationIds)', {
        locationIds,
      });
    }
    if (filterOptions?.paymentStatus) {
      queryBuilder.andWhere('orders.paymentStatus = :paymentStatus', {
        paymentStatus: filterOptions?.paymentStatus,
      });
    }
    // if (filterOptions?.locationId) {
    //   queryBuilder.andWhere('orders.locationId = :locationId', {
    //     locationId: filterOptions.locationId,
    //   });
    // }

    queryBuilder.orderBy(`orders.${sortBy}`, sortOrder).skip(skip).take(limit);

    const [orders, total] = await queryBuilder.getManyAndCount();
    const statusIds = [...new Set(orders.map((order) => order.statusId))];
    const statuses = await this.statusRepository.findBy({
      value: In(statusIds),
    });
    // delivery partner
    const deliveryPartnerIds = [
      ...new Set(orders.map((order) => order.currier)),
    ];
    const deliveryPartner = await this.deliveryPartnerRepository.findBy({
      id: In(deliveryPartnerIds),
    });
    const currierMap = new Map(
      deliveryPartner.map(({ secret_key, api_key, ...partner }) => [
        partner.id,
        partner,
      ]),
    );
    // customer
    const customerIds = [...new Set(orders.map((order) => order.customerId))];
    const customers = await this.customerRepository.findBy({
      customer_Id: In(customerIds),
    });

    const agentIds = [...new Set(orders.map((order) => order.agentId))];
    const agents = await this.usersRepository.findBy({
      userId: In(agentIds),
    });
    const statusMap = new Map(statuses.map((status) => [status.value, status]));
    const customerMap = new Map(
      customers.map((customer) => [customer.customer_Id, customer]),
    );
    const agentMap = new Map(agents.map((order) => [order.userId, order]));
    const modifiedData = orders.map((order) => ({
      ...order,
      status: statusMap.get(order.statusId),
      customer: customerMap.get(order.customerId as any),
      agent: agentMap.get(order.agentId as any),
      partner: currierMap.get(order.currier as any),
    }));

    return {
      data: plainToInstance(Order, modifiedData),
      total,
      page,
      limit,
    };
  }
  // get order reports
async getOrdersReports(options, filterOptions, organizationId) {
    const { sortBy, sortOrder, limit, page, skip } = paginationHelpers(options);
    const queryBuilder = this.orderRepository
      .createQueryBuilder('orders')
      .where('orders.organizationId = :organizationId', { organizationId });

    if (filterOptions?.searchTerm) {
      const searchTerm = `%${filterOptions.searchTerm.toString()}%`;
      queryBuilder.andWhere('orders.orderNumber LIKE :searchTerm', {
        searchTerm,
      });
    }

    const allowedDateFields = [
      'createdAt',
      'intransitTime',
      'storeTime',
      'packingTime',
      'approvedTime',
    ];
    const dateField = allowedDateFields.includes(filterOptions?.dateField)
      ? filterOptions.dateField
      : 'createdAt';

    // ✅ FIX: Bangladesh is UTC+6. Instead of using Date's LOCAL getters
    // (getFullYear/getMonth/getDate) — which depend on the SERVER's timezone
    // and silently shift the day when the input is already a UTC instant
    // representing "Dhaka midnight" — we explicitly shift by +6h first,
    // read the calendar date using UTC getters (unambiguous), then shift
    // back by -6h to get the correct UTC boundaries for that Dhaka day.
    const BD_OFFSET_MS = 6 * 60 * 60 * 1000;

    if (filterOptions?.startDate && filterOptions?.endDate) {
      const rawStart = new Date(filterOptions.startDate);
      const rawEnd = new Date(filterOptions.endDate);

      // Shift into Dhaka wall-clock time (expressed as a UTC instant) so we
      // can safely read the calendar date with UTC getters.
      const bdStart = new Date(rawStart.getTime() + BD_OFFSET_MS);
      const bdEnd = new Date(rawEnd.getTime() + BD_OFFSET_MS);

      const startY = bdStart.getUTCFullYear();
      const startM = bdStart.getUTCMonth();
      const startD = bdStart.getUTCDate();

      const endY = bdEnd.getUTCFullYear();
      const endM = bdEnd.getUTCMonth();
      const endD = bdEnd.getUTCDate();

      // Dhaka day-start / day-end, converted back to real UTC instants.
      const utcStartDate = new Date(
        Date.UTC(startY, startM, startD, 0, 0, 0, 0) - BD_OFFSET_MS,
      );
      const utcEndDate = new Date(
        Date.UTC(endY, endM, endD, 23, 59, 59, 999) - BD_OFFSET_MS,
      );

      queryBuilder.andWhere(
        `orders.${dateField} BETWEEN :startDate AND :endDate`,
        {
          startDate: utcStartDate.toISOString(),
          endDate: utcEndDate.toISOString(),
        },
      );
    }

    let statusIdss = filterOptions?.statusId;
    if (statusIdss) {
      statusIdss = Array.isArray(statusIdss) ? statusIdss : [statusIdss];
      statusIdss = statusIdss.map(Number);
      queryBuilder.andWhere('orders.statusId IN (:...statusIdss)', {
        statusIdss,
      });
    }
    let orderSources = filterOptions?.orderSources;
    if (orderSources) {
      orderSources = Array.isArray(orderSources)
        ? orderSources
        : [orderSources];
      queryBuilder.andWhere('orders.orderSource IN (:...orderSources)', {
        orderSources,
      });
    }
    let selesAgentIds = filterOptions?.agentIds;
    if (selesAgentIds) {
      selesAgentIds = Array.isArray(selesAgentIds)
        ? selesAgentIds
        : [selesAgentIds];
      queryBuilder.andWhere('orders.agentId IN (:...selesAgentIds)', {
        selesAgentIds,
      });
    }

    if (filterOptions?.productId) {
      queryBuilder.leftJoin('orders.products', 'product');
    }
    let productIds = filterOptions?.productId;
    if (productIds) {
      productIds = Array.isArray(productIds) ? productIds : [productIds];
      queryBuilder.andWhere('product.productId IN (:...productIds)', {
        productIds,
      });
    }

    let curierIds = filterOptions?.currier;
    if (curierIds) {
      curierIds = Array.isArray(curierIds) ? curierIds : [curierIds];
      queryBuilder.andWhere('orders.currier IN (:...curierIds)', {
        curierIds,
      });
    }
    let locationIds = filterOptions?.locationId;
    if (locationIds) {
      locationIds = Array.isArray(locationIds) ? locationIds : [locationIds];
      queryBuilder.andWhere('orders.locationId IN (:...locationIds)', {
        locationIds,
      });
    }
    let paymentMethodIds = filterOptions?.paymentMethodIds;
    if (paymentMethodIds) {
      paymentMethodIds = Array.isArray(paymentMethodIds)
        ? paymentMethodIds
        : [paymentMethodIds];
      queryBuilder.andWhere('orders.paymentMethod IN (:...paymentMethodIds)', {
        paymentMethodIds,
      });
    }

    const sumQuery = queryBuilder.clone();
    const { totalAmount, damageQuantity, totalReturnQty, totalPaidAmount } =
      await sumQuery
        .leftJoin('orders.productReturns', 'returnProducts')
        .select('SUM(orders.totalPrice)', 'totalAmount')
        .addSelect('SUM(orders.totalPaidAmount)', 'totalPaidAmount')
        .addSelect('SUM(returnProducts.returnQuantity)', 'totalReturnQty')
        .addSelect('SUM(returnProducts.damageQuantity)', 'damageQuantity')
        .getRawOne();
    queryBuilder.orderBy(`orders.${sortBy}`, sortOrder).skip(skip).take(limit);

    const [orders, total] = await queryBuilder.getManyAndCount();
    const statusIds = [...new Set(orders.map((order) => order.statusId))];
    const warehouseIds = [...new Set(orders.map((order) => order.locationId))];
    const warehouses = await this.warehouseRepository.findBy({
      id: In(warehouseIds),
    });
    const statuses = await this.statusRepository.findBy({
      value: In(statusIds),
    });
    const deliveryPartnerIds = [
      ...new Set(orders.map((order) => order.currier)),
    ];
    const deliveryPartner = await this.deliveryPartnerRepository.findBy({
      id: In(deliveryPartnerIds),
    });
    const currierMap = new Map(
      deliveryPartner.map(({ secret_key, api_key, ...partner }) => [
        partner.id,
        partner,
      ]),
    );
    const customerIds = [...new Set(orders.map((order) => order.customerId))];
    const customers = await this.customerRepository.findBy({
      customer_Id: In(customerIds),
    });

    const agentIds = [...new Set(orders.map((order) => order.agentId))];
    const agents = await this.usersRepository.findBy({
      userId: In(agentIds),
    });
    const statusMap = new Map(statuses.map((status) => [status.value, status]));
    const customerMap = new Map(
      customers.map((customer) => [customer.customer_Id, customer]),
    );
    const warehouseMap = new Map(
      warehouses.map((customer) => [customer.id, customer]),
    );
    const agentMap = new Map(agents.map((order) => [order.userId, order]));
    const modifiedData = orders.map((order) => ({
      ...order,
      status: statusMap.get(order.statusId),
      customer: customerMap.get(order.customerId as any),
      agent: agentMap.get(order.agentId as any),
      partner: currierMap.get(order.currier as any),
    }));
    return {
      data: plainToInstance(Order, modifiedData),
      total,
      page,
      limit,
      totalAmount,
      damageQuantity,
      totalReturnQty,
      totalPaidAmount,
    };
  }

  async getOrderById(orderId: number): Promise<Order & { partner: any }> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: [
        'paymentHistory',
        'comments',
        'comments.user',
        'productReturns',
        'productReturns.product',
        'warehouse',
      ],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.comments && order.comments.length > 0) {
      order.comments.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    const [products, customer] = await Promise.all([
      this.productsRepository.find({
        where: { orderId: order.id },
        relations: ['product'],
      }),
      this.customerRepository.findOne({
        where: { customer_Id: order.customerId },
      }),
    ]);

    // if (!customer) {
    //   throw new NotFoundException(
    //     `Customer with ID ${order.customerId} not found`,
    //   );
    // }

    return {
      ...order,
      products: products || [],
      customer,
      partner: await this.deliveryPartnerRepository.findOne({
        where: { id: order?.currier },
      }),
    };
  }
  async getScanOrderById(orderNumber: string): Promise<Order & { partner: any }> {
    console.log(orderNumber,"order number");
    const order = await this.orderRepository.findOne({
      where: { orderNumber:orderNumber }
    });
   console.log(order,"check");
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderNumber} not found`);
    }
    if (order.status.label !== 'Packing') {
      throw new ApiError(HttpStatus.BAD_REQUEST,`Order with ID ${orderNumber} not in packing`);
    }



    return order;
  }

  /**
   * Delete an order by its ID.
   */
  async deleteOrder(orderId: number): Promise<void> {
    const result = await this.orderRepository.delete(orderId);

    if (result.affected === 0) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }
  }

  async update(orderId: number, data: Order) {
    const {
      customerId,
      receiverPhoneNumber,
      products,
      discount = 0,
      shippingCharge = 0,
      ...rest
    } = data;

    const existingOrder = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['products'],
    });
    if (!existingOrder) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Order does not exist');
    }

    if (!products || products.length === 0) {
      throw new Error('Order must include at least one product');
    }

    const existingProducts = await this.productsRepository.find({
      where: { orderId },
    });

    const validatedProducts: any[] = [];
    let productValue = 0;

    for (const product of products) {
      const existingProduct = await this.productRepository.findOne({
        where: { id: product.productId },
      });
      if (!existingProduct) {
        throw new NotFoundException(
          `Product with ID ${product.productId} not found`,
        );
      }

      // Find previous product quantity
      const prevProduct = existingProducts.find(
        (p) => p.productId === product.productId,
      );
      const prevQuantity = prevProduct ? prevProduct.productQuantity : 0;
      const quantityDiff = product.productQuantity - prevQuantity;

      if (existingOrder.statusId === 2) {
        // Adjust stock based on change in order quantity
        const inventory = await this.inventoryRepository.findOne({
          where: { productId: product.productId },
        });

        const inventoryItem = await this.InventoryItemItemRepository.findOne({
          where: {
            productId: product.productId,
            locationId: existingOrder.locationId,
          },
        });

        if (inventory) {
          await this.inventoryRepository.update(
            { productId: product.productId },
            { orderQue: inventory.orderQue + quantityDiff },
          );
        }

        if (inventoryItem) {
          await this.InventoryItemItemRepository.update(
            {
              productId: product.productId,
              locationId: existingOrder.locationId,
            },
            { orderQue: inventoryItem.orderQue + quantityDiff },
          );
        }
      }
      if (
        (existingOrder.statusId === 5 &&
          existingOrder.status.label === 'Store') ||
        existingOrder.statusId === 6
      ) {
        // Adjust stock based on change in order quantity
        const inventory = await this.inventoryRepository.findOne({
          where: { productId: product.productId },
        });

        const inventoryItem = await this.InventoryItemItemRepository.findOne({
          where: {
            productId: product.productId,
            locationId: existingOrder.locationId,
          },
        });

        if (inventory) {
          await this.inventoryRepository.update(
            { productId: product.productId },
            { processing: inventory.processing + quantityDiff },
          );
        }

        if (inventoryItem) {
          await this.InventoryItemItemRepository.update(
            {
              productId: product.productId,
              locationId: existingOrder.locationId,
            },
            { processing: inventoryItem.processing + quantityDiff },
          );
        }
      }

      // Calculate new subtotal
      const subtotal = product.productQuantity * existingProduct.salePrice;
      productValue += subtotal;
      validatedProducts.push({
        orderId,
        productId: product.productId,
        productQuantity: product.productQuantity,
        productPrice: existingProduct.salePrice,
        subtotal,
      });
    }

    // Delete old products & insert new ones
    await this.productsRepository.delete({ orderId });
    if (validatedProducts.length > 0) {
      await this.productsRepository.save(validatedProducts);
    }

    // Log the update
    await this.orderLogsRepository.save({
      orderId: orderId,
      agentId: data.agentId,
      action: `Order updated. Products and other information (e.g., shipping charge, customer details) have been modified.`,
      previousValue: existingOrder ? JSON.stringify(existingOrder) : null,
      newValue: JSON.stringify(data),
    });

    // Calculate totals
    const grandTotal = productValue + Number(shippingCharge) - Number(discount);
    const totalReceivableAmount = grandTotal - rest.totalPaidAmount;

    // Update order
    await this.orderRepository.update(
      { id: orderId },
      {
        ...rest,
        customerId,
        receiverPhoneNumber,
        discount,
        shippingCharge,
        totalPrice: grandTotal,
        productValue,
        totalReceiveAbleAmount: totalReceivableAmount,
      },
    );

    // Return updated order
    return await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['products'],
    });
  }

  // update payment
  async addPayment(orderId: number, data: PaymentHistory) {
    const isOrderExist = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!isOrderExist) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Order is not exist ');
    }
    const previousHistory = await this.paymentHistoryRepository.find({
      where: { orderId: orderId },
    });

    const insertPayment = await this.paymentHistoryRepository.save(data);
    if (!insertPayment) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Payment is not added ');
    }

    const totalPaidAmount = [...previousHistory, data].reduce(
      (total, payment) => total + Number(payment.paidAmount),
      0,
    );
    const grandTotal =
      Number(isOrderExist.productValue) +
      Number(isOrderExist.shippingCharge) -
      Number(isOrderExist.discount);
    const totalReceivableAmount = grandTotal - totalPaidAmount;
    await this.orderRepository.update(
      {
        id: orderId,
      },
      {
        totalPaidAmount,
        totalReceiveAbleAmount: totalReceivableAmount,
        paymentStatus: data?.paymentStatus,
      },
    );
    await this.orderLogsRepository.save({
      orderId: orderId,
      agentId: data.userId,
      action: `A payment with status '${data.paymentStatus}' was added using the '${data.paymentMethod}' method.`,
      previousValue:
        previousHistory?.length > 0 ? JSON.stringify(previousHistory[0]) : null,
      newValue: JSON.stringify(data),
    });
    return this.orderRepository.findOne({ where: { id: orderId } });
  }

  async changeStatusBulk(
    orderIds: number[],
    mainData: any,
    organizationId: string,
  ) {
    const MAX_CHUNK = 100; // 100 orders per batch
    const chunkedOrders = _.chunk(orderIds, MAX_CHUNK);
    let finalUpdatedOrders: any[] = [];

    for (const chunk of chunkedOrders) {
      const updatedOrders = await this.processOrdersChunk(
        chunk,
        mainData,
        organizationId,
      );
      finalUpdatedOrders = finalUpdatedOrders.concat(updatedOrders);
    }

    return finalUpdatedOrders;
  }

  // ===============================
  // ✅ Process Single Chunk of Orders
  // ===============================
private async processOrdersChunk(
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

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const allProducts = await this.productsRepository.find({
      where: { orderId: In(orderIds) },
    });

    // Bulk inventory updates
    const inventoryUpdatePromises: Promise<any>[] = [];

    for (const product of allProducts) {
      const { productId, productQuantity } = product;
      const order = orders.find((o) => o.id === product.orderId);

      const inventory = await this.inventoryRepository.findOne({
        where: { productId },
      });
      const inventoryItem = await this.InventoryItemItemRepository.findOne({
        where: { productId, locationId: order?.locationId },
      });

      // ========== STATUS 7: IN-TRANSIT ===========
      if (data.statusId === 7) {
        if (inventory) {
          inventoryUpdatePromises.push(
            this.inventoryRepository.decrement(
              { productId },
              'processing',
              productQuantity,
            ),
          );
          inventoryUpdatePromises.push(
            this.inventoryRepository.decrement(
              { productId },
              'stock',
              productQuantity,
            ),
          );
        }

        if (inventoryItem) {
          inventoryUpdatePromises.push(
            this.InventoryItemItemRepository.decrement(
              { productId, locationId: order.locationId },
              'processing',
              productQuantity,
            ),
          );
          inventoryUpdatePromises.push(
            this.InventoryItemItemRepository.decrement(
              { productId, locationId: order.locationId },
              'quantity',
              productQuantity,
            ),
          );
        }
      }

      // ========== STATUS 4: CANCEL ===========
      if (
        data.statusId === 4 &&
        (currentStatus === 5 || currentStatus === 6)
      ) {
        if (inventory) {
          inventoryUpdatePromises.push(
            this.inventoryRepository.decrement(
              { productId },
              'processing',
              productQuantity,
            ),
          );
        }
        if (inventoryItem) {
          inventoryUpdatePromises.push(
            this.InventoryItemItemRepository.decrement(
              { productId, locationId: order.locationId },
              'processing',
              productQuantity,
            ),
          );
        }
      }

      // ========== STATUS 4: RETURN / ORDER QUE ===========
      if (data.statusId === 4 && currentStatus === 2) {
        if (inventory) {
          inventoryUpdatePromises.push(
            this.inventoryRepository.decrement(
              { productId },
              'orderQue',
              productQuantity,
            ),
          );
        }
        if (inventoryItem) {
          inventoryUpdatePromises.push(
            this.InventoryItemItemRepository.decrement(
              { productId, locationId: order.locationId },
              'orderQue',
              productQuantity,
            ),
          );
        }
      }

      // ========== STATUS 3: HOLD ===========
      if (data.statusId === 3 && currentStatus === 2) {
        console.log(
          'this block is execute properly=========================',
        );

        // ensure productQuantity is a number
        const qty = Number(productQuantity) || 0;

        if (inventory) {
          // update Inventory table (use parameterized query, COALESCE to handle NULLs)
          inventoryUpdatePromises.push(
            queryRunner.manager.query(
              `UPDATE "inventory"
       SET "orderQue" = COALESCE("orderQue", 0) - $1,
           "hoildQue" = COALESCE("hoildQue", 0) + $1,
           "updatedAt" = now()
       WHERE "productId" = $2`,
              [qty, productId],
            ),
          );
        }

        if (inventoryItem) {
          // inventoryItems table name from your entity: 'inventoryItems'
          inventoryUpdatePromises.push(
            queryRunner.manager.query(
              `UPDATE "inventoryItems"
       SET "orderQue" = COALESCE("orderQue", 0) - $1,
           "hoildQue" = COALESCE("hoildQue", 0) + $1,
           "updatedAt" = now()
       WHERE "productId" = $2 AND "locationId" = $3`,
              [qty, productId, order.locationId],
            ),
          );
        }
      }

      // ========== STATUS 2: PROCESS / ORDER QUE INCREMENT ===========
      if (
        data.statusId === 2 &&
        (currentStatus === 1 || currentStatus === 4)
      ) {
        if (inventory) {
          inventoryUpdatePromises.push(
            this.inventoryRepository.increment(
              { productId },
              'orderQue',
              productQuantity,
            ),
          );
        }
        if (inventoryItem) {
          inventoryUpdatePromises.push(
            this.InventoryItemItemRepository.increment(
              { productId, locationId: order.locationId },
              'orderQue',
              productQuantity,
            ),
          );
        } else if (inventory) {
          // create new inventory item if missing
          const newItem = this.InventoryItemItemRepository.create({
            locationId: order.locationId,
            productId,
            quantity: 0,
            orderQue: productQuantity,
            inventoryId: inventory.id,
          });
          inventoryUpdatePromises.push(
            this.InventoryItemItemRepository.save(newItem),
          );
        }
      }

      // ========== STATUS 3 from 1 → HOLD QUE ===========
      if (data.statusId === 3 && currentStatus === 1) {
        if (inventory) {
          inventoryUpdatePromises.push(
            this.inventoryRepository.increment(
              { productId },
              'hoildQue',
              productQuantity,
            ),
          );
        }
        if (inventoryItem) {
          inventoryUpdatePromises.push(
            this.InventoryItemItemRepository.increment(
              { productId, locationId: order.locationId },
              'hoildQue',
              productQuantity,
            ),
          );
        } else if (inventory) {
          const newItem = this.InventoryItemItemRepository.create({
            locationId: order.locationId,
            productId,
            quantity: 0,
            orderQue: 0,
            hoildQue: productQuantity,
            inventoryId: inventory.id,
          });
          inventoryUpdatePromises.push(
            this.InventoryItemItemRepository.save(newItem),
          );
        }
      }

      // ========== STATUS 5: STORE ===========
      if (data.statusId === 5) {
        await this.requisitionService.createRequisition(
          { orderIds, userId: data?.userId ?? data?.agentId },
          organizationId,
        );
        await this.orderRepository.update(
          { id: In(orderIds) },
          { storeTime: new Date() },
        );
      }

      // ========== STATUS 6: PACKING ===========
      if (data.statusId === 6) {
        await this.orderRepository.update(
          { id: In(orderIds) },
          { packingTime: new Date() },
        );
      }
    }

    // Execute all bulk updates in parallel
    await Promise.all(inventoryUpdatePromises);

    // Update orders with new status & timestamps
    if (data.statusId === 7) {
      await this.orderRepository.update(
        { id: In(orderIds) },
        { intransitTime: new Date() },
      );
    }

    // Finally, update orders general status & previousStatus
    await this.orderRepository.update(
      { id: In(orderIds) },
      { ...data, previousStatus: currentStatus },
    );

    await queryRunner.commitTransaction();
  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    throw new ApiError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      error.message || 'Failed to update inventory',
    );
  } finally {
    await queryRunner.release();
  }

  // ✅ Courier API call outside transaction — inventory/status changes are
  // already committed, so a courier failure here never rolls those back.
  if (data.statusId === 7) {
    // IMPORTANT: different orders in the same chunk can have different
    // couriers assigned. Grouping by orders[0].currier alone would
    // silently send NOTHING for the whole chunk whenever the first order
    // in the array happened to use a different (or no) courier partner —
    // this was the actual bug. Group by each order's OWN currier id so
    // every courier partner only ever gets its own orders.
    const ordersByCourierPartnerId = new Map<string, typeof orders>();
    for (const op of orders) {
      const key = op.currier || 'unassigned';
      if (!ordersByCourierPartnerId.has(key)) {
        ordersByCourierPartnerId.set(key, []);
      }
      ordersByCourierPartnerId.get(key)!.push(op);
    }

    for (const [partnerId, partnerOrders] of ordersByCourierPartnerId) {
      if (partnerId === 'unassigned') {
        this.logger.warn(
          `Skipped ${partnerOrders.length} order(s) with no courier partner assigned: [${partnerOrders
            .map((o) => o.invoiceNumber)
            .join(', ')}]`,
        );
        continue;
      }

      const currierCompany = await this.deliveryPartnerRepository.findOne({
        where: { organizationId, id: partnerId },
      });

      if (!currierCompany) {
        this.logger.warn(
          `Courier partner ${partnerId} not found for org ${organizationId}, skipping ${partnerOrders.length} order(s): [${partnerOrders
            .map((o) => o.invoiceNumber)
            .join(', ')}]`,
        );
        continue;
      }

      if (currierCompany.partnerName === 'SteadFast') {
        await this.sendOrdersToSteadfast(partnerOrders, currierCompany);
      }
      // else: other courier partners handled elsewhere / not yet integrated
    }
  }

  // Save order logs
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

// ---------- Send a batch of orders to Steadfast, all belonging to the SAME courier partner ----------
private async sendOrdersToSteadfast(
  orders: any[],
  currierCompany: any,
): Promise<void> {
  // Steadfast requires recipient_phone to be exactly 11 digits.
  // Orders with an invalid phone are excluded from the courier request
  // entirely (sending them risks the whole batch being rejected by
  // Steadfast) and are marked locally so they show up as "needs phone
  // fix" instead of silently vanishing.
  const isValidBdPhone = (phone: string) =>
    /^[0-9]{11}$/.test((phone || '').trim());

  const validOrders = orders.filter((op) =>
    isValidBdPhone(op.receiverPhoneNumber),
  );
  const invalidOrders = orders.filter(
    (op) => !isValidBdPhone(op.receiverPhoneNumber),
  );

  if (invalidOrders.length) {
    for (const op of invalidOrders) {
      await this.orderRepository.update(op.id, {
        courierStatus: 'error',
        courierNotificationType: 'invalid_phone',
        trackingMessage: `Recipient phone "${op.receiverPhoneNumber || ''}" is not a valid 11-digit number — not sent to courier`,
        courierUpdatedAt: new Date(),
      });
    }
    this.logger.warn(
      `Skipped ${invalidOrders.length} order(s) with invalid phone number for Steadfast: [${invalidOrders
        .map((o) => o.invoiceNumber)
        .join(', ')}]`,
    );
  }

  if (!validOrders.length) {
    return; // nothing valid to send
  }

  const courierPayload = validOrders.map((op) => ({
    invoice: op.invoiceNumber,
    recipient_name: op.receiverName,
    recipient_phone: op.receiverPhoneNumber,
    recipient_address: op.receiverAddress,
    cod_amount: op.totalReceiveAbleAmount,
    note: op.deliveryNote || 'N/A',
  }));

  let steadfastResults: any[] = [];

  try {
    // NOTE: Confirmed in production that Steadfast's bulk endpoint expects
    // the RAW array directly as the request body — NOT wrapped in a
    // `{ data: [...] }` object. (The doc's PHP example passes
    // json_encode($data) as the 'data' form field, which is a different
    // shape than a raw JSON POST body — that led to an incorrect "fix"
    // earlier that broke working orders. Reverted.)
    const response = await axios.post(
      'https://portal.packzy.com/api/v1/create_order/bulk-order',
      courierPayload,
      {
        headers: {
          'Api-Key': currierCompany.api_key,
          'Secret-Key': currierCompany.secret_key,
        },
      },
    );

    // Response has been observed as either a bare array, or wrapped as
    // { data: [...] } — handle both defensively.
    steadfastResults = Array.isArray(response.data)
      ? response.data
      : response.data?.data || [];

    this.logger.log(
      `Steadfast bulk order request sent: ${validOrders.length} order(s), invoices [${validOrders
        .map((o) => o.invoiceNumber)
        .join(', ')}], ${steadfastResults.length} result(s) received`,
    );
  } catch (err: any) {
    this.logger.error(
      `Steadfast bulk order request failed for invoices [${validOrders
        .map((o) => o.invoiceNumber)
        .join(', ')}]: ${
        err?.response?.data
          ? JSON.stringify(err.response.data)
          : err.message
      }`,
    );
    // Whole courier request failed (network/auth/etc). Orders keep
    // status 7 (in-transit) and null courier fields, so they can be
    // identified and resent to the courier later without touching
    // inventory again.
    return;
  }

  if (!steadfastResults.length) {
    this.logger.warn(
      `Steadfast returned no results for invoices [${validOrders
        .map((o) => o.invoiceNumber)
        .join(', ')}]`,
    );
    return;
  }

  // Match each courier result back to its order by invoice, NOT by array
  // position — Steadfast doesn't guarantee response order matches
  // request order 1:1, especially when some items error out.
  const resultsByInvoice = new Map<string, any>();
  for (const result of steadfastResults) {
    if (result?.invoice) {
      resultsByInvoice.set(String(result.invoice), result);
    }
  }

  for (const op of validOrders) {
    const result = resultsByInvoice.get(String(op.invoiceNumber));
    if (!result) {
      this.logger.warn(
        `No Steadfast result matched for invoice ${op.invoiceNumber} — courier fields left untouched, safe to retry`,
      );
      continue;
    }

    if (result.status === 'success') {
      await this.orderRepository.update(op.id, {
        consignmentId: result.consignment_id
          ? String(result.consignment_id)
          : null,
        trackingCode: result.tracking_code || null,
        courierStatus: 'in_review', // Steadfast's initial state right after creation
        courierNotificationType: 'order_created',
        codAmount: op.totalReceiveAbleAmount,
        courierUpdatedAt: new Date(),
      });
    } else {
      // status === 'error' (or anything unexpected) — record the
      // failure without touching deliveryCharge or other fields that
      // only get populated once real delivery-status updates arrive.
      await this.orderRepository.update(op.id, {
        courierStatus: 'error',
        courierNotificationType: 'order_create_failed',
        trackingMessage: result?.message || 'Steadfast order creation failed',
        courierUpdatedAt: new Date(),
      });
      this.logger.warn(
        `Steadfast order creation failed for invoice ${op.invoiceNumber}: ${JSON.stringify(result)}`,
      );
    }
  }
}
  // change hold status
  async changeHoldStatus(
    orderIds: number[],
    mainData: any,
    organizationId: string,
  ) {
    const { currentStatus, ...data } = mainData;

    // Fetch all orders with status
    const orders = await this.orderRepository.find({
      where: { id: In(orderIds) },
      relations: ['status'],
    });

    if (orders.length !== orderIds.length) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Some orders do not exist');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Fetch all products for these orders
      const products = await this.productsRepository.find({
        where: { orderId: In(orderIds) },
      });

      const productIds = products.map((p) => p.productId);
      const locationIds = [...new Set(orders.map((o) => o.locationId))];

      // Fetch inventories in batch
      const inventories = await this.inventoryRepository.find({
        where: { productId: In(productIds) },
      });

      const inventoryItems = await this.InventoryItemItemRepository.find({
        where: {
          productId: In(productIds),
          locationId: In(locationIds),
        },
      });

      // Convert to Map for quick access
      const inventoryMap = new Map(inventories.map((i) => [i.productId, i]));
      const inventoryItemMap = new Map(
        inventoryItems.map((i) => [`${i.productId}-${i.locationId}`, i]),
      );

      // Process each order
      for (const order of orders) {
        const orderProducts = products.filter((p) => p.orderId === order.id);

        for (const product of orderProducts) {
          const inventory = inventoryMap.get(product.productId);
          const inventoryItem = inventoryItemMap.get(
            `${product.productId}-${order.locationId}`,
          );

          // Previous status 2 or null, and new status is not 4
          if (
            (order?.previousStatus === '2' || !order?.previousStatus) &&
            data?.statusId !== 4
          ) {
            if (inventory) {
              await queryRunner.manager.update(
                Inventory,
                { productId: product.productId },
                {
                  orderQue: inventory.orderQue + product.productQuantity,
                  hoildQue: inventory.hoildQue - product.productQuantity,
                },
              );
            }

            if (inventoryItem) {
              await queryRunner.manager.update(
                InventoryItem,
                { productId: product.productId, locationId: order.locationId },
                {
                  orderQue: inventoryItem.orderQue + product.productQuantity,
                  hoildQue: inventoryItem.hoildQue - product.productQuantity,
                },
              );
            }
          }

          // Previous status 5 or 6, and new status is not 4
          if (
            (order?.previousStatus === '5' || order?.previousStatus === '6') &&
            data?.statusId !== 4
          ) {
            if (inventory) {
              await queryRunner.manager.update(
                Inventory,
                { productId: product.productId },
                {
                  processing: inventory.processing + product.productQuantity,
                  hoildQue: inventory.hoildQue - product.productQuantity,
                },
              );
            }

            if (inventoryItem) {
              await queryRunner.manager.update(
                InventoryItem,
                { productId: product.productId, locationId: order.locationId },
                {
                  processing:
                    inventoryItem.processing + product.productQuantity,
                  hoildQue: inventoryItem.hoildQue - product.productQuantity,
                },
              );
            }
          }

          // New status is 4
          if (data?.statusId === 4) {
            if (inventory) {
              await queryRunner.manager.update(
                Inventory,
                { productId: product.productId },
                { hoildQue: inventory.hoildQue - product.productQuantity },
              );
            }

            if (inventoryItem) {
              await queryRunner.manager.update(
                InventoryItem,
                { productId: product.productId, locationId: order.locationId },
                { hoildQue: inventoryItem.hoildQue - product.productQuantity },
              );
            }

            // Update order status to 4
            await queryRunner.manager.update(
              Order,
              { id: order.id },
              { statusId: data?.statusId },
            );
          } else {
            // Otherwise, revert to previous status or default 2
            await queryRunner.manager.update(
              Order,
              { id: order.id },
              { statusId: +order.previousStatus ? +order.previousStatus : 2 },
            );
          }
        }
      }

      // Commit transaction
      await queryRunner.commitTransaction();
    } catch (error:any) {
      await queryRunner.rollbackTransaction();
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to update inventory',
      );
    } finally {
      await queryRunner.release();
    }

    // Fetch updated orders with status
    const updatedOrders = await this.orderRepository.find({
      where: { id: In(orderIds) },
      relations: ['status'],
    });

    // Save order logs
    const orderLogs = orders.map((order, index) => ({
      orderId: order.id,
      agentId: data.agentId,
      action: `Order Status changed to ${updatedOrders[index].status.label} from ${order.status.label}`,
      previousValue: null,
    }));

    await this.orderLogsRepository.save(orderLogs);

    return updatedOrders;
  }

  async getOrdersLogs(orderId: number) {
    const isExist = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!isExist) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Order is not exist');
    }
    return await this.orderLogsRepository.find({
      where: { orderId: orderId },
      relations: ['updatedBy'],
      select: {
        updatedBy: {
          name: true,
        },
      },
      order: { createdAt: 'DESC' },
    });
  }

  // return order

  async returnOrders(payload: {
    orderIds: string[];
    agentId: string;
    statusId: number;
    warehouse: string;
    returnableProducts: any;
  }) {
    const { orderIds, agentId, statusId, warehouse, returnableProducts } =
      payload;
    // Pre-fetch orders with status
    const orders = await this.orderRepository.find({
      where: { id: In(orderIds) },
      relations: ['status'],
    });

    if (orders.length !== orderIds.length) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Some orders do not exist');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const order of orders) {
        const products = await queryRunner.manager.find(
          this.productsRepository.target,
          {
            where: { orderId: order.id },
          },
        );
        // if full return then execute this part
        if (statusId === 10) {
          for (const product of products) {
            // Fetch inventory and inventoryItem within the transaction
            const inventory = await queryRunner.manager.findOne(
              this.inventoryRepository.target,
              {
                where: { productId: product.productId },
              },
            );

            const inventoryItem = await queryRunner.manager.findOne(
              this.InventoryItemItemRepository.target,
              {
                where: {
                  productId: product.productId,
                  locationId: warehouse,
                },
              },
            );

            // Update inventory stock
            if (inventory) {
              inventory.stock += product.productQuantity;
              await queryRunner.manager.save(
                this.inventoryRepository.target,
                inventory,
              );
            }

            // Update inventory item quantity
            if (inventoryItem) {
              inventoryItem.quantity += product.productQuantity;
              await queryRunner.manager.save(
                this.InventoryItemItemRepository.target,
                inventoryItem,
              );
            }
          }
        }

        //if partial  return then ex ecute this part

        if (statusId === 12) {
          for (const product of returnableProducts) {
            const inventory = await queryRunner.manager.findOne(
              this.inventoryRepository.target,
              {
                where: { productId: product.productId },
              },
            );
            const inventoryItem = await queryRunner.manager.findOne(
              this.InventoryItemItemRepository.target,
              {
                where: {
                  productId: product.productId,
                  locationId: warehouse,
                },
              },
            );

            if (inventory) {
              inventory.stock += product.returnQuantity;
              await queryRunner.manager.save(
                this.inventoryRepository.target,
                inventory,
              );
            }

            if (inventoryItem) {
              inventoryItem.quantity += product.returnQuantity;
              await queryRunner.manager.save(
                this.InventoryItemItemRepository.target,
                inventoryItem,
              );
            }
            const returnDamagePayload = {
              orderId: Number(orderIds[0]),
              productId: product?.productId,
              returnQuantity: product?.returnQuantity,
              damageQuantity: product?.damageQuantity,
              reason:
                'Customer returned due to wrong size and one item was damaged',
              remarks: 'Item returned via courier on 2025-07-25',
              returnDate: new Date(),
            };
            await this.orderProductReturnRepository.save(returnDamagePayload);
          }
        }

        await queryRunner.manager.update(
          this.orderRepository.target,
          { id: order.id },
          { statusId: statusId },
        );
      }

      const updatedOrders = await queryRunner.manager.find(
        this.orderRepository.target,
        {
          where: { id: In(orderIds) },
          relations: ['status'],
        },
      );
      const orderLogs = updatedOrders.map((updatedOrder) => {
        const originalOrder = orders.find((o) => o.id === updatedOrder.id);
        return {
          orderId: updatedOrder.id,
          agentId,
          action: `Order Status changed to ${updatedOrder.status.label} from ${originalOrder?.status.label}`,
          previousValue: null,
        };
      });

      await queryRunner.manager.save(
        this.orderLogsRepository.target,
        orderLogs,
      );

      await queryRunner.commitTransaction();

      return updatedOrders;
    } catch (error:any) {
      await queryRunner.rollbackTransaction();
      throw new ApiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to return orders',
      );
    } finally {
      await queryRunner.release();
    }
  }

  // download excel

  async downloadOrdersExcel(
    filterOptions: any,
    organizationId: string,
    res: Response,
  ) {
    // ---- First, count total orders
    const countQb = this.orderRepository
      .createQueryBuilder('orders')
      .where('orders.organizationId = :organizationId', { organizationId });

    if (filterOptions?.searchTerm) {
      countQb.andWhere('orders.orderNumber LIKE :searchTerm', {
        searchTerm: `%${filterOptions.searchTerm}%`,
      });
    }

    if (filterOptions?.startDate && filterOptions?.endDate) {
      countQb.andWhere('orders.createdAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(filterOptions.startDate),
        endDate: new Date(filterOptions.endDate),
      });
    }
    let curierIds = filterOptions?.currier;
    if (curierIds) {
      curierIds = Array.isArray(curierIds) ? curierIds : [curierIds];
      countQb.andWhere('orders.currier IN (:...curierIds)', {
        curierIds,
      });
    }

    let statusIdss = filterOptions?.statusId;
    if (statusIdss) {
      statusIdss = Array.isArray(statusIdss) ? statusIdss : [statusIdss];
      statusIdss = statusIdss.map(Number);
      countQb.andWhere('orders.statusId IN (:...statusIdss)', { statusIdss });
    }

    const totalOrders = await countQb.getCount();

    // ---- Check row limit
    if (totalOrders > 100000) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        `Too many records (${totalOrders}). Please refine your filters to less than 100,000 rows.`,
      );
    }

    // ---- Set headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=orders-report.xlsx',
    );

    // ---- Streaming workbook
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: res,
      useSharedStrings: false,
      useStyles: false,
    });
    const worksheet = workbook.addWorksheet('Orders Report');

    worksheet.columns = [
      { header: 'Order ID', key: 'id', width: 20 },
      { header: 'Order Number', key: 'orderNumber', width: 20 },
      { header: 'Customer ID', key: 'customerId', width: 20 },
      { header: 'Status', key: 'statusId', width: 15 },
      { header: 'Total Price', key: 'totalPrice', width: 15 },
      { header: 'Agent ID', key: 'agentId', width: 15 },
      { header: 'Created At', key: 'createdAt', width: 25 },
    ];

    // ---- Pagination (keyset style)
    const BATCH_SIZE = 5000;
    let lastId = 0;
    let hasMore = true;

    while (hasMore) {
      const qb = this.orderRepository
        .createQueryBuilder('orders')
        .where('orders.organizationId = :organizationId', { organizationId });

      if (filterOptions?.searchTerm) {
        qb.andWhere('orders.orderNumber LIKE :searchTerm', {
          searchTerm: `%${filterOptions.searchTerm}%`,
        });
      }

      if (filterOptions?.startDate && filterOptions?.endDate) {
        qb.andWhere('orders.createdAt BETWEEN :startDate AND :endDate', {
          startDate: new Date(filterOptions.startDate),
          endDate: new Date(filterOptions.endDate),
        });
      }

      if (filterOptions?.statusId) {
        let statusIds = Array.isArray(filterOptions.statusId)
          ? filterOptions.statusId
          : [filterOptions.statusId];
        statusIds = statusIds.map(Number);
        qb.andWhere('orders.statusId IN (:...statusIds)', { statusIds });
      }

      if (lastId > 0) {
        qb.andWhere('orders.id > :lastId', { lastId });
      }

      qb.orderBy('orders.id', 'ASC').limit(BATCH_SIZE);

      const orders = await qb.getMany();
      if (!orders.length) {
        hasMore = false;
        break;
      }

      for (const order of orders) {
        worksheet
          .addRow({
            id: order.id,
            orderNumber: order.orderNumber,
            customerId: order.customerId,
            statusId: order.statusId,
            totalPrice: order.totalPrice,
            agentId: order.agentId,
            createdAt: order.createdAt,
          })
          .commit();
        lastId = order.id;
      }
    }

    await workbook.commit();
  }

  async getProductSalesReport(options, filterOptions, organizationId) {
    const { sortBy, sortOrder, limit, skip, page } = paginationHelpers(options);

    const baseQuery = this.orderRepository
      .createQueryBuilder('orders')
      .innerJoin('orders.products', 'prod')
      .innerJoin('prod.product', 'p')
      .where('orders.organizationId = :organizationId', { organizationId });

    let utcStartDate: string;
    let utcEndDate: string;

    // ✅ Handle date filter or fallback to current date
    if (filterOptions?.startDate && filterOptions?.endDate) {
      const localStartDate = new Date(filterOptions.startDate);
      utcStartDate = new Date(
        Date.UTC(
          localStartDate.getFullYear(),
          localStartDate.getMonth(),
          localStartDate.getDate(),
          0,
          0,
          0,
          0,
        ),
      ).toISOString();

      const localEndDate = new Date(filterOptions.endDate);
      utcEndDate = new Date(
        Date.UTC(
          localEndDate.getFullYear(),
          localEndDate.getMonth(),
          localEndDate.getDate(),
          23,
          59,
          59,
          999,
        ),
      ).toISOString();
    } else {
      const today = new Date();
      utcStartDate = new Date(
        Date.UTC(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          0,
          0,
          0,
          0,
        ),
      ).toISOString();
      utcEndDate = new Date(
        Date.UTC(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          23,
          59,
          59,
          999,
        ),
      ).toISOString();
    }

    baseQuery.andWhere('orders.createdAt BETWEEN :startDate AND :endDate', {
      startDate: utcStartDate,
      endDate: utcEndDate,
    });

    // ✅ Filter by products
    if (filterOptions?.productId) {
      const productIds = Array.isArray(filterOptions.productId)
        ? filterOptions.productId
        : [filterOptions.productId];
      baseQuery.andWhere('prod.productId IN (:...productIds)', { productIds });
    }

    // ✅ Filter by payment methods
    let paymentMethodIds = filterOptions?.paymentMethodIds;
    if (paymentMethodIds) {
      paymentMethodIds = Array.isArray(paymentMethodIds)
        ? paymentMethodIds
        : [paymentMethodIds];
      baseQuery.andWhere('orders.paymentMethod IN (:...paymentMethodIds)', {
        paymentMethodIds,
      });
    }

    // ✅ Filter by sources
    let orderSources = filterOptions?.orderSources;
    if (orderSources) {
      orderSources = Array.isArray(orderSources)
        ? orderSources
        : [orderSources];
      baseQuery.andWhere('orders.orderSource IN (:...orderSources)', {
        orderSources,
      });
    }

    // ✅ Query for paginated data
    const queryBuilder = baseQuery.clone();

    queryBuilder
      .select('prod.productId', 'productId')
      .addSelect('p.name', 'productName')
      .addSelect('SUM(prod.subtotal)', 'totalSaleAmount')
      .addSelect('SUM(prod.productQuantity)', 'totalOrderQuantity')
      .addSelect('prod.productPrice', 'productPrice')
      .addSelect('orders.orderSource', 'orderSource')
      .addSelect('COUNT(DISTINCT orders.id)', 'orderCount')
      .groupBy('prod.productId')
      .addGroupBy('p.name')
      .addGroupBy('prod.productPrice')
      .addGroupBy('orders.orderSource');

    if (sortBy) {
      if (
        [
          'productName',
          'productId',
          'productPrice',
          'totalSaleAmount',
          'totalOrderQuantity',
          'orderSource',
          'orderCount',
        ].includes(sortBy)
      ) {
        queryBuilder.orderBy(sortBy, sortOrder);
      }
    }

    const result = await queryBuilder.getRawMany();

    const data = result.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      totalSaleAmount: Number(r.totalSaleAmount),
      totalOrderQuantity: Number(r.totalOrderQuantity),
      price: Number(r.productPrice),
      orderSource: r.orderSource,
      orderCount: Number(r.orderCount),
    }));

    const countQuery = baseQuery
      .clone()
      .select('COUNT(DISTINCT prod.productId)', 'cnt');
    const totalResult = await countQuery.getRawOne();
    const total = Number(totalResult.cnt);

    return {
      data,
      total,
      page,
      limit,
      startDate: utcStartDate,
      endDate: utcEndDate,
    };
  }

  async getDeliveryPartnerShipmentReport(
    organizationId: string,
    filterOptions: any,
  ) {
    let utcStartDate: string;
    let utcEndDate: string;

    // ✅ Handle date filter or fallback to current date
    if (filterOptions?.startDate && filterOptions?.endDate) {
      const localStartDate = new Date(filterOptions.startDate);
      utcStartDate = new Date(
        Date.UTC(
          localStartDate.getFullYear(),
          localStartDate.getMonth(),
          localStartDate.getDate(),
          0,
          0,
          0,
          0,
        ),
      ).toISOString();

      const localEndDate = new Date(filterOptions.endDate);
      utcEndDate = new Date(
        Date.UTC(
          localEndDate.getFullYear(),
          localEndDate.getMonth(),
          localEndDate.getDate(),
          23,
          59,
          59,
          999,
        ),
      ).toISOString();
    } else {
      const today = new Date();
      utcStartDate = new Date(
        Date.UTC(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          0,
          0,
          0,
          0,
        ),
      ).toISOString();
      utcEndDate = new Date(
        Date.UTC(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          23,
          59,
          59,
          999,
        ),
      ).toISOString();
    }

    /** 1) Orders aggregation */
    const ordersQb = this.orderRepository
      .createQueryBuilder('o')
      .leftJoin('o.partner', 'dp')
      .where('o.organizationId = :organizationId', { organizationId })
      .andWhere('o.intransitTime BETWEEN :startDate AND :endDate', {
        startDate: utcStartDate,
        endDate: utcEndDate,
      });

    const partnerIds = filterOptions?.currier?.length
      ? filterOptions.currier
      : null;
    if (partnerIds) {
      ordersQb.andWhere('dp.id IN (:...partnerIds)', { partnerIds });
    }

    const locationId = filterOptions?.locationId?.length
      ? filterOptions.locationId
      : null;
    if (locationId) {
      ordersQb.andWhere('o.locationId IN (:...locationId)', { locationId });
    }

    const ordersAgg = await ordersQb
      .select('dp.id', 'partnerId')
      .addSelect('dp.partnerName', 'deliveryPartner')
      .addSelect('MIN(o.intransitTime)', 'inTransitStartDate')
      .addSelect('MAX(o.intransitTime)', 'inTransitEndDate')
      .addSelect('SUM(o.shippingCharge)', 'deliveryCharge')
      .addSelect('COUNT(DISTINCT o.id)', 'orderQty')
      .addSelect('SUM(o.totalPaidAmount)', 'advancePaid')
      .groupBy('dp.id')
      .addGroupBy('dp.partnerName')
      .getRawMany();

    /** 2) Products aggregation */
    const prodRepo =
      this.productsRepository ??
      this.orderRepository.manager.getRepository(Products);

    const productsQb = prodRepo
      .createQueryBuilder('p')
      .leftJoin('p.order', 'o')
      .leftJoin('o.partner', 'dp')
      .where('o.organizationId = :organizationId', { organizationId })
      .andWhere('o.intransitTime BETWEEN :startDate AND :endDate', {
        startDate: utcStartDate,
        endDate: utcEndDate,
      });

    if (partnerIds) {
      productsQb.andWhere('dp.id IN (:...partnerIds)', { partnerIds });
    }

    const productsAgg = await productsQb
      .select('dp.id', 'partnerId')
      .addSelect('SUM(p.productQuantity)', 'productQty')
      .addSelect('SUM(p.productPrice)', 'productPrice')
      .addSelect('SUM(p.subtotal)', 'totalProductPrice')
      .groupBy('dp.id')
      .getRawMany();

    /** 3) Payments aggregation */
    const paymentsQb = this.orderRepository.manager
      .getRepository(PaymentHistory)
      .createQueryBuilder('ph')
      .leftJoin('ph.order', 'o')
      .leftJoin('o.partner', 'dp')
      .where('o.organizationId = :organizationId', { organizationId })
      .andWhere('o.intransitTime BETWEEN :startDate AND :endDate', {
        startDate: utcStartDate,
        endDate: utcEndDate,
      });

    if (partnerIds) {
      paymentsQb.andWhere('dp.id IN (:...partnerIds)', { partnerIds });
    }

    const paymentsAgg = await paymentsQb
      .select('dp.id', 'partnerId')
      .addSelect('ph.paymentMethod', 'paymentMethod')
      .addSelect('SUM(ph.paidAmount)', 'paidAmount')
      .groupBy('dp.id')
      .addGroupBy('ph.paymentMethod')
      .getRawMany();

    /** 4) Merge results */
    const prodMap = new Map(productsAgg.map((r) => [String(r.partnerId), r]));

    const payMap = new Map<string, any[]>();
    for (const r of paymentsAgg) {
      if (!payMap.has(String(r.partnerId))) {
        payMap.set(String(r.partnerId), []);
      }
      payMap.get(String(r.partnerId))?.push({
        method: r.paymentMethod,
        amount: Number(r.paidAmount) || 0,
      });
    }

    const result = ordersAgg.map((r) => {
      const prod = prodMap.get(String(r.partnerId)) || {};
      const payments = payMap.get(String(r.partnerId)) || [];
      const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

      const deliveryCharge = Number(r.deliveryCharge) || 0;
      const productPrice = Number(prod.totalProductPrice) || 0;
      const total = deliveryCharge + productPrice;

      return {
        inTransitDate: `${r.inTransitStartDate} - ${r.inTransitEndDate}`,
        deliveryPartner: r.deliveryPartner,
        deliveryCharge,
        orderQty: Number(r.orderQty) || 0,
        productQty: Number(prod.productQty) || 0,
        productPrice: Number(prod.totalProductPrice) || 0,
        total,
        advancePaid: Number(r.advancePaid) || 0,
        payments,
        totalPaid,
        dueAmount: total - totalPaid,
      };
    });

    return result;
  }
}
