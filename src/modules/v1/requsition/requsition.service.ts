import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../order/entities/order.entity';
import { Requisition } from './entities/requsition.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { Products } from '../order/entities/products.entity';
import { InventoryItem } from '../inventory/entities/inventoryitem.entity';



@Injectable()
export class RequisitionService {
  constructor(
    @InjectRepository(Requisition)
    private requisitionRepository: Repository<Requisition>,

    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Inventory)
    private inventoryRepository: Repository<Inventory>,
    @InjectRepository(Products)
    private ProductsRepository: Repository<Products>,
    @InjectRepository(InventoryItem)
    private InventoryItemRepository: Repository<InventoryItem>,
  ) {}

  async createRequisition(createRequisitionDto: any) {
    const { requisitionNumber, orderIds } = createRequisitionDto;
    const orders = await this.orderRepository.find({
      where: {
        id: In(orderIds),
      },
  
    });
    if (orders.length !== orderIds.length) {
      throw new Error('Some orders not found');
    }
    const requisition = this.requisitionRepository.create({ requisitionNumber, orders });

    const savedRequisition = await this.requisitionRepository.save(requisition);
    
    for (const order of orders) {
      order.requisition = savedRequisition;
      order.statusId=5
     const products=  await this.ProductsRepository.find({where:{orderId:order?.id}})

     for (const item of products) {
      const findInventory = await this.inventoryRepository.findOne({
        where: { productId: item?.productId },
      });
      const findInventoryItem = await this.InventoryItemRepository.findOne({
        where: { productId: item?.productId,locationId:order?.locationId },
      });
    
      if (findInventory) {
        await this.inventoryRepository.update(
          { productId: item?.productId },
          { processing: item?.productQuantity + findInventory.processing ,orderQue:findInventory.orderQue - item.productQuantity}
        );
      }
      if (findInventoryItem) {
        await this.InventoryItemRepository.update(
          { productId: item?.productId,locationId:order?.locationId },
          { processing: item?.productQuantity + findInventory.processing ,orderQue:findInventory.orderQue - item.productQuantity}
        );
      }
    }
    
    }

    // return [];
    return savedRequisition;
  }

  async getRequisitionWithOrders(id: string) {
    return this.requisitionRepository.findOne({
      where: { id },
      relations: ['orders'],
    });
  }
}
