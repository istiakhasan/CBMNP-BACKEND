# DMS progress

- [x] Phase 0 — Audit: Done (2026-09-21); baseline suite is failing independently of DMS.
- [x] Phase 0.5 — Foundation: Done. Backend Git root confirmed as `D:\CBMNP\cbmnp-backend`. Jest alias mapping and `test:dms` isolated DMS tests from legacy suite.
- [x] MVP 1 — Platform hardening: Done. Added DMS-only Jest coverage, non-generic resource allowlisting, required-field checks, required organization header, and Governance audit events.
- [x] MVP 2 — Master data and distributor onboarding: Done. Added Region, Area, Territory, Distributor with KYC/agreements/deposit, approval/blocking workflow, and Retailer channels & credit limits.
- [x] MVP 3 — Credit and inventory allocation: Done. Added distributor inventory tracking (`dms_distributor_inventory`), retailer credit limit enforcement, and automatic inventory receipt/dispatch updates.
- [x] MVP 4 — Primary sales: Done. Implemented company→distributor primary indent orders with line items, approval, dispatch, and automatic distributor warehouse stock increment upon receipt.
- [x] MVP 5 — Secondary sales and collections: Done. Implemented secondary sales orders with dynamic multi-line item calculations (gross, discount, tax, net), status state machine, verified collections reducing retailer outstanding balance.
- [x] Phase 2 — Promotions, delivery, returns/claims: Done. Implemented trade schemes (`dms_schemes`), delivery trips (`dms_delivery_trips`, `dms_delivery_trip_orders`), and return claims (`dms_returns`, `dms_return_items`).
- [x] Phase 2 — SFA/mobile and incentives: Done. Implemented sales rep daily field attendance (`sfa_field_attendance`), field visit geo check-in/out (`sfa_field_visits`) with outcome recording, and sales targets & achievement calculations (`sfa_sales_targets`).
- [x] Phase 3 — Reports, dashboards and UI workspace: Done. Full production UI workspace in Next.js with comprehensive tabs, real-time KPI metrics, line-item order builders, and audit integration.

