import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
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
import { ApiError } from 'src/middleware/ApiError';
import { PaymentHistory } from './entities/paymentHistory.entity';
import { OrdersLog } from './entities/orderlog.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { InventoryItem } from '../inventory/entities/inventoryitem.entity';
import {  QueryRunner, DataSource } from 'typeorm';
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
  ) {}

  async createOrder(payload: Order,organizationId:string) {
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

    if(!organizationId || !await this.organizationRepository.findOne({where:{id:organizationId}})){
      throw new ApiError(HttpStatus.BAD_REQUEST,'You are not authorized ')
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
    const lastUserId=lastOrder?.invoiceNumber?.substring(3)
     const currentId =lastUserId || (0).toString().padStart(4, '0');
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
      invoiceNumber:incrementedId,
      organizationId,
      ...rest,
    });

    await this.orderLogsRepository.save({
      orderId:result.id,
      agentId:payload.agentId,
      action:'The Order created',
      previousValue:null,
    })

    for (const item of products) {
      const { productId, productQuantity } = item;
      const existingInventory = await this.inventoryRepository.findOne({ where: { productId } });
      if (!existingInventory?.orderQue) {
        await this.inventoryRepository.update({ productId }, { orderQue: 0 });
      }
      await this.inventoryRepository.increment(
        { productId },
        "orderQue",
        productQuantity
      );
    
      const existingInventoryItem = await this.InventoryItemItemRepository.findOne({
        where: { productId, locationId: rest?.locationId },
      });
    

      // 
      if(!existingInventoryItem){
       const newInventoryItems= await this.InventoryItemItemRepository.create({
          locationId:rest?.locationId,
          productId:productId,
          quantity:0,
          orderQue:productQuantity,
          inventoryId:existingInventory.id
        })

        await this.InventoryItemItemRepository.save(newInventoryItems)
      }else{
        if (!existingInventoryItem?.orderQue) {
          await this.InventoryItemItemRepository.update(
            { productId, locationId: rest?.locationId },
            { orderQue: 0 }
          );
        }
      
        await this.InventoryItemItemRepository.increment(
          { productId, locationId: rest?.locationId },
          "orderQue",
          productQuantity
        );
      }
     
    }
    return result;
  }

  async getOrders(options, filterOptions,organizationId) {

    const { page, limit, sortBy, sortOrder, skip } = paginationHelpers(options);
    const queryBuilder = this.orderRepository.createQueryBuilder('orders')
                                             .where('orders.organizationId = :organizationId', { organizationId });

    if (filterOptions?.searchTerm) {
      const searchTerm = `%${filterOptions.searchTerm.toString()}%`;
      queryBuilder.andWhere('orders.orderNumber LIKE :searchTerm', {
        searchTerm,
      });
    }

    if (filterOptions?.statusId) {
      queryBuilder.andWhere('orders.statusId = :statusId', {
        statusId: filterOptions.statusId,
      });
    }
    if (filterOptions?.locationId) {
      queryBuilder.andWhere('orders.locationId = :locationId', {
        locationId: filterOptions.locationId,
      });
    }

    queryBuilder.orderBy(`orders.${sortBy}`, sortOrder).skip(skip).take(limit);

    const [orders, total] = await queryBuilder.getManyAndCount();
    const statusIds = [...new Set(orders.map((order) => order.statusId))];
    const statuses = await this.statusRepository.findBy({
      value: In(statusIds),
    });
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
      relations: ['paymentHistory', 'comments', 'comments.user'],
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

    if (!customer) {
      throw new NotFoundException(
        `Customer with ID ${order.customerId} not found`,
      );
    }

    return {
      ...order,
      products: products || [],
      customer,
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
  
    const existingOrder = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!existingOrder) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Order does not exist');
    }
  
    if (!products || products.length === 0) {
      throw new Error('Order must include at least one product');
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
  
       await this.productsRepository.delete({orderId});
       validatedProducts.push({
        orderId,
        productId: product.productId,
        productQuantity: product.productQuantity,
        productPrice: existingProduct.salePrice,
        subtotal,
      });
    }
    if (validatedProducts.length > 0) {
      await this.productsRepository.save(validatedProducts);
    }
    await this.orderLogsRepository.save({
      orderId: orderId,
      agentId: data.agentId,
      action: `Order updated. Products and other information (e.g., shipping charge, customer details) have been modified.`,
      previousValue: existingOrder ? JSON.stringify(existingOrder) : null,
      newValue: JSON.stringify(data),
    });
  

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
    return await this.orderRepository.findOne({ where: { id: orderId }, relations: ['products'] });
  }



  // update payment
  async addPayment(orderId:number,data:PaymentHistory){
   
   const isOrderExist=await this.orderRepository.findOne({where:{id:orderId}})
   if(!isOrderExist){
    throw new ApiError(HttpStatus.BAD_REQUEST,'Order is not exist ')
   }
   const previousHistory=await this.paymentHistoryRepository.find({
    where:{orderId:orderId}
   })

   const insertPayment =await this.paymentHistoryRepository.save(data)
   if(!insertPayment){
    throw new ApiError(HttpStatus.BAD_REQUEST,'Payment is not added ')
   }


    const totalPaidAmount = [...previousHistory,data].reduce(
      (total, payment) => total + Number(payment.paidAmount),
      0,
    );
    const grandTotal =( Number(isOrderExist.productValue) + Number(isOrderExist.shippingCharge)) - Number(isOrderExist.discount);
    const totalReceivableAmount = grandTotal - totalPaidAmount;
    await this.orderRepository.update({
    id:orderId  
    },{
      totalPaidAmount,
      totalReceiveAbleAmount:totalReceivableAmount,
      paymentStatus:data?.paymentStatus
      })
      await this.orderLogsRepository.save({
        orderId: orderId,
        agentId: data.userId,
        action: `A payment with status '${data.paymentStatus}' was added using the '${data.paymentMethod}' method.`,
        previousValue: previousHistory?.length>0?JSON.stringify(previousHistory[0]):null,
        newValue:JSON.stringify(data)
      });
     return  this.orderRepository.findOne({where:{id:orderId}})
  }




  async changeStatusBulk(orderIds: number[], data: Order) {

   
    const orders = await this.orderRepository.find({
      where: { id: In(orderIds) },
      relations: ['status'],
    });
  
    if (orders.length !== orderIds.length) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Some orders do not exist');
    }
  
      if(data?.statusId===7){
        console.log("======================================");
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
      
              const inventoryItem = await this.InventoryItemItemRepository.findOne({
                where: { productId: product.productId, locationId: order.locationId },
              });
      
              if (inventory) {
                productUpdates.push(
                  queryRunner.manager.update(Inventory, { productId: product.productId }, {
                    processing: inventory.processing - product.productQuantity,
                    stock: inventory.stock - product.productQuantity,
                  })
                );
              }
      
              if (inventoryItem) {
                productUpdates.push(
                  queryRunner.manager.update(InventoryItem, { productId: product.productId, locationId: order.locationId }, {
                    processing: inventoryItem.processing - product.productQuantity,
                    quantity: inventoryItem.quantity - product.productQuantity,
                  })
                );
              }
            }
          }
      
          await Promise.all(productUpdates);
      
          // Commit transaction
          await queryRunner.commitTransaction();
        } catch (error) {
          await queryRunner.rollbackTransaction();
          throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, error.message || 'Failed to update inventory');
        } finally {
          await queryRunner.release();
        }
      }
  
    await this.orderRepository.update({ id: In(orderIds) }, data);
  
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
  
  
  async getOrdersLogs(orderId:number){
     const isExist=await this.orderRepository.findOne({where:{id:orderId}})
     if(!isExist){
      throw new ApiError(HttpStatus.BAD_REQUEST,'Order is not exist')
     }
    return await this.orderLogsRepository.find({where:{orderId:orderId},relations:['updatedBy'],select:{
      updatedBy:{
        name:true
      }
    },order:{createdAt:'DESC'}})
  }
}
