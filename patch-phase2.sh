#!/bin/bash
# Phase 2 Fixes — Patch Script
# Patches the already-deployed inputs.tsx in place
# Run from workspace root: bash patch-phase2.sh

set -e
FILE="client/src/pages/modeling/projects/workspace/inputs.tsx"
WIZARD="shared/wizard-enhancement-config.ts"

if [ ! -f "$FILE" ]; then
  echo "❌ $FILE not found!"
  exit 1
fi

# Backup
BACKUP="backups/phase2-patch-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/$(dirname $FILE)" "$BACKUP/shared"
cp "$FILE" "$BACKUP/$FILE"
echo "📦 Backed up $FILE"

# ════════════════════════════════════════════════
# FIX 1: Double-count prevention
# ════════════════════════════════════════════════
echo "🔧 Fix 1: Double-count prevention"

# 1a. Add UNIT_MIX_RENTAL_KEYS + formatting helpers after AVG_DAYS_PER_MONTH line
python3 << 'PYEOF'
import re

filepath = "client/src/pages/modeling/projects/workspace/inputs.tsx"
with open(filepath, "r") as f:
    content = f.read()

# Fix React import
content = content.replace(
    "import { useState, useEffect, useMemo, useCallback, useRef } from 'react';",
    "import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';",
    1
)

# Insert constants + formatting after AVG_DAYS_PER_MONTH
INSERT_AFTER_MARKER = "const AVG_DAYS_PER_MONTH = 365.25 / 12;"
INSERTION = '''

/**
 * COA keys representing primary rental/room revenue.
 * Excluded from compute payload when unit mix has active rows (prevents double-count).
 */
const UNIT_MIX_RENTAL_KEYS = new Set([
  'grossRentalIncome', 'grossPotentialRent', 'netRentalIncome',
  'roomRevenue', 'slipRental', 'storageRental', 'baseRent',
  'grossRent', 'totalRentalIncome', 'rentalIncome', 'accommodationRevenue',
]);

/** Format number as $1,234,567 or ($1,234,567) for negatives */
function fmtCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
  if (isNaN(num) || num === 0) return '';
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return num < 0 ? `($${formatted})` : `$${formatted}`;
}

/** Format number as 3.00% */
function fmtPercent(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
  if (isNaN(num) || num === 0) return '';
  return `${num.toFixed(2)}%`;
}

/** Hook for format-on-blur behavior */
function useFormattedInput(
  value: string,
  onChange: (raw: string) => void,
  formatter: (v: string) => string,
) {
  const [displayValue, setDisplayValue] = React.useState('');
  const [isFocused, setIsFocused] = React.useState(false);
  React.useEffect(() => {
    if (!isFocused) setDisplayValue(value ? formatter(value) : '');
  }, [value, isFocused, formatter]);
  const handleFocus = () => { setIsFocused(true); setDisplayValue(value); };
  const handleBlur = () => { setIsFocused(false); setDisplayValue(value ? formatter(value) : ''); };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.-]/g, '');
    setDisplayValue(e.target.value);
    onChange(raw);
  };
  return { displayValue: isFocused ? displayValue || value : displayValue, handleFocus, handleBlur, handleChange };
}
'''

idx = content.find(INSERT_AFTER_MARKER)
if idx == -1:
    print("  ⚠️ AVG_DAYS_PER_MONTH not found")
else:
    pos = idx + len(INSERT_AFTER_MARKER)
    content = content[:pos] + INSERTION + content[pos:]
    print("  ✅ Added UNIT_MIX_RENTAL_KEYS + formatting helpers")

# 1b. Add hasActiveUnitMix + modify buildAssumptionsPayload
OLD_BUILD = """  const buildAssumptionsPayload = useCallback(() => {
    const assumptions: Record<string, any> = {};
    for (const [key, val] of Object.entries(coaValues)) {
      const numVal = Number(val);
      if (!isNaN(numVal) && numVal !== 0) {
        assumptions[key] = numVal;
      }
    }"""

