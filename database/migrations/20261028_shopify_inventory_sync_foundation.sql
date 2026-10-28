-- Shopify/ERP inventory parity foundation. Apply this migration before
-- deploying the corresponding application release in production.
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS "pendingReservedQuantity" integer NOT NULL DEFAULT 0;

ALTER TABLE "inventoryItems"
  ADD COLUMN IF NOT EXISTS "pendingReservedQuantity" integer NOT NULL DEFAULT 0;

ALTER TABLE warehouse
  ADD COLUMN IF NOT EXISTS "shopifyLocationId" varchar;

ALTER TABLE product
  ADD COLUMN IF NOT EXISTS "shopifyInventoryItemId" varchar;

CREATE INDEX IF NOT EXISTS "IDX_warehouse_shopifyLocationId"
  ON warehouse ("shopifyLocationId")
  WHERE "shopifyLocationId" IS NOT NULL;
