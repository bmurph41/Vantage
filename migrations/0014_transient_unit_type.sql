-- Migration 0014 — Transient Rent Roll Phase 2, Table B
-- Creates transient_unit_type. Scoped to crm_properties and transient_inventory_group.
-- Spec: VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md §3.2 (lines 625-644).
-- Playbook: VANTAGE_TRANSIENT_INTEGRATION_PLAYBOOK.md (Phase 2 Table B).

BEGIN;

CREATE TABLE IF NOT EXISTS transient_unit_type (
  id                   varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               varchar NOT NULL,
  property_id          varchar NOT NULL,
  inventory_group_id   varchar NOT NULL,
  code                 text    NOT NULL,
  name                 text    NOT NULL,
  description          text,
  dimensions           jsonb,
  base_rate            numeric(14,4),
  rate_basis           text    NOT NULL,
  max_occupancy        integer,
  sort_order           integer NOT NULL DEFAULT 0,
  created_at           timestamp NOT NULL DEFAULT now(),
  updated_at           timestamp NOT NULL DEFAULT now(),
  created_by           varchar,
  updated_by           varchar,
  deleted_at           timestamp,
  CONSTRAINT tut_org_fk               FOREIGN KEY (org_id)             REFERENCES organizations(id),
  CONSTRAINT tut_property_fk          FOREIGN KEY (property_id)        REFERENCES crm_properties(id) ON DELETE RESTRICT,
  CONSTRAINT tut_inventory_group_fk   FOREIGN KEY (inventory_group_id) REFERENCES transient_inventory_group(id) ON DELETE RESTRICT,
  CONSTRAINT tut_created_by_fk        FOREIGN KEY (created_by)         REFERENCES users(id),
  CONSTRAINT tut_updated_by_fk        FOREIGN KEY (updated_by)         REFERENCES users(id),
  CONSTRAINT tut_rate_basis_check     CHECK (rate_basis IN ('per_foot_per_night','flat_per_night','per_month','per_year'))
);

CREATE INDEX IF NOT EXISTS tut_org_prop_idx         ON transient_unit_type (org_id, property_id);
CREATE INDEX IF NOT EXISTS tut_org_idx              ON transient_unit_type (org_id);
CREATE INDEX IF NOT EXISTS tut_property_idx         ON transient_unit_type (property_id);
CREATE INDEX IF NOT EXISTS tut_inventory_group_idx  ON transient_unit_type (inventory_group_id);
CREATE UNIQUE INDEX IF NOT EXISTS tut_org_prop_code_unique
  ON transient_unit_type (org_id, property_id, code)
  WHERE deleted_at IS NULL;

COMMIT;
