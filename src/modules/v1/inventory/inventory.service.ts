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
    private readonly dataSource: DataSource,
  ) {}

  async addProductToInventory(createTransactionDto): Promise<Inventory & {type?:boolean}> {
    const { productId, quantity ,type,inventoryItems} = createTransactionDto;
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
          stock: 0
        });
        console.log(inventory,"===============");
        await queryRunner.manager.save(inventory);
        if (inventoryItems && inventoryItems.length > 0) {
          const itemsToSave = inventoryItems.map((item) =>
          {
            const a=   queryRunner.manager.create(InventoryItem, {
              ...item
            })
            return {
              ...a,
              inventory:inventory
            }
          }
          );
          await queryRunner.manager.save(InventoryItem, itemsToSave);
        }
      }
      console.log(inventory);
      throw new Error('adsfasd')
      type ? inventory.stock += quantity :inventory.stock -= quantity
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

  async loadInventory() {
    const result=await this.inventoryRepository.find({
      // relations:['product','product.transactions']
      relations:[
        // 'product',
        'transactions',
        'inventoryItems'
      ]
    })

    return result
  }
  
}
