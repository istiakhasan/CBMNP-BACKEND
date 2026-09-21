# DMS gap analysis

Evidence paths are relative to the repository root. Status reflects working end-to-end behavior, not merely an entity or screen.

| # | Scope area | Status | Evidence and gap |
|---:|---|---|---|
| 1 | Master data | Partial | Territory/distributor/retailer/route CRUD: `sfa-dms.entity.ts`, `SfaDmsWorkspace.tsx`. No region/area hierarchy, dealer profiles, UoM/pack, price list, VAT/AIT. |
| 2 | Distributor onboarding and credit | Partial | Distributor has contact, credit limit and active flag. No KYC, agreement, deposit, approvals, blocked reason, exposure calculation. |
| 3 | Primary sales | Missing | No company→distributor order/invoice/challan/AR/GL flow. |
| 4 | Secondary sales | Partial | Order header and items exist, but only header CRUD is wired; no items workflow, invoice, delivery, pre-sales/van/direct sales. |
| 5 | Inventory | Missing | Product batches exist elsewhere (`inventory-operations/entities/product-batch.entity.ts`) but DMS has no stock integration, FEFO, in-transit or distributor stock. |
| 6 | Pricing, schemes, promotions | Missing | No DMS price/scheme entities or service. |
| 7 | Delivery and logistics | Missing | No trips, assignment, POD, or DMS status flow. |
| 8 | Returns and claims | Missing | No DMS returns/claims. Existing order return entities are not integrated. |
| 9 | Collections and accounts | Partial | `sfa_collections` and UI support methods including bKash/Nagad. No verification, reconciliation, ageing, ledger, credit control or accounting posting. |
| 10 | SFA and mobile APIs | Partial | Visits, route assignment and check-in coordinate columns exist. No beat plans, attendance, GPS enforcement, photos, offline sync API or mobile client implementation. |
| 11 | Targets and incentives | Partial | `sfa_sales_targets` stores three targets. No achievement or incentive calculation. |
| 12 | Approvals and RBAC | Missing | Governance supports generic approval/audit foundations, but `SfaDmsModule` does not use permissions, approval rules, or audit logging. |
| 13 | Reports and dashboards | Partial | Dashboard supplies counts and today collection. No required operational reports, KPI calculations or exports. |
| 14 | Notifications and integrations | Missing | Notification module exists, but no DMS events, REST mobile contract, or Mushak data. |
| 15 | Audit, security, multi-branch/company | Partial | All entities are organization-scoped. No DMS audit trail, per-role guard, branch support, or workflow security. |