NEW_BUILD = """  const hasActiveUnitMix = useMemo(() => {
    return unitRows.some(r => r.enabled && r.count > 0 && r.monthlyRate > 0);
  }, [unitRows]);

  const buildAssumptionsPayload = useCallback(() => {
    const assumptions: Record<string, any> = {};
    for (const [key, val] of Object.entries(coaValues)) {
      const numVal = Number(val);
      if (!isNaN(numVal) && numVal !== 0) {
        if (hasActiveUnitMix && UNIT_MIX_RENTAL_KEYS.has(key)) continue;
        assumptions[key] = numVal;
      }
    }"""

content = content.replace(OLD_BUILD, NEW_BUILD, 1)
print("  ✅ Added hasActiveUnitMix + dedup logic")

# Fix dependency array
content = content.replace(
    "}, [coaValues, customRevenue, customExpenses]);",
    "}, [coaValues, customRevenue, customExpenses, hasActiveUnitMix]);",
    1
)

# 1c. Add unitMixAnnualRevenue alias
content = content.replace(
    "  // Combined financials\n  const totalRevenue = (computedFinancials?.totalRevenue ?? 0) + (unitMixMonthlyRevenue * 12);",
    "  // Combined financials (no double-count: rental keys excluded from compute when unit mix active)\n  const unitMixAnnualRevenue = unitMixMonthlyRevenue * 12;\n  const totalRevenue = (computedFinancials?.totalRevenue ?? 0) + unitMixAnnualRevenue;",
    1
)
print("  ✅ Added unitMixAnnualRevenue alias")

# ════════════════════════════════════════════════
# FIX 2: Formatting — COAFieldRow
# ════════════════════════════════════════════════
print("🔧 Fix 2: Formatting standards")

# Replace COAFieldRow input with formatted version
OLD_COA_INPUT = '''      <div className="relative flex-1 max-w-[160px]">
        <span className="absolute left-2 top-1/2 -translate-y-1/2">
          {getInputIcon(field.inputType)}
        </span>
        <Input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(field.key, e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder={field.defaultValue !== undefined ? String(field.defaultValue) : '0'}
          className="h-7 text-xs pl-7 tabular-nums"
        />
      </div>
      {field.inputType === 'percent' && (
        <span className="text-xs text-muted-foreground">%</span>
      )}'''

NEW_COA_INPUT = '''      <COAFormattedInput field={field} value={value} onChange={onChange} />'''

content = content.replace(OLD_COA_INPUT, NEW_COA_INPUT, 1)

# Add COAFormattedInput component before COAFieldRow
COA_FORMATTED = '''
function COAFormattedInput({ field, value, onChange }: {
  field: COAFieldDef; value: string; onChange: (key: string, value: string) => void;
}) {
  const formatter = field.inputType === 'percent' ? fmtPercent : fmtCurrency;
  const fmt = useFormattedInput(value, (raw) => onChange(field.key, raw), formatter);
  return (
    <>
      <div className="relative flex-1 max-w-[160px]">
        {!fmt.displayValue && <span className="absolute left-2 top-1/2 -translate-y-1/2">{getInputIcon(field.inputType)}</span>}
        <Input type="text" inputMode="decimal" value={fmt.displayValue}
          onChange={fmt.handleChange} onFocus={fmt.handleFocus} onBlur={fmt.handleBlur}
          placeholder={field.defaultValue !== undefined ? String(field.defaultValue) : '0'}
          className={`h-7 text-xs tabular-nums ${fmt.displayValue ? 'pl-2' : 'pl-7'}`} />
      </div>
      {field.inputType === 'percent' && !fmt.displayValue && <span className="text-xs text-muted-foreground">%</span>}
    </>
  );
}

'''
content = content.replace("function COAFieldRow({", COA_FORMATTED + "function COAFieldRow({", 1)
print("  ✅ Added COAFormattedInput with blur formatting")

# Format unit mix revenue display
content = content.replace(
    """{row.enabled ? `$${monthlyRev.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}""",
    """{row.enabled ? fmtCurrency(monthlyRev) : '—'}""",
    1
)

content = content.replace(
    """                    ${subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} / mo""",
    """                    {fmtCurrency(subtotal)} / mo""",
    1
)
print("  ✅ Formatted unit mix displays with fmtCurrency")

