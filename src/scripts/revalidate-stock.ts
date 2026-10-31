import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DatabaseModule } from '../database/database.module';
import { InventoryModule } from '../modules/v1/inventory/inventory.module';
import { InventoryService } from '../modules/v1/inventory/inventory.service';

/**
 * Rebuilds only the inventory counters derived from currently active orders.
 * It never changes physical quantity, procurement, orders, product mappings,
 * or stock transactions. Each run is transactional and stores an audit row.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, InventoryModule],
})
class RevalidateStockModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(RevalidateStockModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const dataSource = app.get(DataSource);
    const inventory = app.get(InventoryService);
    const configuredOrganizationId = process.env.REVALIDATE_STOCK_ORGANIZATION_ID;
    const organizations: Array<{ id: string; name: string | null }> = configuredOrganizationId
      ? await dataSource.query('SELECT id, name FROM organizations WHERE id = $1', [configuredOrganizationId])
      : await dataSource.query('SELECT id, name FROM organizations ORDER BY "createdAt" ASC');

    if (!organizations.length) {
      throw new Error('No organization found. Set REVALIDATE_STOCK_ORGANIZATION_ID in .env if needed.');
    }
    if (!configuredOrganizationId && organizations.length > 1) {
      throw new Error(
        'More than one organization exists. Set REVALIDATE_STOCK_ORGANIZATION_ID in .env to protect other organizations.',
      );
    }

    console.log(`Revalidating order counters for ${organizations.length} organization(s)...`);
    for (const organization of organizations) {
      const result = await inventory.reconcileOrderCounters(
        organization.id,
        'REBUILD_ORDER_COUNTERS',
        // This command is not associated with a logged-in ERP user. Keep the
        // optional UUID audit field null instead of writing a text marker.
        undefined,
      );
      console.log(`${organization.name || organization.id}: master=${result.masterChanges}, warehouse=${result.warehouseChanges}, audit=${result.auditId}`);
    }
    console.log('Done. Physical stock, procurement data, orders, and stock transactions were not changed.');
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('revalidatestock failed:', error?.message || error);
  process.exitCode = 1;
});
