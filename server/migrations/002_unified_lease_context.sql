-- ============================================================================
-- 002_unified_lease_context.sql
-- Adds org_id, property_id, source_lease_id, and lease_context to
-- commercial_leases so the same table + engine serves both Operations
-- (org-scoped, property-linked, permanent) and Valuator (project-scoped,
-- modeling-only).
-- ============================================================================

-- 1) Add columns
ALTER TABLE commercial_leases
  ADD COLUMN IF NOT EXISTS org_id UUID,
  ADD COLUMN IF NOT EXISTS property_id UUID,
  ADD COLUMN IF NOT EXISTS source_lease_id UUID,
  ADD COLUMN IF NOT EXISTS lease_context TEXT NOT NULL DEFAULT 'valuator';

-- 2) Make project_id nullable (Operations leases don't need one)
ALTER TABLE commercial_leases
  ALTER COLUMN project_id DROP NOT NULL;

-- 3) Add self-referencing FK for source_lease_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_cl_source_lease'
  ) THEN
    ALTER TABLE commercial_leases
      ADD CONSTRAINT fk_cl_source_lease
      FOREIGN KEY (source_lease_id) REFERENCES commercial_leases(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 4) Check constraint on lease_context values
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_cl_lease_context'
  ) THEN
    ALTER TABLE commercial_leases
      ADD CONSTRAINT chk_cl_lease_context
      CHECK (lease_context IN ('operations', 'valuator'));
  END IF;
END $$;

-- 5) Backfill: all existing leases are valuator context (they have project_id)
UPDATE commercial_leases
SET lease_context = 'valuator'
WHERE lease_context IS NULL OR lease_context = '';

-- 6) Indexes for Operations queries
CREATE INDEX IF NOT EXISTS idx_cl_org_context
  ON commercial_leases (org_id, lease_context);

CREATE INDEX IF NOT EXISTS idx_cl_org_property
  ON commercial_leases (org_id, property_id)
  WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cl_source_lease
  ON commercial_leases (source_lease_id)
  WHERE source_lease_id IS NOT NULL;

-- 7) Composite for Operations list queries (org + context + active)
CREATE INDEX IF NOT EXISTS idx_cl_ops_list
  ON commercial_leases (org_id, lease_context, active)
  WHERE lease_context = 'operations';

-- Done
SELECT 'Migration 002_unified_lease_context complete' AS status;
