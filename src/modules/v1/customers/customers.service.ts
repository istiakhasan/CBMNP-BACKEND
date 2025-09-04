import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Like, Repository } from 'typeorm';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Customers } from './entities/customers.entity';
import { plainToInstance } from 'class-transformer';
import { ApiError } from '../../../middleware/ApiError';
import { Order } from '../order/entities/order.entity';
import { OrderStatus } from '../status/entities/status.entity';
import paginationHelpers from 'src/helpers/paginationHelpers';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customers)
    private readonly customerRepository: Repository<Customers>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderStatus)
    private readonly orderStatusRepository: Repository<OrderStatus>,
  ) {}

  async createCustomer(data: Customers) {
    const existingCustomer = await this.customerRepository.findOne({
      where: { customerPhoneNumber: data.customerPhoneNumber },
    });
    // if (existingCustomer) {
    //   throw new ApiError(400, 'Number already exist ');
    // }
    const lastCustomer = await this.customerRepository
      .createQueryBuilder('customer')
      .orderBy('customer.createdAt', 'DESC')
      .getOne();
    const lastCustomerId = lastCustomer?.customer_Id?.substring(2);
    const currentId = lastCustomerId || (0).toString().padStart(9, '0'); //000000
    let incrementedId = (parseInt(currentId) + 1).toString().padStart(9, '0');
    if (data?.customerType === 'NON_PROBASHI') {
      incrementedId = `B-${incrementedId}`;
    }
    if (data?.customerType === 'PROBASHI') {
      incrementedId = `P-${incrementedId}`;
    }
    const result = await this.customerRepository.save({
      ...data,
      customer_Id: incrementedId,
    });

    return result;
  }

  async getAllCustomers(options, filterOptions,organizationId) {
    const page = Number(options.page || 1);
    const limit = Number(options.limit || 10);
    const skip = (page - 1) * limit;
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = (options.sortOrder || 'DESC').toUpperCase();
    const queryBuilder = this.customerRepository
      .createQueryBuilder('customers')
      .take(limit)
      .skip(skip)
      .orderBy(`customers.${sortBy}`, sortOrder);
    if (filterOptions?.searchTerm) {
      const searchTerm = `%${filterOptions.searchTerm.toLowerCase()}%`;

      queryBuilder.andWhere(
        '(LOWER(customers.customerName) LIKE :searchTerm OR LOWER(customers.customer_Id) LIKE :searchTerm OR LOWER(customers.customerPhoneNumber) LIKE :searchTerm)',
        { searchTerm },
      );
    }
    if (filterOptions?.filterByCustomerType) {
      queryBuilder.andWhere('customers.customerType = :customerType', {
        customerType: filterOptions.filterByCustomerType,
      });
   
    }
       queryBuilder.andWhere('customers.organizationId = :organizationId', {
        organizationId: organizationId,
      });
    const [data, total] = await queryBuilder.getManyAndCount();
    const modifyData = plainToInstance(Customers, data);

    return {
      data: modifyData,
      total,
      page,
      limit,
    };
  }

  async getOrdersCount(customerId: string) {
    const [groupedOrders, totalOrders, statuses] = await Promise.all([
      this.ordersRepository
        .createQueryBuilder('orders')
        .where('orders.customerId = :customerId', { customerId })
        .leftJoin('orders.status', 'status')
        .select(['status.label AS label', 'COUNT(orders.id) AS count'])
        .groupBy('status.label')
        .getRawMany(),

      this.ordersRepository
        .createQueryBuilder('orders')
        .where('orders.customerId = :customerId', { customerId })
        .select('COUNT(*) AS total')
        .getRawOne(),

      this.orderStatusRepository.find(),
    ]);

    return [
      ...statuses.map((status) => ({
        label: status.label,
        count: parseInt(
          groupedOrders.find((g) => g.label === status.label)?.count || '0',
          10,
        ),
      })),
      { label: 'Total', count: parseInt(totalOrders?.total || '0', 10) },
    ];
  }
  async getOrderByid(customerId: string) {
    const result = await this.customerRepository.findOne({
      where: { customer_Id: customerId },
    });

    return result;
  }
  async updateCustomerById(id: number, payload) {
    await this.customerRepository.update({ id }, payload);

    return this.customerRepository.findOne({
      where: { id },
    });
  }

async getCustomerRetentionReports(options, filterOptions, organizationId) {
  const { page, limit, sortBy, sortOrder, skip } = paginationHelpers(options);
  let utcStartDate: Date;
  let utcEndDate: Date;

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
        0
      )
    );

    const localEndDate = new Date(filterOptions.endDate);
    utcEndDate = new Date(
      Date.UTC(
        localEndDate.getFullYear(),
        localEndDate.getMonth(),
        localEndDate.getDate(),
        23,
        59,
        59,
        999
      )
    );
  } else {
    const today = new Date();
    utcStartDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));
    utcEndDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999));
  }

  let curierIds = filterOptions?.currier;
  if (curierIds && !Array.isArray(curierIds)) {
    curierIds = [curierIds];
  }

  // Main customer query
  const query = this.customerRepository
    .createQueryBuilder('customer')
    .leftJoin(
      'customer.orders',
      'o',
      'o.createdAt BETWEEN :startDate AND :endDate',
      { startDate: utcStartDate, endDate: utcEndDate }
    )
    .where('customer.organizationId = :organizationId', { organizationId });

  // Apply courier filter if provided
  if (curierIds?.length) {
    query.andWhere('o.currier IN (:...curierIds)', { curierIds });
  }

  query
    .groupBy('customer.id')
    .select([
      'customer.id AS id',
      'customer.customer_Id AS customerId',
      'customer.customerPhoneNumber AS customerPhoneNumber',
      'customer.customerType AS customerType',
      'customer.customerName AS customerName',
      'COUNT(o.id) AS orderCount',
      'COALESCE(SUM(o.totalPrice), 0) AS totalSpent',
      'MIN(o.createdAt) AS firstOrderDate',
      'MAX(o.createdAt) AS lastOrderDate',
    ])
    .orderBy(
      sortBy ? `customer.${sortBy}` : 'customer.createdAt',
      sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
    )
    .offset(skip)
    .limit(limit);

  const data = await query.getRawMany();

  // Calculate overall totals with the same date and courier filters, excluding orders without a customer
  const overallTotalsQuery = this.ordersRepository
    .createQueryBuilder('o')
    .select('COUNT(o.id)', 'overallTotalOrders')
    .addSelect('COALESCE(SUM(o.totalPrice), 0)', 'overallTotalSpent')
    .where('o.organizationId = :organizationId', { organizationId })
    .andWhere('o.customerId IS NOT NULL')
    .andWhere('o.createdAt BETWEEN :startDate AND :endDate', { startDate: utcStartDate, endDate: utcEndDate });

  // Apply courier filter to overall totals as well
  if (curierIds?.length) {
    overallTotalsQuery.andWhere('o.currier IN (:...curierIds)', { curierIds });
  }

  const overallTotals = await overallTotalsQuery.getRawOne();

  return {
    data,
    total: data.length,
    page,
    limit,
    overallTotalOrders: Number(overallTotals.overallTotalOrders),
    overallTotalSpent: Number(overallTotals.overallTotalSpent),
  };
}







}
