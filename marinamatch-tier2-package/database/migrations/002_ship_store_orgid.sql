-- Migration: 002_ship_store_orgid.sql
-- Purpose: Add multi-tenant support to ship store tables
-- Impact: Prevents data leakage between organizations

-- Step 1: Add orgId column to all ship store tables (nullable initially)
ALTER TABLE ship_store_categories ADD COLUMN "orgId" INTEGER;
ALTER TABLE ship_store_products ADD COLUMN "orgId" INTEGER;
ALTER TABLE ship_store_inventory ADD COLUMN "orgId" INTEGER;
ALTER TABLE ship_store_transactions ADD COLUMN "orgId" INTEGER;

-- Step 2: Backfill orgId
-- If you have existing data, assign to a demo/default org or delete
-- For this migration, we'll assign all existing data to orgId = 1 (demo org)
-- IMPORTANT: Review this logic based on your data

UPDATE ship_store_categories SET "orgId" = 1 WHERE "orgId" IS NULL;
UPDATE ship_store_products SET "orgId" = 1 WHERE "orgId" IS NULL;
UPDATE ship_store_inventory SET "orgId" = 1 WHERE "orgId" IS NULL;
UPDATE ship_store_transactions SET "orgId" = 1 WHERE "orgId" IS NULL;

-- Step 3: Make orgId required
ALTER TABLE ship_store_categories ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE ship_store_products ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE ship_store_inventory ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE ship_store_transactions ALTER COLUMN "orgId" SET NOT NULL;

-- Step 4: Add foreign key constraints
ALTER TABLE ship_store_categories
ADD CONSTRAINT fk_ship_store_categories_org
FOREIGN KEY ("orgId") REFERENCES organizations(id)
ON DELETE CASCADE;

ALTER TABLE ship_store_products
ADD CONSTRAINT fk_ship_store_products_org
FOREIGN KEY ("orgId") REFERENCES organizations(id)
ON DELETE CASCADE;

ALTER TABLE ship_store_inventory
ADD CONSTRAINT fk_ship_store_inventory_org
FOREIGN KEY ("orgId") REFERENCES organizations(id)
ON DELETE CASCADE;

ALTER TABLE ship_store_transactions
ADD CONSTRAINT fk_ship_store_transactions_org
FOREIGN KEY ("orgId") REFERENCES organizations(id)
ON DELETE CASCADE;

-- Step 5: Add indexes for fast org-level queries
CREATE INDEX idx_ship_store_categories_org ON ship_store_categories("orgId");
CREATE INDEX idx_ship_store_products_org ON ship_store_products("orgId");
CREATE INDEX idx_ship_store_inventory_org ON ship_store_inventory("orgId");
CREATE INDEX idx_ship_store_transactions_org ON ship_store_transactions("orgId");

-- Step 6: Add composite indexes for common query patterns
CREATE INDEX idx_ship_store_products_org_category 
ON ship_store_products("orgId", "categoryId");

CREATE INDEX idx_ship_store_inventory_org_product 
ON ship_store_inventory("orgId", "productId");

CREATE INDEX idx_ship_store_transactions_org_date 
ON ship_store_transactions("orgId", date DESC);

-- Step 7: Add unique constraints to prevent duplicates within org
-- Example: Category name must be unique within organization
CREATE UNIQUE INDEX idx_ship_store_categories_org_name 
ON ship_store_categories("orgId", name);

-- Example: Product SKU must be unique within organization
CREATE UNIQUE INDEX idx_ship_store_products_org_sku 
ON ship_store_products("orgId", sku);

-- Rollback script (save separately)
/*
DROP INDEX IF EXISTS idx_ship_store_categories_org;
DROP INDEX IF EXISTS idx_ship_store_products_org;
DROP INDEX IF EXISTS idx_ship_store_inventory_org;
DROP INDEX IF EXISTS idx_ship_store_transactions_org;
DROP INDEX IF EXISTS idx_ship_store_products_org_category;
DROP INDEX IF EXISTS idx_ship_store_inventory_org_product;
DROP INDEX IF EXISTS idx_ship_store_transactions_org_date;
DROP INDEX IF EXISTS idx_ship_store_categories_org_name;
DROP INDEX IF EXISTS idx_ship_store_products_org_sku;

ALTER TABLE ship_store_categories DROP CONSTRAINT IF EXISTS fk_ship_store_categories_org;
ALTER TABLE ship_store_products DROP CONSTRAINT IF EXISTS fk_ship_store_products_org;
ALTER TABLE ship_store_inventory DROP CONSTRAINT IF EXISTS fk_ship_store_inventory_org;
ALTER TABLE ship_store_transactions DROP CONSTRAINT IF EXISTS fk_ship_store_transactions_org;

ALTER TABLE ship_store_categories DROP COLUMN IF EXISTS "orgId";
ALTER TABLE ship_store_products DROP COLUMN IF EXISTS "orgId";
ALTER TABLE ship_store_inventory DROP COLUMN IF EXISTS "orgId";
ALTER TABLE ship_store_transactions DROP COLUMN IF EXISTS "orgId";
*/

-- Verify migration
DO $$
DECLARE
  categories_count INTEGER;
  products_count INTEGER;
  inventory_count INTEGER;
  transactions_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO categories_count FROM ship_store_categories WHERE "orgId" IS NULL;
  SELECT COUNT(*) INTO products_count FROM ship_store_products WHERE "orgId" IS NULL;
  SELECT COUNT(*) INTO inventory_count FROM ship_store_inventory WHERE "orgId" IS NULL;
  SELECT COUNT(*) INTO transactions_count FROM ship_store_transactions WHERE "orgId" IS NULL;
  
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  Categories with null orgId: %', categories_count;
  RAISE NOTICE '  Products with null orgId: %', products_count;
  RAISE NOTICE '  Inventory with null orgId: %', inventory_count;
  RAISE NOTICE '  Transactions with null orgId: %', transactions_count;
  
  IF categories_count > 0 OR products_count > 0 OR inventory_count > 0 OR transactions_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: Some ship store records still have null orgId';
  END IF;
END $$;
