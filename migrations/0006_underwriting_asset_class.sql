-- Migration: Underwriting stages + Asset class on modeling_projects
-- Non-destructive: adds columns with defaults

-- 1. Asset class column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modeling_projects' AND column_name = 'asset_class'
  ) THEN
    ALTER TABLE modeling_projects ADD COLUMN asset_class VARCHAR(50) DEFAULT 'marina';
  END IF;
END $$;

-- 2. Underwriting stage (where the model is in the UW process)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modeling_projects' AND column_name = 'uw_stage'
  ) THEN
    ALTER TABLE modeling_projects ADD COLUMN uw_stage VARCHAR(50) DEFAULT 'not_started';
  END IF;
END $$;

-- 3. Underwriting sub-status (granular detail)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modeling_projects' AND column_name = 'uw_sub_status'
  ) THEN
    ALTER TABLE modeling_projects ADD COLUMN uw_sub_status VARCHAR(50) DEFAULT NULL;
  END IF;
END $$;

-- 4. Primary valuation metric for this asset class
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modeling_projects' AND column_name = 'primary_valuation_metric'
  ) THEN
    ALTER TABLE modeling_projects ADD COLUMN primary_valuation_metric VARCHAR(50) DEFAULT 'cap_rate';
  END IF;
END $$;

-- 5. Index on asset_class and uw_stage for filtering
CREATE INDEX IF NOT EXISTS idx_mp_asset_class ON modeling_projects(asset_class);
CREATE INDEX IF NOT EXISTS idx_mp_uw_stage ON modeling_projects(uw_stage);
