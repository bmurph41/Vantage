#!/bin/bash
# =============================================================
#  PATCH 01 — Schema: CRM contact roles, company type enum,
#              relationship score + investment criteria fields
#
#  After running this script:
#    npm run db:push
#  Then verify no TypeScript errors:
#    npx tsc --noEmit 2>&1 | head -30
# =============================================================

set -e
SCHEMA="shared/schema.ts"

echo "→ Checking schema file exists..."
[ -f "$SCHEMA" ] || { echo "ERROR: $SCHEMA not found. Run from project root."; exit 1; }

echo "→ Backing up schema..."
cp "$SCHEMA" "${SCHEMA}.bak_$(date +%Y%m%d_%H%M%S)"

# ── 1. Add CRM-specific contact role enum ──────────────────────
# Find the last pgEnum declaration and insert after it.
# We look for a safe anchor: the pendingPropertyStatusEnum line.
ANCHOR='export const pendingPropertyStatusEnum'

if grep -q 'crmContactRoleEnum' "$SCHEMA"; then
  echo "  ✓ crmContactRoleEnum already exists — skipping"
else
  node --input-type=module << 'JSEOF'
import { readFileSync, writeFileSync } from 'fs';
const path = 'shared/schema.ts';
const src = readFileSync(path, 'utf8');

const newEnums = `
// ─── CRM Contact Role (investment context) ───────────────────────────────────
export const crmContactRoleEnum = pgEnum('crm_contact_role', [
  'owner',
  'listing_broker',
  'buyers_broker',
  'property_manager',
  'lender',
  'attorney',
  'appraiser',
  'investor_lp',
  'investor_gp',
  'family_office',
  'institutional_buyer',
  'syndicator',
  'government',
  'other',
]);

// ─── CRM Company Type ─────────────────────────────────────────────────────────
export const crmCompanyTypeEnum = pgEnum('crm_company_type', [
  'brokerage',
  'private_equity',
  'family_office',
  'reit',
  'owner_operator',
  'debt_fund',
  'syndicator',
  'property_management',
  'legal_title',
  'government',
  'other',
]);

// ─── CRM AUM Range ────────────────────────────────────────────────────────────
export const crmAumRangeEnum = pgEnum('crm_aum_range', [
  'under_10m',
  '10m_100m',
  '100m_1b',
  'over_1b',
]);

`;

// Insert before pendingPropertyStatusEnum
const anchor = 'export const pendingPropertyStatusEnum';
if (!src.includes('crmContactRoleEnum') && src.includes(anchor)) {
  const updated = src.replace(anchor, newEnums + anchor);
  writeFileSync(path, updated, 'utf8');
  console.log('  ✓ Added crmContactRoleEnum, crmCompanyTypeEnum, crmAumRangeEnum');
} else if (src.includes('crmContactRoleEnum')) {
  console.log('  ✓ Already present');
} else {
  console.error('  ✗ Anchor not found — append enums manually before pendingPropertyStatusEnum');
  process.exit(1);
}
JSEOF
fi

# ── 2. Add CRM role + investment criteria fields to crmContacts ──
if grep -q 'crmRole.*crmContactRoleEnum\|targetAssetClasses.*jsonb' "$SCHEMA"; then
  echo "  ✓ crmContacts investment fields already exist — skipping"
else
  node --input-type=module << 'JSEOF'
import { readFileSync, writeFileSync } from 'fs';
const path = 'shared/schema.ts';
const src = readFileSync(path, 'utf8');

// Find the crmContacts table and look for a field we can insert after.
// We'll insert after "contactTag" or "leadStatus" — whichever comes last.
// Strategy: find "ownerId:" in the crmContacts block and insert our fields before it.

const newFields = `
  // ── CRM Investment Profile ──────────────────────────────────────────────────
  crmRole: crmContactRoleEnum('crm_role'),                            // Owner, Broker, Investor, etc.
  sourceType: varchar('source_type', { length: 50 }),                 // Referral, Conference, CoStar, etc.
  linkedInUrl: varchar('linkedin_url', { length: 500 }),
  targetAssetClasses: jsonb('target_asset_classes').$type<string[]>().default([]),
  targetGeographies: jsonb('target_geographies').$type<string[]>().default([]),
  dealSizeMin: numeric('deal_size_min', { precision: 15, scale: 2 }),
  dealSizeMax: numeric('deal_size_max', { precision: 15, scale: 2 }),
  returnCriteriaMin: numeric('return_criteria_min', { precision: 6, scale: 4 }), // min cap rate / IRR
  investmentNotes: text('investment_notes'),
  relationshipScore: integer('relationship_score').default(0),        // 0–100 computed score
  lastContactedAt: timestamp('last_contacted_at'),
  nextFollowupDate: date('next_followup_date'),
  ndaOnFile: boolean('nda_on_file').default(false),
  emailConsent: boolean('email_consent').default(false),
  emailConsentDate: timestamp('email_consent_date'),
`;

