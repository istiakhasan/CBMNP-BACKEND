import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';

import { Products } from './entities/products.entity';
import paginationHelpers from 'src/helpers/paginationHelpers';
import { plainToInstance } from 'class-transformer';
import { generateUniqueOrderNumber } from 'src/util/genarateUniqueNumber';
import { Product } from '../product/entity/product.entity';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>, 
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
      queryBuilder.andWhere(
        '(orders.orderNumber LIKE :searchTerm OR customers.name LIKE :searchTerm)',
        { searchTerm }
      );
    }

     // Role Filter
     if (filterOptions?.statusId) {
      queryBuilder.andWhere('orders.statusId = :statusId', {
        statusId: filterOptions.statusId,
      });
    }
  
    queryBuilder
      .leftJoinAndSelect('orders.customer', 'customer')
      .leftJoin('orders.status', 'status') // Change to leftJoin
      .addSelect(['status.label', 'status.value'])  // Select only the fields you need
      .orderBy(`orders.${sortBy}`, sortOrder)
      .skip(skip)
      .take(limit);
  
    const [data, total] = await queryBuilder.getManyAndCount();
    const modifyData = plainToInstance(Order, data);
  
    return {
      data: modifyData,
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
