# DMS roadmap

## MVP

1. **Platform hardening** — replace generic mutation endpoints with DTOs/resource-specific services, decimal handling, organization/role guard integration, audit events, and a real migration workflow. Risk: current baseline tests are broken; establish reliable DMS test harness first.
2. **Distribution master data and onboarding** — hierarchy, outlets, distributor KYC/agreement/security deposit/status, SKU/UoM/pack, price/VAT configuration; reuse Product, Warehouse, Organization and Governance foundations.
3. **Distributor credit and inventory allocation** — transactional credit exposure, distributor warehouse/stock ledger, batch allocation through existing `ProductBatch` and FEFO; do not duplicate inventory logic.
4. **Primary sales** — approved company→distributor order, allocation, challan/invoice, finance integration through existing service interfaces.
5. **Secondary sales and collections** — transactional order lines/pricing, invoice/delivery states, retailer credit and reconciled collections.

## Phase 2

6. Schemes/promotions and budget utilization.
7. Delivery trips, vehicle/rep assignment, POD.
8. Returns, expiry/damage and claims with credit-note integration.
9. SFA beat plans, attendance/GPS, outlet audit, offline sync/mobile APIs.
10. Targets, achievements and incentives.

## Phase 3

11. Operational dashboards/reports and Excel/PDF exports.
12. Notifications, third-party APIs, Mushak-ready invoice data.
13. Security/performance hardening, reconciliation jobs, observability and acceptance testing.

Each phase must add focused unit/feature tests, run the full suite, update all DMS docs, and be committed as `dms: <phase name>`. The high-risk dependency order is master data → credit/inventory → primary/secondary sale → finance/collection; workflow UI must follow stable service contracts.
