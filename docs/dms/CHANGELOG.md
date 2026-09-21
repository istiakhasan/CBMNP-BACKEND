# DMS changelog

## 2026-09-21 — Phase 0 audit

- Documented current SFA/DMS implementation, scope gaps, dependency roadmap, progress state, and implementation assumptions.
- No application or database module code was changed.

## 2026-09-21 — Phase 0.5 foundation

- Confirmed the backend child repository root and committed the Phase 0 audit.
- Added Jest resolution for `src/*` imports and the `npm run test:dms` isolation target.
- Recorded the post-configuration legacy baseline; no legacy tests or application code were changed.

## 2026-09-21 — MVP 1 platform hardening

- Added DMS create/update audit records through `GovernanceService`.
- Required the organization header and blocked the unsafe generic `orderItems` endpoint.
- Added minimum required-field validation for supported resources and DMS-only test helpers/tests.

## DMS API notes

- `GET /api/v1/sfa-dms/dashboard`, `GET /api/v1/sfa-dms/:resource`, `POST /api/v1/sfa-dms/:resource`, and `PATCH /api/v1/sfa-dms/:resource/:id` require `x-organization-id`.
- Supported generic resources are territories, distributors, retailers, routes, visits, orders, collections, and targets. Order items are deliberately excluded until a transactional order workflow exists.
- Create and update emit Governance audit records. RBAC workflow enforcement remains a later master-data/onboarding dependency.

## 2026-09-21 — MVP 2 master data and onboarding (in progress)

- Added organization-scoped region and area master data, with areas assigned to regions and territories optionally assigned to areas.
- Added additive distributor onboarding fields for KYC identifiers, agreement dates, security deposit, onboarding status, and blocked reason.
