import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { GarmentsInventory } from './src/modules/v1/garments/entities/garmentsInventory.entity';
import { GarmentsInventoryLot } from './src/modules/v1/garments/entities/garmentsInventoryLot.entity';
import { GarmentsInventoryAdjustment } from './src/modules/v1/garments/entities/garmentsAdjustment.entity';
import { GarmentsMaterialIssue } from './src/modules/v1/garments/entities/garmentsMaterialIssue.entity';
import { GarmentsPO } from './src/modules/v1/garments/entities/garmentsPo.entity';
import { GarmentsBOM } from './src/modules/v1/garments/entities/garmentsBom.entity';
import { GarmentsBuyerOrder } from './src/modules/v1/garments/entities/garmentsBuyerOrder.entity';
import { GarmentsBOMItem } from './src/modules/v1/garments/entities/garmentsBomItem.entity';
import { GarmentsPOItem } from './src/modules/v1/garments/entities/garmentsPoItem.entity';
import { GarmentsInvoiceCounter } from './src/modules/v1/garments/entities/garmentsInvoiceCounter.entity';

config();

const categoryPrefixMap: Record<string, string> = {
  FABRICS: 'MF',
  fabric: 'MF',
  SEWING_TRIMS: 'TR',
  sewing_trims: 'TR',
  trims: 'TR',
  trim: 'TR',
  FINISHING_TRIMS: 'FT',
  finishing_trims: 'FT',
  ACCESSORIES: 'AC',
  accessories: 'AC',
  PACKAGING: 'PK',
  packaging: 'PK',
  FINISHED_GOODS: 'FG',
  finished_goods: 'FG',
  OTHERS: 'OT',
  others: 'OT',
  SAMPLE: 'SM',
  sample: 'SM',
  SWATCH: 'SW',
  swatch: 'SW',
};

async function generateMissingItemCodes() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cmb_np',
    synchronize: false,
    logging: false,
    entities: [
      GarmentsInventory, GarmentsInventoryLot, GarmentsInventoryAdjustment, GarmentsMaterialIssue,
      GarmentsPO, GarmentsBOM, GarmentsBuyerOrder, GarmentsBOMItem, GarmentsPOItem, GarmentsInvoiceCounter,
    ],
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected');

    const inventoryRepo = dataSource.getRepository(GarmentsInventory);

    // Find all items without itemCode
    const itemsWithoutCode = await inventoryRepo
      .createQueryBuilder('inv')
      .where('inv.itemCode IS NULL')
      .orderBy('inv.createdAt', 'ASC')
      .getMany();

    console.log(`📦 Found ${itemsWithoutCode.length} items without itemCode`);

    if (itemsWithoutCode.length === 0) {
      console.log('✅ All items already have itemCode');
      return;
    }

    let updatedCount = 0;
    const categoryStats: Record<string, number> = {};

    for (const item of itemsWithoutCode) {
      try {
        const prefix = categoryPrefixMap[item.itemCategory] || 'IN';
        const year = item.createdAt ? item.createdAt.getFullYear() : new Date().getFullYear();

        // Find the last used code for this prefix in this year
        const lastCode = await inventoryRepo
          .createQueryBuilder('inv')
          .where('inv.itemCode LIKE :pattern', {
            pattern: `${prefix}-${year}-%`,
          })
          .andWhere('inv.id != :excludeId', { excludeId: item.id })
          .orderBy('inv.createdAt', 'DESC')
          .getOne();

        let nextSeq = 1;
        if (lastCode && lastCode.itemCode) {
          const parts = lastCode.itemCode.split('-');
          if (parts.length >= 3 && parts[0] === prefix) {
            const seqStr = parts[2];
            const parsed = parseInt(seqStr, 10);
            if (!isNaN(parsed)) {
              nextSeq = parsed + 1;
            }
          }
        }

        const itemCode = `${prefix}-${year}-${nextSeq.toString().padStart(6, '0')}`;

        await inventoryRepo.update(item.id, { itemCode });
        updatedCount++;

        if (!categoryStats[item.itemCategory]) {
          categoryStats[item.itemCategory] = 0;
        }
        categoryStats[item.itemCategory]++;

        console.log(`  ✅ ${item.itemName} → ${itemCode}`);
      } catch (err) {
        console.error(`  ❌ Error generating code for ${item.itemName}:`, err);
      }
    }

    console.log(`\n✅ ${updatedCount} item codes generated successfully`);
    console.log('📊 Category-wise distribution:');
    for (const [cat, count] of Object.entries(categoryStats)) {
      const prefix = categoryPrefixMap[cat] || 'IN';
      console.log(`   ${prefix} (${cat}): ${count} items`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

generateMissingItemCodes();
