-- Migration: Extend platform_asset_classes with dynamic configuration fields
-- Converts key/category from enum to text, adds 7 new metadata columns,
-- and seeds all 36 canonical asset class types (idempotent: ON CONFLICT DO NOTHING).

-- Convert key column from enum to text (safe: DO block checks current type)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'platform_asset_classes'
      AND column_name = 'key'
      AND udt_name != 'text'
  ) THEN
    EXECUTE 'ALTER TABLE platform_asset_classes ALTER COLUMN key TYPE text USING key::text';
  END IF;
END;
$$;
--> statement-breakpoint

-- Convert category column from enum to text
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'platform_asset_classes'
      AND column_name = 'category'
      AND udt_name != 'text'
  ) THEN
    EXECUTE 'ALTER TABLE platform_asset_classes ALTER COLUMN category TYPE text USING category::text';
  END IF;
END;
$$;
--> statement-breakpoint

-- Add new dynamic configuration columns
ALTER TABLE platform_asset_classes ADD COLUMN IF NOT EXISTS size_label text;
--> statement-breakpoint
ALTER TABLE platform_asset_classes ADD COLUMN IF NOT EXISTS occ_label text;
--> statement-breakpoint
ALTER TABLE platform_asset_classes ADD COLUMN IF NOT EXISTS price_unit text;
--> statement-breakpoint
ALTER TABLE platform_asset_classes ADD COLUMN IF NOT EXISTS revenue_streams jsonb DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE platform_asset_classes ADD COLUMN IF NOT EXISTS demand_key text;
--> statement-breakpoint
ALTER TABLE platform_asset_classes ADD COLUMN IF NOT EXISTS "group" text;
--> statement-breakpoint
ALTER TABLE platform_asset_classes ADD COLUMN IF NOT EXISTS color text;
--> statement-breakpoint

