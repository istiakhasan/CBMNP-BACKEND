BEGIN;
CREATE TABLE IF NOT EXISTS courier_cod_settlement_items (
  id uuid PRIMARY KEY, settlement_id uuid NOT NULL REFERENCES courier_settlements(id) ON DELETE RESTRICT,
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE RESTRICT, organization_id uuid NOT NULL,
  invoice_number varchar NOT NULL, tracking_code varchar NOT NULL, expected_cod numeric(12,2) NOT NULL,
  received_cod numeric(12,2) NOT NULL, shipping_charge numeric(12,2), status varchar NOT NULL DEFAULT 'Matched',
  adjustment_type varchar, adjustment_amount numeric(12,2) NOT NULL DEFAULT 0,
  adjustment_reason text, confirmed_by varchar, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_courier_cod_settlement_item_order_tracking ON courier_cod_settlement_items (organization_id, order_id, tracking_code);
CREATE INDEX IF NOT EXISTS idx_courier_cod_settlement_item_settlement ON courier_cod_settlement_items (settlement_id);
COMMIT;
