import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import * as ExcelJS from 'exceljs';
import { Products } from './entities/products.entity';
import paginationHelpers from '../../../helpers/paginationHelpers';
import { plainToInstance } from 'class-transformer';
import { generateUniqueOrderNumber } from '../../../util/genarateUniqueNumber';
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
@Injectable()
export class OrderService {
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

    const orderNumber = generateUniqueOrderNumber();
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
    const lastOrder = await this.orderRepository
      .createQueryBuilder('order')
      .orderBy('order.createdAt', 'DESC')
      .take(1)
      .getOne();
    const lastUserId = lastOrder?.invoiceNumber?.substring(3);
    const currentId = lastUserId || (0).toString().padStart(4, '0');
    let incrementedId = (parseInt(currentId) + 1).toString().padStart(4, '0');
    incrementedId = `SO-${incrementedId}`;
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
    if (payload?.statusId === 2) {
      for (const item of products) {
        const { productId, productQuantity } = item;
        const existingInventory = await this.inventoryRepository.findOne({
          where: { productId },
        });
        if (!existingInventory?.orderQue) {
          await this.inventoryRepository.update({ productId }, { orderQue: 0 });
        }
        await this.inventoryRepository.increment(
          { productId },
          'orderQue',
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
              orderQue: productQuantity,
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

          await this.InventoryItemItemRepository.increment(
            { productId, locationId: rest?.locationId },
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

    const orderNumber = generateUniqueOrderNumber();
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
    const lastOrder = await this.orderRepository
      .createQueryBuilder('order')
      .orderBy('order.createdAt', 'DESC')
      .take(1)
      .getOne();
    const lastUserId = lastOrder?.invoiceNumber?.substring(3);
    const currentId = lastUserId || (0).toString().padStart(4, '0');
    let incrementedId = (parseInt(currentId) + 1).toString().padStart(4, '0');
    incrementedId = `SO-${incrementedId}`;
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

  async getOrders(options, filterOptions, organizationId) {
    const { page, limit, sortBy, sortOrder, skip } = paginationHelpers(options);
    const queryBuilder = this.orderRepository
      .createQueryBuilder('orders')
      .where('orders.organizationId = :organizationId', { organizationId });

    if (filterOptions?.searchTerm) {
      const searchTerm = `%${filterOptions.searchTerm.toString()}%`;
      queryBuilder.andWhere('orders.orderNumber LIKE :searchTerm', {
        searchTerm,
      });
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
        paymentStatus:filterOptions?.paymentStatus,
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
        'orders.createdAt BETWEEN :startDate AND :endDate',
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
      console.log(selesAgentIds, 'check');
      queryBuilder.andWhere('orders.agentId IN (:...selesAgentIds)', {
        selesAgentIds,
      });
    }

    if (filterOptions?.productId) {
      queryBuilder.leftJoin('orders.products', 'product');
    }
    let productIds = filterOptions?.productId;
    if (productIds) {
      console.log(productIds, 'product ids');
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
      locationIds = Array.isArray(paymentMethodIds)
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
    const { currentStatus, ...data } = mainData;
    const orders = await this.orderRepository.find({
      where: { id: In(orderIds) },
      relations: ['status'],
    });

    if (orders.length !== orderIds.length) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Some orders do not exist');
    }

    //status change to intransit , in-transit order status===7
    if (data?.statusId === 7) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const currierPayload = orders?.map((op: any) => {
          return {
            invoice: op?.invoiceNumber,
            recipient_name: op?.receiverName,
            recipient_phone: op?.receiverPhoneNumber,
            recipient_address: op?.receiverAddress,
            cod_amount: op?.totalReceiveAbleAmount,
            note: op?.deliveryNote || 'N/A',
          };
        });

        const productUpdates = [];
        for (const order of orders) {
          const products = await this.productsRepository.find({
            where: { orderId: order.id },
          });

          for (const product of products) {
            const inventory = await this.inventoryRepository.findOne({
              where: { productId: product.productId },
            });

            const inventoryItem =
              await this.InventoryItemItemRepository.findOne({
                where: {
                  productId: product.productId,
                  locationId: order.locationId,
                },
              });

            if (inventory) {
              await this.inventoryRepository.update(
                { productId: product.productId },
                {
                  processing: inventory.processing - product.productQuantity,
                  stock: inventory.stock - product.productQuantity,
                },
              );
            }
            if (inventoryItem) {
              await this.InventoryItemItemRepository.update(
                { productId: product.productId, locationId: order.locationId },
                {
                  processing:
                    inventoryItem.processing - product.productQuantity,
                  quantity: inventoryItem.quantity - product.productQuantity,
                },
              );
            }
          }
        }

        const currierCompany = await this.deliveryPartnerRepository.findOne({
          where: { organizationId: organizationId, id: orders[0]?.currier },
        });

        if (currierCompany?.partnerName === 'SteadFast') {
          await Promise.all(productUpdates);
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
        // Commit transaction
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
    }
    //status change to store , store order status===5
    if (data?.statusId === 5) {
      await this.requisitionService.createRequisition(
        { orderIds, userId: data?.userId },
        organizationId,
      );
      await this.orderRepository.update(
        { id: In(orderIds) },
        { storeTime: new Date() },
      );
    }
    if (data?.statusId === 6) {
      await this.orderRepository.update(
        { id: In(orderIds) },
        { packingTime: new Date() },
      );
    }
    if (data?.statusId === 4 && currentStatus === 2) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const productUpdates = [];
        for (const order of orders) {
          const products = await this.productsRepository.find({
            where: { orderId: order.id },
          });

          for (const product of products) {
            const inventory = await this.inventoryRepository.findOne({
              where: { productId: product.productId },
            });

            const inventoryItem =
              await this.InventoryItemItemRepository.findOne({
                where: {
                  productId: product.productId,
                  locationId: order.locationId,
                },
              });

            if (inventory) {
              // productUpdates.push(
              //   queryRunner.manager.update(Inventory, { productId: product.productId }, {
              //     orderQue: inventory.orderQue - product.productQuantity
              //   })
              // );

              await this.inventoryRepository.update(
                { productId: product.productId },
                {
                  orderQue: inventory.orderQue - product.productQuantity,
                },
              );
            }
            if (inventoryItem) {
              // productUpdates.push(
              //   queryRunner.manager.update(InventoryItem, { productId: product.productId, locationId: order.locationId }, {
              //     orderQue: inventoryItem.orderQue - product.productQuantity
              //   })
              // );
              await this.InventoryItemItemRepository.update(
                { productId: product.productId, locationId: order.locationId },
                {
                  orderQue: inventoryItem.orderQue - product.productQuantity,
                },
              );
            }
          }
        }

        // Commit transaction
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
    }
    //  cancel order
    if (data?.statusId === 4 && (currentStatus === 5 || currentStatus === 6)) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const productUpdates = [];
        for (const order of orders) {
          const products = await this.productsRepository.find({
            where: { orderId: order.id },
          });

          for (const product of products) {
            const inventory = await this.inventoryRepository.findOne({
              where: { productId: product.productId },
            });

            const inventoryItem =
              await this.InventoryItemItemRepository.findOne({
                where: {
                  productId: product.productId,
                  locationId: order.locationId,
                },
              });

            if (inventory) {
              // productUpdates.push(
              //   queryRunner.manager.update(Inventory, { productId: product.productId }, {
              //     processing: inventory.processing - product.productQuantity
              //   })
              // );

              await this.inventoryRepository.update(
                { productId: product.productId },
                {
                  processing: inventory.processing - product.productQuantity,
                },
              );
            }
            if (inventoryItem) {
              // productUpdates.push(
              //   queryRunner.manager.update(InventoryItem, { productId: product.productId, locationId: order.locationId }, {
              //     processing: inventoryItem.processing - product.productQuantity
              //   })
              // );
              await this.InventoryItemItemRepository.update(
                { productId: product.productId, locationId: order.locationId },
                {
                  processing:
                    inventoryItem.processing - product.productQuantity,
                },
              );
            }
          }
        }

        // Commit transaction
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
    }

    // change hold status

    if (data?.statusId === 3 && currentStatus === 2) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const productUpdates = [];
        for (const order of orders) {
          const products = await this.productsRepository.find({
            where: { orderId: order.id },
          });

          for (const product of products) {
            const inventory = await this.inventoryRepository.findOne({
              where: { productId: product.productId },
            });

            const inventoryItem =
              await this.InventoryItemItemRepository.findOne({
                where: {
                  productId: product.productId,
                  locationId: order.locationId,
                },
              });

            if (inventory) {
              // productUpdates.push(
              //   queryRunner.manager.update(Inventory, { productId: product.productId }, {
              //     orderQue: inventory.orderQue - product.productQuantity,
              //     hoildQue:inventory.hoildQue+product.productQuantity
              //   })
              // );
              await this.inventoryRepository.update(
                { productId: product.productId },
                {
                  orderQue: inventory.orderQue - product.productQuantity,
                  hoildQue: inventory.hoildQue + product.productQuantity,
                },
              );
            }
            if (inventoryItem) {
              // productUpdates.push(
              //   queryRunner.manager.update(InventoryItem, { productId: product.productId, locationId: order.locationId }, {
              //     orderQue: inventoryItem.orderQue - product.productQuantity,
              //     hoildQue:inventoryItem.hoildQue+product.productQuantity
              //   })
              // );
              await this.InventoryItemItemRepository.update(
                { productId: product.productId, locationId: order.locationId },
                {
                  orderQue: inventoryItem.orderQue - product.productQuantity,
                  hoildQue: inventoryItem.hoildQue + product.productQuantity,
                },
              );
            }
          }
        }

        // Commit transaction
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
    }

    if (data?.statusId === 3 && (currentStatus === 5 || currentStatus === 6)) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const productUpdates = [];
        for (const order of orders) {
          const products = await this.productsRepository.find({
            where: { orderId: order.id },
          });

          for (const product of products) {
            console.log(product, 'product');
            const inventory = await this.inventoryRepository.findOne({
              where: { productId: product.productId },
            });

            const inventoryItem =
              await this.InventoryItemItemRepository.findOne({
                where: {
                  productId: product.productId,
                  locationId: order.locationId,
                },
              });

            if (inventory) {
              console.log('++++++++++++++++++++++');
              // productUpdates.push(
              //   queryRunner.manager.update(Inventory, { productId: product.productId }, {
              //     processing: inventory.processing - product.productQuantity,
              //     hoildQue:inventory.hoildQue+product.productQuantity
              //   })
              // );
              await this.inventoryRepository.update(
                { productId: product.productId },
                {
                  processing: inventory.processing - product.productQuantity,
                  hoildQue: inventory.hoildQue + product.productQuantity,
                },
              );
            }
            if (inventoryItem) {
              console.log('_________________________');
              // productUpdates.push(
              //   queryRunner.manager.update(InventoryItem, { productId: product.productId, locationId: order.locationId }, {
              //     processing: inventoryItem.processing - product.productQuantity,
              //     hoildQue:inventoryItem.hoildQue+product.productQuantity
              //   })
              // );
              await this.InventoryItemItemRepository.update(
                { productId: product.productId, locationId: order.locationId },
                {
                  processing:
                    inventoryItem.processing - product.productQuantity,
                  hoildQue: inventoryItem.hoildQue + product.productQuantity,
                },
              );
            }
          }
        }
        // Commit transaction
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
    }

    if (data?.statusId === 2 && (currentStatus === 1 || currentStatus === 4)) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        for (const order of orders) {
          const products = await this.productsRepository.find({
            where: { orderId: order.id },
          });

          for (const item of products) {
            const { productId, productQuantity } = item;
            const existingInventory = await this.inventoryRepository.findOne({
              where: { productId },
            });
            if (!existingInventory?.orderQue) {
              await this.inventoryRepository.update(
                { productId },
                { orderQue: 0 },
              );
            }
            await this.inventoryRepository.increment(
              { productId },
              'orderQue',
              productQuantity,
            );

            const existingInventoryItem =
              await this.InventoryItemItemRepository.findOne({
                where: { productId, locationId: order?.locationId },
              });

            //
            if (!existingInventoryItem) {
              const newInventoryItems =
                await this.InventoryItemItemRepository.create({
                  locationId: order?.locationId,
                  productId: productId,
                  quantity: 0,
                  orderQue: productQuantity,
                  inventoryId: existingInventory.id,
                });

              await this.InventoryItemItemRepository.save(newInventoryItems);
            } else {
              if (!existingInventoryItem?.orderQue) {
                await this.InventoryItemItemRepository.update(
                  { productId, locationId: order?.locationId },
                  { orderQue: 0 },
                );
              }

              await this.InventoryItemItemRepository.increment(
                { productId, locationId: order?.locationId },
                'orderQue',
                productQuantity,
              );
            }
          }
        }

        // Commit transaction
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
    }
    if (data?.statusId === 3 && currentStatus === 1) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        for (const order of orders) {
          const products = await this.productsRepository.find({
            where: { orderId: order.id },
          });

          for (const item of products) {
            const { productId, productQuantity } = item;
            const existingInventory = await this.inventoryRepository.findOne({
              where: { productId },
            });
            if (!existingInventory?.hoildQue) {
              await this.inventoryRepository.update(
                { productId },
                { hoildQue: 0 },
              );
            }
            await this.inventoryRepository.increment(
              { productId },
              'hoildQue',
              productQuantity,
            );

            const existingInventoryItem =
              await this.InventoryItemItemRepository.findOne({
                where: { productId, locationId: order?.locationId },
              });

            //
            if (!existingInventoryItem) {
              const newInventoryItems =
                await this.InventoryItemItemRepository.create({
                  locationId: order?.locationId,
                  productId: productId,
                  quantity: 0,
                  orderQue: productQuantity,
                  inventoryId: existingInventory.id,
                });

              await this.InventoryItemItemRepository.save(newInventoryItems);
            } else {
              if (!existingInventoryItem?.orderQue) {
                await this.InventoryItemItemRepository.update(
                  { productId, locationId: order?.locationId },
                  { hoildQue: 0 },
                );
              }

              await this.InventoryItemItemRepository.increment(
                { productId, locationId: order?.locationId },
                'hoildQue',
                productQuantity,
              );
            }
          }
        }

