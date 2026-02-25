#!/usr/bin/env python3
"""
Phase 2 — Remaining Fixes
==========================
1. Double-count prevention (unit mix + COA revenue dedup)
2. Formatting standards ($000,000 currency, 0.00% percentages)
3. Wizard enhancement config (asset-class-aware property size + doc types)
4. Marina text sweep (find + replace)

Run from project root in Replit shell:
  python3 phase2-fixes.py

Creates backups before any changes.
"""

import os
import sys
import re
import shutil
from datetime import datetime

TIMESTAMP = datetime.now().strftime('%Y%m%d-%H%M%S')
BACKUP_DIR = f'backups/phase2-fixes-{TIMESTAMP}'
CHANGES = []

def backup(filepath):
    if os.path.exists(filepath):
        dest = os.path.join(BACKUP_DIR, filepath)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(filepath, dest)
        print(f'  📦 Backed up {filepath}')

def patch_file(filepath, old, new, description=''):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    count = content.count(old)
    if count == 0:
        print(f'  ⚠️  Pattern not found in {filepath}: {description or old[:60]}...')
        return False
    if count > 1:
        print(f'  ⚠️  Pattern found {count} times in {filepath} (expected 1): {description or old[:60]}...')
        # Still apply if it's safe
    
    content = content.replace(old, new, 1)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    CHANGES.append(f'{filepath}: {description}')
    print(f'  ✅ {description}')
    return True

def insert_after(filepath, marker, insertion, description=''):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    idx = content.find(marker)
    if idx == -1:
        print(f'  ⚠️  Marker not found in {filepath}: {description}')
        return False
    
    insert_pos = idx + len(marker)
    content = content[:insert_pos] + insertion + content[insert_pos:]
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    CHANGES.append(f'{filepath}: {description}')
    print(f'  ✅ {description}')
    return True

def insert_before(filepath, marker, insertion, description=''):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    idx = content.find(marker)
    if idx == -1:
        print(f'  ⚠️  Marker not found in {filepath}: {description}')
        return False
    
    content = content[:idx] + insertion + content[idx:]
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    CHANGES.append(f'{filepath}: {description}')
    print(f'  ✅ {description}')
    return True


# ═══════════════════════════════════════════════════════════════════
# FIX 1: DOUBLE-COUNT PREVENTION
# ═══════════════════════════════════════════════════════════════════

