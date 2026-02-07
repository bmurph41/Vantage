-- Migration: Add P&L Parser v2 columns to pnl_jobs
-- These columns support parse metrics tracking and validation gates

-- Add parse metrics JSON column (stores strategy, periodsDetected, rowsExtracted, etc.)
ALTER TABLE pnl_jobs ADD COLUMN IF NOT EXISTS parse_metrics_json jsonb;

-- Add validation JSON column (stores check results from validate.ts)
ALTER TABLE pnl_jobs ADD COLUMN IF NOT EXISTS validation_json jsonb;

-- Add validation status enum column
-- Using text instead of enum to avoid needing a new pg enum type
ALTER TABLE pnl_jobs ADD COLUMN IF NOT EXISTS validation_status text DEFAULT 'unknown';

-- Add comment for documentation
COMMENT ON COLUMN pnl_jobs.parse_metrics_json IS 'Parser v2 metrics: strategy, periodsDetected, rowsExtracted, numericCellsExtracted, headerConfidence, pageCount, tokensCount';
COMMENT ON COLUMN pnl_jobs.validation_json IS 'Validation gate results: status, checks[], summary';
COMMENT ON COLUMN pnl_jobs.validation_status IS 'Validation outcome: unknown | pass | warn | fail';