-- Seed all 36 canonical asset class types (idempotent)
INSERT INTO platform_asset_classes (key, label, short_label, category, icon, enabled, sort_order, size_label, occ_label, price_unit, revenue_streams, demand_key, "group", color, config, enabled_modules, default_data_sources)
VALUES
  -- Waterfront
  ('marina',            'Marina',                    'Marina',          'specialty',   'Anchor',    true,  1,  'Slips',         'Slip Occ %',       'Slip',   '["Fuel Revenue","Storage Revenue","Service Revenue"]',          'Boat Ownership %',            'Waterfront', '#00d4ff', '{}', '["crm","salesComps","modeling","proForma","rentRoll","fuelSales","shipStore","vdr","dueDiligence","docket"]', '[]'),
  ('dry_stack',         'Dry Stack / Boatyard',      'Dry Stack',       'specialty',   'Warehouse', true,  2,  'Rack Units',    'Rack Occ %',       'Rack',   '["Storage Fees","Launch Fees","Service Revenue"]',              'Boat Ownership %',            'Waterfront', '#06b6d4', '{}', '["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('yacht_club',        'Yacht Club',                'Yacht Club',      'specialty',   'Anchor',    false, 3,  'Slips',         'Membership Occ',   'Slip',   '["Membership Dues","Slip Fees","F&B Revenue"]',                 'HH Boat Ownership %',         'Waterfront', '#38bdf8', '{}', '["crm","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('waterfront_resort', 'Waterfront Resort',         'WF Resort',       'hospitality', 'Hotel',     false, 4,  'Keys',          'Occ %',            'Key',    '["Room Revenue","Marina Fees","F&B Revenue"]',                  'Tourism Index',               'Waterfront', '#0ea5e9', '{}', '["crm","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('boat_rental',       'Boat Rental / Charter',     'Boat Rental',     'specialty',   'Anchor',    false, 5,  'Vessels',       'Utilization %',    'Vessel', '["Charter Revenue","Rental Revenue","Fuel/Ancillary"]',         'Visitor Spend Index',         'Waterfront', '#22d3ee', '{}', '["crm","modeling","proForma","vdr","dueDiligence"]', '[]'),
  -- Hospitality
  ('hotel',             'Hotel',                     'Hotel',           'hospitality', 'Hotel',     false, 6,  'Keys',          'Occ % / RevPAR',   'Key',    '["Room Revenue","F&B Revenue","Ancillary"]',                    'Tourism Index',               'Hospitality','#a78bfa', '{}', '["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('boutique_hotel',    'Boutique Hotel',            'Boutique Hotel',  'hospitality', 'Hotel',     false, 7,  'Keys',          'Occ %',            'Key',    '["Room Revenue","F&B Revenue","Events Revenue"]',               'ADR vs Market',               'Hospitality','#8b5cf6', '{}', '["crm","modeling","proForma","vdr","dueDiligence"]', '[]'),
  ('motel',             'Motel / Motor Inn',         'Motel',           'hospitality', 'Hotel',     false, 8,  'Keys',          'Occ %',            'Key',    '["Room Revenue","Vending","Ancillary"]',                        'Drive-by Traffic',            'Hospitality','#c084fc', '{}', '["crm","salesComps","modeling","proForma","vdr","dueDiligence"]', '[]'),
  ('extended_stay',     'Extended Stay',             'Extended Stay',   'hospitality', 'Hotel',     false, 9,  'Units',         'Occ %',            'Unit',   '["Weekly Room Rev","Monthly Room Rev","Ancillary"]',            'Corporate Demand Idx',        'Hospitality','#e879f9', '{}', '["crm","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('rv_park',           'RV Park / Campground',      'RV Park',         'specialty',   'Home',      false, 10, 'Sites',         'Occ %',            'Site',   '["Site Rental","Hook-Ups","Store/Amenity"]',                    'Snowbird Season %',           'Hospitality','#f59e0b', '{}', '["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('glamping',          'Glamping / Eco-Resort',     'Glamping',        'hospitality', 'Home',      false, 11, 'Units',         'Occ %',            'Unit',   '["Accommodation Rev","Experience Rev","F&B"]',                  'Experiential Travel Idx',     'Hospitality','#fbbf24', '{}', '["crm","modeling","proForma","vdr","dueDiligence"]', '[]'),
  -- Residential
  ('multifamily',       'Multifamily',               'Multifamily',     'residential', 'Building2', false, 12, 'Units',         'Occ %',            'Unit',   '["Rental Revenue","Parking Revenue","Ancillary"]',              'Renter Demand Index',         'Residential','#4ade80', '{}', '["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"]', '["zillow_bridge","mls_reso"]'),
  ('garden_apt',        'Garden Apartments',         'Garden Apts',     'residential', 'Building2', false, 13, 'Units',         'Occ %',            'Unit',   '["Rental Revenue","Laundry/Vend","Storage"]',                   'Rent Growth YoY %',           'Residential','#22c55e', '{}', '["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('senior_housing',    'Senior Housing',            'Senior Housing',  'residential', 'Building2', false, 14, 'Units',         'Occ %',            'Unit',   '["Rental Revenue","Care Fees","Ancillary Services"]',           '65+ Population Growth',       'Residential','#16a34a', '{}', '["crm","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('student_housing',   'Student Housing',           'Student Housing', 'residential', 'Building2', false, 15, 'Beds',          'Bed Occ %',        'Bed',    '["Rental Revenue","Parking Revenue","Amenity Fees"]',           'University Enrollment',       'Residential','#15803d', '{}', '["crm","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('mobile_home_park',  'Mobile Home Park',          'MHP',             'residential', 'Home',      false, 16, 'Pads',          'Pad Occ %',        'Pad',    '["Pad Rental Revenue","Utility Revenue","Ancillary"]',          'Affordable Housing Demand',   'Residential','#166534', '{}', '["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('condo',             'Condo / Condo-tel',         'Condo',           'residential', 'Building',  false, 17, 'Units',         'Occ %',            'Unit',   '["HOA Fees","Rental Revenue","Ancillary"]',                     'Condo Demand Index',          'Residential','#86efac', '{}', '["crm","salesComps","modeling","proForma","vdr","dueDiligence"]', '["zillow_bridge"]'),
  ('sfr',               'Single Family Rental',      'SFR',             'residential', 'Home',      false, 18, 'Units',         'Occ %',            'Unit',   '["Rental Revenue","Ancillary Fees","Storage"]',                 'SFR Demand Index',            'Residential','#bbf7d0', '{}', '["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"]', '["zillow_bridge","mls_reso"]'),
  -- Industrial
  ('industrial',        'Industrial',                'Industrial',      'commercial',  'Factory',   false, 19, 'Sq Ft',         'Leased %',         'Sq Ft',  '["Base Rent","NNN Recoveries","Ancillary"]',                    'Industrial Absorption Rate',  'Industrial', '#fb923c', '{}', '["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('warehouse',         'Warehouse / Distribution',  'Warehouse',       'commercial',  'Warehouse', false, 20, 'Sq Ft',         'Leased %',         'Sq Ft',  '["Base Rent","NNN Recoveries","Loading Dock Fees"]',            'E-Commerce Growth Rate',      'Industrial', '#f97316', '{}', '["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('cold_storage',      'Cold Storage / Refrigerated','Cold Storage',   'commercial',  'Warehouse', false, 21, 'Sq Ft',         'Leased %',         'Sq Ft',  '["Base Rent","Utility Recoveries","Handling Fees"]',            'Food Supply Chain Index',     'Industrial', '#ea580c', '{}', '["crm","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('self_storage',      'Self Storage',              'Self Storage',    'commercial',  'Box',       false, 22, 'Units',         'Occ %',            'Unit',   '["Rental Revenue","Insurance Revenue","Ancillary"]',            'Self Storage Demand',         'Industrial', '#c2410c', '{}', '["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('data_center',       'Data Center',               'Data Center',     'commercial',  'Warehouse', false, 23, 'MW / Sq Ft',    'Power Util %',     'MW',     '["Colocation Revenue","Power Revenue","Connectivity Fees"]',    'Cloud Demand Index',          'Industrial', '#9a3412', '{}', '["crm","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('truck_terminal',    'Truck Terminal / Flex Industrial','Truck Terminal','commercial','Truck',    false, 24, 'Sq Ft / Doors', 'Leased %',         'Sq Ft',  '["Base Rent","NNN Recoveries","Trailer Storage"]',              'Freight Volume Index',        'Industrial', '#7c2d12', '{}', '["crm","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  -- Office
  ('office',            'Office',                    'Office',          'commercial',  'Building2', false, 25, 'Sq Ft',         'Leased %',         'Sq Ft',  '["Base Rent","Operating Expense Recoveries","Parking Revenue"]','Office Absorption Rate',      'Office',     '#60a5fa', '{}', '["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('medical_office',    'Medical Office',            'Medical Office',  'commercial',  'Building2', false, 26, 'Sq Ft',         'Leased %',         'Sq Ft',  '["Base Rent","NNN Recoveries","Procedure Revenue"]',            'Healthcare Demand Index',     'Office',     '#3b82f6', '{}', '["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('coworking',         'Co-working / Flex Office',  'Co-working',      'commercial',  'Building2', false, 27, 'Desks / Sq Ft', 'Desk Occ %',       'Desk',   '["Membership Revenue","Day Pass Revenue","Conference Room Fees"]','Remote Work Index',          'Office',     '#2563eb', '{}', '["crm","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('creative_office',   'Creative Office / Loft',    'Creative Office', 'commercial',  'Building2', false, 28, 'Sq Ft',         'Leased %',         'Sq Ft',  '["Base Rent","CAM Recoveries","Ancillary"]',                    'Creative Industry Employment', 'Office',    '#1d4ed8', '{}', '["crm","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  -- Retail
  ('retail',            'Retail Strip Center',       'Retail',          'commercial',  'Store',     false, 29, 'Sq Ft',         'Leased %',         'Sq Ft',  '["Base Rent","CAM Recoveries","Percentage Rent"]',              'Retail Sales Index',          'Retail',     '#f43f5e', '{}', '["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('anchored_retail',   'Anchored Shopping Center',  'Anchored Retail', 'commercial',  'Store',     false, 30, 'Sq Ft',         'Leased %',         'Sq Ft',  '["Base Rent","CAM Recoveries","Outparcel Revenue"]',            'Anchor Tenant Sales PSF',     'Retail',     '#e11d48', '{}', '["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('nnn_single_tenant', 'NNN Single Tenant / Net Lease','NNN',          'commercial',  'Store',     false, 31, 'Sq Ft',         'Occ %',            'Sq Ft',  '["Base Rent","Lease Escalations","Ancillary"]',                 'Tenant Credit Rating',        'Retail',     '#be123c', '{}', '["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('car_wash',          'Car Wash',                  'Car Wash',        'specialty',   'Store',     false, 32, 'Bays',          'Wash Volume',      'Bay',    '["Wash Revenue","Membership Revenue","Ancillary"]',             'Vehicle Count Index',         'Retail',     '#9f1239', '{}', '["crm","modeling","proForma","vdr","dueDiligence"]', '[]'),
  ('laundromat',        'Laundromat',                'Laundromat',      'specialty',   'Store',     false, 33, 'Machines',      'Util %',           'Machine','["Wash Revenue","Dry Revenue","Ancillary"]',                    'Population Density',          'Retail',     '#881337', '{}', '["crm","modeling","proForma","vdr","dueDiligence"]', '[]'),
  -- Other
  ('business',          'Business Acquisition',      'Business',        'specialty',   'Briefcase', false, 34, 'Revenue',       'Utilization %',    'EBITDA', '["Operating Revenue","Service Revenue","Ancillary"]',           'Industry Growth Rate',        'Other',      '#854d0e', '{}', '["crm","modeling","proForma","vdr","dueDiligence"]', '[]'),
  ('mixed_use',         'Mixed Use',                 'Mixed Use',       'commercial',  'Layers',    false, 35, 'Sq Ft / Units', 'Leased %',         'Sq Ft',  '["Retail Rent","Residential Rent","Parking Revenue"]',          'Mixed-Use Demand Index',      'Other',      '#713f12', '{}', '["crm","salesComps","modeling","proForma","rentRoll","vdr","dueDiligence"]', '[]'),
  ('land',              'Land',                      'Land',            'land',        'LandPlot',  false, 36, 'Acres',         'Coverage %',       'Acre',   '["Land Lease Revenue","Timber Revenue","Mineral Revenue"]',     'Land Price Index',            'Other',      '#a3a3a3', '{}', '["crm","salesComps","modeling","proForma","vdr","dueDiligence"]', '[]')
ON CONFLICT (key) DO UPDATE SET
  label              = EXCLUDED.label,
  short_label        = EXCLUDED.short_label,
  category           = EXCLUDED.category,
  icon               = EXCLUDED.icon,
  sort_order         = EXCLUDED.sort_order,
  enabled_modules    = EXCLUDED.enabled_modules,
  default_data_sources = EXCLUDED.default_data_sources,
  size_label         = EXCLUDED.size_label,
  occ_label          = EXCLUDED.occ_label,
  price_unit         = EXCLUDED.price_unit,
  revenue_streams    = EXCLUDED.revenue_streams,
  demand_key         = EXCLUDED.demand_key,
  "group"            = EXCLUDED."group",
  color              = EXCLUDED.color,
  updated_at         = now();
