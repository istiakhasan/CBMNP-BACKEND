# CBMNP Backend API reference

The live, interactive reference is generated from the Nest controllers whenever
the backend starts:

- Swagger UI: `http://<host>:<port>/api-docs`
- OpenAPI JSON: `http://<host>:<port>/api-docs-json`
- Standard v1 base URL: `http://<host>:<port>/api/v1`

The default port is `8080`. Therefore a normal v1 request starts with
`http://localhost:8080/api/v1/...`. Static uploaded files are served below
`/api/v1/images/`.

## Route contract

For every current business module, use the following shape:

```text
https://<host>/api/v1/<endpoint>
```

For example, `GET /api/v1/products`, `POST /api/v1/orders`, and
`GET /api/v1/hr-payroll/employees` all follow that contract. Swagger displays
the `/v1/...` part because its server is configured as `/api`; its generated
request URL is therefore `/api/v1/...`.

### Legacy exceptions

These deployed controller routes do **not** currently follow `/api/v1`. They
remain documented and grouped in Swagger, but should be treated as legacy until
they are versioned through a separately planned, backward-compatible migration:

| Actual route | Purpose |
| --- | --- |
| `/api/chat` | Chat endpoint |
| `/api/thana/*` | Thana master data |
| `/api/webhook/shopify*` | Shopify integrations |
| `/api/v2/orders/change-status` | Version-2 order-status change |

## Authentication and tenancy

Use `Content-Type: application/json` for JSON endpoints. A protected route
expects the JWT itself in `Authorization` (without the `Bearer ` prefix) and an
organization identifier in `x-organization-id`.

```bash
curl 'http://localhost:8080/api/v1/hr-payroll/self-service/profile' \
  -H 'Authorization: <raw-jwt>' \
  -H 'x-organization-id: <organization-id>'
```

`AuthGuard` validates that `x-organization-id` equals the organization encoded
in the token. Incorrect or absent credentials result in `401`, `403`, or the
application's `419 Invalid token` response. Do not assume a route is protected
merely because it appears in Swagger: protection is only enforced where the
controller or handler applies `AuthGuard`.

The biometric routes (`/v1/hr-payroll/biometric/*`) intentionally use a device
API key instead of user JWT authentication. Third-party webhooks have their own
signature/key verification in their handlers.

## Response and errors

Most controllers return this envelope (some legacy handlers vary):

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Optional message",
  "meta": { "page": 1, "limit": 20, "total": 120 },
  "data": {}
}
```

List endpoints commonly accept `page`, `limit`, `searchTerm`, and module-specific
filters. Path values such as `:id`, `:customerId`, and `:warehouseId` are UUIDs
unless the individual service documents a different identifier.

## Copy-ready examples

Replace every angle-bracket value before sending. Swagger's **Authorize**
dialog accepts the raw token in `raw-jwt`; do not prepend `Bearer`.

### Login

```bash
curl -X POST 'http://localhost:8080/api/v1/auth/log-in' \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"StrongPassword123!"}'
```

### Create an SFA/DMS distributor

```bash
curl -X POST 'http://localhost:8080/api/v1/sfa-dms/distributors' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: <raw-jwt>' \
  -H 'x-organization-id: <organization-uuid>' \
  -d '{"code":"DIST-001","name":"Example Distributor","areaId":"<area-uuid>","contactPerson":"Rahim Uddin","phone":"01700000000"}'
