-- Migration 006: Expand cl_lease_type enum with new lease categories
-- Adds ground, commercial, residential, storage to the existing enum
-- All operations are idempotent

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'cl_lease_type' AND e.enumlabel = 'ground'
  ) THEN
    ALTER TYPE cl_lease_type ADD VALUE 'ground';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'cl_lease_type' AND e.enumlabel = 'commercial'
  ) THEN
    ALTER TYPE cl_lease_type ADD VALUE 'commercial';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'cl_lease_type' AND e.enumlabel = 'residential'
  ) THEN
    ALTER TYPE cl_lease_type ADD VALUE 'residential';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'cl_lease_type' AND e.enumlabel = 'storage'
  ) THEN
    ALTER TYPE cl_lease_type ADD VALUE 'storage';
  END IF;
END $$;
