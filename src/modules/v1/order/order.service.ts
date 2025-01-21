import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';

import { Products } from './entities/products.entity';
import paginationHelpers from 'src/helpers/paginationHelpers';
import { plainToInstance } from 'class-transformer';
import { generateUniqueOrderNumber } from 'src/util/genarateUniqueNumber';
import { Product } from '../product/entity/product.entity';
import { OrderStatus } from '../status/entities/status.entity';
import { Customers } from '../customers/entities/customers.entity';
import { In } from 'typeorm';
import { Users } from '../user/entities/user.entity';
@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>, 
    @InjectRepository(OrderStatus) private readonly statusRepository: Repository<OrderStatus>, 
    @InjectRepository(Customers) private readonly customerRepository: Repository<Customers>, 
    @InjectRepository(Users) private readonly usersRepository: Repository<Users>, 
  ) {}


  async createOrder(payload: Order) {
    const { customerId, receiverPhoneNumber, products, ...rest } = payload;

    if (!products || !products.length) {
      throw new Error('Order must include at least one product');
    }
      const   orderNumber = generateUniqueOrderNumber();
      const validatedProducts = await Promise.all(
        products.map(async (product:any) => {
          const existingProduct = await this.productRepository.findOne({where:{id:product.productId}});
          if (!existingProduct) {
            throw new NotFoundException(`Product with ID ${product.productId} not found`);
          }
          const subtotal = product.productQuantity * existingProduct.salePrice;
          return {
            productId: product.productId,
            productQuantity: product.productQuantity,
            productPrice: existingProduct.salePrice,
            subtotal,
          };
        })
      );

    return this.orderRepository.save({
      orderNumber,
      customerId,
      receiverPhoneNumber,
      products: validatedProducts,
      currier: payload.currier,
      orderSource: payload.orderSource,
      shippingCharge: payload.shippingCharge,
      totalPrice:Number(payload.shippingCharge)+Number(validatedProducts?.reduce((acc,b)=>acc+b.subtotal,0)),
      productValue:Number(validatedProducts?.reduce((acc,b)=>acc+b.subtotal,0)),
      ...rest
    });
  }
  






  async getOrders(options, filterOptions) {
    const { page, limit, sortBy, sortOrder, skip } = paginationHelpers(options);
    const queryBuilder = this.orderRepository.createQueryBuilder('orders');
  
    if (filterOptions?.searchTerm) {
      const searchTerm = `%${filterOptions.searchTerm.toString()}%`;
      queryBuilder.andWhere('orders.orderNumber LIKE :searchTerm', { searchTerm });
    }
  
    if (filterOptions?.statusId) {
      queryBuilder.andWhere('orders.statusId = :statusId', {
        statusId: filterOptions.statusId,
      });
    }
  
    queryBuilder
      .orderBy(`orders.${sortBy}`, sortOrder)
      .skip(skip)
      .take(limit);
  
    const [orders, total] = await queryBuilder.getManyAndCount();
    const statusIds = [...new Set(orders.map(order => order.statusId))];
    const statuses = await this.statusRepository.findBy({
      value: In(statusIds),
    });
    const customerIds = [...new Set(orders.map(order => order.customerId))];
    const customers = await this.customerRepository.findBy({
      customer_Id: In(customerIds),
    });

    const agentIds=[...new Set(orders.map(order=>order.agentId))]
    const agents=await this.usersRepository.findBy({
      userId:In(agentIds)
    })
    const statusMap = new Map(statuses.map(status => [status.value, status]));
    const customerMap = new Map(customers.map(customer => [customer.customer_Id, customer]));
    const agentMap = new Map(agents.map(order => [order.userId, order]));
   
    const modifiedData = orders.map(order => ({
      ...order,
      status: statusMap.get(order.statusId),
      customer: customerMap.get(order.customerId as any),
      agent: agentMap.get(order.agentId as any),
    }));
  
    return {
      data: plainToInstance(Order, modifiedData),
      total,
      page,
      limit,
    };
  }
  
  

  async getOrderById(orderId: number): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['products'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
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



 
  
}
