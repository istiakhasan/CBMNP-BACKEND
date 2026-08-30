import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { OrderExchange } from './entities/orderExchannge.entity';
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
    @InjectRepository(OrderExchange)
    private readonly OrderExchange: Repository<OrderExchange>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(OrderExchange)
    private readonly orderExchangeRepository: Repository<OrderExchange>,

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
          const newInventoryItem = this.InventoryItemItemRepository.create({
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

    const orderNumber = await this.generateOrderNumber(organizationId);
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

 async getOrders(
    options,
    filterOptions,
    organizationId,
    includeProducts = false,
  ) {
    const { page, limit, sortBy, sortOrder, skip } = paginationHelpers(options);
    const queryBuilder = this.orderRepository
      .createQueryBuilder('orders')
      .where('orders.organizationId = :organizationId', { organizationId });

    if (includeProducts) {
      queryBuilder.leftJoinAndSelect('orders.products', 'products');
      queryBuilder.leftJoinAndSelect('products.product', 'product');
    }
   if (filterOptions?.searchTerm) {
  const searchTerm = `%${filterOptions.searchTerm.toString().trim()}%`;

  queryBuilder.leftJoin('orders.customer', 'customer');

  queryBuilder.andWhere(
    `(
      orders.invoiceNumber LIKE :searchTerm
      OR orders.receiverPhoneNumber LIKE :searchTerm
      OR customer.customerPhoneNumber LIKE :searchTerm
    )`,
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

    /**
     * =====================================================
     * Delivery payment status filter — DERIVED, not a raw column
     * =====================================================
     *
     * The frontend still sends the same three values it always has
     * ('Pending' | 'Partial' | 'Paid' | '' for All), so no frontend
     * change is needed. But we no longer trust `orders.paymentStatus`
     * as a column — it doesn't capture "courier collected the cash
     * but hasn't settled it to us yet" vs "product was returned".
     *
     * Business definitions (delivered orders only):
     *
     * - 'Pending'  -> Pay Due:
     *     Delivered, no product return, but money actually in hand
     *     (totalPaidAmount, built only from PaymentHistory rows —
     *     advances + confirmed courier settlements) is LESS than
     *     totalPrice. E.g. customer paid 2000 advance on a 4000 order,
     *     courier collected the other 2000 from the customer, but
     *     that 2000 hasn't been settled to us yet.
     *
     * - 'Partial'  -> Partial Delivered:
     *     Order has at least one row in order_product_returns
     *     (e.g. ordered 2 products, customer kept 1 and returned 1).
     *     This takes priority over the money check — a return means
     *     "partial delivered" regardless of how much cash came in.
     *
     * - 'Paid'     -> Pay Collected:
     *     No product return, and totalPaidAmount fully covers
     *     totalPrice (advance + confirmed courier settlement together
     *     equal the full order value).
     *
     * NOTE: `order_product_returns` is assumed to use an `orderId`
     * column (same naming convention as the rest of this schema, e.g.
     * `payment_history.orderId`). Adjust the column name below if your
     * actual table differs.
     */
    if (filterOptions?.paymentStatus) {
      const hasReturnSql = `EXISTS (
        SELECT 1 FROM order_product_returns opr
        WHERE opr."orderId" = orders.id
      )`;

      switch (filterOptions.paymentStatus) {
        case 'Partial':
          // Partial Delivered: has an active product return
          queryBuilder.andWhere(hasReturnSql);
          break;

        case 'Paid':
          // Pay Collected: no return, and fully paid
          queryBuilder.andWhere(`NOT ${hasReturnSql}`);
          queryBuilder.andWhere(
            'COALESCE(orders.totalPaidAmount, 0) >= orders.totalPrice',
          );
          break;

        case 'Pending':
          // Pay Due: no return, and NOT fully paid yet
          queryBuilder.andWhere(`NOT ${hasReturnSql}`);
          queryBuilder.andWhere(
            'COALESCE(orders.totalPaidAmount, 0) < orders.totalPrice',
          );
          break;

        default:
          // Unknown value — fall back to old raw-column behavior
          // instead of silently ignoring the filter.
          queryBuilder.andWhere('orders.paymentStatus = :paymentStatus', {
            paymentStatus: filterOptions.paymentStatus,
          });
      }
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

    // fetch which of these orders have an active product return, so we
    // can attach a computed `deliveryPaymentStatus` label to each row
    // for the frontend (independent of whatever filter was applied).
    const orderIds = orders.map((order) => order.id);
    const ordersWithReturns = orderIds.length
      ? await this.orderProductReturnRepository
          .createQueryBuilder('opr')
          .select('DISTINCT opr.orderId', 'orderId')
          .where('opr.orderId IN (:...orderIds)', { orderIds })
          .getRawMany()
      : [];
    const returnedOrderIdSet = new Set(
      ordersWithReturns.map((row) => row.orderId),
    );

    const statusMap = new Map(statuses.map((status) => [status.value, status]));
    const customerMap = new Map(
      customers.map((customer) => [customer.customer_Id, customer]),
    );
    const agentMap = new Map(agents.map((order) => [order.userId, order]));
    const modifiedData = orders.map((order) => {
      const hasReturn = returnedOrderIdSet.has(order.id);
      const totalPaid = Number(order.totalPaidAmount ?? 0);
      const totalPrice = Number(order.totalPrice ?? 0);

      // 'PayDue' | 'PartialDelivered' | 'PayCollected'
      const deliveryPaymentStatus = hasReturn
        ? 'PartialDelivered'
        : totalPaid >= totalPrice
          ? 'PayCollected'
          : 'PayDue';

      return {
        ...order,
        status: statusMap.get(order.statusId),
        customer: customerMap.get(order.customerId as any),
        agent: agentMap.get(order.agentId as any),
        partner: currierMap.get(order.currier as any),
        deliveryPaymentStatus,
      };
    });

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
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
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

  // ✅ এই order-টা কোনো exchange-এর OLD (original) পাশে আছে কিনা —
  //    অর্থাৎ এই order থেকে নতুন কোনো exchange-order তৈরি হয়েছে কিনা
  const exchangesAsOriginal = await this.orderExchangeRepository.find({
    where: { originalOrderId: order.id },
  });

  // ✅ এই order-টা নিজেই কোনো exchange-এর ফলে তৈরি হওয়া NEW order কিনা
  const exchangeAsNew = await this.orderExchangeRepository.findOne({
    where: { newOrderId: order.id },
  });

  // ✅ ২টাতেই referenced orderNumber/invoiceNumber সহ দিলে frontend-এ লিংক করা সহজ হবে
  let exchangedIntoOrders: any[] = [];
  if (exchangesAsOriginal.length) {
    const newOrderIds = exchangesAsOriginal.map((e) => e.newOrderId);
    const newOrders = await this.orderRepository.find({
      where: { id: In(newOrderIds) },
    });
    const newOrderMap = new Map(newOrders.map((o) => [o.id, o]));
    exchangedIntoOrders = exchangesAsOriginal.map((e) => ({
      ...e,
      newOrder: newOrderMap.get(e.newOrderId),
    }));
  }

  let exchangedFromOrder: any = null;
  if (exchangeAsNew) {
    const originalOrder = await this.orderRepository.findOne({
      where: { id: exchangeAsNew.originalOrderId },
    });
    exchangedFromOrder = { ...exchangeAsNew, originalOrder };
  }

  return {
    ...order,
    products: products || [],
    customer,
    partner: await this.deliveryPartnerRepository.findOne({
      where: { id: order?.currier },
    }),
    exchangedIntoOrders, // এই order থেকে যেসব নতুন order তৈরি হয়েছে
    exchangedFromOrder,  // এই order নিজে কোনো exchange থেকে তৈরি হলে তার তথ্য
  } as any;
}
  async getScanOrderById(
    orderNumber: string,
  ): Promise<Order & { partner: any }> {
    console.log(orderNumber, 'order number');
    const order = await this.orderRepository.findOne({
      where: { orderNumber: orderNumber },
    });
    console.log(order, 'check');
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderNumber} not found`);
    }
    if (order.status.label !== 'Packing') {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        `Order with ID ${orderNumber} not in packing`,
      );
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
    agentId: actingAgentId,
    ...rest
  } = data;

  const existingOrder = await this.orderRepository.findOne({
    where: { id: orderId },
    relations: ['products', 'status'],
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

  // union of old + new productIds so REMOVED products are also processed
  const newProductMap = new Map(products.map((p) => [p.productId, p]));
  const existingProductMap = new Map(
    existingProducts.map((p) => [p.productId, p]),
  );
  const allProductIds = new Set([
    ...newProductMap.keys(),
    ...existingProductMap.keys(),
  ]);

  const validatedProducts: any[] = [];
  let productValue = 0;

  for (const productId of allProductIds) {
    const newItem = newProductMap.get(productId);
    const prevItem = existingProductMap.get(productId);

    const prevQuantity = prevItem ? prevItem.productQuantity : 0;
    const newQuantity = newItem ? newItem.productQuantity : 0;
    // + মানে quantity বেড়েছে/নতুন added, - মানে কমেছে/removed
    const quantityDiff = newQuantity - prevQuantity;

    if (quantityDiff !== 0) {
      const inventory = await this.inventoryRepository.findOne({
        where: { productId },
      });
      const inventoryItem = await this.InventoryItemItemRepository.findOne({
        where: { productId, locationId: existingOrder.locationId },
      });

      if (existingOrder.statusId === 2) {
        if (inventory) {
          await this.inventoryRepository.update(
            { productId },
            { orderQue: inventory.orderQue + quantityDiff },
          );
        }
        if (inventoryItem) {
          await this.InventoryItemItemRepository.update(
            { productId, locationId: existingOrder.locationId },
            { orderQue: inventoryItem.orderQue + quantityDiff },
          );
        }
      }

      if (
        (existingOrder.statusId === 5 &&
          existingOrder.status.label === 'Store') ||
        existingOrder.statusId === 6
      ) {
        if (inventory) {
          await this.inventoryRepository.update(
            { productId },
            { processing: inventory.processing + quantityDiff },
          );
        }
        if (inventoryItem) {
          await this.InventoryItemItemRepository.update(
            { productId, locationId: existingOrder.locationId },
            { processing: inventoryItem.processing + quantityDiff },
          );
        }
      }

      // ✅ NEW: In-Transit — stock ইতিমধ্যে বের হয়ে গেছে ওয়্যারহাউস থেকে।
      // quantity বাড়লে (diff > 0) → আরও শিপ হচ্ছে → stock আরও কমবে
      // quantity কমলে/remove হলে (diff < 0) → কম শিপ হচ্ছে → stock ফেরত (বাড়বে)
      if (existingOrder.statusId === 7) {
        if (inventory) {
          await this.inventoryRepository.update(
            { productId },
            { stock: inventory.stock - quantityDiff },
          );
        }
        if (inventoryItem) {
          await this.InventoryItemItemRepository.update(
            { productId, locationId: existingOrder.locationId },
            { quantity: inventoryItem.quantity - quantityDiff },
          );
        }
      }
    }

    // শুধু নতুন payload-এ থাকা product-গুলোর জন্যই validatedProducts/subtotal বানাও
    if (newItem) {
      const existingProduct = await this.productRepository.findOne({
        where: { id: productId },
      });
      if (!existingProduct) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      const subtotal = newItem.productQuantity * existingProduct.salePrice;
      productValue += subtotal;

      validatedProducts.push({
        orderId,
        productId,
        productQuantity: newItem.productQuantity,
        productPrice: existingProduct.salePrice,
        subtotal,
      });
    }
  }

  // Delete old products & insert new ones
  await this.productsRepository.delete({ orderId });
  if (validatedProducts.length > 0) {
    await this.productsRepository.save(validatedProducts);
  }

  // Log the update
  await this.orderLogsRepository.save({
    orderId: orderId,
    agentId: actingAgentId,
    action: `Order updated. Products and other information (e.g., shipping charge, customer details) have been modified.`,
    previousValue: existingOrder ? JSON.stringify(existingOrder) : null,
    newValue: JSON.stringify(data),
  });

  // Calculate totals
  const grandTotal = productValue + Number(shippingCharge) - Number(discount);
  const totalReceivableAmount = grandTotal - rest.totalPaidAmount;

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
    const { currentStatus,agentId: actingAgentId, ...data } = mainData;

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
          await this.sendOrdersToSteadfast(
            partnerOrders,
            currierCompany,
            currentStatus,
          );
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
      agentId: actingAgentId,
      action: `Order Status changed to ${updatedOrders[index].status.label} from ${order.status.label}`,
      previousValue: null,
    }));

    await this.orderLogsRepository.save(orderLogs);

    return updatedOrders;
  }

  // ---------- Send a batch of orders to Steadfast, all belonging to the SAME courier partner ----------
  /**
   * FIX: Orders were staying at statusId 7 (In-Transit) even when they were
   * never actually accepted by Steadfast — invalid phone numbers, a failed
   * HTTP request, an empty response, a missing per-invoice result, or a
   * per-item "error" result all left the order's main status untouched
   * (only `courierStatus` was set), and inventory stayed decremented as if
   * the order had shipped.
   *
   * This file contains:
   *   1. A new private helper, `revertFailedCourierOrders`, that undoes the
   *      status-7 side effects for any order that could not be confirmed as
   *      sent to the courier.
   *   2. A revised `sendOrdersToSteadfast` that calls it at every failure
   *      point instead of leaving the order status inconsistent.
   *
   * Paste both methods into OrderService, replacing the existing
   * `sendOrdersToSteadfast` method. No other files need to change — all
   * repositories/imports used here (Inventory, InventoryItem, In, Order,
   * axios, this.dataSource, this.logger, etc.) are already present in
   * order.service.ts.
   */

  // ---------- Revert an order's status/inventory when courier dispatch fails ----------
  // Called for any order that could NOT be confirmed as actually accepted by
  // the courier: invalid phone, a per-item rejection from Steadfast, no
  // matching result in the response, or a total request failure.
  //
  // Without this, changeStatusBulk's statusId === 7 branch (which runs in
  // its own transaction BEFORE the courier call) leaves the order looking
  // like it shipped — status 7, inventory decremented, intransitTime set —
  // even though Steadfast never actually received it. This function undoes
  // exactly that.
  /**
   * FIX v2 — root cause of "status change holeu courier a dhukloi na, but
   * status stayed at In-Transit":
   *
   * revertFailedCourierOrders() was reverting statusId using
   * `order.previousStatus` from an Order object fetched BEFORE the main
   * status-7 transaction ran. That transaction is what actually WRITES
   * `previousStatus = currentStatus` — so the in-memory value was stale
   * (the previousStatus from some earlier transition, not this one).
   *
   * If that stale value happened to be invalid (e.g. 0, or a statusId that
   * no longer exists in the status table), the UPDATE hit a foreign-key
   * constraint violation, the revert transaction rolled back, the error was
   * only logged (not thrown), and the outer code kept printing
   * "Reverted N order(s)..." regardless — so the order silently stayed at
   * statusId 7 with no visible failure.
   *
   * Fix: stop guessing from a stale field. Thread the real, known-correct
   * `currentStatus` (already available in processOrdersChunk, and what
   * actually gets written as `previousStatus` in the main transaction)
   * explicitly through sendOrdersToSteadfast -> revertFailedCourierOrders.
   *
   * Changes needed in order.service.ts:
   *   1. processOrdersChunk: pass `currentStatus` into sendOrdersToSteadfast.
   *   2. sendOrdersToSteadfast: accept `revertToStatusId` param, pass it on.
   *   3. revertFailedCourierOrders: accept `revertToStatusId` param, use it
   *      directly instead of reading order.previousStatus.
   */

  // ============================================================
  // 1) Inside processOrdersChunk — find this block:
  // ============================================================
  //
  //     if (currierCompany.partnerName === 'SteadFast') {
  //       await this.sendOrdersToSteadfast(partnerOrders, currierCompany);
  //     }
  //
  // Replace with (note the third argument):
  //
  //     if (currierCompany.partnerName === 'SteadFast') {
  //       await this.sendOrdersToSteadfast(
  //         partnerOrders,
  //         currierCompany,
  //         currentStatus, // the known-correct status to revert to on failure
  //       );
  //     }

  // ============================================================
  // 2) Replace revertFailedCourierOrders with this version
  // ============================================================


  // ============================================================
  // 3) Replace sendOrdersToSteadfast's signature and every
  //    revertFailedCourierOrders(...) call site to pass revertToStatusId
  // ============================================================
  // ============================================================
  // Reconcile a batch of orders whose Steadfast outcome is uncertain
  // (network failure, timeout, empty response) OR that Steadfast
  // rejected as duplicate (THIS_INVOICE_ALREADY_EXISTS).
  //
  // This is the single source of truth for "is this order actually
  // in Steadfast or not" — it NEVER guesses. It calls Steadfast's
  // status-by-invoice endpoint per order and classifies each one as
  // either CONFIRMED-IN-COURIER or CONFIRMED-NOT-IN-COURIER.
  // ============================================================
  private async reconcileWithSteadfast(
    orders: Order[],
    currierCompany: any,
  ): Promise<{ confirmedInCourier: Map<number, any>; confirmedFailed: Order[] }> {
    const confirmedInCourier = new Map<number, any>(); // orderId -> steadfast status payload
    const confirmedFailed: Order[] = [];

    for (const op of orders) {
      try {
        const res = await axios.get(
          `https://portal.packzy.com/api/v1/status_by_invoice/${encodeURIComponent(op.invoiceNumber)}`,
          {
            headers: {
              'Api-Key': currierCompany.api_key,
              'Secret-Key': currierCompany.secret_key,
            },
            timeout: 15000,
          },
        );

        // Steadfast returns status: 200 + a delivery_status when the
        // invoice genuinely exists in their system; anything else (404,
        // status:'no_data', etc.) means it was never actually created.
        const data = res.data;
        const exists =
          data?.status === 200 &&
          (data?.delivery_status || data?.consignment_id);

        if (exists) {
          confirmedInCourier.set(op.id, data);
        } else {
          confirmedFailed.push(op);
        }
      } catch (err: any) {
        // Steadfast explicitly says "not found" via 404 -> definitely not created.
        if (err?.response?.status === 404) {
          confirmedFailed.push(op);
          continue;
        }

        // Any other error (network/timeout/5xx) means we STILL don't know.
        // Do not guess in either direction — retry the check once after
        // a short backoff before giving up and treating it as unresolved.
        try {
          await new Promise((r) => setTimeout(r, 2000));
          const retryRes = await axios.get(
            `https://portal.packzy.com/api/v1/status_by_invoice/${encodeURIComponent(op.invoiceNumber)}`,
            {
              headers: {
                'Api-Key': currierCompany.api_key,
                'Secret-Key': currierCompany.secret_key,
              },
              timeout: 15000,
            },
          );
          const data = retryRes.data;
          const exists =
            data?.status === 200 &&
            (data?.delivery_status || data?.consignment_id);
          if (exists) {
            confirmedInCourier.set(op.id, data);
          } else {
            confirmedFailed.push(op);
          }
        } catch (err2: any) {
          if (err2?.response?.status === 404) {
            confirmedFailed.push(op);
          } else {
            // Genuinely unresolved after retry — log loudly, do NOT
            // touch this order's status at all (leave it exactly as it
            // is right now so a human/cron can re-check later, instead
            // of falsely marking it success or failed).
            this.logger.error(
              `UNRESOLVED: could not confirm Steadfast state for invoice ${op.invoiceNumber} after retry — leaving order ${op.id} untouched. Needs manual/cron reconciliation. Error: ${err2.message}`,
            );
          }
        }
      }
    }

    return { confirmedInCourier, confirmedFailed };
  }

  // ---------- Revert an order's status/inventory — ONLY called for
  // CONFIRMED failures (verified via reconcileWithSteadfast, or an
  // outright rejection reason from Steadfast that isn't a duplicate) ----------
  private async revertFailedCourierOrders(
    failedOrders: Order[],
    revertToStatusId: number,
    reason: {
      courierStatus: string;
      courierNotificationType: string;
      trackingMessage: string;
    },
  ): Promise<void> {
    if (!failedOrders.length) return;

    if (
      revertToStatusId === undefined ||
      revertToStatusId === null ||
      isNaN(revertToStatusId)
    ) {
      this.logger.error(
        `CRITICAL: cannot revert courier-failed orders [${failedOrders
          .map((o) => o.invoiceNumber)
          .join(', ')}] — no valid revertToStatusId was provided (got: ${revertToStatusId}). Order(s) remain incorrectly at statusId 7.`,
      );
      return;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const orderIds = failedOrders.map((o) => o.id);
      const products = await queryRunner.manager.find(
        this.productsRepository.target,
        { where: { orderId: In(orderIds) } },
      );

      for (const order of failedOrders) {
        const orderProducts = products.filter((p) => p.orderId === order.id);

        for (const product of orderProducts) {
          const { productId, productQuantity } = product;

          await queryRunner.manager.increment(
            Inventory,
            { productId },
            'processing',
            productQuantity,
          );
          await queryRunner.manager.increment(
            Inventory,
            { productId },
            'stock',
            productQuantity,
          );

          if (order.locationId) {
            await queryRunner.manager.increment(
              InventoryItem,
              { productId, locationId: order.locationId },
              'processing',
              productQuantity,
            );
            await queryRunner.manager.increment(
              InventoryItem,
              { productId, locationId: order.locationId },
              'quantity',
              productQuantity,
            );
          }
        }

        await queryRunner.manager.update(
          Order,
          { id: order.id },
          {
            statusId: revertToStatusId,
            previousStatus: null,
            intransitTime: null,
            courierStatus: reason.courierStatus,
            courierNotificationType: reason.courierNotificationType,
            trackingMessage: reason.trackingMessage,
            courierUpdatedAt: new Date(),
          },
        );

        await queryRunner.manager.save(this.orderLogsRepository.target, {
          orderId: order.id,
          agentId: null,
          action: `Courier dispatch confirmed failed (${reason.courierNotificationType}: ${reason.trackingMessage}). Status reverted from In-Transit to ${revertToStatusId}, inventory restored.`,
          previousValue: null,
        });
      }

      await queryRunner.commitTransaction();
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `CRITICAL: failed to revert courier-failed orders [${failedOrders
          .map((o) => o.invoiceNumber)
          .join(', ')}] to statusId ${revertToStatusId} — they remain incorrectly at statusId 7: ${err.message}`,
        err.stack,
      );
    } finally {
      await queryRunner.release();
    }
  }

  // ---------- Confirm success: write consignment_id/tracking_code
  // for orders we've VERIFIED are genuinely in Steadfast (either a
  // fresh 'success' response, or reconciled via status_by_invoice) ----------
  private async confirmCourierSuccess(
    confirmedInCourier: Map<number, any>,
  ): Promise<void> {
    const updates: Promise<any>[] = [];
    for (const [orderId, data] of confirmedInCourier) {
      updates.push(
        this.orderRepository.update(orderId, {
          consignmentId: data.consignment_id ? String(data.consignment_id) : null,
          trackingCode: data.tracking_code || null,
          courierStatus: data.delivery_status || 'in_review',
          courierNotificationType: 'order_created',
          courierUpdatedAt: new Date(),
        }),
      );
    }
    await Promise.all(updates);
  }

  private async sendOrdersToSteadfast(
    orders: any[],
    currierCompany: any,
    revertToStatusId: number,
  ): Promise<void> {
    const normalizeBdPhone = (raw: string): string | null => {
      if (!raw) return null;
      let digits = raw.replace(/\D/g, '');
      if (digits.startsWith('00')) digits = digits.slice(2);
      if (digits.startsWith('880')) digits = digits.slice(3);
      if (digits.length === 10 && !digits.startsWith('0')) digits = '0' + digits;
      return /^0[0-9]{10}$/.test(digits) ? digits : null;
    };

    const ordersWithPhone = orders.map((op) => ({
      op,
      normalizedPhone: normalizeBdPhone(op.receiverPhoneNumber),
    }));

    const validOrders = ordersWithPhone
      .filter((x) => x.normalizedPhone !== null)
      .map((x) => x.op);
    const invalidOrders = ordersWithPhone
      .filter((x) => x.normalizedPhone === null)
      .map((x) => x.op);

    const normalizedPhoneByOrderId = new Map<number, string>();
    for (const x of ordersWithPhone) {
      if (x.normalizedPhone) normalizedPhoneByOrderId.set(x.op.id, x.normalizedPhone);
    }

    // Invalid phone -> CONFIRMED failure, no ambiguity, revert immediately.
    if (invalidOrders.length) {
      await this.revertFailedCourierOrders(invalidOrders, revertToStatusId, {
        courierStatus: 'error',
        courierNotificationType: 'invalid_phone',
        trackingMessage:
          'Recipient phone number is not a valid 11-digit BD number — not sent to courier',
      });
      this.logger.warn(
        `Reverted ${invalidOrders.length} order(s) with invalid phone number for Steadfast: [${invalidOrders
          .map((o) => o.invoiceNumber)
          .join(', ')}]`,
      );
    }

    if (!validOrders.length) return;

    const courierPayload = validOrders.map((op) => ({
      invoice: op.invoiceNumber,
      recipient_name: op.receiverName,
      recipient_phone: normalizedPhoneByOrderId.get(op.id) || op.receiverPhoneNumber,
      recipient_address: op.receiverAddress,
      cod_amount: op.totalReceiveAbleAmount,
      note: op.deliveryNote || 'N/A',
    }));

    let steadfastResults: any[] = [];
    let requestSucceeded = false;

    try {
      const response = await axios.post(
        'https://portal.packzy.com/api/v1/create_order/bulk-order',
        courierPayload,
        {
          headers: {
            'Api-Key': currierCompany.api_key,
            'Secret-Key': currierCompany.secret_key,
          },
          timeout: 30000,
        },
      );

      steadfastResults = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];
      requestSucceeded = true;

      this.logger.log(
        `Steadfast bulk order request sent: ${validOrders.length} order(s), invoices [${validOrders
          .map((o) => o.invoiceNumber)
          .join(', ')}], ${steadfastResults.length} result(s) received`,
      );
    } catch (err: any) {
      const errMsg = err?.response?.data ? JSON.stringify(err.response.data) : err.message;
      this.logger.error(
        `Steadfast bulk order request failed for invoices [${validOrders
          .map((o) => o.invoiceNumber)
          .join(', ')}]: ${errMsg}`,
      );

      // ✅ THE ACTUAL BUG: we do NOT know if Steadfast received this
      // before the network died. Verify per-order instead of assuming
      // failure and reverting blindly.
      const { confirmedInCourier, confirmedFailed } =
        await this.reconcileWithSteadfast(validOrders, currierCompany);

      if (confirmedInCourier.size) {
        await this.confirmCourierSuccess(confirmedInCourier);
        this.logger.log(
          `Reconciled ${confirmedInCourier.size} order(s) as ALREADY IN COURIER despite request error: [${[
            ...confirmedInCourier.keys(),
          ].join(', ')}]`,
        );
      }

      if (confirmedFailed.length) {
        await this.revertFailedCourierOrders(confirmedFailed, revertToStatusId, {
          courierStatus: 'error',
          courierNotificationType: 'courier_request_failed',
          trackingMessage: `Steadfast bulk request failed and reconciliation confirmed non-delivery: ${errMsg}`,
        });
      }

      return;
    }

    if (!steadfastResults.length) {
      this.logger.warn(
        `Steadfast returned no results for invoices [${validOrders.map((o) => o.invoiceNumber).join(', ')}]`,
      );
      const { confirmedInCourier, confirmedFailed } =
        await this.reconcileWithSteadfast(validOrders, currierCompany);

      if (confirmedInCourier.size) await this.confirmCourierSuccess(confirmedInCourier);
      if (confirmedFailed.length) {
        await this.revertFailedCourierOrders(confirmedFailed, revertToStatusId, {
          courierStatus: 'error',
          courierNotificationType: 'empty_courier_response',
          trackingMessage: 'Steadfast returned an empty result set; reconciliation confirmed non-delivery',
        });
      }
      return;
    }

    const resultsByInvoice = new Map<string, any>();
    for (const result of steadfastResults) {
      if (result?.invoice) resultsByInvoice.set(String(result.invoice), result);
    }

    const succeededUpdates: Promise<any>[] = [];
    const noResultOrders: Order[] = [];
    const duplicateOrders: Order[] = []; // THIS_INVOICE_ALREADY_EXISTS -> needs reconciliation, NOT auto-fail
    const genuineFailedOrders: Order[] = [];
    const failedReasons = new Map<number, string>();

    for (const op of validOrders) {
      const result = resultsByInvoice.get(String(op.invoiceNumber));

      if (!result) {
        noResultOrders.push(op);
        continue;
      }

      if (result.status === 'success') {
        succeededUpdates.push(
          this.orderRepository.update(op.id, {
            consignmentId: result.consignment_id ? String(result.consignment_id) : null,
            trackingCode: result.tracking_code || null,
            courierStatus: 'in_review',
            courierNotificationType: 'order_created',
            codAmount: op.totalReceiveAbleAmount,
            courierUpdatedAt: new Date(),
          }),
        );
        continue;
      }

      // Steadfast's error field can be a JSON-stringified array like
      // '["THIS_INVOICE_ALREADY_EXISTS"]' or a plain string — check both.
      const errStr = Array.isArray(result?.error)
        ? result.error.join(',')
        : String(result?.error || '');

      if (errStr.includes('THIS_INVOICE_ALREADY_EXISTS')) {
        // NOT a confirmed failure — the invoice genuinely exists on
        // Steadfast's side already. Must verify via status_by_invoice
        // before deciding success or failure; never assume either.
        duplicateOrders.push(op);
      } else {
        // Any other explicit Steadfast error (bad address, balance,
        // etc.) IS a confirmed failure — Steadfast told us directly.
        genuineFailedOrders.push(op);
        failedReasons.set(op.id, result?.message || errStr || 'Steadfast order creation failed');
      }

      this.logger.warn(
        `Steadfast order creation not successful for invoice ${op.invoiceNumber}: ${JSON.stringify(result)}`,
      );
    }

    await Promise.all(succeededUpdates);

    // Reconcile the ambiguous buckets (no-result + duplicate) together —
    // for both, we genuinely don't know the true state without asking
    // Steadfast directly.
    const toReconcile = [...noResultOrders, ...duplicateOrders];
    if (toReconcile.length) {
      const { confirmedInCourier, confirmedFailed } =
        await this.reconcileWithSteadfast(toReconcile, currierCompany);

      if (confirmedInCourier.size) {
        await this.confirmCourierSuccess(confirmedInCourier);
        this.logger.log(
          `Reconciled ${confirmedInCourier.size} order(s) as ALREADY IN COURIER (duplicate/no-result case): [${[
            ...confirmedInCourier.keys(),
          ].join(', ')}]`,
        );
      }

      if (confirmedFailed.length) {
        await this.revertFailedCourierOrders(confirmedFailed, revertToStatusId, {
          courierStatus: 'error',
          courierNotificationType: 'reconciled_not_found',
          trackingMessage:
            'Reconciliation via status_by_invoice confirmed this order was never created at Steadfast',
        });
      }
    }

    // Genuine, Steadfast-confirmed failures — revert directly, no need
    // to double-check since Steadfast already gave us a definitive reason.
    if (genuineFailedOrders.length) {
      for (const op of genuineFailedOrders) {
        await this.revertFailedCourierOrders([op], revertToStatusId, {
          courierStatus: 'error',
          courierNotificationType: 'order_create_failed',
          trackingMessage: failedReasons.get(op.id) || 'Steadfast order creation failed',
        });
      }
    }
  }

  // ---------- Send a batch of orders to Steadfast, all belonging to the SAME courier partner ----------

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
    } catch (error: any) {
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
  reason?: string; // optional: pass from frontend if you want custom reason
}) {
  const { orderIds, agentId, statusId, warehouse, returnableProducts, reason } =
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

      // ---- FULL RETURN ----
      if (statusId === 10) {
        for (const product of products) {
          const inventory = await queryRunner.manager.findOne(
            this.inventoryRepository.target,
            { where: { productId: product.productId } },
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
            inventory.stock += product.productQuantity;
            await queryRunner.manager.save(
              this.inventoryRepository.target,
              inventory,
            );
          }

          if (inventoryItem) {
            inventoryItem.quantity += product.productQuantity;
            await queryRunner.manager.save(
              this.InventoryItemItemRepository.target,
              inventoryItem,
            );
          }

          // ✅ now saving a return record for full returns too
          const returnDamagePayload = {
            orderId: order.id, // ✅ correct orderId per order, not orderIds[0]
            productId: product.productId,
            returnQuantity: product.productQuantity,
            damageQuantity: 0,
            reason: reason || 'Full order returned',
            remarks: `Order fully returned from ${order.status.label} status`,
            returnDate: new Date(),
          };
          await this.orderProductReturnRepository.save(returnDamagePayload);
        }
      }

      // ---- PARTIAL RETURN ----
      if (statusId === 12) {
        for (const product of returnableProducts) {
          const inventory = await queryRunner.manager.findOne(
            this.inventoryRepository.target,
            { where: { productId: product.productId } },
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
            orderId: order.id, // ✅ fixed: was hardcoded Number(orderIds[0])
            productId: product?.productId,
            returnQuantity: product?.returnQuantity,
            damageQuantity: product?.damageQuantity,
            reason:
              reason ||
              (product?.damageQuantity > 0
                ? 'Customer returned; item(s) damaged'
                : 'Customer returned'),
            remarks: `Item returned via courier on ${new Date().toISOString().split('T')[0]}`,
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
  } catch (error: any) {
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
    const BD_OFFSET_MS = 6 * 60 * 60 * 1000;

    // ✅ Handle date filter or fallback to current date
    if (filterOptions?.startDate && filterOptions?.endDate) {
      const rawStart = new Date(filterOptions.startDate);
      const bdStart = new Date(rawStart.getTime() + BD_OFFSET_MS);
      utcStartDate = new Date(
        Date.UTC(
          bdStart.getUTCFullYear(),
          bdStart.getUTCMonth(),
          bdStart.getUTCDate(),
          0,
          0,
          0,
          0,
        ) - BD_OFFSET_MS,
      ).toISOString();

      const rawEnd = new Date(filterOptions.endDate);
      const bdEnd = new Date(rawEnd.getTime() + BD_OFFSET_MS);
      utcEndDate = new Date(
        Date.UTC(
          bdEnd.getUTCFullYear(),
          bdEnd.getUTCMonth(),
          bdEnd.getUTCDate(),
          23,
          59,
          59,
          999,
        ) - BD_OFFSET_MS,
      ).toISOString();
    } else {
      const today = new Date();
      const bdToday = new Date(today.getTime() + BD_OFFSET_MS);
      utcStartDate = new Date(
        Date.UTC(
          bdToday.getUTCFullYear(),
          bdToday.getUTCMonth(),
          bdToday.getUTCDate(),
          0,
          0,
          0,
          0,
        ) - BD_OFFSET_MS,
      ).toISOString();
      utcEndDate = new Date(
        Date.UTC(
          bdToday.getUTCFullYear(),
          bdToday.getUTCMonth(),
          bdToday.getUTCDate(),
          23,
          59,
          59,
          999,
        ) - BD_OFFSET_MS,
      ).toISOString();
    }

    baseQuery.andWhere(`orders.${dateField} BETWEEN :startDate AND :endDate`, {
      startDate: utcStartDate,
      endDate: utcEndDate,
    });

    if (filterOptions?.statusId) {
      const statusIds = Array.isArray(filterOptions.statusId)
        ? filterOptions.statusId
        : [filterOptions.statusId];
      baseQuery.andWhere('orders.statusId IN (:...statusIds)', { statusIds });
    }

    if (filterOptions?.locationId) {
      const locationIds = Array.isArray(filterOptions.locationId)
        ? filterOptions.locationId
        : [filterOptions.locationId];
      baseQuery.andWhere('orders.locationId IN (:...locationIds)', {
        locationIds,
      });
    }

    if (filterOptions?.agentIds) {
      const agentIds = Array.isArray(filterOptions.agentIds)
        ? filterOptions.agentIds
        : [filterOptions.agentIds];
      baseQuery.andWhere('orders.agentId IN (:...agentIds)', { agentIds });
    }

    if (filterOptions?.currier) {
      const curierIds = Array.isArray(filterOptions.currier)
        ? filterOptions.currier
        : [filterOptions.currier];
      baseQuery.andWhere('orders.currier IN (:...curierIds)', { curierIds });
    }

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

    const productSummaryResult = await baseQuery
      .clone()
      .select('SUM(prod.productQuantity)', 'totalProductQuantity')
      .addSelect('SUM(prod.subtotal)', 'totalSaleAmount')
      .addSelect('COUNT(DISTINCT orders.id)', 'totalOrders')
      .getRawOne();

    const orderRows = await baseQuery
      .clone()
      .select('orders.id', 'orderId')
      .addSelect('orders.totalPaidAmount', 'totalPaidAmount')
      .addSelect('orders.totalPrice', 'totalOrderAmount')
      .addSelect('orders.currier', 'currier')
      .groupBy('orders.id')
      .addGroupBy('orders.totalPaidAmount')
      .addGroupBy('orders.totalPrice')
      .addGroupBy('orders.currier')
      .getRawMany();

    const paidAmount = orderRows.reduce(
      (total, order) => total + (Number(order.totalPaidAmount) || 0),
      0,
    );
    const totalOrderAmount = orderRows.reduce(
      (total, order) => total + (Number(order.totalOrderAmount) || 0),
      0,
    );
    const courierOrderCount = orderRows.filter((order) => order.currier).length;

    const courierBreakdown = await baseQuery
      .clone()
      .leftJoin('orders.partner', 'dp')
      .select('orders.currier', 'courierId')
      .addSelect('COALESCE(dp.partnerName, :unassigned)', 'courierName')
      .addSelect('COUNT(DISTINCT orders.id)', 'orderCount')
      .addSelect('SUM(prod.productQuantity)', 'productQuantity')
      .addSelect('SUM(prod.subtotal)', 'saleAmount')
      .setParameter('unassigned', 'Unassigned')
      .groupBy('orders.currier')
      .addGroupBy('dp.partnerName')
      .getRawMany();

    return {
      data,
      total,
      page,
      limit,
      startDate: utcStartDate,
      endDate: utcEndDate,
      summary: {
        totalProducts: total,
        totalProductQuantity:
          Number(productSummaryResult?.totalProductQuantity) || 0,
        totalOrders: Number(productSummaryResult?.totalOrders) || 0,
        courierOrderCount,
        paidAmount,
        salesAmount: Number(productSummaryResult?.totalSaleAmount) || 0,
        totalOrderAmount,
        courierBreakdown: courierBreakdown.map((item) => ({
          courierId: item.courierId,
          courierName: item.courierName,
          orderCount: Number(item.orderCount) || 0,
          productQuantity: Number(item.productQuantity) || 0,
          saleAmount: Number(item.saleAmount) || 0,
        })),
      },
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
  // startDate marker itself IS the correct UTC instant for day-start
  utcStartDate = new Date(filterOptions.startDate).toISOString();

  // day-end = day-start + 24h - 1ms (timezone-agnostic, no getFullYear/getMonth/getDate)
  utcEndDate = new Date(
    new Date(filterOptions.endDate).getTime() + 24 * 60 * 60 * 1000 - 1,
  ).toISOString();
} else {
  const today = new Date();
  utcStartDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0),
  ).toISOString();
  utcEndDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999),
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
        partnerId: r.partnerId,
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
  async getDeliveryPartnerOrderDetails(
  organizationId: string,
  partnerId: string,
  filterOptions: any,
) {
  let utcStartDate: string;
  let utcEndDate: string;

  if (filterOptions?.startDate && filterOptions?.endDate) {
    utcStartDate = new Date(filterOptions.startDate).toISOString();
    utcEndDate = new Date(
      new Date(filterOptions.endDate).getTime() + 24 * 60 * 60 * 1000 - 1,
    ).toISOString();
  } else {
    const today = new Date();
    utcStartDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0, 0),
    ).toISOString();
    utcEndDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999),
    ).toISOString();
  }

  const locationId = filterOptions?.locationId?.length
    ? filterOptions.locationId
    : null;

  const qb = this.orderRepository
    .createQueryBuilder('o')
    .leftJoin('o.partner', 'dp')
    .where('o.organizationId = :organizationId', { organizationId })
    .andWhere('dp.id = :partnerId', { partnerId })
    .andWhere('o.intransitTime BETWEEN :startDate AND :endDate', {
      startDate: utcStartDate,
      endDate: utcEndDate,
    });

  if (locationId) {
    qb.andWhere('o.locationId IN (:...locationId)', { locationId });
  }

  const rows = await qb
    .select('o.intransitTime', 'inTransitDate')
    .addSelect('o.invoiceNumber', 'invoiceNumber')
    .addSelect('o.trackingCode', 'trackingId')
    .addSelect('o.receiverName', 'name')
    .addSelect('o.paymentStatus', 'paymentStatus')
    .addSelect('o.receiverPhoneNumber', 'mobileNo')
    .addSelect('COALESCE(o.codAmount, o.totalPaidAmount, 0)', 'codAmount')
    .orderBy('o.intransitTime', 'ASC')
    .getRawMany();

  return rows.map((r) => ({
    inTransitDate: r.inTransitDate,
    invoiceNumber: r.invoiceNumber,
    trackingId: r.trackingId || 'N/A',
    name: r.name,
    mobileNo: r.mobileNo,
    codAmount: Number(r.codAmount) || 0,
    paymentStatus: r.paymentStatus || "N/A",
  }));
}