# ════════════════════════════════════════════════
# FIX 2b: DynamicField formatting
# ════════════════════════════════════════════════

OLD_DYNAMIC = '''      <div className="relative">
        {field.type === 'currency' && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
        )}
        <Input
          type={field.type === 'text' ? 'text' : 'number'}
          step={field.type === 'percent' ? '0.1' : field.type === 'integer' ? '1' : '0.01'}
          min={field.type !== 'text' ? '0' : undefined}
          placeholder={field.placeholder || ''}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'h-8',
            field.type === 'currency' ? 'pl-7' : '',
            field.suffix ? 'pr-12' : ''
          )}
        />
        {field.suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {field.suffix}
          </span>
        )}
        {field.type === 'percent' && !field.suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
        )}
      </div>'''

NEW_DYNAMIC = '''      <DynFormattedInput field={field} value={value} onChange={onChange} />'''

content = content.replace(OLD_DYNAMIC, NEW_DYNAMIC, 1)

# Add DynFormattedInput before DynamicField
DYN_FORMATTED = '''
function DynFormattedInput({ field, value, onChange }: {
  field: InputFieldDef; value: string; onChange: (value: string) => void;
}) {
  const isCurrency = field.type === 'currency';
  const isPercent = field.type === 'percent';
  const formatter = isPercent ? fmtPercent : fmtCurrency;
  const fmt = useFormattedInput(value, onChange, formatter);
  if (isCurrency || isPercent) {
    return (
      <div className="relative">
        {!fmt.displayValue && isCurrency && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>}
        <Input type="text" inputMode="decimal" placeholder={field.placeholder || ''}
          value={fmt.displayValue} onChange={fmt.handleChange} onFocus={fmt.handleFocus} onBlur={fmt.handleBlur}
          className={cn('h-8', !fmt.displayValue && isCurrency ? 'pl-7' : '', field.suffix ? 'pr-12' : '')} />
        {field.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{field.suffix}</span>}
        {isPercent && !field.suffix && !fmt.displayValue && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>}
      </div>
    );
  }
  return (
    <div className="relative">
      <Input type={field.type === 'text' ? 'text' : 'number'} step={field.type === 'integer' ? '1' : '0.01'}
        min={field.type !== 'text' ? '0' : undefined} placeholder={field.placeholder || ''}
        value={value} onChange={(e) => onChange(e.target.value)}
        className={cn('h-8', field.suffix ? 'pr-12' : '')} />
      {field.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{field.suffix}</span>}
    </div>
  );
}

'''
content = content.replace("function DynamicField({", DYN_FORMATTED + "function DynamicField({", 1)
print("  ✅ Added DynFormattedInput for config fields")

# Write
with open(filepath, "w") as f:
    f.write(content)
print(f"  ✅ Wrote {filepath} ({len(content):,} bytes)")
PYEOF

# ════════════════════════════════════════════════
# FIX 3: Wizard Enhancement Config
# ════════════════════════════════════════════════
echo "🔧 Fix 3: Wizard enhancement config"

cat > "$WIZARD" << 'TSEOF'
/**
 * Wizard Enhancement Config — Asset-Class-Aware
 * Used by OnboardingWizard for property size, document types, upload labels.
 */

export interface PropertySizeField {
  id: string; label: string; type: 'number' | 'select'; suffix?: string;
}

export interface DocumentTypeOption {
  id: string; label: string; assetClasses: string[];
}

export interface WizardAssetConfig {
  uploadLabel: string;
  uploadDescription: string;
  propertySizeFields: PropertySizeField[];
  documentTypes: string[];
}

