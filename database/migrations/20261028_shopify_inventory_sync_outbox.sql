CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS shopify_inventory_sync_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" varchar NOT NULL, "warehouseId" varchar NOT NULL, "organizationId" varchar NOT NULL,
  quantity integer, status varchar NOT NULL DEFAULT 'PENDING', attempts integer NOT NULL DEFAULT 0,
  "lastError" text, "nextRetryAt" timestamp, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_shopify_inventory_sync_outbox_retry" ON shopify_inventory_sync_outbox (status, "nextRetryAt");