```

### Create an SFA/DMS order with items

```json
{
  "retailerId": "<retailer-uuid>",
  "orderDate": "2026-09-23",
  "orderNumber": "SO-20260923-001",
  "discountAmount": 50,
  "items": [{ "productId": "<product-uuid>", "quantity": 2, "unitPrice": 450 }]
}
```

Send that body to `POST /api/v1/sfa-dms/orders/create-with-items` with the
same two organization headers above.

### Biometric webhook

```json
{
  "deviceId": "<biometric-device-uuid>",
  "logs": [{ "employeeCode": "EMP-001", "timestamp": "2026-09-23T09:00:00+06:00", "type": "check-in" }]
}
```

Send it to `POST /api/v1/hr-payroll/biometric/sync` with
`x-device-api-key`, `x-organization-id`, and `Content-Type: application/json`.

## Route catalogue

Every endpoint below is relative to `/api`. The live Swagger page is the
canonical operation-level reference: it lists HTTP method, path parameters,
query parameters, request DTOs where the controller declares one, and response
models. This catalogue is included so consumers can find the correct module
without depending on a running server.

For every `POST`, `PUT`, and `PATCH` operation, Swagger shows an editable
**Request body** box after clicking **Try it out**. Operations with documented
schemas show real examples; legacy `data: any` operations use an open JSON
object so you can enter the exact payload and execute the request from Swagger.

| Area | Base route | Operations |
| --- | --- | --- |
| Auth | `/v1/auth` | `POST /log-in`, `POST /super/log-in`, `POST /refresh-token`, `GET /profile`, `POST /employee-change-password` |
| Users & access | `/v1/user`, `/v1/permission`, `/v1/userpermission` | CRUD users, permissions and user-permission assignments; user options |
| Organization & locations | `/v1/organization`, `/v1/warehouse`, `/v1/divisions`, `/v1/districts`, `/thana` | CRUD organizations, warehouses, divisions, districts and thanas; warehouse options/overview/default warehouse |
| Catalogue | `/v1/products`, `/v1/category`, `/v1/supplier`, `/v1/inventory`, `/v1/transaction`, `/v1/status` | Product/category/supplier management, variants/images, inventory and transaction lookup, status/order counts |
| Customers | `/v1/customers` | Customer CRUD, addresses, order count, retention and top-customer reports |
| Orders | `/v1/orders`, `/v2/orders` | Order CRUD, POS orders, payment, exchange, return, direct delivery, status/hold changes, courier COD settlement, scans, logs and sales/courier reports |
| Procurement | `/v1/procurements`, `/v1/requisition`, `/v1/purchase-returns` | Procurement/direct purchase/receiving, requisitions, GRN, RFQ/quotations and purchase-return approval |
| Accounting & finance | `/v1/accounting/*`, `/v1/finance` | Chart of accounts, journal entries, ledger/trial-balance/P&L/balance-sheet reports, bank accounts, expenses, transfers, receivables, payables and reconciliation |
| Operations | `/v1/inventory-operations`, `/v1/sales-operations`, `/v1/logistics-operations` | Locations, batches, transfers, adjustments, reorder/valuation reports, quotations, coupons, credit, POS sessions, routing/rates/pick-lists/COD settlements |
| Governance | `/v1/governance`, `/v1/activity-logs`, `/v1/notifications` | Branches, audit/login history, approval rules, activity logs, SMS templates/logs and outbound webhooks |
| Garments | `/v1/garments` | Garment dashboard, orders, BOMs, purchase orders, material issue/return, inventory lots, sample inwards and adjustment approval |
| HR & payroll | `/v1/hr-payroll` | Departments, designations, biometric devices/logs, shifts, holidays, employees, attendance, leave, loans, expenses, payroll, overtime, transfers, reviews, training, disciplinary actions, assets, clearance, commissions, announcements, approvals and reports |
| SFA/DMS | `/v1/sfa-dms` | Dashboard, distributor onboarding, sales/primary orders, attendance, field visits, collections, trips, returns, target/stock reports and approved generic master-data CRUD |
| External integration | `/v1/webhook/steadfast`, `/webhook/shopify*`, `/v1/hr-payroll/biometric/*`, `/chat` | Courier, Shopify, biometric device and chat integrations |

## SFA/DMS generic resources

SFA/DMS also exposes `GET`, `POST` `/v1/sfa-dms/:resource` and `GET`, `PATCH`
`/v1/sfa-dms/:resource/:id`. These are deliberately restricted by the service's
resource map; callers must use a supported resource name, not an arbitrary table
or entity name. All SFA/DMS endpoints require `x-organization-id`; its dedicated
controller returns `400` when that header is missing.

## File uploads

The HR self-service profile-photo operation is multipart/form-data; use field
name `file`. Other upload endpoints should be checked in Swagger/source before
integration because legacy controllers do not share one upload DTO.

## Keeping the reference current

The Swagger document is created at application boot using `SwaggerModule` in
`src/main.ts`; adding a Nest controller operation makes it available in the live
reference automatically. When adding a request DTO, decorate it with
`@ApiProperty` (and the operation with `@ApiBody` where needed) so consumers see
the exact body schema rather than an untyped object.
