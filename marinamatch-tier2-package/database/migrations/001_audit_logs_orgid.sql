-- Migration: 001_audit_logs_orgid.sql
-- Purpose: Allow audit logs for org-level operations (not just project-level)
-- Impact: Enables complete audit trail for user management, pack subscriptions, etc.

-- Step 1: Make projectId nullable (currently required)
ALTER TABLE audit_logs 
ALTER COLUMN "projectId" DROP NOT NULL;

-- Step 2: Add orgId column
ALTER TABLE audit_logs 
ADD COLUMN "orgId" INTEGER;

-- Step 3: Backfill orgId from existing projectId relationships
UPDATE audit_logs al
SET "orgId" = p."orgId"
FROM projects p
WHERE al."projectId" = p.id
AND al."orgId" IS NULL;

-- Step 4: For remaining null orgIds, try to get from userId
UPDATE audit_logs al
SET "orgId" = u."orgId"
FROM users u
WHERE al."userId" = u.id
AND al."orgId" IS NULL;

-- Step 5: Delete any audit logs that still have null orgId (orphaned data)
DELETE FROM audit_logs WHERE "orgId" IS NULL;

-- Step 6: Make orgId required now that it's backfilled
ALTER TABLE audit_logs 
ALTER COLUMN "orgId" SET NOT NULL;

-- Step 7: Add foreign key constraint
ALTER TABLE audit_logs
ADD CONSTRAINT fk_audit_logs_org
FOREIGN KEY ("orgId") REFERENCES organizations(id)
ON DELETE CASCADE;

-- Step 8: Add index for fast org-level queries
CREATE INDEX idx_audit_logs_org_timestamp 
ON audit_logs("orgId", timestamp DESC);

-- Step 9: Add index for user-level queries
CREATE INDEX idx_audit_logs_user_timestamp 
ON audit_logs("userId", timestamp DESC);

-- Step 10: Add composite index for project + org queries
CREATE INDEX idx_audit_logs_org_project 
ON audit_logs("orgId", "projectId")
WHERE "projectId" IS NOT NULL;

-- Rollback script (save this separately)
/*
DROP INDEX IF EXISTS idx_audit_logs_org_timestamp;
DROP INDEX IF EXISTS idx_audit_logs_user_timestamp;
DROP INDEX IF EXISTS idx_audit_logs_org_project;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS fk_audit_logs_org;
ALTER TABLE audit_logs DROP COLUMN IF EXISTS "orgId";
ALTER TABLE audit_logs ALTER COLUMN "projectId" SET NOT NULL;
*/

-- Verify migration
DO $$
DECLARE
  null_org_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM audit_logs;
  SELECT COUNT(*) INTO null_org_count FROM audit_logs WHERE "orgId" IS NULL;
  
  RAISE NOTICE 'Migration complete:';
  RAISE NOTICE '  Total audit logs: %', total_count;
  RAISE NOTICE '  Logs with null orgId: %', null_org_count;
  RAISE NOTICE '  Logs with null projectId: %', (SELECT COUNT(*) FROM audit_logs WHERE "projectId" IS NULL);
  
  IF null_org_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % audit logs still have null orgId', null_org_count;
  END IF;
END $$;