        // Commit transaction
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
    }

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
  // change hold status
  async changeHoldStatus(
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
      for (const order of orders) {
        const products = await this.productsRepository.find({
          where: { orderId: order.id },
        });

        for (const product of products) {
          const inventory = await this.inventoryRepository.findOne({
            where: { productId: product.productId },
          });
          const inventoryItem = await this.InventoryItemItemRepository.findOne({
            where: {
              productId: product.productId,
              locationId: order.locationId,
            },
          });

          if (
            (order?.previousStatus === '2' || !order?.previousStatus) &&
            data?.statusId !== 4
          ) {
            if (inventory) {
              // productUpdates.push(
              //   queryRunner.manager.update(Inventory, { productId: product.productId }, {
              //     orderQue: inventory.orderQue + product.productQuantity,
              //     hoildQue:inventory.hoildQue-product.productQuantity
              //   })
              // );

              await this.inventoryRepository.update(
                { productId: product.productId },
                {
                  orderQue: inventory.orderQue + product.productQuantity,
                  hoildQue: inventory.hoildQue - product.productQuantity,
                },
              );
            }
            if (inventoryItem) {
              // productUpdates.push(
              //   queryRunner.manager.update(InventoryItem, { productId: product.productId, locationId: order.locationId }, {
              //     orderQue: inventoryItem.orderQue + product.productQuantity,
              //     hoildQue:inventoryItem.hoildQue-product.productQuantity
              //   })
              // );

              await this.InventoryItemItemRepository.update(
                { productId: product.productId, locationId: order.locationId },
                {
                  orderQue: inventoryItem.orderQue + product.productQuantity,
                  hoildQue: inventoryItem.hoildQue - product.productQuantity,
                },
              );
            }
          }
          if (
            (order?.previousStatus === '5' || order?.previousStatus === '6') &&
            data?.statusId !== 4
          ) {
            if (inventory) {
              // productUpdates.push(
              //   queryRunner.manager.update(Inventory, { productId: product.productId }, {
              //     processing: inventory.processing + product.productQuantity,
              //     hoildQue:inventory.hoildQue-product.productQuantity
              //   })
              // );

              await this.inventoryRepository.update(
                { productId: product.productId },
                {
                  processing: inventory.processing + product.productQuantity,
                  hoildQue: inventory.hoildQue - product.productQuantity,
                },
              );
            }
            if (inventoryItem) {
              // productUpdates.push(
              //   queryRunner.manager.update(InventoryItem, { productId: product.productId, locationId: order.locationId }, {
              //     processing: inventoryItem.processing + product.productQuantity,
              //     hoildQue:inventoryItem.hoildQue-product.productQuantity
              //   })
              // );
              await this.InventoryItemItemRepository.update(
                { productId: product.productId, locationId: order.locationId },
                {
                  processing:
                    inventoryItem.processing + product.productQuantity,
                  hoildQue: inventoryItem.hoildQue - product.productQuantity,
                },
              );
            }
          }
          if (data?.statusId === 4) {
            if (inventory) {
              // productUpdates.push(
              //   queryRunner.manager.update(Inventory, { productId: product.productId }, {
              //     hoildQue:inventory.hoildQue-product.productQuantity
              //   })
              // );

              await this.inventoryRepository.update(
                { productId: product.productId },
                {
                  hoildQue: inventory.hoildQue - product.productQuantity,
                },
              );
            }
            if (inventoryItem) {
              // productUpdates.push(
              //   queryRunner.manager.update(InventoryItem, { productId: product.productId, locationId: order.locationId }, {
              //     hoildQue:inventoryItem.hoildQue-product.productQuantity
              //   })
              // );
              await this.InventoryItemItemRepository.update(
                { productId: product.productId, locationId: order.locationId },
                {
                  hoildQue: inventoryItem.hoildQue - product.productQuantity,
                },
              );
            }
          }
          if (data?.statusId === 4) {
            await this.orderRepository.update(
              { id: order.id },
              { statusId: data?.statusId },
            );
          } else {
            await this.orderRepository.update(
              { id: order.id },
              { statusId: +order.previousStatus ? +order.previousStatus : 2 },
            );
          }
        }
      }
      // Commit transaction
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

    // await this.orderRepository.update({ id: In(orderIds) }, data);

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
    } catch (error) {
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
        0, 0, 0, 0,
      ),
    ).toISOString();

    const localEndDate = new Date(filterOptions.endDate);
    utcEndDate = new Date(
      Date.UTC(
        localEndDate.getFullYear(),
        localEndDate.getMonth(),
        localEndDate.getDate(),
        23, 59, 59, 999,
      ),
    ).toISOString();
  } else {
    const today = new Date();
    utcStartDate = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0),
    ).toISOString();
    utcEndDate = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
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
  const prodMap = new Map(
    productsAgg.map((r) => [String(r.partnerId), r]),
  );

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
