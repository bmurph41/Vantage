-- pack_catalog seed template
--
-- Run this on a prod-equivalent DB AFTER replacing every `price_XXX_TODO`
-- placeholder with a real Stripe price ID from your Stripe dashboard.
-- Idempotent via ON CONFLICT (pack_type) — safe to re-apply.
--
-- The 12 rows below match every value of the pack_type enum. Keep the set
-- complete; customer.subscription.updated uses this table to reverse-look-up
-- tier from price_id, so any pack type without rows here can't be upgraded
-- through the Stripe billing portal.
--
-- Columns you MUST fill: monthly_price_cents, yearly_price_cents,
-- stripe_price_id_monthly, stripe_price_id_yearly.
-- `name` and `description` are sensible defaults; edit to taste.

INSERT INTO pack_catalog (
  id, pack_type, name, description, features,
  monthly_price_cents, yearly_price_cents,
  stripe_price_id_monthly, stripe_price_id_yearly,
  dependencies, is_core, display_order, is_active, created_at, updated_at
) VALUES
  (gen_random_uuid(), 'crm_pipeline',   'CRM & Pipeline',        'Contacts, companies, deals, pipeline kanban.', '[]'::jsonb,
    0, 0, 'price_crm_pipeline_monthly_TODO',   'price_crm_pipeline_yearly_TODO',   '[]'::jsonb, true,  10, true, NOW(), NOW()),
  (gen_random_uuid(), 'modeling_tools', 'Modeling Tools',        'Pro forma, DCF, Monte Carlo, exit planning.',  '[]'::jsonb,
    0, 0, 'price_modeling_tools_monthly_TODO', 'price_modeling_tools_yearly_TODO', '[]'::jsonb, true,  20, true, NOW(), NOW()),
  (gen_random_uuid(), 'analysis',       'Comps & Analysis',      'Sales comps, rate comps, cohort + KPI analytics.', '[]'::jsonb,
    0, 0, 'price_analysis_monthly_TODO',       'price_analysis_yearly_TODO',       '[]'::jsonb, true,  30, true, NOW(), NOW()),
  (gen_random_uuid(), 'operations',     'Operations',            'Rent roll, leases, tenant management, op accounting.', '[]'::jsonb,
    0, 0, 'price_operations_monthly_TODO',     'price_operations_yearly_TODO',     '[]'::jsonb, false, 40, true, NOW(), NOW()),
  (gen_random_uuid(), 'fund_management','Fund Management',       'GP/LP fund lifecycle, capital calls, distributions.', '[]'::jsonb,
    0, 0, 'price_fund_management_monthly_TODO','price_fund_management_yearly_TODO','[]'::jsonb, false, 50, true, NOW(), NOW()),
  (gen_random_uuid(), 'lp_portal',      'LP Portal',             'Quarterly statements, K-1 delivery, side letters.',  '[]'::jsonb,
    0, 0, 'price_lp_portal_monthly_TODO',      'price_lp_portal_yearly_TODO',      '["fund_management"]'::jsonb, false, 60, true, NOW(), NOW()),
  (gen_random_uuid(), 'prospecting',    'Prospecting',           'Deal sourcing, email marketing, outbound campaigns.', '[]'::jsonb,
    0, 0, 'price_prospecting_monthly_TODO',    'price_prospecting_yearly_TODO',    '[]'::jsonb, false, 70, true, NOW(), NOW()),
  (gen_random_uuid(), 'analytics_pro',  'Analytics Pro',         'Executive dashboards, portfolio summary, reports.', '[]'::jsonb,
    0, 0, 'price_analytics_pro_monthly_TODO',  'price_analytics_pro_yearly_TODO',  '[]'::jsonb, false, 80, true, NOW(), NOW()),
  (gen_random_uuid(), 'owner',          'Owner',                 'Ownership-side tools — entity, capex, budget.',      '[]'::jsonb,
    0, 0, 'price_owner_monthly_TODO',          'price_owner_yearly_TODO',          '[]'::jsonb, false, 90, true, NOW(), NOW()),
  (gen_random_uuid(), 'investor',       'Investor',              'Investor-side tools — deal discovery, watchlists.',  '[]'::jsonb,
    0, 0, 'price_investor_monthly_TODO',       'price_investor_yearly_TODO',       '[]'::jsonb, false, 100, true, NOW(), NOW()),
  (gen_random_uuid(), 'broker',         'Broker',                'Broker subscription tiers — profile, advisory.',     '[]'::jsonb,
    0, 0, 'price_broker_monthly_TODO',         'price_broker_yearly_TODO',         '[]'::jsonb, false, 110, true, NOW(), NOW()),
  (gen_random_uuid(), 'master_comps',   'Master Comps Data',     'Industry-wide comps benchmarking data.',             '[]'::jsonb,
    0, 0, 'price_master_comps_monthly_TODO',   'price_master_comps_yearly_TODO',   '[]'::jsonb, false, 120, true, NOW(), NOW())
ON CONFLICT (pack_type) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  yearly_price_cents = EXCLUDED.yearly_price_cents,
  stripe_price_id_monthly = EXCLUDED.stripe_price_id_monthly,
  stripe_price_id_yearly = EXCLUDED.stripe_price_id_yearly,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Sanity check after apply — should return 12 rows with non-null price IDs.
-- SELECT pack_type, stripe_price_id_monthly, stripe_price_id_yearly
--   FROM pack_catalog ORDER BY display_order;
