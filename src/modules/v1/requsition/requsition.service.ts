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

 async createRequisition(createRequisitionDto: any, organizationId: string) {
  const { orderIds, userId } = createRequisitionDto;
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const requisitionNumber = await this.generateRequisitionNumber();

    // ✅ Load all orders in one query
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

    // ✅ Create requisition
    const requisition = queryRunner.manager.create(Requisition, {
      requisitionNumber,
      orders,
      userId,
      totalOrders: orderIds.length,
      organizationId,
      orderIds,
    });

    const savedRequisition = await queryRunner.manager.save(Requisition, requisition);

    // ✅ Fetch all products for all orders in one query
    const allProducts = await this.productsRepository.find({
      where: { orderId: In(orderIds) },
    });

    // ✅ Aggregate product totals in-memory
    const productTotals = new Map<
      string,
      {
        totalQty: number;
        byLocation: Map<string, number>;
      }
    >();

    for (const product of allProducts) {
      const productId = product.productId;
      const qty = product.productQuantity;
      const locationId = product.orderId ? orders.find(o => o.id === product.orderId)?.locationId : null;

      if (!productTotals.has(productId)) {
        productTotals.set(productId, {
          totalQty: 0,
          byLocation: new Map<string, number>(),
        });
      }

      const totals = productTotals.get(productId)!;
      totals.totalQty += qty;

      if (locationId) {
        totals.byLocation.set(locationId, (totals.byLocation.get(locationId) || 0) + qty);
      }
    }

    // ✅ Fetch all inventories for involved products in one query
    const productIds = Array.from(productTotals.keys());
    const inventories = await this.inventoryRepository.find({
      where: { productId: In(productIds) },
    });
    const inventoryMap = new Map(inventories.map(inv => [inv.productId, inv]));

    // ✅ Fetch all inventory items for involved products in one query
    const inventoryItems = await this.InventoryItemRepository.find({
      where: { productId: In(productIds) },
    });
    const inventoryItemMap = new Map(
      inventoryItems.map(item => [`${item.productId}-${item.locationId}`, item]),
    );

    // ✅ Prepare bulk updates for inventories
    const inventoryUpdates = [];
    for (const [productId, totals] of productTotals.entries()) {
      const inventory = inventoryMap.get(productId);
      if (inventory) {
        inventory.processing += totals.totalQty;
        inventory.orderQue -= totals.totalQty;
        inventoryUpdates.push(inventory);
      }

      for (const [locationId, qty] of totals.byLocation.entries()) {
        const inventoryItem = inventoryItemMap.get(`${productId}-${locationId}`);
        if (inventoryItem) {
          inventoryItem.processing += qty;
          inventoryItem.orderQue -= qty;
          inventoryUpdates.push(inventoryItem);
        }
      }
    }

    // ✅ Save all updated inventories in bulk
    if (inventoryUpdates.length) {
      await queryRunner.manager.save(inventoryUpdates);
    }

    // ✅ Update all orders in bulk
    await queryRunner.manager.update(
      Order,
      { id: In(orderIds) },
      { statusId: 5, requisition: savedRequisition, storeTime: new Date() },
    );

    // ✅ Create logs in bulk
    const orderLogs = orders.map(order => ({
      orderId: order.id,
      agentId: userId,
      action: `Order Status changed to Store and create requisition from ${order.status?.label || ''}`,
      previousValue: null,
    }));
    await this.orderLogsRepository.save(orderLogs);

    // ✅ Commit transaction
    await queryRunner.commitTransaction();
    return savedRequisition;

  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw new ApiError(
      HttpStatus.INTERNAL_SERVER_ERROR,
      error.message || 'Failed to create requisition',
    );
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
  const rows = await this.requisitionRepository
    .createQueryBuilder('requisition')
    .leftJoin('requisition.orders', 'order')
    .leftJoin('requisition.user', 'user')
    .leftJoin('order.products', 'op')
    .leftJoin('op.product', 'product')
    .select([
      'requisition.id',
      'requisition.createdAt',
      'requisition.requisitionNumber',
      'order.orderNumber',
      'op.productQuantity',
      'product.id',
      'product.name',
      'product.weight',
      'product.unit',
      'user.name',
      // if you have available qty in inventory instead of product table
      'product.purchasePrice', // or join inventory if availableQty is there
    ])
    .where('requisition.id = :id', { id })
    .getRawMany();

  // Transform → group by product
  const grouped = rows.reduce((acc, row) => {
    const key = `${row.product_id}_${row.product_weight}_${row.product_unit}`;
    if (!acc[key]) {
      acc[key] = {
        productName: row.product_name,
        packSize: `${row.product_weight} ${row.product_unit}`, // ← build pack size here
        availableQty: row.product_purchasePrice ?? 0, // replace with inventory.availableQty if needed
        orders: [],
        totalQty: 0,
      };
    }
    acc[key].orders.push({
      orderNumber: row.order_orderNumber,
      qty: row.op_productQuantity,
    });
    acc[key].totalQty += row.op_productQuantity;
    return acc;
  }, {} as Record<string, any>);
 console.log(rows,"row");
  return {
    requisitionNumber: rows[0]?.requisition_requisitionNumber,
    prepairedBy: rows[0]?.user_name,
    createdAt: rows[0]?.requisition_createdAt,
    products: Object.values(grouped),
  };
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
