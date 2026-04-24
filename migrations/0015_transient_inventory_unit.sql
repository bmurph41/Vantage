-- Migration 0015 — Transient Rent Roll Phase 2, Table C
-- Creates transient_inventory_unit. The physical slip #A-12, Room 304, Pad 27.
-- Spec: VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md §3.2 (lines 646-663).
-- Playbook: VANTAGE_TRANSIENT_INTEGRATION_PLAYBOOK.md (Phase 2 Table C).

BEGIN;

CREATE TABLE IF NOT EXISTS transient_inventory_unit (
  id                   varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               varchar NOT NULL,
  property_id          varchar NOT NULL,
  inventory_group_id   varchar NOT NULL,
  unit_type_id         varchar NOT NULL,
  identifier           text    NOT NULL,
  status               text    NOT NULL DEFAULT 'active',
  activation_date      date,
  decommission_date    date,
  attributes           jsonb   NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamp NOT NULL DEFAULT now(),
  updated_at           timestamp NOT NULL DEFAULT now(),
  created_by           varchar,
  updated_by           varchar,
  deleted_at           timestamp,
  CONSTRAINT tiu_org_fk               FOREIGN KEY (org_id)             REFERENCES organizations(id),
  CONSTRAINT tiu_property_fk          FOREIGN KEY (property_id)        REFERENCES crm_properties(id)          ON DELETE RESTRICT,
  CONSTRAINT tiu_inventory_group_fk   FOREIGN KEY (inventory_group_id) REFERENCES transient_inventory_group(id) ON DELETE RESTRICT,
  CONSTRAINT tiu_unit_type_fk         FOREIGN KEY (unit_type_id)       REFERENCES transient_unit_type(id)     ON DELETE RESTRICT,
  CONSTRAINT tiu_created_by_fk        FOREIGN KEY (created_by)         REFERENCES users(id),
  CONSTRAINT tiu_updated_by_fk        FOREIGN KEY (updated_by)         REFERENCES users(id),
  CONSTRAINT tiu_status_check         CHECK (status IN ('active','ooo','decommissioned')),
  CONSTRAINT tiu_date_order_check     CHECK (decommission_date IS NULL OR activation_date IS NULL OR decommission_date >= activation_date)
);

CREATE INDEX IF NOT EXISTS tiu_org_prop_idx         ON transient_inventory_unit (org_id, property_id);
CREATE INDEX IF NOT EXISTS tiu_org_idx              ON transient_inventory_unit (org_id);
CREATE INDEX IF NOT EXISTS tiu_property_idx         ON transient_inventory_unit (property_id);
CREATE INDEX IF NOT EXISTS tiu_inventory_group_idx  ON transient_inventory_unit (inventory_group_id);
CREATE INDEX IF NOT EXISTS tiu_unit_type_idx        ON transient_inventory_unit (unit_type_id);
CREATE UNIQUE INDEX IF NOT EXISTS tiu_org_prop_ident_unique
  ON transient_inventory_unit (org_id, property_id, identifier)
  WHERE deleted_at IS NULL;

COMMIT;
