-- Production Additive SFA & DMS Complete Migration
-- Safe, idempotent script for PostgreSQL. Creates missing tables and columns without altering existing ERP data.

-- Master Data extensions
ALTER TABLE dms_distributors ADD COLUMN IF NOT EXISTS "email" varchar;
ALTER TABLE dms_distributors ADD COLUMN IF NOT EXISTS "address" text;
ALTER TABLE dms_distributors ADD COLUMN IF NOT EXISTS "outstandingBalance" numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE dms_retailers ADD COLUMN IF NOT EXISTS "channel" varchar NOT NULL DEFAULT 'Grocery';
ALTER TABLE dms_retailers ADD COLUMN IF NOT EXISTS "creditLimit" numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE dms_retailers ADD COLUMN IF NOT EXISTS "outstandingBalance" numeric(14,2) NOT NULL DEFAULT 0;

-- SFA Field Attendance
CREATE TABLE IF NOT EXISTS sfa_field_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "salesRepId" varchar NOT NULL,
  date date NOT NULL,
  "checkInTime" timestamp,
  "checkOutTime" timestamp,
  "checkInLatitude" numeric(10,7),
  "checkInLongitude" numeric(10,7),
  "checkOutLatitude" numeric(10,7),
  "checkOutLongitude" numeric(10,7),
  status varchar NOT NULL DEFAULT 'Present',
  "totalVisits" int NOT NULL DEFAULT 0,
  remarks text,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("organizationId", "salesRepId", date)
);
CREATE INDEX IF NOT EXISTS idx_sfa_attendance_rep_date ON sfa_field_attendance ("organizationId", "salesRepId", date);

-- SFA Field Visits extensions
ALTER TABLE sfa_field_visits ADD COLUMN IF NOT EXISTS "checkOutLatitude" numeric(10,7);
ALTER TABLE sfa_field_visits ADD COLUMN IF NOT EXISTS "checkOutLongitude" numeric(10,7);
ALTER TABLE sfa_field_visits ADD COLUMN IF NOT EXISTS "outcome" varchar NOT NULL DEFAULT 'Pending';
ALTER TABLE sfa_field_visits ADD COLUMN IF NOT EXISTS "orderAmount" numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE sfa_field_visits ADD COLUMN IF NOT EXISTS "collectionAmount" numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE sfa_field_visits ADD COLUMN IF NOT EXISTS "photoUrl" varchar;

-- Secondary Sales Orders extensions
ALTER TABLE dms_sales_orders ADD COLUMN IF NOT EXISTS "deliveryDate" date;
ALTER TABLE dms_sales_orders ADD COLUMN IF NOT EXISTS "paymentStatus" varchar NOT NULL DEFAULT 'Unpaid';
ALTER TABLE dms_sales_orders ADD COLUMN IF NOT EXISTS "taxAmount" numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE dms_sales_orders ADD COLUMN IF NOT EXISTS "paidAmount" numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE dms_sales_orders ADD COLUMN IF NOT EXISTS "deliveryAddress" text;

-- Secondary Sales Order Items extensions
ALTER TABLE dms_sales_order_items ADD COLUMN IF NOT EXISTS "productName" varchar;
ALTER TABLE dms_sales_order_items ADD COLUMN IF NOT EXISTS "productSku" varchar;
ALTER TABLE dms_sales_order_items ADD COLUMN IF NOT EXISTS "uom" varchar DEFAULT 'PCS';
ALTER TABLE dms_sales_order_items ADD COLUMN IF NOT EXISTS "taxRate" numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE dms_sales_order_items ADD COLUMN IF NOT EXISTS "taxAmount" numeric(14,2) NOT NULL DEFAULT 0;

-- Primary Orders (Company -> Distributor)
CREATE TABLE IF NOT EXISTS dms_primary_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "orderNumber" varchar NOT NULL,
  "distributorId" uuid NOT NULL,
  "warehouseId" varchar,
  "orderDate" date NOT NULL,
  "expectedDeliveryDate" date,
  status varchar NOT NULL DEFAULT 'Draft',
  "paymentStatus" varchar NOT NULL DEFAULT 'Unpaid',
  "grossAmount" numeric(14,2) NOT NULL DEFAULT 0,
  "discountAmount" numeric(14,2) NOT NULL DEFAULT 0,
  "taxAmount" numeric(14,2) NOT NULL DEFAULT 0,
  "netAmount" numeric(14,2) NOT NULL DEFAULT 0,
  "paidAmount" numeric(14,2) NOT NULL DEFAULT 0,
  "challanNumber" varchar,
  "invoiceNumber" varchar,
  notes text,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("organizationId", "orderNumber")
);
CREATE INDEX IF NOT EXISTS idx_dms_primary_orders_org_dist ON dms_primary_orders ("organizationId", "distributorId");

