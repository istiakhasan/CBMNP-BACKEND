import { Injectable } from '@nestjs/common';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { In, Repository } from 'typeorm';
import { Customers } from '../customers/entities/customers.entity';
import { Users } from '../user/entities/user.entity';
import { OrderStatus } from '../status/entities/status.entity';
import { DeliveryPartner } from '../delivery-partner/entities/delivery-partner.entity';
import { Products } from '../order/entities/products.entity';
import { Product } from '../product/entity/product.entity';
import { Expense } from '../finance/entities/expense.entity';
import { InventoryItem } from '../inventory/entities/inventoryitem.entity';
import { SupplierBill } from '../finance/entities/supplier-bill.entity';

type CachedTopSelling = {
  data: {
    label: string;
    orders: number;
    totalSales: string;
  }[];
  timestamp: number;
};

type OrderDashboardDateField =
  | 'createdAt'
  | 'intransitTime'
  | 'storeTime'
  | 'packingTime'
  | 'approvedTime'
  | 'courierUpdatedAt';

const topSellingCache: Record<string, CachedTopSelling> = {};
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Customers)
    private readonly customerRepository: Repository<Customers>,
    @InjectRepository(Users)
    private readonly userRepository: Repository<Users>,
    @InjectRepository(OrderStatus)
    private readonly statusRepository: Repository<OrderStatus>,
    @InjectRepository(DeliveryPartner)
    private readonly deliveryPartnerRepository: Repository<DeliveryPartner>,
    @InjectRepository(Products)
    private readonly orderproductsRepository: Repository<Products>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(SupplierBill)
    private readonly supplierBillRepository: Repository<SupplierBill>,
  ) {}
  create(createDashboardDto: CreateDashboardDto) {
    return 'This action adds a new dashboard';
  }

  findAll() {
    return `This action returns all dashboard`;
  }

  findOne(id: number) {
    return `This action returns a #${id} dashboard`;
  }

  update(id: number, updateDashboardDto: UpdateDashboardDto) {
    return `This action updates a #${id} dashboard`;
  }

  remove(id: number) {
    return `This action removes a #${id} dashboard`;
  }

  async getMonthlyDashboardData(
    year: number = new Date().getFullYear(),
    organizationId?: string,
    dateField?: string,
  ) {
    const orderDateField = this.resolveOrderDashboardDateField(dateField);
    const orderDateColumn = `order.${orderDateField}`;
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .select([
        `TO_CHAR(${orderDateColumn}, 'Mon') AS month`,
        `TO_CHAR(${orderDateColumn}, 'MM') AS monthNumber`,
        'COUNT(order.id) as totalOrders',
        'SUM(order.totalPrice) as totalRevenue',
      ])
      .where(`EXTRACT(YEAR FROM ${orderDateColumn}) = :year`, { year })
      .groupBy('month, monthNumber')
      .orderBy(`TO_CHAR(${orderDateColumn}, 'MM')::int`);

    if (organizationId) {
      qb.andWhere('order.organizationId = :organizationId', { organizationId });
    }

    const results = await qb.getRawMany();

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const chartData = months.map((month) => {
      const found = results.find((r) => r.month === month);
      console.log(found?.totalrevenue, 'rev');
      return !!found ? Number(found?.totalrevenue || 0) : 0;
    });
    return chartData;
  }
  async getDashboardSummary(
    organizationId: string,
    period?: string,
    startDate?: string,
    endDate?: string,
    dateField?: string,
  ) {
    return this.getAdvancedDashboardSummary(organizationId, period, startDate, endDate, dateField);
  }

  async getAdvancedDashboardSummary(
    organizationId: string,
    period: string = 'all',
    startDate?: string,
    endDate?: string,
    dateField?: string,
  ) {
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    // Determine Date Filter Range
    const now = new Date();
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;

    if (startDate && endDate) {
      dateFrom = new Date(startDate + 'T00:00:00.000Z');
      dateTo = new Date(endDate + 'T23:59:59.999Z');
    } else {
      const p = (period || 'all').toLowerCase();
      if (p === 'day' || p === 'today') {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      } else if (p === 'week') {
        dateFrom = new Date(now);
        dateFrom.setDate(now.getDate() - 7);
        dateFrom.setHours(0, 0, 0, 0);
        dateTo = now;
      } else if (p === 'month') {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        dateTo = now;
      } else if (p === 'year') {
        dateFrom = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        dateTo = now;
      }
    }

    const orderDateField = this.resolveOrderDashboardDateField(dateField);
    const orderDateColumn = (alias: string = 'orders') => `${alias}.${orderDateField}`;

    const applyDateFilter = (qb: any, alias: string = 'orders') => {
      if (dateFrom && dateTo) {
        const dateColumn = orderDateColumn(alias);
        qb.andWhere(`${dateColumn} >= :dateFrom AND ${dateColumn} <= :dateTo`, {
          dateFrom,
          dateTo,
        });
      }
    };

    const applyCreatedAtDateFilter = (qb: any, alias: string) => {
      if (dateFrom && dateTo) {
        qb.andWhere(`${alias}.createdAt >= :dateFrom AND ${alias}.createdAt <= :dateTo`, {
          dateFrom,
          dateTo,
        });
      }
    };

    // 1. Core Orders Query (All in Range)
    const allOrdersQb = this.orderRepository
      .createQueryBuilder('orders')
      .where('orders.organizationId = :organizationId', { organizationId })
      .select('COUNT(orders.id)', 'count')
      .addSelect('COALESCE(SUM(orders.totalPrice), 0)', 'totalPrice');
    applyDateFilter(allOrdersQb, 'orders');

    // 2. Pending Orders (status 1)
    const pendingQb = this.orderRepository
      .createQueryBuilder('orders')
      .where('orders.organizationId = :organizationId', { organizationId })
      .andWhere('orders.statusId = :statusId', { statusId: 1 })
      .select('COUNT(orders.id)', 'count')
      .addSelect('COALESCE(SUM(orders.totalPrice), 0)', 'totalPrice');
    applyDateFilter(pendingQb, 'orders');

    // 3. Delivered Orders (status 8)
    const deliveredQb = this.orderRepository
      .createQueryBuilder('orders')
      .where('orders.organizationId = :organizationId', { organizationId })
      .andWhere('orders.statusId = :statusId', { statusId: 8 })
      .select('COUNT(orders.id)', 'count')
      .addSelect('COALESCE(SUM(orders.totalPrice), 0)', 'totalPrice');
    applyDateFilter(deliveredQb, 'orders');

    // 4. In-Transit / Processing Orders (statuses: 2=Approved, 3=Processing, 6=InTransit, 7=OutForDelivery)
    const inTransitQb = this.orderRepository
      .createQueryBuilder('orders')
      .where('orders.organizationId = :organizationId', { organizationId })
      .andWhere('orders.statusId IN (:...statuses)', { statuses: [2, 3, 6, 7] })
      .select('COUNT(orders.id)', 'count')
      .addSelect('COALESCE(SUM(orders.totalPrice), 0)', 'totalPrice');
    applyDateFilter(inTransitQb, 'orders');

    // 5. Cancelled Orders (status 4)
    const cancelledQb = this.orderRepository
      .createQueryBuilder('orders')
      .where('orders.organizationId = :organizationId', { organizationId })
      .andWhere('orders.statusId = :statusId', { statusId: 4 })
      .select('COUNT(orders.id)', 'count')
      .addSelect('COALESCE(SUM(orders.totalPrice), 0)', 'totalPrice');
    applyDateFilter(cancelledQb, 'orders');

    // 6. Returned / Damaged Orders (status 5)
    const returnedQb = this.orderRepository
      .createQueryBuilder('orders')
      .where('orders.organizationId = :organizationId', { organizationId })
      .andWhere('orders.statusId = :statusId', { statusId: 5 })
      .select('COUNT(orders.id)', 'count')
      .addSelect('COALESCE(SUM(orders.totalPrice), 0)', 'totalPrice');
    applyDateFilter(returnedQb, 'orders');

    // 7. Operating Expenses
    const expenseQb = this.expenseRepository
      .createQueryBuilder('expense')
      .where('expense.organizationId = :organizationId', { organizationId })
      .select('COALESCE(SUM(expense.amount), 0)', 'totalExpense')
      .addSelect('COUNT(expense.id)', 'expenseCount');
    if (dateFrom && dateTo) {
      expenseQb.andWhere('expense.expenseDate >= :startDate AND expense.expenseDate <= :endDate', {
        startDate: dateFrom.toISOString().split('T')[0],
        endDate: dateTo.toISOString().split('T')[0],
      });
    }

    // 8. Accounts Payable (Outstanding Supplier Bills)
    const apQb = this.supplierBillRepository
      .createQueryBuilder('bill')
      .where('bill.organizationId = :organizationId', { organizationId })
      .select('COALESCE(SUM(bill.dueAmount), 0)', 'totalDue');

    // 9. Warehouse Stock Valuation
    const valuationQb = this.inventoryItemRepository
      .createQueryBuilder('item')
      .leftJoin('item.product', 'product')
      .where('product.organizationId = :organizationId', { organizationId })
      .select('COALESCE(SUM(item.quantity), 0)', 'totalUnits')
      .addSelect('COALESCE(SUM(item.quantity * COALESCE(product.regularPrice, 0)), 0)', 'totalValue');

    // 10. Total Clients & New Clients
    const totalClientsQb = this.customerRepository
      .createQueryBuilder('customers')
      .where('customers.organizationId = :organizationId', { organizationId })
      .select('COUNT(customers.id)', 'count');

    const newClientsQb = this.customerRepository
      .createQueryBuilder('customers')
      .where('customers.organizationId = :organizationId', { organizationId })
      .select('COUNT(customers.id)', 'count');
    applyCreatedAtDateFilter(newClientsQb, 'customers');

    // 11. Top Customers
    const topCustomersQb = this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.organizationId = :organizationId', { organizationId })
      .leftJoin('customer.orders', 'order')
      .select([
        'customer.id AS id',
        'customer.customerName AS name',
        'customer.customerPhoneNumber AS phone',
        'COUNT(order.id) AS "orderCount"',
        'COALESCE(SUM(order.totalPrice), 0) AS price',
      ])
      .groupBy('customer.id')
      .orderBy('COALESCE(SUM(order.totalPrice), 0)', 'DESC')
      .limit(5);

    // 12. Top Selling Products
    const topProductsQb = this.orderproductsRepository
      .createQueryBuilder('op')
      .innerJoin('op.order', 'o')
      .innerJoin('op.product', 'p')
      .where('o.organizationId = :organizationId', { organizationId });
    applyDateFilter(topProductsQb, 'o');
    topProductsQb
      .select('op.productId', 'productId')
      .addSelect('p.name', 'productName')
      .addSelect('p.sku', 'sku')
      .addSelect('COALESCE(SUM(op.productQuantity), 0)', 'quantitySold')
      .addSelect('COALESCE(SUM(op.subtotal), 0)', 'totalSales')
      .groupBy('op.productId')
      .addGroupBy('p.name')
      .addGroupBy('p.sku')
      .orderBy('COALESCE(SUM(op.subtotal), 0)', 'DESC')
      .limit(5);

    // 13. Time-Series Chart Data
    let timeSeriesQb = this.orderRepository
      .createQueryBuilder('orders')
      .where('orders.organizationId = :organizationId', { organizationId });
    applyDateFilter(timeSeriesQb, 'orders');

    if (period === 'day' || period === 'today') {
      timeSeriesQb
        .select(`TO_CHAR(${orderDateColumn('orders')}, 'HH24:00')`, 'timeKey')
        .addSelect('COUNT(orders.id)', 'ordersCount')
        .addSelect('COALESCE(SUM(orders.totalPrice), 0)', 'revenue')
        .groupBy(`TO_CHAR(${orderDateColumn('orders')}, 'HH24:00')`)
        .orderBy(`TO_CHAR(${orderDateColumn('orders')}, 'HH24:00')`, 'ASC');
    } else if (period === 'week') {
      timeSeriesQb
        .select(`TO_CHAR(${orderDateColumn('orders')}, 'Dy')`, 'timeKey')
        .addSelect(`TO_CHAR(${orderDateColumn('orders')}, 'YYYY-MM-DD')`, 'sortDate')
        .addSelect('COUNT(orders.id)', 'ordersCount')
        .addSelect('COALESCE(SUM(orders.totalPrice), 0)', 'revenue')
        .groupBy(`TO_CHAR(${orderDateColumn('orders')}, 'Dy'), TO_CHAR(${orderDateColumn('orders')}, 'YYYY-MM-DD')`)
        .orderBy(`TO_CHAR(${orderDateColumn('orders')}, 'YYYY-MM-DD')`, 'ASC');
    } else if (period === 'month') {
      timeSeriesQb
        .select(`TO_CHAR(${orderDateColumn('orders')}, 'DD Mon')`, 'timeKey')
        .addSelect(`TO_CHAR(${orderDateColumn('orders')}, 'YYYY-MM-DD')`, 'sortDate')
        .addSelect('COUNT(orders.id)', 'ordersCount')
        .addSelect('COALESCE(SUM(orders.totalPrice), 0)', 'revenue')
        .groupBy(`TO_CHAR(${orderDateColumn('orders')}, 'DD Mon'), TO_CHAR(${orderDateColumn('orders')}, 'YYYY-MM-DD')`)
        .orderBy(`TO_CHAR(${orderDateColumn('orders')}, 'YYYY-MM-DD')`, 'ASC');
    } else {
      timeSeriesQb
        .select(`TO_CHAR(${orderDateColumn('orders')}, 'Mon')`, 'timeKey')
        .addSelect(`TO_CHAR(${orderDateColumn('orders')}, 'MM')`, 'sortDate')
        .addSelect('COUNT(orders.id)', 'ordersCount')
        .addSelect('COALESCE(SUM(orders.totalPrice), 0)', 'revenue')
        .groupBy(`TO_CHAR(${orderDateColumn('orders')}, 'Mon'), TO_CHAR(${orderDateColumn('orders')}, 'MM')`)
        .orderBy(`TO_CHAR(${orderDateColumn('orders')}, 'MM')`, 'ASC');
    }

    // Execute All in Parallel
    const [
      allOrders,
      pendingOrders,
      deliveredOrders,
      inTransitOrders,
      cancelledOrders,
      returnedOrders,
      expenses,
      apData,
      valuationData,
      totalClientsData,
      newClientsData,
      topCustomers,
      topProducts,
      timeSeriesData,
    ] = await Promise.all([
      allOrdersQb.getRawOne(),
      pendingQb.getRawOne(),
      deliveredQb.getRawOne(),
      inTransitQb.getRawOne(),
      cancelledQb.getRawOne(),
      returnedQb.getRawOne(),
      expenseQb.getRawOne(),
      apQb.getRawOne(),
      valuationQb.getRawOne(),
      totalClientsQb.getRawOne(),
      newClientsQb.getRawOne(),
      topCustomersQb.getRawMany(),
      topProductsQb.getRawMany(),
      timeSeriesQb.getRawMany(),
    ]);

    const totalOrdersCount = Number(allOrders?.count || 0);
    const grossSalesAmount = Number(allOrders?.totalPrice || 0);
    const deliveredCount = Number(deliveredOrders?.count || 0);
    const deliveredAmount = Number(deliveredOrders?.totalPrice || 0);
    const deliverySuccessRate = totalOrdersCount > 0 ? (deliveredCount / totalOrdersCount) * 100 : 0;

    const cancelledCount = Number(cancelledOrders?.count || 0);
    const cancelledAmount = Number(cancelledOrders?.totalPrice || 0);
    const returnedCount = Number(returnedOrders?.count || 0);
    const returnedAmount = Number(returnedOrders?.totalPrice || 0);
    const returnLossRate = totalOrdersCount > 0 ? ((cancelledCount + returnedCount) / totalOrdersCount) * 100 : 0;

    const operatingExpenses = Number(expenses?.totalExpense || 0);
    const grossProfit = deliveredAmount - operatingExpenses;
    const profitMargin = deliveredAmount > 0 ? (grossProfit / deliveredAmount) * 100 : 0;
    const aov = totalOrdersCount > 0 ? grossSalesAmount / totalOrdersCount : 0;

    return {
      period,
      dateField: orderDateField,
      startDate: dateFrom?.toISOString(),
      endDate: dateTo?.toISOString(),
      salesOverview: {
        grossSales: grossSalesAmount,
        totalOrders: totalOrdersCount,
        aov,
      },
      fulfillmentOverview: {
        delivered: {
          count: deliveredCount,
          amount: deliveredAmount,
          rate: Number(deliverySuccessRate.toFixed(1)),
        },
        pending: {
          count: Number(pendingOrders?.count || 0),
          amount: Number(pendingOrders?.totalPrice || 0),
        },
        inTransit: {
          count: Number(inTransitOrders?.count || 0),
          amount: Number(inTransitOrders?.totalPrice || 0),
        },
        cancelled: {
          count: cancelledCount,
          amount: cancelledAmount,
          rate: Number(((cancelledCount / (totalOrdersCount || 1)) * 100).toFixed(1)),
        },
        returned: {
          count: returnedCount,
          amount: returnedAmount,
          rate: Number(((returnedCount / (totalOrdersCount || 1)) * 100).toFixed(1)),
        },
        returnLossRate: Number(returnLossRate.toFixed(1)),
      },
      financialOverview: {
        deliveredRevenue: deliveredAmount,
        operatingExpenses,
        grossProfit,
        profitMargin: Number(profitMargin.toFixed(1)),
        outstandingAP: Number(apData?.totalDue || 0),
      },
      inventoryOverview: {
        totalUnits: Number(valuationData?.totalUnits || 0),
        totalValuation: Number(valuationData?.totalValue || 0),
      },
      customerOverview: {
        totalClients: Number(totalClientsData?.count || 0),
        newClientsInPeriod: Number(newClientsData?.count || 0),
      },
      chartData: timeSeriesData.map((t: any) => ({
        key: t.timeKey,
        orders: Number(t.ordersCount || 0),
        revenue: Number(t.revenue || 0),
      })),
      topCustomers: topCustomers.map((c: any) => ({
        id: c.id,
        name: c.name || 'Customer',
        phone: c.phone || '',
        orderCount: Number(c.orderCount || 0),
        totalSpent: Number(c.price || 0),
      })),
      topProducts: topProducts.map((p: any) => ({
        productId: p.productId,
        productName: p.productName || 'Product',
        sku: p.sku || '',
        quantitySold: Number(p.quantitySold || 0),
        totalSales: Number(p.totalSales || 0),
      })),
      // Backward compatibility fields
      totalClient: Number(totalClientsData?.count || 0),
      totalPendingOrders: {
        total: Number(pendingOrders?.count || 0),
        price: Number(pendingOrders?.totalPrice || 0),
      },
      totalDeliveredOrders: {
        total: deliveredCount,
        price: deliveredAmount,
      },
      totalCancelledOrders: {
        total: cancelledCount,
        price: cancelledAmount,
      },
    };
  }

  //

  async getOrderStatusDistribution(organizationId: string) {
    const queryRunner = await this.statusRepository
      .createQueryBuilder('status')
      .leftJoin('status.orders', 'orders')
      .where('orders.organizationId = :organizationId', { organizationId })
      .select('status.label', 'label')
      .addSelect('COALESCE(COUNT(orders.id), 0)', 'count')
      .groupBy('status.value')
      .addGroupBy('status.label')
      .getRawMany();
    const totalOrders = await this.statusRepository
      .createQueryBuilder('status')
      .leftJoin('status.orders', 'orders')
      .where('orders.organizationId = :organizationId', { organizationId })
      .select('COALESCE(COUNT(orders.id), 0)', 'count')
      .getRawOne();

    return [...queryRunner, { label: 'All', count: totalOrders?.count }];
  }
  async getDeliveryPartnerDistribution(organizationId: string) {
    const queryRunner = await this.deliveryPartnerRepository
      .createQueryBuilder('partner')
      .where('partner.organizationId = :organizationId', { organizationId })
      .leftJoin(
        'orders',
        'order',
        'order.currier = partner.id AND order.organizationId = :organizationId',
        {
          organizationId,
        },
      )
      .select('partner.partnerName', 'label')
      .addSelect('COUNT(order.id)', 'count')
      .groupBy('partner.partnerName')
      .getRawMany();

    console.log(queryRunner);
    return queryRunner;
  }

  async getTopSellingItems(organizationId: string) {
    const cacheDuration = 5 * 60 * 1000;
    const now = Date.now();
    const cached = topSellingCache[organizationId];
    const result = await this.orderproductsRepository
      .createQueryBuilder('op')
      .innerJoin('op.order', 'o')
      .where('o.organizationId = :organizationId', { organizationId })
      .select('op.productId', 'productId')
      .addSelect('COUNT(op.orderId)', 'orders')
      .addSelect('SUM(op.subtotal)', 'totalSales')
      .groupBy('op.productId')
      .orderBy('SUM(op.subtotal)', 'DESC')
      .limit(5)
      .getRawMany();

    const productIds = result.map((item) => item.productId);
    const products = await this.productRepository.findBy({
      id: In(productIds),
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const mapped = result.map((item) => ({
      label: productMap.get(item.productId)?.name ?? 'Unknown',
      orders: +item.orders,
      totalSales: parseFloat(item.totalSales).toFixed(2),
      url: productMap.get(item.productId)?.images?.[0]?.url ?? null,
    }));

    topSellingCache[organizationId] = {
      data: mapped,
      timestamp: now,
    };

    return mapped;
  }

  async getAgentDashboardSummary(organizationId: string, agentId: string) {
    if (!organizationId || !agentId) {
      throw new Error('organizationId and agentId are required');
    }

    const now = new Date();
    const todayStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const todayEnd = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    const weekStart = new Date(todayStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay()); // Sunday start

    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    );

    const baseQb = () =>
      this.orderRepository
        .createQueryBuilder('orders')
        .where('orders.organizationId = :organizationId', { organizationId })
        .andWhere('orders.agentId = :agentId', { agentId });

    const todayPromise = baseQb()
      .andWhere('orders.createdAt BETWEEN :start AND :end', {
        start: todayStart.toISOString(),
        end: todayEnd.toISOString(),
      })
      .select('COUNT(orders.id)', 'count')
      .addSelect('COALESCE(SUM(orders.totalPrice), 0)', 'revenue')
      .getRawOne();

    const weekPromise = baseQb()
      .andWhere('orders.createdAt >= :start', {
        start: weekStart.toISOString(),
      })
      .select('COUNT(orders.id)', 'count')
      .addSelect('COALESCE(SUM(orders.totalPrice), 0)', 'revenue')
      .getRawOne();

    const monthPromise = baseQb()
      .andWhere('orders.createdAt >= :start', {
        start: monthStart.toISOString(),
      })
      .select('COUNT(orders.id)', 'count')
      .addSelect('COALESCE(SUM(orders.totalPrice), 0)', 'revenue')
      .getRawOne();

    const totalPromise = baseQb()
      .select('COUNT(orders.id)', 'count')
      .addSelect('COALESCE(SUM(orders.totalPrice), 0)', 'revenue')
      .getRawOne();

    const statusBreakdownPromise = baseQb()
      .leftJoin('orders.status', 'status')
      .select('status.label', 'label')
      .addSelect('COUNT(orders.id)', 'count')
      .groupBy('status.label')
      .getRawMany();

    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
    const dailyTrendPromise = baseQb()
      .andWhere('orders.createdAt >= :start', {
        start: sevenDaysAgo.toISOString(),
      })
      .select("TO_CHAR(orders.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(orders.id)', 'count')
      .addSelect('COALESCE(SUM(orders.totalPrice), 0)', 'revenue')
      .groupBy("TO_CHAR(orders.createdAt, 'YYYY-MM-DD')")
      .orderBy("TO_CHAR(orders.createdAt, 'YYYY-MM-DD')", 'ASC')
      .getRawMany();

    const sixMonthsAgo = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
    );
    const monthlyTrendPromise = baseQb()
      .andWhere('orders.createdAt >= :start', {
        start: sixMonthsAgo.toISOString(),
      })
      .select("TO_CHAR(orders.createdAt, 'Mon YYYY')", 'month')
      .addSelect("TO_CHAR(orders.createdAt, 'YYYY-MM')", 'sortKey')
      .addSelect('COUNT(orders.id)', 'count')
      .addSelect('COALESCE(SUM(orders.totalPrice), 0)', 'revenue')
      .groupBy("TO_CHAR(orders.createdAt, 'Mon YYYY')")
      .addGroupBy("TO_CHAR(orders.createdAt, 'YYYY-MM')")
      .orderBy("TO_CHAR(orders.createdAt, 'YYYY-MM')", 'ASC')
      .getRawMany();

    const recentOrdersPromise = baseQb()
      .leftJoin('orders.customer', 'customer')
      .leftJoin('orders.status', 'status')
      .select('orders.id', 'id')
      .addSelect('orders.orderNumber', 'orderNumber')
      .addSelect('orders.totalPrice', 'totalPrice')
      .addSelect('orders.createdAt', 'createdAt')
      .addSelect('customer.customerName', 'customerName')
      .addSelect('status.label', 'statusLabel')
      .orderBy('orders.createdAt', 'DESC')
      .limit(10)
      .getRawMany();

    const [
      today,
      week,
      month,
      total,
      statusBreakdown,
      dailyTrend,
      monthlyTrend,
      recentOrders,
    ] = await Promise.all([
      todayPromise,
      weekPromise,
      monthPromise,
      totalPromise,
      statusBreakdownPromise,
      dailyTrendPromise,
      monthlyTrendPromise,
      recentOrdersPromise,
    ]);

    return {
      today: {
        orders: Number(today?.count) || 0,
        revenue: Number(today?.revenue) || 0,
      },
      thisWeek: {
        orders: Number(week?.count) || 0,
        revenue: Number(week?.revenue) || 0,
      },
      thisMonth: {
        orders: Number(month?.count) || 0,
        revenue: Number(month?.revenue) || 0,
      },
      totalOrdersServed: Number(total?.count) || 0,
      totalRevenue: Number(total?.revenue) || 0,
      statusBreakdown: statusBreakdown.map((s) => ({
        label: s.label,
        count: Number(s.count) || 0,
      })),
      dailyTrend: dailyTrend.map((d) => ({
        date: d.date,
        orders: Number(d.count) || 0,
        revenue: Number(d.revenue) || 0,
      })),
      monthlyTrend: monthlyTrend.map((m) => ({
        month: m.month,
        orders: Number(m.count) || 0,
        revenue: Number(m.revenue) || 0,
      })),
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        totalPrice: Number(o.totalPrice) || 0,
        createdAt: o.createdAt,
        customerName: o.customerName,
        status: o.statusLabel,
      })),
    };
  }

