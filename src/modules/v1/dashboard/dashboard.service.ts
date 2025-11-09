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
type CachedTopSelling = {
  data: {
    label: string;
    orders: number;
    totalSales: string;
  }[];
  timestamp: number;
};

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
  ) {
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .select([
        "TO_CHAR(order.createdAt, 'Mon') AS month",
        "TO_CHAR(order.createdAt, 'MM') AS monthNumber",
        'COUNT(order.id) as totalOrders',
        'SUM(order.totalPrice) as totalRevenue',
      ])
      .where('EXTRACT(YEAR FROM order.createdAt) = :year', { year })
      .groupBy('month, monthNumber')
      .orderBy("TO_CHAR(order.createdAt, 'MM')::int");

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
  async getDashboardSummary(organizationId: string) {
    if (!organizationId) {
      throw new Error('organizationId is required');
    }

    // --- Define all promises ---
    const totalClientPromise = this.customerRepository
      .createQueryBuilder('customers')
      .select('COUNT(customers.id)', 'count')
      .where('customers.organizationId = :organizationId', { organizationId })
      .getRawOne();

    const totalAgentPromise = this.userRepository
      .createQueryBuilder('users')
      .select('COUNT(users.id)', 'count')
      .where('users.organizationId = :organizationId', { organizationId })
      .andWhere('users.role = :role', { role: 'user' })
      .getRawOne();

    const totalPendingOrdersPromise = this.orderRepository
      .createQueryBuilder('orders')
      .select('COUNT(orders.id)', 'count')
      .where('orders.organizationId = :organizationId', { organizationId })
      .andWhere('orders.statusId = :statusId', { statusId: '1' })
      .addSelect('SUM(orders.totalPrice)', 'totalPrice')
      .getRawOne();

    const totalDeliveredOrdersPromise = this.orderRepository
      .createQueryBuilder('orders')
      .select('COUNT(orders.id)', 'count')
      .where('orders.organizationId = :organizationId', { organizationId })
      .andWhere('orders.statusId = :statusId', { statusId: '8' })
      .addSelect('SUM(orders.totalPrice)', 'totalPrice') // Assuming the column name is 'totalPrice'
      .getRawOne();

    const totalCancelledOrdersPromise = this.orderRepository
      .createQueryBuilder('orders')
      .select('COUNT(orders.id)', 'count')
      .where('orders.organizationId = :organizationId', { organizationId })
      .andWhere('orders.statusId = :statusId', { statusId: '4' })
      .addSelect('SUM(orders.totalPrice)', 'totalPrice')
      .getRawOne();

    const topCustomersPromise = this.customerRepository
      .createQueryBuilder('customer')
      .where('customer.organizationId = :organizationId', { organizationId })
      .leftJoin('customer.orders', 'order')
      .select([
        'customer.id AS id',
        'customer.customerName AS name',
        'customer.customerPhoneNumber AS phone',
        'customer.customer_Id AS customerId',
        'COUNT(order.id) AS orderCount',
        'SUM(order.totalPrice) AS price',
      ])
      .groupBy('customer.id')
      .orderBy('orderCount', 'DESC')
      .limit(5)
      .getRawMany();

    // --- Await all promises in parallel ---
    const [
      totalClient,
      totalAgent,
      totalPendingOrders,
      totalDeliveredOrders,
      totalCancelledOrders,
      topCustomers,
    ] = await Promise.all([
      totalClientPromise,
      totalAgentPromise,
      totalPendingOrdersPromise,
      totalDeliveredOrdersPromise,
      totalCancelledOrdersPromise,
      topCustomersPromise,
    ]);

    return {
      totalClient: Number(totalClient.count),
      totalAgent: Number(totalAgent.count),
      totalPendingOrders: {
        total: Number(totalPendingOrders.count),
        price: Number(totalPendingOrders.totalPrice),
      },
      totalDeliveredOrders: {
        total: Number(totalDeliveredOrders.count),
        price: Number(totalDeliveredOrders.totalPrice),
      },
      totalCancelledOrders: {
        total: Number(totalCancelledOrders.count),
        price: Number(totalCancelledOrders.totalPrice),
      },
      topCustomers,
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

  const productIds = result.map(item => item.productId);
  const products = await this.productRepository.findBy({ id: In(productIds) });
  const productMap = new Map(products.map(p => [p.id, p]));

  const mapped = result.map(item => ({
    label: productMap.get(item.productId)?.name ?? "Unknown",
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



}