def fix_double_count():
    """
    When unit mix has active rows computing rental revenue,
    exclude the primary rental income COA field from the compute payload.
    This prevents the engine from counting rental income twice.
    """
    filepath = 'client/src/pages/modeling/projects/workspace/inputs.tsx'
    
    if not os.path.exists(filepath):
        print('  ❌ inputs.tsx not found!')
        return False
    
    backup(filepath)
    print('\n🔧 Fix 1: Double-Count Prevention')
    
    # 1a. Add UNIT_MIX_RENTAL_KEYS constant after AVG_DAYS_PER_MONTH
    rental_keys_const = """

/**
 * COA field keys that represent primary rental/room revenue.
 * When unit mix has active rows, these are excluded from the compute payload
 * to prevent double-counting (unit mix already computes this revenue).
 */
const UNIT_MIX_RENTAL_KEYS = new Set([
  'grossRentalIncome',
  'grossPotentialRent',
  'netRentalIncome',
  'roomRevenue',
  'slipRental',
  'storageRental',
  'baseRent',
  'grossRent',
  'totalRentalIncome',
  'rentalIncome',
  'accommodationRevenue',
]);
"""
    
    insert_after(
        filepath,
        'const AVG_DAYS_PER_MONTH = 365.25 / 12;',
        rental_keys_const,
        'Added UNIT_MIX_RENTAL_KEYS constant'
    )
    
    # 1b. Modify buildAssumptionsPayload to exclude rental keys when unit mix active
    old_payload = """  const buildAssumptionsPayload = useCallback(() => {
    const assumptions: Record<string, any> = {};
    for (const [key, val] of Object.entries(coaValues)) {
      const numVal = Number(val);
      if (!isNaN(numVal) && numVal !== 0) {
        assumptions[key] = numVal;
      }
    }"""
    
    new_payload = """  const hasActiveUnitMix = useMemo(() => {
    return unitRows.some(r => r.enabled && r.count > 0 && r.monthlyRate > 0);
  }, [unitRows]);

  const buildAssumptionsPayload = useCallback(() => {
    const assumptions: Record<string, any> = {};
    for (const [key, val] of Object.entries(coaValues)) {
      const numVal = Number(val);
      if (!isNaN(numVal) && numVal !== 0) {
        // Skip primary rental revenue keys when unit mix is computing revenue
        if (hasActiveUnitMix && UNIT_MIX_RENTAL_KEYS.has(key)) continue;
        assumptions[key] = numVal;
      }
    }"""
    
    patch_file(filepath, old_payload, new_payload,
        'Modified buildAssumptionsPayload to skip rental keys when unit mix active')
    
    # 1c. Add visual indicator on COA fields that are being computed by unit mix
    # Modify COAFieldRow to show "Computed from unit mix" badge
    old_coa_row = """function COAFieldRow({
  field,
  value,
  onChange,
}: {
  field: COAFieldDef;
  value: string;
  onChange: (key: string, value: string) => void;
}) {"""
    
    new_coa_row = """function COAFieldRow({
  field,
  value,
  onChange,
  isUnitMixOverride,
  unitMixValue,
}: {
  field: COAFieldDef;
  value: string;
  onChange: (key: string, value: string) => void;
  isUnitMixOverride?: boolean;
  unitMixValue?: number;
}) {
  if (isUnitMixOverride) {
    return (
      <div className="flex items-center gap-2 opacity-60">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Label className="text-xs text-muted-foreground w-44 truncate cursor-help line-through">
                {field.label}
              </Label>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p className="text-xs">Computed from unit mix above — not double-counted</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200">
          ← From Unit Mix: {formatCurrency(unitMixValue ?? 0)}
        </Badge>
      </div>
    );
  }"""
    
    patch_file(filepath, old_coa_row, new_coa_row,
        'Added unit mix override display to COAFieldRow')
    
    # 1d. Pass isUnitMixOverride props in COASection
    old_coa_section_render = """                {categoryFields.map(field => (
                  <COAFieldRow
                    key={field.key}
                    field={field}
                    value={values[field.key] ?? ''}
                    onChange={onChange}
                  />
                ))}"""
    
    new_coa_section_render = """                {categoryFields.map(field => (
                  <COAFieldRow
                    key={field.key}
                    field={field}
                    value={values[field.key] ?? ''}
                    onChange={onChange}
                    isUnitMixOverride={field.category === 'revenue' && hasActiveUnitMix && UNIT_MIX_RENTAL_KEYS.has(field.key)}
                    unitMixValue={unitMixAnnualRevenue}
                  />
                ))}"""
    
    # But COASection doesn't have access to hasActiveUnitMix or unitMixAnnualRevenue...
    # Need to pass them as props. Let me update the approach.
    
    # Actually, let me take a simpler approach: add the props to COASection
    
    old_coa_section_sig = """function COASection({
  category,
  fieldGroups,
  visibleFields,
  values,
  onChange,
  customLines,
  onAddCustomLine,
  onUpdateCustomLine,
  onRemoveCustomLine,
}: {
  category: 'revenue' | 'expense';
  fieldGroups: Record<string, COAFieldDef[]>;
  visibleFields: COAFieldDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  customLines: COACustomLine[];
  onAddCustomLine: () => void;
  onUpdateCustomLine: (id: string, field: 'label' | 'amount', value: string) => void;
  onRemoveCustomLine: (id: string) => void;
}) {"""
    
    new_coa_section_sig = """function COASection({
  category,
  fieldGroups,
  visibleFields,
  values,
  onChange,
  customLines,
  onAddCustomLine,
  onUpdateCustomLine,
  onRemoveCustomLine,
  hasActiveUnitMix,
  unitMixAnnualRevenue,
}: {
  category: 'revenue' | 'expense';
  fieldGroups: Record<string, COAFieldDef[]>;
  visibleFields: COAFieldDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  customLines: COACustomLine[];
  onAddCustomLine: () => void;
  onUpdateCustomLine: (id: string, field: 'label' | 'amount', value: string) => void;
  onRemoveCustomLine: (id: string) => void;
  hasActiveUnitMix?: boolean;
  unitMixAnnualRevenue?: number;
}) {"""
    
    patch_file(filepath, old_coa_section_sig, new_coa_section_sig,
        'Added hasActiveUnitMix + unitMixAnnualRevenue props to COASection')
    
    patch_file(filepath, old_coa_section_render, new_coa_section_render,
        'Pass unit mix override to COAFieldRow')
    
    # 1e. Pass the new props in the revenue COASection call
    old_revenue_coa_call = """            <COASection
                category="revenue"
                fieldGroups={coaFieldGroups}
                visibleFields={visibleCOAFields}
                values={coaValues}
                onChange={handleCOAChange}
                customLines={customRevenue}
                onAddCustomLine={() => addCustomLine('revenue')}
                onUpdateCustomLine={(id, field, value) => updateCustomLine('revenue', id, field, value)}
                onRemoveCustomLine={(id) => removeCustomLine('revenue', id)}
              />"""
    
    new_revenue_coa_call = """            <COASection
                category="revenue"
                fieldGroups={coaFieldGroups}
                visibleFields={visibleCOAFields}
                values={coaValues}
                onChange={handleCOAChange}
                customLines={customRevenue}
                onAddCustomLine={() => addCustomLine('revenue')}
                onUpdateCustomLine={(id, field, value) => updateCustomLine('revenue', id, field, value)}
                onRemoveCustomLine={(id) => removeCustomLine('revenue', id)}
                hasActiveUnitMix={hasActiveUnitMix}
                unitMixAnnualRevenue={unitMixMonthlyRevenue * 12}
              />"""
    
    patch_file(filepath, old_revenue_coa_call, new_revenue_coa_call,
        'Pass unit mix state to revenue COASection')
    
    # 1f. Add unitMixAnnualRevenue variable alias for clarity
    old_combined = """  // Combined financials
  const totalRevenue = (computedFinancials?.totalRevenue ?? 0) + (unitMixMonthlyRevenue * 12);"""
    
    new_combined = """  // Combined financials (no double-count: rental keys excluded from compute when unit mix active)
  const unitMixAnnualRevenue = unitMixMonthlyRevenue * 12;
  const totalRevenue = (computedFinancials?.totalRevenue ?? 0) + unitMixAnnualRevenue;"""
    
    patch_file(filepath, old_combined, new_combined,
        'Added unitMixAnnualRevenue alias + clarified no-double-count comment')
    
    # 1g. Fix the useCallback dependency to include hasActiveUnitMix
    old_deps = '  }, [coaValues, customRevenue, customExpenses]);'
    new_deps = '  }, [coaValues, customRevenue, customExpenses, hasActiveUnitMix]);'
    
    patch_file(filepath, old_deps, new_deps,
        'Added hasActiveUnitMix to buildAssumptionsPayload dependencies')
    
    return True


