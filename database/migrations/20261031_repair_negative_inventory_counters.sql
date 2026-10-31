-- Repair historical counter underflows. Queue counters must never reduce
-- sellable stock below the physical warehouse quantity.
UPDATE inventory
SET
  "orderQue" = GREATEST(0, COALESCE("orderQue", 0)),
  "hoildQue" = GREATEST(0, COALESCE("hoildQue", 0)),
  processing = GREATEST(0, COALESCE(processing, 0)),
  "pendingReservedQuantity" = GREATEST(0, COALESCE("pendingReservedQuantity", 0));

UPDATE "inventoryItems"
SET
  "orderQue" = GREATEST(0, COALESCE("orderQue", 0)),
  "hoildQue" = GREATEST(0, COALESCE("hoildQue", 0)),
  processing = GREATEST(0, COALESCE(processing, 0)),
  "pendingReservedQuantity" = GREATEST(0, COALESCE("pendingReservedQuantity", 0));
