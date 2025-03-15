import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../product/entity/product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Inventory } from './entities/inventory.entity';
import { InventoryItem } from './entities/inventoryitem.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Inventory)
    private readonly inventoryRepository: Repository<Inventory>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    private readonly dataSource: DataSource,
  ) {}

  async addProductToInventory(createTransactionDto): Promise<Inventory & {type?:boolean}> {
    const { productId, quantity ,type,inventoryItems,expiredQuantity,wastageQuantity, organizationId} = createTransactionDto;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const product = await queryRunner.manager.findOne(Product, {
        where: { id: productId },
      });
      if (!product) {
        throw new Error('Product not found');
      }
      let inventory = await queryRunner.manager.findOne(Inventory, {
        where: { productId },
      });
      if (!inventory) {
        inventory = queryRunner.manager.create(Inventory, {
          productId,
          organizationId,
          stock: 0,
          expiredQuantity: 0,
          wastageQuantity: 0,
        });
        await queryRunner.manager.save(inventory);
      }
      if (inventoryItems && inventoryItems.length > 0) {
        const itemsToSave =await Promise.all(inventoryItems.map(async(item) =>
          {
            const isExist=await queryRunner.manager.findOne(InventoryItem,{
              where:{inventory:{id:inventory.id},productId:item?.productId,locationId:item?.locationId}
            })
            if(isExist){
              type?Number(isExist.quantity += Number(item.quantity)):isExist.quantity -= Number(item.quantity)
              type?Number(isExist.wastageQuantity += item.wastageQuantity):isExist.wastageQuantity -= item.wastageQuantity
              type?Number(isExist.expiredQuantity += item.expiredQuantity):isExist.expiredQuantity -= item.expiredQuantity

              const inventoryItemTransaction = queryRunner.manager.create('Transaction', {
                productId: item.productId,
                quantity: item.quantity,
                totalAmount: product.regularPrice * item.quantity,
                type: type ? 'IN' : 'OUT',
                inventoryId: inventory.productId,
                locationId: item.locationId,
              });
              await queryRunner.manager.save(inventoryItemTransaction);
              return isExist;
            }else{
              const a=   queryRunner.manager.create(InventoryItem, {
                ...item
              })
              const inventoryItemTransaction = queryRunner.manager.create('Transaction', {
                productId: item.productId,
                quantity: item.quantity,
                totalAmount: product.regularPrice * item.quantity,
                type: type ? 'IN' : 'OUT',
                inventoryId: inventory.productId,
                locationId: item.locationId,
              });
              await queryRunner.manager.save(inventoryItemTransaction);
              return {
                ...a,
                inventory:inventory
              }
            }
           
          }
          ));
        await queryRunner.manager.save(InventoryItem, itemsToSave);
      }
      type ? Number(inventory.stock += quantity) :inventory.stock -= quantity
      type? Number(inventory.expiredQuantity +=expiredQuantity):inventory.expiredQuantity -=expiredQuantity
      type ? Number(inventory.wastageQuantity +=wastageQuantity):inventory.wastageQuantity -=wastageQuantity
      const result=  await queryRunner.manager.save(inventory);
      const transaction = queryRunner.manager.create('Transaction', {
        productId,
        quantity,
        totalAmount: product.regularPrice * quantity,
        type: type?'IN':'OUT',
        inventoryId:inventory.productId
      });
      await queryRunner.manager.save(transaction);
      await queryRunner.commitTransaction();
      return result
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async loadInventory(organizationId) {

    const result=await this.inventoryRepository.find({
      where:{organizationId},
      // relations:['product','product.transactions']
      relations:[
        'product',
        'transactions',
        'inventoryItems',
        'inventoryItems.location',
      ]
    })

    return result
  }
  async loadInventoryByProductId(productId:string) {
    const result=await this.inventoryRepository.findOne({
      where:{productId:productId},
      relations:[
        'product',
        'inventoryItems',
        'inventoryItems.location',
      ],
      order:{createdAt:'DESC'}
    })

    return result
  }
  async loadInventoryByWarehouseProduct(query:any) {
    const {productId,locationId}=query
    const result=await this.inventoryItemRepository.findOne({
      where:{productId:productId,locationId:locationId},
      relations:[
        'product',
        'location',
      ],
      order:{createdAt:'DESC'}
    })

    return result
  }
  
}
