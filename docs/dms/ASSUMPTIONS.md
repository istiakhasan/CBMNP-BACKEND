# DMS assumptions

1. `organizationId` is the tenant/company boundary. Branch-specific DMS behavior will use the existing Governance branch model after its supported interface is confirmed.
2. Bangladesh currency is BDT and monetary values must be persisted/processed as fixed-scale decimals; no JavaScript floating-point arithmetic will be used for business calculations.
3. Existing Product, Warehouse, Inventory Operations, Finance/Accounting, Governance, Permission, and Notification modules are the integration boundaries; DMS will not write their tables directly.
4. `product_batches` is the starting point for batch/expiry capability, subject to confirming its service API and transaction semantics in the implementation phase.
5. TypeORM auto-sync is enabled in `src/database/database.module.ts` whenever `NODE_ENV !== production`; a second legacy database module has `synchronize: false`. There is no discovered migration runner, while the current DMS schema is a standalone additive SQL script. DMS changes will remain additive and compatible with the active auto-sync behavior; this is a deployment risk because non-production schemas drift without replayable migrations. Old SQL will not be edited.
6. The broken pre-existing suite must be recorded but does not authorize unrelated test repairs during a DMS phase unless they directly block DMS verification.
