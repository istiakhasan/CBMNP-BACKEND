-- Audit snapshots make a counter rebuild traceable and reversible by an
-- operator. No physical stock, orders, procurement, or ledger rows are kept
-- in this table or modified by the reconciliation command.
CREATE TABLE IF NOT EXISTS inventory_counter_reconciliation_audits (
  id uuid PRIMARY KEY,
  "organizationId" varchar NOT NULL,
  "executedById" varchar,
  "beforeSnapshot" jsonb NOT NULL,
  "afterSnapshot" jsonb NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_inventory_counter_reconciliation_audits_org_created"
  ON inventory_counter_reconciliation_audits ("organizationId", "createdAt" DESC);
