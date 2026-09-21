# DMS progress

- [x] Phase 0 — Audit: Done (2026-09-21); baseline suite is failing independently of DMS.
- [x] Phase 0.5 — Foundation: Done. Backend Git root confirmed as `D:\CBMNP\cbmnp-backend`; `dms: phase 0 audit` committed. Jest alias mapping and `test:dms` were added. New baseline: 1 suite/1 test passing; 23 suites/22 tests failing due to legacy dependency mocks and one stale v2 import. Auto-sync is active outside production and remains unchanged (deployment drift risk documented).
- [x] MVP 1 — Platform hardening: Done. Added DMS-only Jest coverage (3 passing tests), non-generic resource allowlisting, required-field checks, required organization header, and Governance audit events for create/update. `npm run build` passes. Full legacy baseline remains 1 suite/1 test passing and 23 suites/22 tests failing.
- [ ] MVP 2 — Master data and distributor onboarding: In progress. Region/area hierarchy and additive distributor KYC/agreement/deposit/status fields added; UI, approval workflow, SKU/UoM/price/VAT configuration remain.
- [ ] MVP 3 — Credit and inventory allocation: Not started.
- [ ] MVP 4 — Primary sales: Not started.
- [ ] MVP 5 — Secondary sales and collections: Not started.
- [ ] Phase 2 — Promotions, delivery, returns/claims: Not started.
- [ ] Phase 2 — SFA/mobile and incentives: Not started.
- [ ] Phase 3 — Reports, integrations, hardening: Not started.
