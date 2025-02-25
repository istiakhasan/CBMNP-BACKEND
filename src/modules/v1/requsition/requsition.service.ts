import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import { Order } from '../order/entities/order.entity';
import { Requisition } from './entities/requsition.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { Products } from '../order/entities/products.entity';
import { InventoryItem } from '../inventory/entities/inventoryitem.entity';
import paginationHelpers from '../../../helpers/paginationHelpers';
import { plainToInstance } from 'class-transformer';
import { ApiError } from '../../../middleware/ApiError';
import {  QueryRunner, DataSource } from 'typeorm';
import { OrdersLog } from '../order/entities/orderlog.entity';


@Injectable()
export class RequisitionService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Requisition)
    private requisitionRepository: Repository<Requisition>,

    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
    @InjectRepository(Products)
    private productsRepository: Repository<Products>,
    @InjectRepository(InventoryItem)
    private InventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(OrdersLog)
    private readonly orderLogsRepository: Repository<OrdersLog>,
  ) {}

  async createRequisition(createRequisitionDto: any,organizationId:string) {
    const { orderIds, userId } = createRequisitionDto;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
  
    try {
      const requisitionNumber = await this.generateRequisitionNumber();
  
      const orders = await this.orderRepository.find({
        where: { id: In(orderIds) },
        relations: ['requisition'],
      });
  
      if (orders.length !== orderIds.length) {
        throw new ApiError(HttpStatus.BAD_REQUEST, 'Some orders not found');
      }
  
      if (orders.some(order => !!order.requisitionId)) {
        throw new ApiError(HttpStatus.BAD_REQUEST, 'Some orders are already in a requisition');
      }
  
      const requisition = queryRunner.manager.create(Requisition, {
        requisitionNumber,
        orders,
        userId,
        totalOrders:orderIds?.length || 0,
        organizationId,
        orderIds
      });
  
      const savedRequisition = await queryRunner.manager.save(Requisition, requisition);
  
      const productUpdates = [];
      for (const order of orders) {
        const products = await this.productsRepository.find({
          where: { orderId: order.id },
        });
  
        for (const product of products) {
          const inventory = await this.inventoryRepository.findOne({
            where: { productId: product.productId },
          });
  
          const inventoryItem = await this.InventoryItemRepository.findOne({
            where: { productId: product.productId, locationId: order.locationId },
          });
  
          if (inventory) {
            productUpdates.push(
              queryRunner.manager.update(Inventory, { productId: product.productId }, {
                processing: inventory.processing + product.productQuantity,
                orderQue: inventory.orderQue - product.productQuantity,
              })
            );
          }
  
          if (inventoryItem) {
            productUpdates.push(
              queryRunner.manager.update(InventoryItem, { productId: product.productId, locationId: order.locationId }, {
                processing: inventoryItem.processing + product.productQuantity,
                orderQue: inventoryItem.orderQue - product.productQuantity,
              })
            );
          }
        }
      }
  
      await Promise.all(productUpdates);
  
      // Explicitly update order status
      await Promise.all(orders.map(order => 
        queryRunner.manager.update(Order, { id: order.id }, { statusId: 5,  requisition : savedRequisition })
      ));
      const orderLogs = orders.map((order, index) => ({
        orderId: order.id,
        agentId: "R-000000015",
        action: `Order Status changed to Packing and create requisition from ${order.status.label}`,
        previousValue: null,
      }));
    
      await this.orderLogsRepository.save(orderLogs);
  
      // Commit transaction
      await queryRunner.commitTransaction();
      return savedRequisition;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, error.message || 'Failed to create requisition');
    } finally {
      await queryRunner.release();
    }
  }
  


  async getAllRequisition(options, filterOptions, organizationId) {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelpers(options);

    const whereCondition: any = {};

    // Search functionality
    if (filterOptions?.searchTerm) {
        const searchTerm = `%${filterOptions.searchTerm}%`;
        whereCondition.OR = [
            { id: Like(searchTerm) },
            { requisitionNumber: Like(searchTerm) },
        ];
    }
    if (organizationId) {
      whereCondition.organizationId = organizationId
    }
    

    // Ensure sortOrder is either 'ASC' or 'DESC'
    const validSortOrder = sortOrder === 'DESC' ? 'DESC' : 'ASC';

    const result = await this.requisitionRepository.find({
        where: whereCondition,
        take: limit,
        skip: skip,
        order: {
            [sortBy]: validSortOrder,
        },
        relations: ['user'], 
        select: {
            id: true,
            createdAt: true,
            requisitionNumber: true,
            totalOrders: true,
            orderIds:true,

            user: {
                name: true,
            },
        },
    });
    // const finalResult=[]
    // for (let i = 0; i < result.length; i++) {
    //   const element = result[i];
    //   console.log(element.id);
    //   const abc=await this.orderRepository.find({
    //     where:{requisitionId:element.id}
    //   })

    //   finalResult.push({
    //     ...element,
    //     orders:abc
    //   })
      
    // }

    // Assuming you want to count total records
    const total = await this.requisitionRepository.count({
        where: whereCondition,
    });

    return {
        data: result,
        page,
        limit,
        total,
    };
}




  async getRequisitionWithOrders(id: string) {
    return this.requisitionRepository.findOne({
      where: { id },
      relations: ['orders'],
    });
  }




  async generateRequisitionNumber(): Promise<string> {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0'); // Ensures two-digit day
    const year = now.getFullYear();

    // Get the latest requisition for today
    const latestRequisition = await this.requisitionRepository.findOne({
        where: { requisitionNumber: Like(`REQ-${day}-${year}-%`) },
        order: { requisitionNumber: 'DESC' },
    });

    let sequenceNumber = 1;
    if (latestRequisition) {
        const lastNumber = parseInt(latestRequisition.requisitionNumber.split('-').pop() || '0', 10);
        sequenceNumber = lastNumber + 1;
    }

    return `REQ-${day}-${year}-${sequenceNumber.toString().padStart(4, '0')}`;
}

}
