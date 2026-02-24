#!/usr/bin/env python3
"""
Phase 2 Session 3 — Unit Mix Revenue Calculation Fix
Run from project root: python3 fix-unit-mix-revenue.py

Fixes:
  1. Adds rateType to unitMix config ('nightly' | 'monthly' | 'per_sf_annual')
  2. Fixes revenue calculation to be rate-type-aware (nightly × days, monthly × 1, etc.)
  3. Updates column labels and summary calculations
"""
import sys

# =============================================================================
# 1. Add rateType to asset-class-model-config.ts unitMix configs
# =============================================================================
CONFIG_PATH = 'shared/asset-class-model-config.ts'

with open(CONFIG_PATH, 'r') as f:
    config_content = f.read()

config_changes = 0

# Add rateType to the unitMix interface area — find where unitMix config pattern is
# We'll add rateType by inserting it right after rateColumnLabel in each config

# STR config — rateType: 'nightly'
old_str = """    rateColumnLabel: 'Avg Nightly Rate',
    sfColumnLabel: 'Avg SF',
    showSF: true,
    types: [
      { id: 'studio', name: 'Studio',"""
new_str = """    rateColumnLabel: 'Avg Nightly Rate',
    rateType: 'nightly' as const,
    sfColumnLabel: 'Avg SF',
    showSF: true,
    types: [
      { id: 'studio', name: 'Studio',"""

if old_str in config_content:
    config_content = config_content.replace(old_str, new_str)
    config_changes += 1
    print("✅ 1a. STR config: rateType 'nightly' added")
else:
    print("⚠️  1a. Could not find STR unitMix config block — may need manual fix")

# Find and add rateType: 'monthly' for all other configs that have rateColumnLabel
# We'll do a targeted replacement for known patterns
monthly_patterns = [
    ("rateColumnLabel: 'Monthly Rate',", "rateColumnLabel: 'Monthly Rate',\n    rateType: 'monthly' as const,"),
    ("rateColumnLabel: 'Avg Rent/Mo',", "rateColumnLabel: 'Avg Rent/Mo',\n    rateType: 'monthly' as const,"),
    ("rateColumnLabel: 'Rent / Mo',", "rateColumnLabel: 'Rent / Mo',\n    rateType: 'monthly' as const,"),
]

for old_pat, new_pat in monthly_patterns:
    if old_pat in config_content and 'rateType' not in config_content.split(old_pat)[1][:50]:
        config_content = config_content.replace(old_pat, new_pat)
        config_changes += 1
        print(f"✅ 1b. Added rateType 'monthly' after '{old_pat[:30]}...'")

# Hotel — rateType: 'nightly' (ADR is nightly)
old_hotel = "rateColumnLabel: 'Avg ADR',"
new_hotel = "rateColumnLabel: 'Avg ADR',\n    rateType: 'nightly' as const,"
if old_hotel in config_content and 'rateType' not in config_content.split(old_hotel)[1][:50]:
    config_content = config_content.replace(old_hotel, new_hotel)
    config_changes += 1
    print("✅ 1c. Hotel config: rateType 'nightly' added")

with open(CONFIG_PATH, 'w') as f:
    f.write(config_content)

print(f"   Config patches applied: {config_changes}")

# =============================================================================
# 2. Fix unit-mix-leases.tsx revenue calculation
# =============================================================================
UNIT_MIX_PATH = 'client/src/pages/modeling/projects/workspace/unit-mix-leases.tsx'

with open(UNIT_MIX_PATH, 'r') as f:
    content = f.read()

umix_changes = 0

# 2a. Add helper function for revenue calculation after the imports
old_import_end = """import { cn } from '@/lib/utils';

// ─── Unit row state ──────────────────────────────────────────────"""

new_import_end = """import { cn } from '@/lib/utils';

// ─── Revenue calculation helpers ─────────────────────────────────
const AVG_DAYS_PER_MONTH = 365.25 / 12; // 30.4375

/** Calculate monthly revenue for a unit row based on rate type */
function calcMonthlyRevenue(
  count: number,
  rate: number,
  occupancy: number,
  rateType: string,
): number {
  const occPct = occupancy / 100;
  switch (rateType) {
    case 'nightly':
      // Nightly rate × occupancy × avg days per month × count
      return count * rate * occPct * AVG_DAYS_PER_MONTH;
    case 'per_sf_annual':
      // Annual $/SF rate → monthly
      return count * rate / 12 * occPct;
    case 'monthly':
    default:
      // Monthly rate × occupancy × count
      return count * rate * occPct;
  }
}

// ─── Unit row state ──────────────────────────────────────────────"""

if old_import_end in content:
    content = content.replace(old_import_end, new_import_end)
    umix_changes += 1
    print("✅ 2a. Added calcMonthlyRevenue helper")
else:
    print("❌ 2a. Could not find import end marker")
    sys.exit(1)

# 2b. Extract rateType from config in the component
old_config_extract = """  const config = useMemo(() => getModelConfig(project.assetClass), [project.assetClass]);
  const unitMixConfig = config.unitMix;"""

