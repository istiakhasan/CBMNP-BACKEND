import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Like, Repository } from 'typeorm';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Customers, CustomerType } from './entities/customers.entity';
import { plainToInstance } from 'class-transformer';
import { ApiError } from '../../../middleware/ApiError';
import { Order } from '../order/entities/order.entity';
import { OrderStatus } from '../status/entities/status.entity';
import paginationHelpers from 'src/helpers/paginationHelpers';
import { AddressBook } from './entities/addressbook.entity';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customers)
    private readonly customerRepository: Repository<Customers>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderStatus)
    private readonly orderStatusRepository: Repository<OrderStatus>,
    @InjectRepository(AddressBook)
    private readonly addressRepository: Repository<AddressBook>,
  ) {}

  async createCustomer(
  data: Customers & {
    receiverName: string;
    receiverPhone: string;
    relationship: string;
    receiverDivision: string;
    receiverDistrict: string;
    receiverThana: string;
    receiverAddress: string;
  },query:{addressBook:boolean}
) {
  // 1️⃣ Check if customer exists
  const existingCustomer = await this.customerRepository.findOne({
    where: { customerPhoneNumber: data.customerPhoneNumber },
  });
  if (existingCustomer) {
    throw new ApiError(400, 'Number already exists');
  }

  // 2️⃣ Generate customer ID
  let prefix = '';
  if (data.customerType === CustomerType.NonProbashi) {
    prefix = 'B-';
  } else if (data.customerType === CustomerType.Probashi) {
    prefix = 'P-';
  }

  const lastCustomer = await this.customerRepository
    .createQueryBuilder('customer')
    // .where('customer.organizationId = :orgId', { orgId: data.organizationId })
    .andWhere('customer.customer_Id LIKE :prefix', { prefix: `${prefix}%` })
    .orderBy('customer.customer_Id', 'DESC')
    .getOne();

  let newNumber = 1;
  if (lastCustomer?.customer_Id) {
    const lastNumber = parseInt(lastCustomer.customer_Id.replace(prefix, ''), 10);
    if (!isNaN(lastNumber)) newNumber = lastNumber + 1;
  }

  const incrementedId = `${prefix}${newNumber.toString().padStart(8, '0')}`;

  // 3️⃣ Save customer
  const savedCustomer = await this.customerRepository.save({
    ...data,
    customer_Id: incrementedId,
  });
  console.log(query,"check");
  if(!!query?.addressBook){
  // 4️⃣ Create default address entry
  let addressPayload: any = {
    customerId: savedCustomer.id,
    isDefault: true,
  };
  if (data.customerType === CustomerType.NonProbashi) {
    addressPayload = {
      ...addressPayload,
      receiverName: data.customerName,
      receiverPhoneNumber: data.customerPhoneNumber,
      division: data.division,
      district: data.district,
      thana: data.thana,
      address: data.address,
    };
  } else if (data.customerType === CustomerType.Probashi) {
    addressPayload = {
      ...addressPayload,
      receiverName: data.receiverName,
      receiverPhoneNumber: data.receiverPhone,
      relationship: data.relationship,
      division: data.receiverDivision,
      district: data.receiverDistrict,
      thana: data.receiverThana,
      address: data.receiverAddress,
    };
  }

  await this.addressRepository.save(addressPayload);
  }


  // 5️⃣ Load customer with addresses
  const customerWithAddresses = await this.customerRepository.findOne({
    where: { id: savedCustomer.id },
    relations: ['addresses']
  });

  return customerWithAddresses;
}


  async getAllCustomers(options, filterOptions, organizationId) {
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

    const [customers, total] = await queryBuilder.getManyAndCount();

    // 🔹 Extract all customer IDs
    const customerIds = customers.map((c) => c.id);

    // 🔹 Fetch addresses in one query
    const addresses = await this.addressRepository.find({
      where: { customerId: In(customerIds) },
    });

    // 🔹 Map addresses back to customers
    const dataWithAddresses = customers.map((customer) => {
      return {
        ...customer,
        addresses: addresses.filter((a) => a.customerId === customer.id),
      };
    });

    return {
      data: dataWithAddresses,
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
const [customer, lastOrders] = await Promise.all([
  this.customerRepository.findOne({
    where: { customer_Id: customerId },
    relations: ['addresses'],
  }),
  this.ordersRepository.find({
    where: { customer: { customer_Id: customerId } },
    relations:['status'],
    order: { createdAt: 'DESC' },
    take: 5,
  }),
]);

if (customer) {
  customer.orders = lastOrders;
}

  if (!customer) return null;

  const { total, delivered, cancelled, ongoing } = await this.customerRepository
    .createQueryBuilder('customer')
    .leftJoin('customer.orders', 'order')
    .where('customer.customer_Id = :customerId', { customerId })
    .select([
      'COUNT(order.id) as total',
      "SUM(CASE WHEN order.statusId = 8 THEN 1 ELSE 0 END) as delivered",
      "SUM(CASE WHEN order.statusId = 4 THEN 1 ELSE 0 END) as cancelled",
      "SUM(CASE WHEN order.statusId NOT IN (1, 7, 8, 10) THEN 1 ELSE 0 END) as ongoing",
    ])
    .getRawOne<{ total: string; delivered: string; cancelled: string; ongoing: string }>();

  const totalOrders = Number(total) || 0;
  const deliveredOrders = Number(delivered) || 0;
  const cancelledOrders = Number(cancelled) || 0;
  const ongoingOrders = Number(ongoing) || 0;

  const successRatio =
    totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;

  const successRatioStrict =
    deliveredOrders + cancelledOrders > 0
      ? (deliveredOrders / (deliveredOrders + cancelledOrders)) * 100
      : 0;

  return {
    ...customer,
    totalOrders,
    deliveredOrders,
    cancelledOrders,
    ongoingOrders,
    successRatio,
    successRatioStrict,
  };
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
          0,
        ),
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
          999,
        ),
      );
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
      );
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
      );
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
        { startDate: utcStartDate, endDate: utcEndDate },
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
        sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
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
      .andWhere('o.createdAt BETWEEN :startDate AND :endDate', {
        startDate: utcStartDate,
        endDate: utcEndDate,
      });
    if (curierIds?.length) {
      overallTotalsQuery.andWhere('o.currier IN (:...curierIds)', {
        curierIds,
      });
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
  async topCustomersReports(organizationId: string, options, filterOptions) {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelpers(options);

    // ---------------- Date Filters ----------------
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
          0,
        ),
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
          999,
        ),
      );
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
      );
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
      );
    }

    // ---------------- Optimized Single Query ----------------
    const customersQuery = this.customerRepository
      .createQueryBuilder('customer')
      .leftJoin(
        'customer.orders',
        'order',
        `
        order.organizationId = :organizationId
        AND order.createdAt BETWEEN :startDate AND :endDate
        ${filterOptions?.statusId ? 'AND order.statusId = :statusId' : ''}
      `,
        {
          organizationId,
          startDate: utcStartDate,
          endDate: utcEndDate,
          ...(filterOptions?.statusId && { statusId: filterOptions.statusId }),
        },
      )
      .select([
        'customer.id AS id',
        'customer.customerName AS customerName',
        'customer.customerPhoneNumber AS customerPhoneNumber',
        'customer.customerAdditionalPhoneNumber AS customerAdditionalPhoneNumber',
        'customer.address AS address',
        'customer.customerType AS customerType',
        'customer.country AS country',
        'customer.customer_Id AS customer_Id',
      ])
      .where('customer.organizationId = :organizationId', { organizationId })
      .addSelect('COUNT(order.id)', 'total_orders')
      .addSelect('COALESCE(SUM(order.totalPrice), 0)', 'total_value')
      .addSelect('COUNT(*) OVER()::int', 'total_customers')
      .addSelect('SUM(COUNT(order.id)) OVER()::int', 'grand_total_orders')
      .addSelect(
        'SUM(SUM(order.totalPrice)) OVER()::float',
        'grand_total_value',
      )
      .groupBy('customer.id')
      .orderBy(
        sortBy === 'totalOrders' ? 'total_orders' : 'total_value',
        sortOrder,
      )
      .offset(skip)
      .limit(limit);

    const rows = await customersQuery.getRawMany();

    // ---------------- Final Response ----------------
    return {
      data: rows.map((r) => ({
        id: r.id,
        customername: r.customername,
        customerphonenumber: r.customerphonenumber,
        customerAdditionalPhoneNumber: r.customeradditionalphonenumber,
        address: r.address,
        customertype: r.customertype,
        country: r.country,
        customer_id: r.customer_id,
        total_orders: parseInt(r.total_orders, 10),
        total_value: parseFloat(r.total_value),
      })),
      totalCustomers: parseInt(rows[0]?.total_customers ?? '0', 10),
      grandTotalOrders: parseInt(rows[0]?.grand_total_orders ?? '0', 10),
      grandTotalValue: parseFloat(rows[0]?.grand_total_value ?? '0'),
      page,
      limit,
    };
  }

  async createAddressBook(data) {
    const result = await this.addressRepository.save(data);
    return result;
  }
}