export const DOCUMENT_TYPES: DocumentTypeOption[] = [
  { id: 'pnl', label: 'Profit & Loss (P&L)', assetClasses: ['*'] },
  { id: 'payout', label: 'Payout Report', assetClasses: ['str'] },
  { id: 'rent_roll', label: 'Rent Roll', assetClasses: ['multifamily','duplex','triplex','quadplex','sfr','retail','office','industrial','medical','mixed_use'] },
  { id: 'occupancy', label: 'Occupancy Report', assetClasses: ['hotel','str','self_storage','multifamily','marina'] },
  { id: 'revenue_summary', label: 'Revenue Report / Sales Summary', assetClasses: ['*'] },
  { id: 'balance_sheet', label: 'Balance Sheet', assetClasses: ['*'] },
  { id: 'bank_statement', label: 'Bank Statement', assetClasses: ['*'] },
  { id: 'operating_statement', label: 'Operating Statement', assetClasses: ['*'] },
  { id: 'str_performance', label: 'STR Performance Report (AirDNA/Pricelabs)', assetClasses: ['str'] },
  { id: 'smith_travel', label: 'Smith Travel Research (STR Report)', assetClasses: ['hotel'] },
  { id: 'fuel_sales', label: 'Fuel Sales Report', assetClasses: ['marina'] },
  { id: 'lease_abstract', label: 'Lease Abstract / Schedule', assetClasses: ['retail','office','industrial','medical','mixed_use'] },
  { id: 'cam_reconciliation', label: 'CAM Reconciliation', assetClasses: ['retail','office','industrial','medical'] },
  { id: 'debt_schedule', label: 'Debt Service Schedule', assetClasses: ['*'] },
  { id: 'tax_return', label: 'Tax Return (Schedule E / K-1)', assetClasses: ['*'] },
  { id: 'insurance', label: 'Insurance Declaration Page', assetClasses: ['*'] },
  { id: 'property_tax', label: 'Property Tax Bill', assetClasses: ['*'] },
  { id: 'appraisal', label: 'Appraisal', assetClasses: ['*'] },
  { id: 'environmental', label: 'Environmental Report (Phase I/II)', assetClasses: ['*'] },
  { id: 'capex_log', label: 'Capital Expenditure Log', assetClasses: ['*'] },
  { id: 'wash_count', label: 'Wash Count / Machine Report', assetClasses: ['laundromat'] },
  { id: 'unit_mix', label: 'Unit Mix Schedule', assetClasses: ['self_storage','multifamily'] },
  { id: 'franchise', label: 'Franchise Agreement', assetClasses: ['hotel','laundromat','business'] },
  { id: 'business_tax', label: 'Business Tax Return', assetClasses: ['business'] },
  { id: 'other', label: 'Other', assetClasses: ['*'] },
];

export function getDocumentTypesForAsset(assetClass: string): DocumentTypeOption[] {
  return DOCUMENT_TYPES.filter(dt => dt.assetClasses.includes('*') || dt.assetClasses.includes(assetClass));
}