// Find the anchor inside crmContacts table — insert before ownerId field
// The ownerId field appears as: ownerId: varchar('owner_id')
const anchor = `  ownerId: varchar('owner_id')`;

// Make sure we're targeting the crmContacts ownerId, not another table's
// We do a contextual replace: only the first occurrence after 'export const crmContacts'
const crmIdx = src.indexOf('export const crmContacts');
if (crmIdx === -1) {
  console.error('  ✗ crmContacts table not found in schema');
  process.exit(1);
}

const beforeCrm = src.slice(0, crmIdx);
const afterCrm = src.slice(crmIdx);

const ownerIdx = afterCrm.indexOf(anchor);
if (ownerIdx === -1) {
  console.error('  ✗ ownerId anchor not found in crmContacts block');
  process.exit(1);
}

const updated = beforeCrm + afterCrm.slice(0, ownerIdx) + newFields + afterCrm.slice(ownerIdx);

if (!src.includes('crmRole') && !src.includes('targetAssetClasses')) {
  writeFileSync(path, updated, 'utf8');
  console.log('  ✓ Added investment profile fields to crmContacts');
} else {
  console.log('  ✓ Fields already present');
}
JSEOF
fi

# ── 3. Add companyType + AUM + mandate fields to crmCompanies ──
if grep -q 'companyType.*crmCompanyTypeEnum\|aumRange.*crmAumRangeEnum' "$SCHEMA"; then
  echo "  ✓ crmCompanies fields already exist — skipping"
else
  node --input-type=module << 'JSEOF'
import { readFileSync, writeFileSync } from 'fs';
const path = 'shared/schema.ts';
const src = readFileSync(path, 'utf8');

const newFields = `
  // ── Firm Classification & Investment Mandate ────────────────────────────────
  companyType: crmCompanyTypeEnum('company_type'),
  aumRange: crmAumRangeEnum('aum_range'),
  aumApprox: numeric('aum_approx', { precision: 18, scale: 2 }),
  targetAssetClasses: jsonb('target_asset_classes').$type<string[]>().default([]),
  targetGeographies: jsonb('target_geographies').$type<string[]>().default([]),
  dealSizeMin: numeric('deal_size_min', { precision: 15, scale: 2 }),
  dealSizeMax: numeric('deal_size_max', { precision: 15, scale: 2 }),
  investmentMandate: text('investment_mandate'),
  ndaOnFile: boolean('nda_on_file').default(false),
  ndaExpiryDate: date('nda_expiry_date'),
  linkedInUrl: varchar('linkedin_url', { length: 500 }),
  parentCompanyId: varchar('parent_company_id'),                      // Self-ref for hierarchy
`;

// Insert before ownerId in crmCompanies
const crmIdx = src.indexOf('export const crmCompanies');
if (crmIdx === -1) {
  console.error('  ✗ crmCompanies table not found');
  process.exit(1);
}
const afterCrm = src.slice(crmIdx);
const anchor = `  ownerId: varchar('owner_id')`;
const ownerIdx = afterCrm.indexOf(anchor);
if (ownerIdx === -1) {
  console.error('  ✗ ownerId anchor not found in crmCompanies');
  process.exit(1);
}

const beforeCrm = src.slice(0, crmIdx);
const updated = beforeCrm + afterCrm.slice(0, ownerIdx) + newFields + afterCrm.slice(ownerIdx);

if (!src.includes('companyType') || !src.includes('crmCompanyTypeEnum')) {
  writeFileSync(path, updated, 'utf8');
  console.log('  ✓ Added company type + mandate fields to crmCompanies');
} else {
  console.log('  ✓ Fields already present');
}
JSEOF
fi

# ── 4. Add listing status enum + fields to crmProperties if missing ──
if grep -q 'listingStatusEnum\|listing_status_enum' "$SCHEMA"; then
  echo "  ✓ listingStatusEnum already exists — skipping"
else
  node --input-type=module << 'JSEOF'
