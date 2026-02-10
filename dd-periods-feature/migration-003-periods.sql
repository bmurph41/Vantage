-- Migration 003: DD Checklist Item Period Slots
-- Enables year/month/trailing period tracking per checklist item

CREATE TABLE IF NOT EXISTS dd_checklist_item_periods (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id varchar NOT NULL REFERENCES dd_checklist_items(id) ON DELETE CASCADE,
  period_type varchar(20) NOT NULL CHECK (period_type IN ('year', 'month', 'trailing')),
  period_label text NOT NULL,          -- Display: "2023", "Jan 2024", "T12"
  period_sort integer NOT NULL DEFAULT 0,  -- For ordering
  is_received boolean NOT NULL DEFAULT false,
  received_at timestamptz,
  received_by varchar REFERENCES users(id),
  file_id varchar,                     -- Optional link to uploaded document
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ddcip_item_idx ON dd_checklist_item_periods(item_id);
CREATE INDEX IF NOT EXISTS ddcip_received_idx ON dd_checklist_item_periods(item_id, is_received);

-- Add period_config to items for default period setup
ALTER TABLE dd_checklist_items ADD COLUMN IF NOT EXISTS period_config jsonb;
-- e.g. { "type": "year", "values": ["2021","2022","2023","2024"] }
-- e.g. { "type": "month", "values": ["Jan 2024","Feb 2024",...,"Dec 2024"] }
-- e.g. { "type": "trailing", "values": ["T12","T24"] }

-- Add has_periods flag for quick filtering
ALTER TABLE dd_checklist_items ADD COLUMN IF NOT EXISTS has_periods boolean NOT NULL DEFAULT false;

COMMENT ON TABLE dd_checklist_item_periods IS 'Tracks individual period slots (years, months, trailing) for DD checklist items';
