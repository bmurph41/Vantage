-- Migration 007: Add 'str' to dd_template_asset_class enum
-- Phase 4a Item 5 — STR DD checklist. This enum was missed during the
-- platform-wide varchar migration that moved 55+ asset-class columns off
-- pgEnum. Fix-forward minimal change to unblock STR DD template seeding.
-- Broader varchar migration for this column captured in §3.5 cleanup.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'dd_template_asset_class' AND e.enumlabel = 'str'
  ) THEN
    ALTER TYPE dd_template_asset_class ADD VALUE 'str';
  END IF;
END $$;
