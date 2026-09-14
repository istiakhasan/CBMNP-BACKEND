"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const dotenv_1 = require("dotenv");
const garmentsInventory_entity_1 = require("./src/modules/v1/garments/entities/garmentsInventory.entity");
const garmentsInventoryLot_entity_1 = require("./src/modules/v1/garments/entities/garmentsInventoryLot.entity");
const garmentsAdjustment_entity_1 = require("./src/modules/v1/garments/entities/garmentsAdjustment.entity");
const garmentsMaterialIssue_entity_1 = require("./src/modules/v1/garments/entities/garmentsMaterialIssue.entity");
const garmentsPo_entity_1 = require("./src/modules/v1/garments/entities/garmentsPo.entity");
const garmentsBom_entity_1 = require("./src/modules/v1/garments/entities/garmentsBom.entity");
const garmentsBuyerOrder_entity_1 = require("./src/modules/v1/garments/entities/garmentsBuyerOrder.entity");
const garmentsBomItem_entity_1 = require("./src/modules/v1/garments/entities/garmentsBomItem.entity");
const garmentsPoItem_entity_1 = require("./src/modules/v1/garments/entities/garmentsPoItem.entity");
const garmentsInvoiceCounter_entity_1 = require("./src/modules/v1/garments/entities/garmentsInvoiceCounter.entity");
(0, dotenv_1.config)();
const categoryPrefixMap = {
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
function generateMissingItemCodes() {
    return __awaiter(this, void 0, void 0, function* () {
        const dataSource = new typeorm_1.DataSource({
            type: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT) || 5432,
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'cmb_np',
            synchronize: false,
            logging: false,
            entities: [
                garmentsInventory_entity_1.GarmentsInventory, garmentsInventoryLot_entity_1.GarmentsInventoryLot, garmentsAdjustment_entity_1.GarmentsInventoryAdjustment, garmentsMaterialIssue_entity_1.GarmentsMaterialIssue,
                garmentsPo_entity_1.GarmentsPO, garmentsBom_entity_1.GarmentsBOM, garmentsBuyerOrder_entity_1.GarmentsBuyerOrder, garmentsBomItem_entity_1.GarmentsBOMItem, garmentsPoItem_entity_1.GarmentsPOItem, garmentsInvoiceCounter_entity_1.GarmentsInvoiceCounter,
            ],
        });
        try {
            yield dataSource.initialize();
            console.log('✅ Database connected');
            const inventoryRepo = dataSource.getRepository(garmentsInventory_entity_1.GarmentsInventory);
            const itemsWithoutCode = yield inventoryRepo
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
            const categoryStats = {};
            for (const item of itemsWithoutCode) {
                try {
                    const prefix = categoryPrefixMap[item.itemCategory] || 'IN';
                    const year = item.createdAt ? item.createdAt.getFullYear() : new Date().getFullYear();
                    const lastCode = yield inventoryRepo
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
                    yield inventoryRepo.update(item.id, { itemCode });
                    updatedCount++;
                    if (!categoryStats[item.itemCategory]) {
                        categoryStats[item.itemCategory] = 0;
                    }
                    categoryStats[item.itemCategory]++;
                    console.log(`  ✅ ${item.itemName} → ${itemCode}`);
                }
                catch (err) {
                    console.error(`  ❌ Error generating code for ${item.itemName}:`, err);
                }
            }
            console.log(`\n✅ ${updatedCount} item codes generated successfully`);
            console.log('📊 Category-wise distribution:');
            for (const [cat, count] of Object.entries(categoryStats)) {
                const prefix = categoryPrefixMap[cat] || 'IN';
                console.log(`   ${prefix} (${cat}): ${count} items`);
            }
        }
        catch (error) {
            console.error('❌ Error:', error);
            process.exit(1);
        }
        finally {
            yield dataSource.destroy();
        }
    });
}
generateMissingItemCodes();
//# sourceMappingURL=generate-missing-item-codes.js.map