// Status lookup — DB-এর order_statuses টেবিল অনুযায়ী
private  ORDER_STATUSES = [
  { id: 1, name: 'Pending' },
  { id: 2, name: 'Approved' },
  { id: 3, name: 'Hold' },
  { id: 4, name: 'Cancel' },
  { id: 5, name: 'Store' },
  { id: 6, name: 'Packing' },
  { id: 7, name: 'In-transit' },
  { id: 8, name: 'Delivered' },
  { id: 9, name: 'Unreachable' },
  { id: 10, name: 'Returned' },
  { id: 11, name: 'Pending-Return' },
  { id: 12, name: 'Partial-Return' },
  { id: 13, name: 'Damage' },
];

async getAreaWiseDistribution(
  organizationId: string,
  level: 'division' | 'district' | 'thana' = 'division',
  period: string = 'month',
  startDate?: string,
  endDate?: string,
  dateField?: string,
  statusIds?: number[],   // 👈 নতুন param
) {
  if (!organizationId) {
    throw new Error('organizationId is required');
  }

  const now = new Date();
  let currentFrom: Date;
  let currentTo: Date = now;
  let previousFrom: Date;
  let previousTo: Date;

  if (startDate && endDate) {
    currentFrom = new Date(startDate + 'T00:00:00.000Z');
    currentTo = new Date(endDate + 'T23:59:59.999Z');
    const durationMs = currentTo.getTime() - currentFrom.getTime();
    previousTo = new Date(currentFrom.getTime() - 1);
    previousFrom = new Date(previousTo.getTime() - durationMs);
  } else {
    const p = (period || 'month').toLowerCase();
    if (p === 'day' || p === 'today') {
      currentFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      currentTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      previousFrom = new Date(currentFrom);
      previousFrom.setDate(previousFrom.getDate() - 1);
      previousTo = new Date(currentTo);
      previousTo.setDate(previousTo.getDate() - 1);
    } else if (p === 'week') {
      currentFrom = new Date(now);
      currentFrom.setDate(now.getDate() - 7);
      currentFrom.setHours(0, 0, 0, 0);
      previousTo = new Date(currentFrom.getTime() - 1);
      previousFrom = new Date(currentFrom);
      previousFrom.setDate(previousFrom.getDate() - 7);
    } else if (p === 'year') {
      currentFrom = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      previousFrom = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      previousTo = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    } else {
      currentFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      previousFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      previousTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    }
  }

  let areaColumn = "COALESCE(NULLIF(orders.receiverDivision, ''), NULLIF(customer.division, ''), 'Unspecified')";
  if (level === 'district') {
    areaColumn = "COALESCE(NULLIF(orders.receiverDistrict, ''), NULLIF(customer.district, ''), 'Unspecified')";
  } else if (level === 'thana') {
    areaColumn = "COALESCE(NULLIF(orders.receiverThana, ''), NULLIF(customer.thana, ''), 'Unspecified')";
  }

  const applyStatusFilter = (qb: any) => {
    if (statusIds && statusIds.length > 0) {
      qb.andWhere('orders.statusId IN (:...statusIds)', { statusIds });
    }
  };

  const orderDateField = this.resolveOrderDashboardDateField(dateField);
  const orderDateColumn = `orders.${orderDateField}`;

  // Current period area metrics
  const currentQb = this.orderRepository
    .createQueryBuilder('orders')
    .leftJoin('orders.customer', 'customer')
    .where('orders.organizationId = :organizationId', { organizationId })
    .andWhere(`${orderDateColumn} >= :currentFrom AND ${orderDateColumn} <= :currentTo`, {
      currentFrom,
      currentTo,
    })
    .select(`${areaColumn}`, 'area')
    .addSelect('COUNT(orders.id)', 'orderCount')
    .addSelect('COALESCE(SUM(orders.totalPrice), 0)', 'totalSales')
    .addSelect("COUNT(CASE WHEN orders.statusId = 8 THEN 1 END)", 'deliveredCount')
    .addSelect("COUNT(CASE WHEN orders.statusId IN (4, 10, 11, 12, 13) THEN 1 END)", 'cancelledCount');

  // প্রতিটা status-এর জন্য আলাদা count column যোগ করা হচ্ছে
  this.ORDER_STATUSES.forEach((s) => {
    currentQb.addSelect(`COUNT(CASE WHEN orders.statusId = ${s.id} THEN 1 END)`, `status_${s.id}`);
  });

  applyStatusFilter(currentQb);

  const currentResults = await currentQb
    .groupBy(areaColumn)
    .orderBy('COUNT(orders.id)', 'DESC')
    .limit(30)
    .getRawMany();

  // Previous period area metrics for trend / growth calculation
  const previousQb = this.orderRepository
    .createQueryBuilder('orders')
    .leftJoin('orders.customer', 'customer')
    .where('orders.organizationId = :organizationId', { organizationId })
    .andWhere(`${orderDateColumn} >= :previousFrom AND ${orderDateColumn} <= :previousTo`, {
      previousFrom,
      previousTo,
    })
    .select(`${areaColumn}`, 'area')
    .addSelect('COUNT(orders.id)', 'prevOrderCount')
    .addSelect('COALESCE(SUM(orders.totalPrice), 0)', 'prevSales');

  applyStatusFilter(previousQb);

  const previousResults = await previousQb.groupBy(areaColumn).getRawMany();

  const prevMap = new Map<string, { count: number; sales: number }>();
  previousResults.forEach((r) => {
    prevMap.set(r.area, {
      count: Number(r.prevOrderCount || 0),
      sales: Number(r.prevSales || 0),
    });
  });

  const totalOrdersInPeriod = currentResults.reduce(
    (sum, r) => sum + Number(r.orderCount || 0),
    0,
  );
  const totalSalesInPeriod = currentResults.reduce(
    (sum, r) => sum + Number(r.totalSales || 0),
    0,
  );

  const areas = currentResults.map((r) => {
    const currentOrders = Number(r.orderCount || 0);
    const currentSales = Number(r.totalSales || 0);
    const deliveredCount = Number(r.deliveredCount || 0);
    const cancelledCount = Number(r.cancelledCount || 0);
    const prev = prevMap.get(r.area) || { count: 0, sales: 0 };

    let orderGrowthRate = 0;
    if (prev.count > 0) {
      orderGrowthRate = ((currentOrders - prev.count) / prev.count) * 100;
    } else if (currentOrders > 0) {
      orderGrowthRate = 100;
    }

    const deliveryRate = currentOrders > 0 ? (deliveredCount / currentOrders) * 100 : 0;
    const shareOfTotal = totalOrdersInPeriod > 0 ? (currentOrders / totalOrdersInPeriod) * 100 : 0;

    // সবগুলো status-এর breakdown
    const statusBreakdown: Record<string, number> = {};
    this.ORDER_STATUSES.forEach((s) => {
      statusBreakdown[s.name] = Number(r[`status_${s.id}`] || 0);
    });

    return {
      area: r.area,
      orders: currentOrders,
      previousOrders: prev.count,
      sales: currentSales,
      previousSales: prev.sales,
      deliveredOrders: deliveredCount,
      cancelledOrders: cancelledCount,
      deliveryRate: Number(deliveryRate.toFixed(1)),
      orderGrowthRate: Number(orderGrowthRate.toFixed(1)),
      growthTrend: orderGrowthRate > 0 ? 'up' : orderGrowthRate < 0 ? 'down' : 'stable',
      sharePercentage: Number(shareOfTotal.toFixed(1)),
      statusBreakdown,   // 👈 { Pending: 2, Approved: 5, ... }
    };
  });

  const growingAreas = [...areas]
    .filter((a) => a.orderGrowthRate > 0)
    .sort((a, b) => b.orderGrowthRate - a.orderGrowthRate)
    .slice(0, 5);

  const decliningAreas = [...areas]
    .filter((a) => a.orderGrowthRate < 0)
    .sort((a, b) => a.orderGrowthRate - b.orderGrowthRate)
    .slice(0, 5);

  return {
    level,
    period,
    dateField: orderDateField,
    appliedStatusIds: statusIds || [],
    statusList: this.ORDER_STATUSES,   // 👈 frontend filter option বানাতে সুবিধা
    totalOrders: totalOrdersInPeriod,
    totalSales: totalSalesInPeriod,
    areas,
    topGrowingAreas: growingAreas,
    topDecliningAreas: decliningAreas,
  };
}

private resolveOrderDashboardDateField(dateField?: string): OrderDashboardDateField {
  const allowedDateFields: OrderDashboardDateField[] = [
    'createdAt',
    'intransitTime',
    'storeTime',
    'packingTime',
    'approvedTime',
    'courierUpdatedAt',
  ];

  return allowedDateFields.includes(dateField as OrderDashboardDateField)
    ? (dateField as OrderDashboardDateField)
    : 'createdAt';
}
}