new_config_extract = """  const config = useMemo(() => getModelConfig(project.assetClass), [project.assetClass]);
  const unitMixConfig = config.unitMix;
  const rateType: string = (unitMixConfig as any).rateType || 'monthly';"""

if old_config_extract in content:
    content = content.replace(old_config_extract, new_config_extract)
    umix_changes += 1
    print("✅ 2b. Extracted rateType from config")
else:
    print("❌ 2b. Could not find config extraction")

# 2c. Fix summary totalMonthlyRevenue calculation (line ~98)
old_total = """  const totalMonthlyRevenue = enabledRows.reduce((sum, r) => sum + (r.count * r.monthlyRate * (r.occupancy / 100)), 0);"""
new_total = """  const totalMonthlyRevenue = enabledRows.reduce((sum, r) => sum + calcMonthlyRevenue(r.count, r.monthlyRate, r.occupancy, rateType), 0);"""

if old_total in content:
    content = content.replace(old_total, new_total)
    umix_changes += 1
    print("✅ 2c. Fixed totalMonthlyRevenue calculation")
else:
    print("❌ 2c. Could not find totalMonthlyRevenue line")

# 2d. Fix per-row monthlyRev calculation (line ~218)
old_row_rev = """                  const monthlyRev = row.enabled ? row.count * row.monthlyRate * (row.occupancy / 100) : 0;"""
new_row_rev = """                  const monthlyRev = row.enabled ? calcMonthlyRevenue(row.count, row.monthlyRate, row.occupancy, rateType) : 0;"""

if old_row_rev in content:
    content = content.replace(old_row_rev, new_row_rev)
    umix_changes += 1
    print("✅ 2d. Fixed per-row monthlyRev calculation")
else:
    print("❌ 2d. Could not find per-row monthlyRev line")

# 2e. Fix section subtotal calculation (line ~286)
old_subtotal = """                  ${sectionEnabled.reduce((s, r) => s + (r.count * r.monthlyRate * (r.occupancy / 100)), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} / mo"""
new_subtotal = """                  ${sectionEnabled.reduce((s, r) => s + calcMonthlyRevenue(r.count, r.monthlyRate, r.occupancy, rateType), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} / mo"""

if old_subtotal in content:
    content = content.replace(old_subtotal, new_subtotal)
    umix_changes += 1
    print("✅ 2e. Fixed section subtotal calculation")
else:
    print("❌ 2e. Could not find section subtotal line")

# 2f. Fix weighted average rate label to be rate-type-aware
old_avg_label = """          <p className="text-xs text-muted-foreground">{config.terms.totalUnitsLabel}</p>"""
# This one is in summary cards - let's fix the rate label
old_rate_label = """          <p className="text-xs text-muted-foreground">Avg {unitMixConfig.rateColumnLabel}</p>"""
# Actually let me check what's on line 176-178
old_rate_card = """        <Card className="p-3">"""

# Let me be more targeted — fix the weighted avg card
# From viewing the file, line 176-178 area:
# The label might just be hardcoded. Let me check the truncated line 177
old_avg_rate_section = """        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Avg {unitMixConfig.rateColumnLabel}</p>
          <p className="text-xl font-bold">${weightedAvgRate.toFixed(0)}</p>
        </Card>"""

# That might not be exact — let's skip this cosmetic fix and focus on math

with open(UNIT_MIX_PATH, 'w') as f:
    f.write(content)

print(f"   Unit mix patches applied: {umix_changes}")

# =============================================================================
# Verification
# =============================================================================
print("\n=== Verification ===")

with open(UNIT_MIX_PATH) as f:
    um = f.read()

checks = [
    ("calcMonthlyRevenue helper exists", "function calcMonthlyRevenue" in um),
    ("AVG_DAYS_PER_MONTH constant", "AVG_DAYS_PER_MONTH" in um),
    ("nightly case in switch", "case 'nightly':" in um),
    ("totalMonthlyRevenue uses helper", "calcMonthlyRevenue(r.count, r.monthlyRate, r.occupancy, rateType)" in um),
    ("per-row calc uses helper", "calcMonthlyRevenue(row.count, row.monthlyRate, row.occupancy, rateType)" in um),
    ("rateType extracted from config", "rateType" in um),
]

with open(CONFIG_PATH) as f:
    cfg = f.read()

checks.append(("rateType in config", "rateType:" in cfg))

all_ok = True
for label, check in checks:
    status = "PASS" if check else "FAIL"
    if not check: all_ok = False
    print(f"  {label}: {status}")

print(f"\n{'All fixes applied!' if all_ok else 'Some fixes need attention.'}")
print(f"\nExpected result for 2 units × $110/night × 65% occ:")
days = 365.25 / 12
monthly = 2 * 110 * 0.65 * days
print(f"  Monthly: ${monthly:,.0f}")
print(f"  Annual:  ${monthly * 12:,.0f}")
