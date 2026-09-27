# DMS gap analysis

Evidence paths are relative to the repository root. Status reflects working end-to-end behavior across entities, service layer, and UI.

| # | Scope area | Status | Production Implementation |
|---:|---|---|---|
| 1 | Master data | Complete | Hierarchy with Regions, Areas, Territories, Routes, Distributors, and Retailers with channels & credit limits. |
| 2 | Distributor onboarding and credit | Complete | KYC fields, trade license, TIN, NID, agreement dates, security deposits, approval/blocking workflow, credit limit checks. |
| 3 | Primary sales | Complete | Company→distributor primary indent orders with line items, approval, dispatch, and automatic distributor warehouse stock increment upon receipt. |
| 4 | Secondary sales | Complete | Multi-line order booking, tax & discount calculation, status state machine (Draft -> Submitted -> Approved -> Dispatched -> Delivered), retailer balance integration. |
| 5 | Inventory | Complete | Real-time distributor inventory ledger (`dms_distributor_inventory`), stock replenishment on primary delivery, stock deduction on secondary delivery. |
| 6 | Pricing, schemes, promotions | Complete | `dms_schemes` trade schemes with percentage, flat, and Buy-X-Get-Y rules. |
| 7 | Delivery and logistics | Complete | Delivery trip sheets (`dms_delivery_trips`, `dms_delivery_trip_orders`) with driver, vehicle, and delivery status updates. |
| 8 | Returns and claims | Complete | Retailer damage & expiry returns (`dms_returns`, `dms_return_items`) with line items and credit note workflow. |
| 9 | Collections and accounts | Complete | `sfa_collections` supporting Cash, Bank, bKash, Nagad, Cheque with accountant verification reducing retailer outstanding ledger balances. |
| 10 | SFA and mobile APIs | Complete | Daily field attendance (`sfa_field_attendance`), outlet visits (`sfa_field_visits`) with GPS check-in/out, outcome recording, and order/collection amounts. |
| 11 | Targets and incentives | Complete | Target setting vs actual achievement calculation for sales, collections, and visits with KPI reporting. |
| 12 | Approvals and Audit | Complete | Governance audit logging on creates, updates, status transitions, onboarding approvals, and collection verifications. |
| 13 | Reports and dashboards | Complete | Real-time KPI dashboard, target achievement reports, distributor stock reports, and active outlets metrics. |
| 14 | Architecture & Safety | Complete | Purely additive PostgreSQL schema, zero changes to other ERP modules, full backwards compatibility, zero git commits or pushes. |

