-- Migration 0013 — Transient Rent Roll Phase 2, Table A
-- Creates transient_inventory_group. Scoped to crm_properties (physical property).
-- Spec: VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md §3.2.
-- Playbook: VANTAGE_TRANSIENT_INTEGRATION_PLAYBOOK.md (Phase 2 Table A).

BEGIN;

CREATE TABLE IF NOT EXISTS transient_inventory_group (
  id               varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           varchar NOT NULL,
  property_id      varchar NOT NULL,
  asset_class_id   text    NOT NULL,
  name             text    NOT NULL,
  description      text,
  sort_order       integer NOT NULL DEFAULT 0,
  meta             jsonb   NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamp NOT NULL DEFAULT now(),
  updated_at       timestamp NOT NULL DEFAULT now(),
  created_by       varchar,
  updated_by       varchar,
  deleted_at       timestamp,
  CONSTRAINT tig_org_fk         FOREIGN KEY (org_id)      REFERENCES organizations(id),
  CONSTRAINT tig_property_fk    FOREIGN KEY (property_id) REFERENCES crm_properties(id) ON DELETE RESTRICT,
  CONSTRAINT tig_created_by_fk  FOREIGN KEY (created_by)  REFERENCES users(id),
  CONSTRAINT tig_updated_by_fk  FOREIGN KEY (updated_by)  REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS tig_org_prop_idx ON transient_inventory_group (org_id, property_id);
CREATE INDEX IF NOT EXISTS tig_org_idx      ON transient_inventory_group (org_id);
CREATE INDEX IF NOT EXISTS tig_property_idx ON transient_inventory_group (property_id);
CREATE UNIQUE INDEX IF NOT EXISTS tig_org_prop_name_unique
  ON transient_inventory_group (org_id, property_id, name)
  WHERE deleted_at IS NULL;

COMMIT;
