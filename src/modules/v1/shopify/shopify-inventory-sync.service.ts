import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { LessThanOrEqual, Repository } from 'typeorm';
import { InventoryItem } from '../inventory/entities/inventoryitem.entity';
import { Product } from '../product/entity/product.entity';
import { Warehouse } from '../warehouse/entities/warehouse.entity';
import { Shopify } from './entities/shopify.entity';
import { ShopifyInventorySyncOutbox } from './entities/shopify-inventory-sync.entity';

/** ERP is the inventory source of truth; Shopify receives absolute quantities. */
@Injectable()
export class ShopifyInventorySyncService {
  private readonly logger = new Logger(ShopifyInventorySyncService.name);

  constructor(
    @InjectRepository(InventoryItem) private readonly items: Repository<InventoryItem>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Warehouse) private readonly warehouses: Repository<Warehouse>,
    @InjectRepository(Shopify) private readonly shops: Repository<Shopify>,
    @InjectRepository(ShopifyInventorySyncOutbox) private readonly outbox: Repository<ShopifyInventorySyncOutbox>,
  ) {}

  /** Audits the request first, then makes an immediate delivery attempt. */
  async sync(productId: string, warehouseId: string, organizationId: string) {
    const event = await this.outbox.save(this.outbox.create({
      productId, warehouseId, organizationId, status: 'PENDING', attempts: 0,
    }));
    return this.deliver(event);
  }

  private async deliver(event: ShopifyInventorySyncOutbox) {
    await this.outbox.update(event.id, {
      status: 'PROCESSING', attempts: event.attempts + 1, lastError: null, nextRetryAt: null,
    });
    try {
      const [item, product, warehouse, shop] = await Promise.all([
        this.items.findOne({ where: { productId: event.productId, locationId: event.warehouseId } }),
        this.products.findOne({ where: { id: event.productId, organizationId: event.organizationId } }),
        this.warehouses.findOne({ where: { id: event.warehouseId, organizationId: event.organizationId } }),
        this.shops.findOne({ where: { organizationId: event.organizationId } }),
      ]);
      if (!item) throw new Error('ERP warehouse inventory item is missing');
      if (!product?.shopifyInventoryItemId) throw new Error('Shopify inventory item mapping is missing');
      if (!warehouse?.shopifyLocationId) throw new Error('Shopify location mapping is missing');
      if (!shop?.accessToken || !shop?.domain) throw new Error('Shopify shop connection is missing');

      const quantity = Math.max(0,
        Number(item.quantity || 0) - Number(item.pendingReservedQuantity || 0) - Number(item.orderQue || 0)
        - Number(item.processing || 0) - Number(item.hoildQue || 0) - Number(item.wastageQuantity || 0) - Number(item.expiredQuantity || 0),
      );
      const gid = (type: string, value: string) => value.startsWith('gid://') ? value : `gid://shopify/${type}/${value}`;
      const query = `mutation SetInventory($input: InventorySetQuantitiesInput!, $key: String!) {
        inventorySetQuantities(input: $input) @idempotent(key: $key) { userErrors { message field } }
      }`;
      const response = await axios.post(
        `https://${shop.domain}/admin/api/2026-10/graphql.json`,
        { query, variables: { key: event.id, input: { name: 'available', reason: 'correction', quantities: [{ inventoryItemId: gid('InventoryItem', product.shopifyInventoryItemId), locationId: gid('Location', warehouse.shopifyLocationId), quantity, changeFromQuantity: null }] } } },
        { headers: { 'X-Shopify-Access-Token': shop.accessToken }, timeout: 15000 },
      );
      const errors = response.data?.data?.inventorySetQuantities?.userErrors || response.data?.errors;
      if (errors?.length) throw new Error(errors.map((x: any) => x.message).join(', '));
      await this.outbox.update(event.id, { status: 'SUCCESS', quantity, lastError: null, nextRetryAt: null });
      this.logger.log(`Shopify stock set product=${event.productId} warehouse=${event.warehouseId} quantity=${quantity}`);
      return { quantity, eventId: event.id };
    } catch (error: any) {
      const attempts = event.attempts + 1;
      const retryMinutes = Math.min(60, Math.max(1, 2 ** Math.min(attempts, 6)));
      await this.outbox.update(event.id, {
        status: 'FAILED', lastError: String(error?.message || error).slice(0, 2000),
        nextRetryAt: new Date(Date.now() + retryMinutes * 60_000),
      });
      this.logger.error(`Shopify stock sync failed event=${event.id}: ${error?.message || error}`);
      return { failed: true, eventId: event.id };
    }
  }

  /** Retries failures with exponential backoff; audit records are retained. */
  @Cron('*/1 * * * *')
  async retryFailed() {
    const due = await this.outbox.find({
      where: { status: 'FAILED', nextRetryAt: LessThanOrEqual(new Date()) },
      order: { createdAt: 'ASC' }, take: 100,
    });
    for (const event of due) await this.deliver(event);
  }

  /** Safety net for missed webhooks and Shopify-side manual changes. */
  @Cron('*/15 * * * *')
  async reconcileAll() {
    const rows = await this.items.createQueryBuilder('item')
      .innerJoin(Warehouse, 'warehouse', 'warehouse.id = item.locationId')
      .select(['item.productId AS "productId"', 'item.locationId AS "locationId"', 'warehouse.organizationId AS "organizationId"'])
      .where('warehouse."shopifyLocationId" IS NOT NULL')
      .getRawMany();
    for (const row of rows) await this.sync(row.productId, row.locationId, row.organizationId);
  }
}
