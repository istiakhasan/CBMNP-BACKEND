-- Production-safe order-list indexes for PostgreSQL.
--
-- Run this file with a database role that can create indexes, outside a
-- transaction (for example: psql "$DATABASE_URL" -f this-file.sql).
-- CREATE INDEX CONCURRENTLY keeps reads and writes available, and these are
-- additive structures only: no rows, tables, or existing indexes are changed.
-- On a 200M+ row table, run one statement at a time during a quieter period
-- and monitor pg_stat_progress_create_index before starting the next one.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_orders_org_created_at_id"
  ON "orders" ("organizationId", "createdAt" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_orders_org_status_created_at_id"
  ON "orders" ("organizationId", "statusId", "createdAt" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_orders_org_location_created_at_id"
  ON "orders" ("organizationId", "locationId", "createdAt" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_orders_org_courier_created_at_id"
  ON "orders" ("organizationId", "currier", "createdAt" DESC, "id" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_products_product_order"
  ON "products" ("productId", "orderId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_order_product_returns_order"
  ON "order_product_returns" ("orderId");