# ═══════════════════════════════════════════════════════════════════
# FIX 2: FORMATTING STANDARDS
# ═══════════════════════════════════════════════════════════════════

def fix_formatting():
    """
    Add $000,000 currency formatting and 0.00% percentage formatting.
    Format on blur, raw number on focus.
    Negative values: ($000,000) with parentheses.
    """
    filepath = 'client/src/pages/modeling/projects/workspace/inputs.tsx'
    
    if not os.path.exists(filepath):
        print('  ❌ inputs.tsx not found!')
        return False
    
    print('\n🔧 Fix 2: Formatting Standards')
    
    # 2a. Add formatting helper functions after the UNIT_MIX_RENTAL_KEYS constant
    format_helpers = """

// ═══════════════════════════════════════════════════════════════════════════
// Formatting Helpers — $000,000 currency, 0.00% percentages
// ═══════════════════════════════════════════════════════════════════════════

/** Format a number as currency: $1,234,567 or ($1,234,567) for negatives */
function fmtCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
  if (isNaN(num) || num === 0) return '';
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return num < 0 ? `($${formatted})` : `$${formatted}`;
}

/** Format a number as percentage: 3.00% */
function fmtPercent(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
  if (isNaN(num) || num === 0) return '';
  return `${num.toFixed(2)}%`;
}

/** Strip formatting to get raw number string for editing */
function stripFormat(formatted: string): string {
  // Handle ($1,234) negative format
  const isNeg = formatted.includes('(') && formatted.includes(')');
  const raw = formatted.replace(/[^0-9.]/g, '');
  return isNeg && raw ? `-${raw}` : raw;
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
    if (!isFocused) {
      setDisplayValue(value ? formatter(value) : '');
    }
  }, [value, isFocused, formatter]);

  const handleFocus = () => {
    setIsFocused(true);
    setDisplayValue(value); // Show raw number
  };

  const handleBlur = () => {
    setIsFocused(false);
    setDisplayValue(value ? formatter(value) : '');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.-]/g, '');
    setDisplayValue(e.target.value);
    onChange(raw);
  };

  return { displayValue: isFocused ? displayValue || value : displayValue, handleFocus, handleBlur, handleChange };
}
"""
    
    # Insert after UNIT_MIX_RENTAL_KEYS block
    insert_after(
        filepath,
        "]);",  # End of UNIT_MIX_RENTAL_KEYS set — we need a more specific marker
        '',
        ''
    )
    
    # Actually, let me find a better insertion point. Insert after the 
    # "/** Calculate monthly revenue" function
    insert_after(
        filepath,
        "const AVG_DAYS_PER_MONTH = 365.25 / 12;",
        '',
        ''
    )
    
    # The UNIT_MIX_RENTAL_KEYS was already inserted by fix 1. Let me find the end
    # of that block and insert after it. But the marker might be tricky.
    # Let me insert right before the calcMonthlyRevenue function instead.
    
    insert_before(
        filepath,
        "/** Calculate monthly revenue for a unit row based on rate type */",
        format_helpers,
        'Added formatting helper functions (fmtCurrency, fmtPercent, stripFormat, useFormattedInput)'
    )
    
    # 2b. Add React import (need React.useState, React.useEffect in the hook)
    # Check if React is already imported
    with open(filepath, 'r') as f:
        content = f.read()
    
    if "import React" not in content and "import * as React" not in content:
        patch_file(
            filepath,
            "import { useState, useEffect, useMemo, useCallback, useRef } from 'react';",
            "import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';",
            'Added React default import for formatting hook'
        )
    
    # 2c. Upgrade COAFieldRow to use format-on-blur
    old_coa_input = """      <div className="relative flex-1 max-w-[160px]">
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
      )}"""
    
    new_coa_input = """      <FormattedCOAInput
        field={field}
        value={value}
        onChange={onChange}
      />"""
    
    patch_file(filepath, old_coa_input, new_coa_input,
        'Replaced COAFieldRow input with FormattedCOAInput')
    
    # 2d. Add FormattedCOAInput component (before COAFieldRow)
    formatted_coa_input = """
/** Formatted input for COA fields — format on blur, raw on focus */
function FormattedCOAInput({
  field,
  value,
  onChange,
}: {
  field: COAFieldDef;
  value: string;
  onChange: (key: string, value: string) => void;
}) {
  const formatter = field.inputType === 'percent' ? fmtPercent : fmtCurrency;
  const fmt = useFormattedInput(
    value,
    (raw) => onChange(field.key, raw),
    formatter
  );

  return (
    <>
      <div className="relative flex-1 max-w-[160px]">
        {!fmt.displayValue && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2">
            {getInputIcon(field.inputType)}
          </span>
        )}
        <Input
          type="text"
          inputMode="decimal"
          value={fmt.displayValue}
          onChange={fmt.handleChange}
          onFocus={fmt.handleFocus}
          onBlur={fmt.handleBlur}
          placeholder={field.defaultValue !== undefined ? String(field.defaultValue) : '0'}
          className={`h-7 text-xs tabular-nums ${fmt.displayValue ? 'pl-2' : 'pl-7'}`}
        />
      </div>
      {field.inputType === 'percent' && !fmt.displayValue && (
        <span className="text-xs text-muted-foreground">%</span>
      )}
    </>
  );
}

"""
    
    insert_before(
        filepath,
        "function COAFieldRow({",
        formatted_coa_input,
        'Added FormattedCOAInput component with blur formatting'
    )
    
    # 2e. Upgrade DynamicField currency/percent inputs to use formatting
    old_dynamic_input = """      <div className="relative">
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
      </div>"""
    
    new_dynamic_input = """      <FormattedDynamicInput field={field} value={value} onChange={onChange} />"""
    
    patch_file(filepath, old_dynamic_input, new_dynamic_input,
        'Replaced DynamicField input with FormattedDynamicInput')
    
    # 2f. Add FormattedDynamicInput component (before DynamicField)
    formatted_dynamic = """
/** Formatted input for DynamicField — currency/percent get format-on-blur */
function FormattedDynamicInput({
  field,
  value,
  onChange,
}: {
  field: InputFieldDef;
  value: string;
  onChange: (value: string) => void;
}) {
  const isCurrency = field.type === 'currency';
  const isPercent = field.type === 'percent';
  const isFormattable = isCurrency || isPercent;

  // Always call hook (React rules) — just use fmtCurrency as default formatter
  const formatter = isPercent ? fmtPercent : fmtCurrency;
  const fmt = useFormattedInput(value, onChange, formatter);

  if (isFormattable) {
    return (
      <div className="relative">
        {!fmt.displayValue && isCurrency && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
        )}
        <Input
          type="text"
          inputMode="decimal"
          placeholder={field.placeholder || ''}
          value={fmt.displayValue}
          onChange={fmt.handleChange}
          onFocus={fmt.handleFocus}
          onBlur={fmt.handleBlur}
          className={cn(
            'h-8',
            !fmt.displayValue && isCurrency ? 'pl-7' : '',
            field.suffix ? 'pr-12' : ''
          )}
        />
        {field.suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {field.suffix}
          </span>
        )}
        {isPercent && !field.suffix && !fmt.displayValue && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
        )}
      </div>
    );
  }

  // Non-formattable (text, integer, number) — hook called above but result unused
  return (
    <div className="relative">
      <Input
        type={field.type === 'text' ? 'text' : 'number'}
        step={field.type === 'integer' ? '1' : '0.01'}
        min={field.type !== 'text' ? '0' : undefined}
        placeholder={field.placeholder || ''}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn('h-8', field.suffix ? 'pr-12' : '')}
      />
      {field.suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {field.suffix}
        </span>
      )}
    </div>
  );
}

"""
    
    insert_before(
        filepath,
        "function DynamicField({",
        formatted_dynamic,
        'Added FormattedDynamicInput component'
    )
    
    # 2g. Format the unit mix rate + revenue display
    old_unit_rate_input = """                  <div className="relative">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                    <Input
                      type="number" min="0" step="1"
                      value={row.monthlyRate || ''}
                      onChange={(e) => updateRow(row.typeId, 'monthlyRate', parseFloat(e.target.value) || 0)}
                      disabled={!row.enabled}
                      className="h-7 text-right text-xs pl-4"
                    />
                  </div>"""
    
    new_unit_rate_input = """                  <FormattedUnitInput
                    value={row.monthlyRate}
                    onChange={(v) => updateRow(row.typeId, 'monthlyRate', v)}
                    disabled={!row.enabled}
                    prefix="$"
                  />"""
    
    patch_file(filepath, old_unit_rate_input, new_unit_rate_input,
        'Formatted unit mix rate input')
    
    # 2h. Add FormattedUnitInput component in the EmbeddedUnitMix section
    formatted_unit_input = """
/** Compact formatted input for unit mix table */
function FormattedUnitInput({
  value,
  onChange,
  disabled,
  prefix,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = React.useState('');
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) {
      setDisplay(value ? fmtCurrency(value).replace('$', '') : '');
    }
  }, [value, focused]);

  return (
    <div className="relative">
      {prefix && !display && (
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{prefix}</span>
      )}
      <Input
        type="text"
        inputMode="decimal"
        value={focused ? (value || '') : (display ? `$${display}` : '')}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '');
          onChange(parseFloat(raw) || 0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        className={`h-7 text-right text-xs ${!display ? 'pl-4' : 'pl-1'}`}
      />
      {suffix && (
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{suffix}</span>
      )}
    </div>
  );
}

"""
    
    insert_before(
        filepath,
        "function EmbeddedUnitMix({",
        formatted_unit_input,
        'Added FormattedUnitInput component for unit mix table'
    )
    
    # 2i. Format unit mix monthly revenue display
    old_rev_display = """{row.enabled ? `$${monthlyRev.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}"""
    new_rev_display = """{row.enabled ? fmtCurrency(monthlyRev) : '—'}"""
    
    patch_file(filepath, old_rev_display, new_rev_display,
        'Use fmtCurrency for unit mix monthly revenue display')
    
    # 2j. Format subtotal display
    old_subtotal = """                    ${subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} / mo"""
    new_subtotal = """                    {fmtCurrency(subtotal)} / mo"""
    
    patch_file(filepath, old_subtotal, new_subtotal,
        'Use fmtCurrency for section subtotal display')
    
    return True


