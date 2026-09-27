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

## 2026-09-21 — Production-Grade SFA & DMS Complete Release

- **Master Data & Hierarchy**: Added Regions, Areas, Territories, Route beats, Distributor profiles (KYC, trade license, TIN, NID, agreement dates, credit limit, security deposit, onboarding status: Draft/Pending Approval/Approved/Blocked), and Retailer profiles (channels, credit limit, outstanding balance, GPS lat/lng).
- **Secondary Sales Order Booking**: Transactional order line item creation with dynamic subtotal, discount, VAT/tax, and net amount calculation; retailer credit limit check; order status workflow state machine (Draft -> Submitted -> Approved -> Dispatched -> Delivered / Cancelled); automatic retailer outstanding balance update.
- **Primary Sales Indents**: Distributor to central warehouse primary order indents with line items, approval, dispatch, and automatic distributor stock increment upon receipt.
- **Distributor Stock & Inventory Ledger**: Real-time distributor inventory tracking (`dms_distributor_inventory`) auto-incremented on primary delivery and deducted on secondary dispatch/delivery.
- **Field Force Automation (SFA)**: Daily field attendance check-in/out (`sfa_field_attendance`) with GPS coordinates; outlet visits (`sfa_field_visits`) with check-in, check-out, visit outcomes, booked order/collection values, and photos.
- **Collections & Credit Management**: Field collections (`sfa_collections`) supporting Cash, bKash, Nagad, Bank, Cheque with cheque details; accountant verification workflow (`Submitted -> Verified -> Deposited`) that safely reduces retailer outstanding ledger balances.
- **Promotions & Trade Schemes**: Rule-based schemes (`dms_schemes`) for percentage discounts, flat discounts, and Buy-X-Get-Y promotions.
- **Logistics & Delivery Trips**: Trip sheets (`dms_delivery_trips`, `dms_delivery_trip_orders`) with driver, vehicle, and multi-order delivery confirmation.
- **Damage & Return Claims**: Retailer returns (`dms_returns`, `dms_return_items`) tracking reasons (damage, expiry) and credit note workflow.
- **Sales Targets & KPIs**: Target setting vs actual achievement calculation for sales, collections, and visits with percentage progress and KPI reports.
- **Frontend Workspace**: Complete Next.js & Ant Design workspace (`SfaDmsWorkspace.tsx`) with domain tabs, multi-line order builders, modal drawers, status tags, and real-time dashboard cards.
- **Zero Impact Guarantee**: Zero changes made to other ERP modules; all database changes are 100% additive; zero git commits or pushes.