export const UPLOAD_PERIODS = [
  { value: 'annual', label: 'Annual' },
  { value: 't12', label: 'Trailing 12 Months (T12)' },
  { value: 'ytd', label: 'Year to Date (YTD)' },
  { value: 'q1', label: 'Q1 (Jan-Mar)' }, { value: 'q2', label: 'Q2 (Apr-Jun)' },
  { value: 'q3', label: 'Q3 (Jul-Sep)' }, { value: 'q4', label: 'Q4 (Oct-Dec)' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom Range' },
] as const;

const SF: PropertySizeField[] = [
  { id: 'lotSize', label: 'Lot Size', type: 'number', suffix: 'acres' },
  { id: 'buildingSF', label: 'Building SF', type: 'number', suffix: 'SF' },
];

export const WIZARD_ASSET_CONFIGS: Record<string, WizardAssetConfig> = {
  str: { uploadLabel: 'Upload Payouts', uploadDescription: 'Upload payout reports from Airbnb, VRBO, or your property manager.',
    propertySizeFields: [...SF, {id:'bedrooms',label:'Bedrooms',type:'number'}, {id:'bathrooms',label:'Bathrooms',type:'number'}, {id:'maxGuests',label:'Max Guests',type:'number'}],
    documentTypes: ['payout','pnl','str_performance','occupancy','tax_return','insurance','property_tax'] },
  sfr: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload P&L statements, rent rolls, or bank statements.',
    propertySizeFields: [...SF, {id:'bedrooms',label:'Bedrooms',type:'number'}, {id:'bathrooms',label:'Bathrooms',type:'number'}],
    documentTypes: ['pnl','rent_roll','tax_return','insurance','property_tax'] },
  multifamily: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload operating statements, rent rolls, or T12 financials.',
    propertySizeFields: [...SF, {id:'totalUnits',label:'Total Units',type:'number'}, {id:'yearBuilt',label:'Year Built',type:'number'}],
    documentTypes: ['pnl','operating_statement','rent_roll','occupancy','unit_mix','debt_schedule','tax_return'] },
  retail: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload operating statements, lease abstracts, or CAM reconciliations.',
    propertySizeFields: [...SF, {id:'gla',label:'Gross Leasable Area (GLA)',type:'number',suffix:'SF'}],
    documentTypes: ['pnl','operating_statement','rent_roll','lease_abstract','cam_reconciliation','debt_schedule'] },
  office: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload operating statements, lease abstracts, or rent rolls.',
    propertySizeFields: [...SF, {id:'gla',label:'GLA',type:'number',suffix:'SF'}],
    documentTypes: ['pnl','operating_statement','rent_roll','lease_abstract','cam_reconciliation','debt_schedule'] },
  industrial: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload operating statements, lease abstracts, or rent rolls.',
    propertySizeFields: [...SF, {id:'gla',label:'GLA',type:'number',suffix:'SF'}, {id:'clearHeight',label:'Clear Height',type:'number',suffix:'ft'}, {id:'dockDoors',label:'Dock Doors',type:'number'}],
    documentTypes: ['pnl','operating_statement','rent_roll','lease_abstract','cam_reconciliation','debt_schedule'] },
  hotel: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload operating statements, STR reports, or P&L statements.',
    propertySizeFields: [...SF, {id:'totalRooms',label:'Total Rooms',type:'number'}, {id:'yearBuilt',label:'Year Built',type:'number'}],
    documentTypes: ['pnl','operating_statement','smith_travel','occupancy','franchise','debt_schedule'] },
  marina: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload P&L statements, fuel sales reports, or operating statements.',
    propertySizeFields: [{id:'uplandAcreage',label:'Upland Acreage',type:'number',suffix:'acres'}, {id:'submergedAcreage',label:'Submerged Acreage',type:'number',suffix:'acres'}, {id:'totalSlips',label:'Total Slips',type:'number'}],
    documentTypes: ['pnl','operating_statement','fuel_sales','occupancy','environmental','debt_schedule'] },
  self_storage: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload operating statements, unit mix schedules, or P&L statements.',
    propertySizeFields: [...SF, {id:'totalUnits',label:'Total Units',type:'number'}],
    documentTypes: ['pnl','operating_statement','occupancy','unit_mix','debt_schedule'] },
  laundromat: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload P&L statements, wash count reports, or bank statements.',
    propertySizeFields: [{id:'buildingSF',label:'Building SF',type:'number',suffix:'SF'}],
    documentTypes: ['pnl','wash_count','bank_statement','franchise','tax_return'] },
  business: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload P&L statements, business tax returns, or revenue summaries.',
    propertySizeFields: [{id:'buildingSF',label:'Building SF (optional)',type:'number',suffix:'SF'}],
    documentTypes: ['pnl','business_tax','revenue_summary','franchise','bank_statement'] },
  mixed_use: { uploadLabel: 'Upload Financials', uploadDescription: 'Upload operating statements, rent rolls, or lease abstracts.',
    propertySizeFields: [...SF, {id:'totalUnits',label:'Total Residential Units',type:'number'}, {id:'gla',label:'Commercial GLA',type:'number',suffix:'SF'}],
    documentTypes: ['pnl','operating_statement','rent_roll','lease_abstract','cam_reconciliation'] },
};

export function getWizardConfig(assetClass: string): WizardAssetConfig {
  return WIZARD_ASSET_CONFIGS[assetClass] ?? WIZARD_ASSET_CONFIGS.business;
}
TSEOF

echo "  ✅ Created $WIZARD"

# ════════════════════════════════════════════════
# Summary
# ════════════════════════════════════════════════
echo ""
echo "════════════════════════════════════════════════"
echo "✅ All patches applied!"
echo "════════════════════════════════════════════════"
echo "  Backups: $BACKUP"
echo ""
echo "Next: npm run build"