# ═══════════════════════════════════════════════════════════════════
# FIX 3: WIZARD ENHANCEMENT CONFIG
# ═══════════════════════════════════════════════════════════════════

def fix_wizard_config():
    """
    Create the wizard enhancement config file with asset-class-aware
    property size fields, document types, and upload terminology.
    """
    filepath = 'shared/wizard-enhancement-config.ts'
    
    print('\n🔧 Fix 3: Wizard Enhancement Config')
    
    config = '''/**
 * Wizard Enhancement Config — Asset-Class-Aware
 * Used by OnboardingWizard for property size, document types, upload labels.
 */

export interface PropertySizeField {
  id: string;
  label: string;
  type: 'number' | 'select';
  suffix?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export interface DocumentTypeOption {
  id: string;
  label: string;
  assetClasses: string[];  // which asset classes see this option
}

export interface WizardAssetConfig {
  uploadLabel: string;           // "Upload P&L" vs "Upload Payout" etc.
  uploadDescription: string;     // Contextual help text
  propertySizeFields: PropertySizeField[];
  documentTypes: string[];       // IDs from DOCUMENT_TYPES
}

// ─── Document Type Registry ──────────────────────────────────────

export const DOCUMENT_TYPES: DocumentTypeOption[] = [
  { id: 'pnl', label: 'Profit & Loss (P&L)', assetClasses: ['*'] },
  { id: 'payout', label: 'Payout Report', assetClasses: ['str'] },
  { id: 'rent_roll', label: 'Rent Roll', assetClasses: ['multifamily', 'duplex', 'triplex', 'quadplex', 'sfr', 'retail', 'office', 'industrial', 'medical', 'mixed_use'] },
  { id: 'occupancy', label: 'Occupancy Report', assetClasses: ['hotel', 'str', 'self_storage', 'multifamily', 'marina'] },
  { id: 'revenue_summary', label: 'Revenue Report / Sales Summary', assetClasses: ['*'] },
  { id: 'balance_sheet', label: 'Balance Sheet', assetClasses: ['*'] },
  { id: 'bank_statement', label: 'Bank Statement', assetClasses: ['*'] },
  { id: 'operating_statement', label: 'Operating Statement', assetClasses: ['*'] },
  { id: 'str_performance', label: 'STR Performance Report (AirDNA/Pricelabs)', assetClasses: ['str'] },
  { id: 'smith_travel', label: 'Smith Travel Research (STR Report)', assetClasses: ['hotel'] },
  { id: 'fuel_sales', label: 'Fuel Sales Report', assetClasses: ['marina'] },
  { id: 'lease_abstract', label: 'Lease Abstract / Schedule', assetClasses: ['retail', 'office', 'industrial', 'medical', 'mixed_use'] },
  { id: 'cam_reconciliation', label: 'CAM Reconciliation', assetClasses: ['retail', 'office', 'industrial', 'medical'] },
  { id: 'debt_schedule', label: 'Debt Service Schedule', assetClasses: ['*'] },
  { id: 'tax_return', label: 'Tax Return (Schedule E / K-1)', assetClasses: ['*'] },
  { id: 'insurance', label: 'Insurance Declaration Page', assetClasses: ['*'] },
  { id: 'property_tax', label: 'Property Tax Bill', assetClasses: ['*'] },
  { id: 'appraisal', label: 'Appraisal', assetClasses: ['*'] },
  { id: 'environmental', label: 'Environmental Report (Phase I/II)', assetClasses: ['*'] },
  { id: 'survey', label: 'Survey / Site Plan', assetClasses: ['*'] },
  { id: 'capex_log', label: 'Capital Expenditure Log', assetClasses: ['*'] },
  { id: 'wash_count', label: 'Wash Count / Machine Report', assetClasses: ['laundromat'] },
  { id: 'unit_mix', label: 'Unit Mix Schedule', assetClasses: ['self_storage', 'multifamily'] },
  { id: 'franchise', label: 'Franchise Agreement', assetClasses: ['hotel', 'laundromat', 'business'] },
  { id: 'business_tax', label: 'Business Tax Return', assetClasses: ['business'] },
  { id: 'other', label: 'Other', assetClasses: ['*'] },
];

/** Get document types relevant to an asset class */
export function getDocumentTypesForAsset(assetClass: string): DocumentTypeOption[] {
  return DOCUMENT_TYPES.filter(
    dt => dt.assetClasses.includes('*') || dt.assetClasses.includes(assetClass)
  );
}

// ─── Upload Period Options ───────────────────────────────────────

export const UPLOAD_PERIODS = [
  { value: 'annual', label: 'Annual' },
  { value: 't12', label: 'Trailing 12 Months (T12)' },
  { value: 'ytd', label: 'Year to Date (YTD)' },
  { value: 'q1', label: 'Q1 (Jan–Mar)' },
  { value: 'q2', label: 'Q2 (Apr–Jun)' },
  { value: 'q3', label: 'Q3 (Jul–Sep)' },
  { value: 'q4', label: 'Q4 (Oct–Dec)' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom Range' },
] as const;

// ─── Per Asset Class Config ──────────────────────────────────────

const SHARED_SIZE_FIELDS: PropertySizeField[] = [
  { id: 'lotSize', label: 'Lot Size', type: 'number', suffix: 'acres' },
  { id: 'buildingSF', label: 'Building SF', type: 'number', suffix: 'SF' },
];

export const WIZARD_ASSET_CONFIGS: Record<string, WizardAssetConfig> = {
  str: {
    uploadLabel: 'Upload Payouts',
    uploadDescription: 'Upload payout reports from Airbnb, VRBO, or your property manager.',
    propertySizeFields: [
      ...SHARED_SIZE_FIELDS,
      { id: 'bedrooms', label: 'Bedrooms', type: 'number' },
      { id: 'bathrooms', label: 'Bathrooms', type: 'number' },
      { id: 'maxGuests', label: 'Max Guests', type: 'number' },
    ],
    documentTypes: ['payout', 'pnl', 'str_performance', 'occupancy', 'tax_return', 'insurance', 'property_tax'],
  },

  sfr: {
    uploadLabel: 'Upload Financials',
    uploadDescription: 'Upload P&L statements, rent rolls, or bank statements.',
    propertySizeFields: [
      ...SHARED_SIZE_FIELDS,
      { id: 'bedrooms', label: 'Bedrooms', type: 'number' },
      { id: 'bathrooms', label: 'Bathrooms', type: 'number' },
    ],
    documentTypes: ['pnl', 'rent_roll', 'tax_return', 'insurance', 'property_tax'],
  },

  duplex: {
    uploadLabel: 'Upload Financials',
    uploadDescription: 'Upload P&L statements, rent rolls, or operating statements.',
    propertySizeFields: [
      ...SHARED_SIZE_FIELDS,
      { id: 'totalUnits', label: 'Total Units', type: 'number' },
    ],
    documentTypes: ['pnl', 'rent_roll', 'tax_return', 'insurance', 'property_tax'],
  },

  triplex: {
    uploadLabel: 'Upload Financials',
    uploadDescription: 'Upload P&L statements, rent rolls, or operating statements.',
    propertySizeFields: [
      ...SHARED_SIZE_FIELDS,
      { id: 'totalUnits', label: 'Total Units', type: 'number' },
    ],
    documentTypes: ['pnl', 'rent_roll', 'tax_return', 'insurance', 'property_tax'],
  },

  quadplex: {
    uploadLabel: 'Upload Financials',
    uploadDescription: 'Upload P&L statements, rent rolls, or operating statements.',
    propertySizeFields: [
      ...SHARED_SIZE_FIELDS,
      { id: 'totalUnits', label: 'Total Units', type: 'number' },
    ],
    documentTypes: ['pnl', 'rent_roll', 'tax_return', 'insurance', 'property_tax'],
  },

  multifamily: {
    uploadLabel: 'Upload Financials',
    uploadDescription: 'Upload operating statements, rent rolls, or T12 financials.',
    propertySizeFields: [
      ...SHARED_SIZE_FIELDS,
      { id: 'totalUnits', label: 'Total Units', type: 'number' },
      { id: 'yearBuilt', label: 'Year Built', type: 'number' },
    ],
    documentTypes: ['pnl', 'operating_statement', 'rent_roll', 'occupancy', 'unit_mix', 'debt_schedule', 'tax_return'],
  },

  retail: {
    uploadLabel: 'Upload Financials',
    uploadDescription: 'Upload operating statements, lease abstracts, or CAM reconciliations.',
    propertySizeFields: [
      ...SHARED_SIZE_FIELDS,
      { id: 'gla', label: 'Gross Leasable Area (GLA)', type: 'number', suffix: 'SF' },
    ],
    documentTypes: ['pnl', 'operating_statement', 'rent_roll', 'lease_abstract', 'cam_reconciliation', 'debt_schedule'],
  },

  office: {
    uploadLabel: 'Upload Financials',
    uploadDescription: 'Upload operating statements, lease abstracts, or rent rolls.',
    propertySizeFields: [
      ...SHARED_SIZE_FIELDS,
      { id: 'gla', label: 'Gross Leasable Area (GLA)', type: 'number', suffix: 'SF' },
    ],
    documentTypes: ['pnl', 'operating_statement', 'rent_roll', 'lease_abstract', 'cam_reconciliation', 'debt_schedule'],
  },

  industrial: {
    uploadLabel: 'Upload Financials',
    uploadDescription: 'Upload operating statements, lease abstracts, or rent rolls.',
    propertySizeFields: [
      ...SHARED_SIZE_FIELDS,
      { id: 'gla', label: 'Gross Leasable Area (GLA)', type: 'number', suffix: 'SF' },
      { id: 'clearHeight', label: 'Clear Height', type: 'number', suffix: 'ft' },
      { id: 'dockDoors', label: 'Dock Doors', type: 'number' },
    ],
    documentTypes: ['pnl', 'operating_statement', 'rent_roll', 'lease_abstract', 'cam_reconciliation', 'debt_schedule'],
  },

  medical: {
    uploadLabel: 'Upload Financials',
    uploadDescription: 'Upload operating statements, lease abstracts, or rent rolls.',
    propertySizeFields: [
      ...SHARED_SIZE_FIELDS,
      { id: 'gla', label: 'Gross Leasable Area (GLA)', type: 'number', suffix: 'SF' },
    ],
    documentTypes: ['pnl', 'operating_statement', 'rent_roll', 'lease_abstract', 'cam_reconciliation'],
  },

  hotel: {
    uploadLabel: 'Upload Financials',
    uploadDescription: 'Upload operating statements, STR reports, or P&L statements.',
    propertySizeFields: [
      ...SHARED_SIZE_FIELDS,
      { id: 'totalRooms', label: 'Total Rooms', type: 'number' },
      { id: 'yearBuilt', label: 'Year Built', type: 'number' },
    ],
    documentTypes: ['pnl', 'operating_statement', 'smith_travel', 'occupancy', 'franchise', 'debt_schedule'],
  },

  marina: {
    uploadLabel: 'Upload Financials',
    uploadDescription: 'Upload P&L statements, fuel sales reports, or operating statements.',
    propertySizeFields: [
      { id: 'uplandAcreage', label: 'Upland Acreage', type: 'number', suffix: 'acres' },
      { id: 'submergedAcreage', label: 'Submerged Acreage', type: 'number', suffix: 'acres' },
      { id: 'totalSlips', label: 'Total Slips', type: 'number' },
    ],
    documentTypes: ['pnl', 'operating_statement', 'fuel_sales', 'occupancy', 'environmental', 'debt_schedule'],
  },

  self_storage: {
    uploadLabel: 'Upload Financials',
    uploadDescription: 'Upload operating statements, unit mix schedules, or P&L statements.',
    propertySizeFields: [
      ...SHARED_SIZE_FIELDS,
      { id: 'totalUnits', label: 'Total Units', type: 'number' },
    ],
    documentTypes: ['pnl', 'operating_statement', 'occupancy', 'unit_mix', 'debt_schedule'],
  },

  laundromat: {
    uploadLabel: 'Upload Financials',
    uploadDescription: 'Upload P&L statements, wash count reports, or bank statements.',
    propertySizeFields: [
      { id: 'buildingSF', label: 'Building SF', type: 'number', suffix: 'SF' },
    ],
    documentTypes: ['pnl', 'wash_count', 'bank_statement', 'franchise', 'tax_return'],
  },

  business: {
    uploadLabel: 'Upload Financials',
    uploadDescription: 'Upload P&L statements, business tax returns, or revenue summaries.',
    propertySizeFields: [
      { id: 'buildingSF', label: 'Building SF (optional)', type: 'number', suffix: 'SF' },
    ],
    documentTypes: ['pnl', 'business_tax', 'revenue_summary', 'franchise', 'bank_statement'],
  },

  mixed_use: {
    uploadLabel: 'Upload Financials',
    uploadDescription: 'Upload operating statements, rent rolls, or lease abstracts.',
    propertySizeFields: [
      ...SHARED_SIZE_FIELDS,
      { id: 'totalUnits', label: 'Total Residential Units', type: 'number' },
      { id: 'gla', label: 'Commercial GLA', type: 'number', suffix: 'SF' },
    ],
    documentTypes: ['pnl', 'operating_statement', 'rent_roll', 'lease_abstract', 'cam_reconciliation'],
  },
};

/** Get wizard config for an asset class, with fallback */
export function getWizardConfig(assetClass: string): WizardAssetConfig {
  return WIZARD_ASSET_CONFIGS[assetClass] ?? WIZARD_ASSET_CONFIGS.business;
}
'''
    
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(config)
    
    CHANGES.append(f'{filepath}: Created wizard enhancement config')
    print(f'  ✅ Created {filepath} ({len(config)} bytes)')
    return True


