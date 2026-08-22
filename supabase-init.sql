-- supabase-init.sql
-- Run this in the Supabase SQL editor to create tables used by the app.

-- Vendors
CREATE TABLE IF NOT EXISTS "vendors" (
  id text PRIMARY KEY,
  name text NOT NULL,
  "contactPerson" text,
  mobile text,
  "gstNumber" text,
  specialization text,
  status text,
  address text
);

-- Categories
CREATE TABLE IF NOT EXISTS "categories" (
  id text PRIMARY KEY,
  name text NOT NULL,
  status text,
  "createdDate" date,
  "productCount" int DEFAULT 0
);

-- Products & Variants
CREATE TABLE IF NOT EXISTS "products" (
  id text PRIMARY KEY,
  "categoryId" text,
  name text,
  code text,
  unit text,
  status text
);
CREATE TABLE IF NOT EXISTS "variants" (
  id text PRIMARY KEY,
  "productId" text REFERENCES "products"(id),
  name text,
  sku text,
  attributes jsonb,
  "factoryStock" int DEFAULT 0,
  "withVendor" int DEFAULT 0,
  rejected int DEFAULT 0,
  status text
);

-- Job Works and Items
CREATE TABLE IF NOT EXISTS "jobWorks" (
  id text PRIMARY KEY,
  "jobNumber" text,
  "vendorId" text REFERENCES "vendors"(id),
  process text,
  "issueDate" date,
  "expectedReturnDate" date,
  priority text,
  reference text,
  remarks text,
  status text,
  "createdBy" text,
  "createdAt" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "items" (
  id text PRIMARY KEY,
  "jobWorkId" text REFERENCES "jobWorks"(id),
  "productId" text,
  "variantId" text,
  "sentQuantity" int DEFAULT 0,
  "receivedQuantity" int DEFAULT 0,
  "rejectedQuantity" int DEFAULT 0,
  "lossQuantity" int DEFAULT 0,
  rate numeric
);

-- Receipts and receipt items
CREATE TABLE IF NOT EXISTS "receipts" (
  id text PRIMARY KEY,
  "jobWorkId" text REFERENCES "jobWorks"(id),
  date date,
  "receivedBy" text,
  "vendorChallanNumber" text,
  remarks text,
  "createdBy" text
);

CREATE TABLE IF NOT EXISTS "receipt_items" (
  id text PRIMARY KEY,
  "receiptId" text REFERENCES "receipts"(id),
  "variantId" text,
  received int DEFAULT 0,
  rejected int DEFAULT 0,
  loss int DEFAULT 0
);

-- Simple dev policies (DEV ONLY) — grant anon full access for quick testing.
-- WARNING: Do NOT use these policies in production.
DO $$
BEGIN
  EXECUTE 'ALTER TABLE "vendors" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY IF NOT EXISTS anon_full_vendors ON "vendors" FOR ALL USING (true) WITH CHECK (true)';

  EXECUTE 'ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY IF NOT EXISTS anon_full_categories ON "categories" FOR ALL USING (true) WITH CHECK (true)';

  EXECUTE 'ALTER TABLE "products" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY IF NOT EXISTS anon_full_products ON "products" FOR ALL USING (true) WITH CHECK (true)';

  EXECUTE 'ALTER TABLE "variants" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY IF NOT EXISTS anon_full_variants ON "variants" FOR ALL USING (true) WITH CHECK (true)';

  EXECUTE 'ALTER TABLE "jobWorks" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY IF NOT EXISTS anon_full_jobWorks ON "jobWorks" FOR ALL USING (true) WITH CHECK (true)';

  EXECUTE 'ALTER TABLE "items" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY IF NOT EXISTS anon_full_items ON "items" FOR ALL USING (true) WITH CHECK (true)';

  EXECUTE 'ALTER TABLE "receipts" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY IF NOT EXISTS anon_full_receipts ON "receipts" FOR ALL USING (true) WITH CHECK (true)';

  EXECUTE 'ALTER TABLE "receipt_items" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY IF NOT EXISTS anon_full_receipt_items ON "receipt_items" FOR ALL USING (true) WITH CHECK (true)';
EXCEPTION WHEN others THEN
  -- ignore if policies already exist or RLS already enabled
  RAISE NOTICE 'Policy creation skipped: %', SQLERRM;
END$$;