import { readFileSync, writeFileSync } from 'fs';
const path = 'shared/schema.ts';
const src = readFileSync(path, 'utf8');

const newEnum = `
// ─── CRM Property Listing Status ─────────────────────────────────────────────
export const crmListingStatusEnum = pgEnum('crm_listing_status', [
  'off_market',
  'on_market',
  'under_loi',
  'under_contract',
  'closed',
  'portfolio',
  'watchlist',
]);

`;

const anchor = 'export const pendingPropertyStatusEnum';
if (src.includes(anchor) && !src.includes('crmListingStatusEnum')) {
  const updated = src.replace(anchor, newEnum + anchor);
  writeFileSync(path, updated, 'utf8');
  console.log('  ✓ Added crmListingStatusEnum');
} else {
  console.log('  ✓ Already present or anchor missing');
}
JSEOF
fi

# ── 5. Add listingStatus + geocode + env flags to crmProperties ──
if grep -q 'listingStatus.*crmListingStatusEnum\|latLng\|latitude.*crmProperties' "$SCHEMA"; then
  echo "  ✓ crmProperties extended fields already exist — skipping"
else
  node --input-type=module << 'JSEOF'
import { readFileSync, writeFileSync } from 'fs';
const path = 'shared/schema.ts';
const src = readFileSync(path, 'utf8');

const newFields = `
  // ── Listing & Deal Status ───────────────────────────────────────────────────
  listingStatus: crmListingStatusEnum('listing_status').default('off_market'),
  askingPrice: numeric('asking_price', { precision: 15, scale: 2 }),
  lastSalePrice: numeric('last_sale_price', { precision: 15, scale: 2 }),
  lastSaleDate: date('last_sale_date'),
  // ── Geocode ─────────────────────────────────────────────────────────────────
  latitude: numeric('latitude', { precision: 10, scale: 7 }),
  longitude: numeric('longitude', { precision: 10, scale: 7 }),
  // ── Environmental / Due Diligence Flags ─────────────────────────────────────
  hasEnvIssues: boolean('has_env_issues').default(false),
  hasTitleIssues: boolean('has_title_issues').default(false),
  inFloodZone: boolean('in_flood_zone').default(false),
  hasWetlands: boolean('has_wetlands').default(false),
  // ── Marina-Specific ──────────────────────────────────────────────────────────
  totalSlips: integer('total_slips'),
  drySlips: integer('dry_slips'),
  hasFuelDock: boolean('has_fuel_dock').default(false),
  hasRepairYard: boolean('has_repair_yard').default(false),
  waterDepthFt: numeric('water_depth_ft', { precision: 5, scale: 1 }),
  dockMaterial: varchar('dock_material', { length: 100 }),
  yearBuilt: integer('year_built'),
`;

const crmIdx = src.indexOf('export const crmProperties');
if (crmIdx === -1) {
  console.error('  ✗ crmProperties table not found');
  process.exit(1);
}
const afterCrm = src.slice(crmIdx);
// Insert before ownerId in crmProperties
const anchor = `  ownerId: varchar('owner_id')`;
const ownerIdx = afterCrm.indexOf(anchor);
if (ownerIdx === -1) {
  // Try alternate anchor
  const alt = `  orgId: varchar('org_id')`;
  const altIdx = afterCrm.indexOf(alt, 50); // skip first match which might be same table start
  if (altIdx === -1) {
    console.error('  ✗ Could not find insertion anchor in crmProperties');
    process.exit(1);
  }
  const beforeCrm = src.slice(0, crmIdx);
  const updated = beforeCrm + afterCrm.slice(0, altIdx) + newFields + afterCrm.slice(altIdx);
  writeFileSync(path, updated, 'utf8');
} else {
  const beforeCrm = src.slice(0, crmIdx);
  const updated = beforeCrm + afterCrm.slice(0, ownerIdx) + newFields + afterCrm.slice(ownerIdx);
  writeFileSync(path, updated, 'utf8');
}
console.log('  ✓ Added listing status, geocode, env flags, marina fields to crmProperties');
JSEOF
fi

echo ""
echo "✅ Patch 01 complete."
echo ""
echo "Next steps:"
echo "  1. Run: npm run db:push"
echo "  2. Check: npx tsc --noEmit 2>&1 | head -40"
echo "  3. If TS errors, check shared/schema.ts for any enum reference issues"
echo "  4. Then run crm_patch_02_property_fm.sh"