# ═══════════════════════════════════════════════════════════════════
# FIX 4: MARINA TEXT SWEEP
# ═══════════════════════════════════════════════════════════════════

def marina_text_sweep():
    """
    Scan the codebase for marina-specific text and generate a targeted fix script.
    """
    print('\n🔧 Fix 4: Marina Text Sweep')
    
    # Directories to scan
    scan_dirs = ['client/src', 'shared', 'server']
    extensions = {'.ts', '.tsx', '.js', '.jsx'}
    
    # Patterns to look for (case-insensitive)
    patterns = [
        (r'\bmarina\b', 'marina (word)'),
        (r'\bMarinas?\b', 'Marina/Marinas (capitalized)'),
        (r'\bboat\b', 'boat'),
        (r'\bslip\b', 'slip (context-dependent)'),
        (r'\bMarinaMatch\b', 'MarinaMatch (brand name - keep)'),
    ]
    
    findings = []
    files_scanned = 0
    
    for scan_dir in scan_dirs:
        if not os.path.exists(scan_dir):
            continue
        for root, dirs, files in os.walk(scan_dir):
            # Skip node_modules
            dirs[:] = [d for d in dirs if d != 'node_modules' and d != '.git']
            for fname in files:
                ext = os.path.splitext(fname)[1]
                if ext not in extensions:
                    continue
                
                fpath = os.path.join(root, fname)
                files_scanned += 1
                
                try:
                    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                        lines = f.readlines()
                except:
                    continue
                
                for i, line in enumerate(lines):
                    for pattern, label in patterns:
                        matches = re.findall(pattern, line, re.IGNORECASE)
                        if matches:
                            # Skip if it's just 'MarinaMatch' brand name
                            stripped = line.strip()
                            if label == 'MarinaMatch (brand name - keep)':
                                continue
                            # Check if it's a comment
                            is_comment = stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*')
                            # Check if it's in a string
                            is_ui_text = any(c in line for c in ["'", '"', '`'])
                            
                            findings.append({
                                'file': fpath,
                                'line': i + 1,
                                'text': stripped[:120],
                                'label': label,
                                'is_comment': is_comment,
                                'is_ui_text': is_ui_text,
                            })
    
    # Generate report
    report_path = 'marina-text-sweep-report.md'
    
    # Group by file
    by_file = {}
    for f in findings:
        if f['file'] not in by_file:
            by_file[f['file']] = []
        by_file[f['file']].append(f)
    
    with open(report_path, 'w') as f:
        f.write('# Marina Text Sweep Report\n\n')
        f.write(f'**Generated:** {datetime.now().isoformat()}\n')
        f.write(f'**Files scanned:** {files_scanned}\n')
        f.write(f'**Total occurrences:** {len(findings)}\n')
        f.write(f'**Files with matches:** {len(by_file)}\n\n')
        
        # Summary by type
        ui_text = [x for x in findings if x['is_ui_text'] and not x['is_comment']]
        comments = [x for x in findings if x['is_comment']]
        code = [x for x in findings if not x['is_ui_text'] and not x['is_comment']]
        
        f.write('## Priority Breakdown\n\n')
        f.write(f'| Category | Count | Action |\n')
        f.write(f'|---|---|---|\n')
        f.write(f'| UI text (strings) | {len(ui_text)} | **Fix** — visible to users |\n')
        f.write(f'| Code (variables/types) | {len(code)} | Review — may need rename or alias |\n')
        f.write(f'| Comments | {len(comments)} | Low priority — cosmetic |\n\n')
        
        # Detailed findings
        f.write('## Detailed Findings\n\n')
        for filepath, matches in sorted(by_file.items()):
            f.write(f'### `{filepath}`\n\n')
            for m in matches:
                tag = '🔴 UI' if m['is_ui_text'] and not m['is_comment'] else ('💬 Comment' if m['is_comment'] else '⚙️ Code')
                f.write(f'- **L{m["line"]}** [{tag}]: `{m["text"]}`\n')
            f.write('\n')
    
    print(f'  ✅ Generated {report_path} ({len(findings)} occurrences in {len(by_file)} files)')
    
    # Now generate the actual fix script for UI-facing text
    fix_script = 'fix-marina-text.py'
    
    with open(fix_script, 'w') as f:
        f.write('''#!/usr/bin/env python3
"""
Marina Text Sweep — Auto-Fix Script
Replaces marina-specific UI text with asset-class-generic text.
Run from project root: python3 fix-marina-text.py
"""
import os, re, shutil
from datetime import datetime

BACKUP = f'backups/marina-sweep-{datetime.now().strftime("%Y%m%d-%H%M%S")}'

# Safe replacements for UI-facing strings (not variable names, not MarinaMatch brand)
REPLACEMENTS = [
    # Wizard / Onboarding
    (r'"Marina Details"', '"Property Details"'),
    (r"'Marina Details'", "'Property Details'"),
    (r'"Add Marina"', '"Add Property"'),
    (r"'Add Marina'", "'Add Property'"),
    (r'"Marina Info"', '"Property Info"'),
    (r"'Marina Info'", "'Property Info'"),
    (r'"Your Marina"', '"Your Property"'),
    (r"'Your Marina'", "'Your Property'"),
    (r'"this marina"', '"this property"'),
    (r"'this marina'", "'this property'"),
    (r'"the marina"', '"the property"'),
    (r"'the marina'", "'the property'"),
    (r'"a marina"', '"a property"'),
    (r"'a marina'", "'a property'"),
    
    # Plurals
    (r'"marinas"', '"properties"'),
    (r"'marinas'", "'properties'"),
    (r'"Marinas"', '"Properties"'),
    (r"'Marinas'", "'Properties'"),
    
    # Sidebar / Navigation  
    (r'"Marina Analysis"', '"Investment Analysis"'),
    (r"'Marina Analysis'", "'Investment Analysis'"),
    (r'"Marina Dashboard"', '"Portfolio Dashboard"'),
    (r"'Marina Dashboard'", "'Portfolio Dashboard'"),
    (r'"Marina Intelligence"', '"Market Intelligence"'),
    (r"'Marina Intelligence'", "'Market Intelligence'"),
    
    # CRM / Pipeline
    (r'"Marina CRM"', '"Deal CRM"'),
    (r"'Marina CRM'", "'Deal CRM'"),
    
    # Storage / Slips (context-dependent, be careful)
    (r'"boat storage"', '"storage"'),
    (r"'boat storage'", "'storage'"),
    (r'"Boat Storage"', '"Storage"'),
    (r"'Boat Storage'", "'Storage'"),
    
    # Descriptions
    (r'"marina operation"', '"property operation"'),
    (r"'marina operation'", "'property operation'"),
    (r'"marina investment"', '"property investment"'),
    (r"'marina investment'", "'property investment'"),
    (r'"marina property"', '"property"'),
    (r"'marina property'", "'property'"),
    (r'"marina project"', '"project"'),
    (r"'marina project'", "'project'"),
]

def safe_replace(filepath):
    """Apply safe UI text replacements to a file."""
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    original = content
    changes = 0
    
    for pattern, replacement in REPLACEMENTS:
        new_content = re.sub(pattern, replacement, content, flags=re.IGNORECASE)
        if new_content != content:
            count = len(re.findall(pattern, content, re.IGNORECASE))
            changes += count
            content = new_content
    
    if content != original:
        # Backup
        dest = os.path.join(BACKUP, filepath)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(filepath, dest)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  ✅ {filepath} ({changes} replacements)')
        return changes
    return 0

if __name__ == '__main__':
    print('\\n🔄 Marina Text Sweep — Safe UI Text Replacements')
    print('=' * 60)
    
    total = 0
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', 'backups', 'dist', 'build')]
        for fname in files:
            if fname.endswith(('.ts', '.tsx', '.js', '.jsx')):
                fpath = os.path.join(root, fname)
                total += safe_replace(fpath)
    
    print(f'\\n✅ Done: {total} total replacements')
    print(f'📦 Backups in: {BACKUP}')
    print('\\n⚠️  Review changes carefully before committing!')
    print('   Variable names, enum values, and MarinaMatch brand were NOT touched.')
    print('   Run: npm run build   to verify no errors.')
''')
    
    CHANGES.append(f'{fix_script}: Created marina text sweep auto-fix script')
    print(f'  ✅ Created {fix_script}')
    
    return True


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print('=' * 60)
    print('PHASE 2 — REMAINING FIXES')
    print('=' * 60)
    
    os.makedirs(BACKUP_DIR, exist_ok=True)
    
    # Fix 1: Double-count prevention
    fix_double_count()
    
    # Fix 2: Formatting standards
    fix_formatting()
    
    # Fix 3: Wizard config
    fix_wizard_config()
    
    # Fix 4: Marina text sweep
    marina_text_sweep()
    
    # Summary
    print('\n' + '=' * 60)
    print('SUMMARY')
    print('=' * 60)
    print(f'  Changes applied: {len(CHANGES)}')
    print(f'  Backups in: {BACKUP_DIR}')
    
    print('\n📋 Changes:')
    for c in CHANGES:
        print(f'  • {c}')
    
    print('\n📌 Next steps:')
    print('  1. npm run build        ← verify no errors')
    print('  2. Test in browser       ← verify NOI not double-counted')
    print('  3. python3 fix-marina-text.py  ← run marina text sweep')
    print('  4. npm run build        ← verify no errors after sweep')
    print('  5. Wire wizard config into OnboardingWizard.tsx (see shared/wizard-enhancement-config.ts)')