async exchangeOrderProduct(payload: {
  orderId: number;
  oldProductId: string;
  oldQuantity: number;
  newProductId: string;
  newQuantity: number;
  agentId: string;
  reason?: string;
}) {
  const { orderId, oldProductId, oldQuantity, newProductId, newQuantity, agentId, reason } = payload;

  const originalOrder = await this.orderRepository.findOne({
    where: { id: orderId },
    relations: ['status'],
  });
  if (!originalOrder) {
    throw new ApiError(HttpStatus.BAD_REQUEST, 'Order does not exist');
  }
  if (!originalOrder.status || originalOrder.status.label !== 'Delivered') {
    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      `Order must be in "Delivered" status to exchange (current: ${originalOrder.status?.label || 'unknown'})`,
    );
  }

  const orderProduct = await this.productsRepository.findOne({
    where: { orderId, productId: oldProductId },
  });
  if (!orderProduct) {
    throw new ApiError(HttpStatus.BAD_REQUEST, 'Product not found in this order');
  }
  if (oldQuantity > orderProduct.productQuantity) {
    throw new ApiError(HttpStatus.BAD_REQUEST, 'Exchange quantity exceeds ordered quantity');
  }

  const newProductInfo = await this.productRepository.findOne({ where: { id: newProductId } });
  if (!newProductInfo) {
    throw new NotFoundException(`Product with ID ${newProductId} not found`);
  }

  const oldSubtotal = orderProduct.productPrice * oldQuantity;
  const newSubtotal = newProductInfo.salePrice * newQuantity;
  const priceDifference = newSubtotal - oldSubtotal;

  // ✅ FIX: এই দুটো call তাদের নিজস্ব ছোট transaction ব্যবহার করে,
  //    আর সম্পূর্ণ শেষ হয়ে commit হয়ে যায় — মূল queryRunner transaction শুরুর আগেই।
  //    তাই আর কোনো lock-competition/deadlock হবে না।
  const newOrderNumber = await this.generateOrderNumber(originalOrder.organizationId);
  const newInvoiceNumber = await this.generateInvoiceNumber(originalOrder.organizationId);

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // ---- ধাপ ১: পুরনো product return করা ----
    const oldInventory = await queryRunner.manager.findOne(Inventory, { where: { productId: oldProductId } });
    const oldInventoryItem = await queryRunner.manager.findOne(InventoryItem, {
      where: { productId: oldProductId, locationId: originalOrder.locationId },
    });

    if (oldInventory) {
      await queryRunner.manager.increment(Inventory, { productId: oldProductId }, 'stock', oldQuantity);
    }
    if (oldInventoryItem) {
      await queryRunner.manager.increment(
        InventoryItem,
        { productId: oldProductId, locationId: originalOrder.locationId },
        'quantity',
        oldQuantity,
      );
    }

    await queryRunner.manager.save(OrderProductReturn, {
      orderId: originalOrder.id,
      productId: oldProductId,
      returnQuantity: oldQuantity,
      damageQuantity: 0,
      reason: reason || 'Exchanged for another product',
      remarks: 'Returned as part of a product exchange',
      returnDate: new Date(),
    });

    const fullyReturned = oldQuantity === orderProduct.productQuantity;
    await queryRunner.manager.update(
      Order,
      { id: originalOrder.id },
      { statusId: fullyReturned ? 10 : 12 },
    );

    // ---- ধাপ ২: নতুন order তৈরি (numbers আগেই generate হয়ে গেছে) ----
    const newOrder = await queryRunner.manager.save(Order, {
      orderNumber: newOrderNumber,
      invoiceNumber: newInvoiceNumber,
      parentOrderId: originalOrder.id,
      customerId: originalOrder.customerId,
      receiverName: originalOrder.receiverName,
      receiverPhoneNumber: originalOrder.receiverPhoneNumber,
      receiverAddress: originalOrder.receiverAddress,
      receiverDivision: originalOrder.receiverDivision,
      receiverDistrict: originalOrder.receiverDistrict,
      receiverThana: originalOrder.receiverThana,
      organizationId: originalOrder.organizationId,
      locationId: originalOrder.locationId,
      currier: originalOrder.currier,
      addressId: originalOrder.addressId,
      orderSource: 'Exchange',
      orderType: 'Exchange',
      statusId: 2,
      shippingCharge: 0,
      discount: 0,
      productValue: newSubtotal,
      totalPrice: newSubtotal,
      totalPaidAmount: 0,
      totalReceiveAbleAmount: newSubtotal,
      agentId,
    });

    await queryRunner.manager.save(Products, {
      orderId: newOrder.id,
      productId: newProductId,
      productQuantity: newQuantity,
      productPrice: newProductInfo.salePrice,
      subtotal: newSubtotal,
    });

    const newInventory = await queryRunner.manager.findOne(Inventory, { where: { productId: newProductId } });
    if (newInventory) {
      await queryRunner.manager.increment(Inventory, { productId: newProductId }, 'orderQue', newQuantity);
    } else {
      await queryRunner.manager.save(Inventory, {
        productId: newProductId,
        organizationId: originalOrder.organizationId,
        orderQue: newQuantity,
        hoildQue: 0,
        processing: 0,
        stock: 0,
      });
    }

    const newInventoryItem = await queryRunner.manager.findOne(InventoryItem, {
      where: { productId: newProductId, locationId: originalOrder.locationId },
    });
    if (newInventoryItem) {
      await queryRunner.manager.increment(
        InventoryItem,
        { productId: newProductId, locationId: originalOrder.locationId },
        'orderQue',
        newQuantity,
      );
    } else if (newInventory) {
      // ✅ আগেরবার এই else block বাদ পড়েছিল — নতুন location-এ প্রথমবার হলে এখন তৈরি হবে
      await queryRunner.manager.save(InventoryItem, {
        locationId: originalOrder.locationId,
        productId: newProductId,
        quantity: 0,
        orderQue: newQuantity,
        inventoryId: newInventory.id,
      });
    }

    await queryRunner.manager.save(OrderExchange, {
      originalOrderId: originalOrder.id,
      newOrderId: newOrder.id,
      oldProductId,
      oldQuantity,
      newProductId,
      newQuantity,
      priceDifference,
      reason: reason || 'Customer requested exchange',
      agentId,
    });

    await queryRunner.manager.save(OrdersLog, [
      {
        orderId: originalOrder.id,
        agentId,
        action: `${oldQuantity} unit(s) of product ${oldProductId} returned for exchange. New order ${newOrderNumber} created for ${newQuantity} unit(s) of ${newProductId}.`,
        previousValue: null,
      },
      {
        orderId: newOrder.id,
        agentId,
        action: `Order created as an exchange for order ${originalOrder.orderNumber}. Price difference: ${priceDifference}.`,
        previousValue: null,
      },
    ]);

    await queryRunner.commitTransaction();

    return { originalOrderId: originalOrder.id, newOrder, priceDifference };
  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, error.message || 'Failed to process exchange');
  } finally {
    await queryRunner.release();
  }
}
}