CREATE TABLE IF NOT EXISTS dms_primary_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "orderId" uuid NOT NULL,
  "productId" uuid NOT NULL,
  "productName" varchar,
  "productSku" varchar,
  "uom" varchar DEFAULT 'PCS',
  quantity int NOT NULL,
  "allocatedQuantity" int NOT NULL DEFAULT 0,
  "unitPrice" numeric(14,2) NOT NULL,
  "discountAmount" numeric(14,2) NOT NULL DEFAULT 0,
  "lineTotal" numeric(14,2) NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("orderId", "productId")
);

-- Distributor Inventory Ledger
CREATE TABLE IF NOT EXISTS dms_distributor_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "distributorId" uuid NOT NULL,
  "productId" uuid NOT NULL,
  "productName" varchar,
  "productSku" varchar,
  "uom" varchar DEFAULT 'PCS',
  "availableQuantity" numeric(14,2) NOT NULL DEFAULT 0,
  "reservedQuantity" numeric(14,2) NOT NULL DEFAULT 0,
  "lastRestockedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("organizationId", "distributorId", "productId")
);

-- Collections extensions
ALTER TABLE sfa_collections ADD COLUMN IF NOT EXISTS "bankName" varchar;
ALTER TABLE sfa_collections ADD COLUMN IF NOT EXISTS "chequeNumber" varchar;
ALTER TABLE sfa_collections ADD COLUMN IF NOT EXISTS "chequeDate" date;
ALTER TABLE sfa_collections ADD COLUMN IF NOT EXISTS "depositDate" date;
ALTER TABLE sfa_collections ADD COLUMN IF NOT EXISTS "verifiedBy" varchar;
ALTER TABLE sfa_collections ADD COLUMN IF NOT EXISTS "verifiedAt" timestamp;

-- Trade Schemes & Promotions
CREATE TABLE IF NOT EXISTS dms_schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  code varchar NOT NULL,
  name varchar NOT NULL,
  "schemeType" varchar NOT NULL DEFAULT 'Percentage',
  "minQuantity" int NOT NULL DEFAULT 1,
  "minOrderAmount" numeric(14,2) NOT NULL DEFAULT 0,
  "discountPercentage" numeric(5,2) NOT NULL DEFAULT 0,
  "flatDiscount" numeric(14,2) NOT NULL DEFAULT 0,
  "freeProductId" varchar,
  "freeQuantity" int NOT NULL DEFAULT 0,
  "startDate" date,
  "endDate" date,
  active boolean NOT NULL DEFAULT true,
  description text,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("organizationId", code)
);

-- Delivery Trips
CREATE TABLE IF NOT EXISTS dms_delivery_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "tripNumber" varchar NOT NULL,
  "distributorId" varchar,
  "driverName" varchar,
  "driverPhone" varchar,
  "vehicleNumber" varchar,
  "tripDate" date NOT NULL,
  status varchar NOT NULL DEFAULT 'Scheduled',
  "totalOrders" int NOT NULL DEFAULT 0,
  "deliveredOrders" int NOT NULL DEFAULT 0,
  "totalAmount" numeric(14,2) NOT NULL DEFAULT 0,
  note text,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("organizationId", "tripNumber")
);

CREATE TABLE IF NOT EXISTS dms_delivery_trip_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "tripId" uuid NOT NULL,
  "orderId" uuid NOT NULL,
  sequence int NOT NULL DEFAULT 0,
  "deliveryStatus" varchar NOT NULL DEFAULT 'Pending',
  "failureReason" varchar,
  "deliveredAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("tripId", "orderId")
);

-- Returns & Damage Claims
CREATE TABLE IF NOT EXISTS dms_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "returnNumber" varchar NOT NULL,
  "distributorId" varchar,
  "retailerId" varchar NOT NULL,
  "returnDate" date NOT NULL,
  "returnType" varchar NOT NULL DEFAULT 'Damage',
  status varchar NOT NULL DEFAULT 'Pending',
  "totalAmount" numeric(14,2) NOT NULL DEFAULT 0,
  note text,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("organizationId", "returnNumber")
);

CREATE TABLE IF NOT EXISTS dms_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "returnId" uuid NOT NULL,
  "productId" uuid NOT NULL,
  "productName" varchar,
  quantity int NOT NULL,
  "unitPrice" numeric(14,2) NOT NULL,
  "lineTotal" numeric(14,2) NOT NULL,
  reason varchar,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sales Targets extensions
ALTER TABLE sfa_sales_targets ADD COLUMN IF NOT EXISTS "distributorId" varchar;
ALTER TABLE sfa_sales_targets ADD COLUMN IF NOT EXISTS "achievedSales" numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE sfa_sales_targets ADD COLUMN IF NOT EXISTS "achievedCollection" numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE sfa_sales_targets ADD COLUMN IF NOT EXISTS "achievedVisits" int NOT NULL DEFAULT 0;
