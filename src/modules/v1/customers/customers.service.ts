import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { HttpStatus, Injectable } from '@nestjs/common'
import { Customers } from './entities/customers.entity';
import { plainToInstance } from 'class-transformer';
import { ApiError } from '../../../middleware/ApiError';
import { Order } from '../order/entities/order.entity';
import { OrderStatus } from '../status/entities/status.entity';


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
      if (existingCustomer) {
        throw new ApiError(400,"Number already exist ")
      }
    const lastCustomer = await this.customerRepository
      .createQueryBuilder('customer')
      .orderBy('customer.created_at', 'DESC') 
      .getOne();
      const lastCustomerId=lastCustomer?.customer_Id?.substring(2)
       const currentId =lastCustomerId || (0).toString().padStart(9, '0'); //000000
       let incrementedId = (parseInt(currentId) + 1).toString().padStart(9, '0');
       if(data?.customerType==="NON_PROBASHI"){
           incrementedId = `B-${incrementedId}`;
       }
       if(data?.customerType==="PROBASHI"){
           incrementedId = `P-${incrementedId}`;
       }
       const result=await this.customerRepository.save({...data,customer_Id:incrementedId})

    return result
  }
 
async getAllCustomers(options, filterOptions) {
    const page = Number(options.page || 1);
    const limit = Number(options.limit || 10);
    const skip = (page - 1) * limit;
    const sortBy = options.sortBy || 'created_at';
    const sortOrder = (options.sortOrder || 'DESC').toUpperCase();
    const queryBuilder = this.customerRepository.createQueryBuilder('customers')
        .take(limit)
        .skip(skip)
        .orderBy(`customers.${sortBy}`, sortOrder);
    if (filterOptions?.searchTerm) {
        const searchTerm = `%${filterOptions.searchTerm}%`;
        queryBuilder.andWhere(
            '(customers.customerName LIKE :searchTerm OR customers.customer_Id LIKE :searchTerm OR customers.customerPhoneNumber LIKE :searchTerm)',
            { searchTerm }
        );
    }
    if (filterOptions?.filterByCustomerType) {
        queryBuilder.andWhere('customers.customerType = :customerType', {
            customerType: filterOptions.filterByCustomerType,
        });
    }
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
      count: parseInt(groupedOrders.find((g) => g.label === status.label)?.count || '0', 10),
    })),
    { label: 'Total', count: parseInt(totalOrders?.total || '0', 10) },
  ];
}
async getOrderByid(customerId: string) {
  const result = await this.customerRepository.findOne({where:{customer_Id:customerId}})

  return result
}
}
