-- Migration: Deal Pipeline + DD Enhancements (Institutional Version)
-- Uses VARCHAR to match existing crm_deals.id and crm_contacts.id types

-- ============================================================================
-- 1. deal_contacts – Structured contact blocks with team classification
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_contacts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  deal_id VARCHAR NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  contact_id VARCHAR REFERENCES crm_contacts(id) ON DELETE SET NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  company VARCHAR(255),
  title_role VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  contact_type VARCHAR(50) NOT NULL DEFAULT 'other',
  team_type VARCHAR(20) NOT NULL DEFAULT 'mutual',
  is_primary BOOLEAN DEFAULT FALSE,
  notes TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_contacts_deal_id ON deal_contacts(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_contacts_contact_id ON deal_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_deal_contacts_team_type ON deal_contacts(team_type);

-- ============================================================================
-- 2. deal_extensions – DD extension periods with executed tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_extensions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  deal_id VARCHAR NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  extension_number INTEGER NOT NULL DEFAULT 1,
  days INTEGER NOT NULL DEFAULT 0,
  executed BOOLEAN NOT NULL DEFAULT FALSE,
  executed_date TIMESTAMP WITH TIME ZONE,
  based_on_event VARCHAR(50) DEFAULT 'dd_expiration',
  notes TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_extensions_deal_id ON deal_extensions(deal_id);

-- ============================================================================
-- 3. deal_deposits – Automated deposit scheduling
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_deposits (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  deal_id VARCHAR NOT NULL REFERENCES crm_deals(id) ON DELETE CASCADE,
  deposit_number INTEGER NOT NULL DEFAULT 1,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  anchor_event VARCHAR(50) NOT NULL DEFAULT 'psa_signed',
  days_offset INTEGER NOT NULL DEFAULT 0,
  day_type VARCHAR(20) NOT NULL DEFAULT 'calendar',
  calculated_due_date DATE,
  actual_paid_date DATE,
  refundable BOOLEAN NOT NULL DEFAULT TRUE,
  applied_to_price BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  notes TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_deposits_deal_id ON deal_deposits(deal_id);

-- ============================================================================
-- 4. deal_property_address – Full address for deals not linked to model
-- ============================================================================
CREATE TABLE IF NOT EXISTS deal_property_address (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  deal_id VARCHAR NOT NULL UNIQUE REFERENCES crm_deals(id) ON DELETE CASCADE,
  street VARCHAR(500),
  city VARCHAR(255),
  state VARCHAR(100),
  zip VARCHAR(20),
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  full_address TEXT,
  linked_to_model BOOLEAN NOT NULL DEFAULT FALSE,
  model_id VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_property_address_deal_id ON deal_property_address(deal_id);

-- ============================================================================
-- 5. Add dd_period_mode to crm_deals (auto vs custom)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'crm_deals' AND column_name = 'dd_period_mode'
  ) THEN
    ALTER TABLE crm_deals ADD COLUMN dd_period_mode VARCHAR(20) DEFAULT 'auto';
  END IF;
END $$;

-- ============================================================================
-- 6. Ensure anchor_type column exists on crm_deals
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'crm_deals' AND column_name = 'anchor_type'
  ) THEN
    ALTER TABLE crm_deals ADD COLUMN anchor_type VARCHAR(50) DEFAULT 'psa';
  END IF;
END $$;
