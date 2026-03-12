/**
 * inputs.tsx — Consolidated Inputs & Assumptions
 * 
 * THE single unified input surface for all financial inputs.
 * Replaces the previous 3 disconnected surfaces:
 *   1. Old inputs.tsx (generic assumptions)
 *   2. direct-input-form.tsx (COA revenue + expense lines) — absorbed here
 *   3. unit-mix-leases.tsx revenue portion — absorbed here
 *
 * Architecture:
 *   PLModeToggle at top → determines what sections show
 *   Revenue Section (unit mix table + COA revenue + custom lines)
 *   Expense Section (COA expense lines + custom lines)
 *   Deal & Growth Assumptions (always visible)
 *   Seasonality (if applicable)
 *   Live NOI Summary (sticky bar)
 *
 * Data flow:
 *   ALL inputs save to one unified PATCH call:
 *     - project root fields (growth rates, season, storageTypes)
 *     - project.customMetrics.inputAssumptions (COA + custom lines)
 *   Live preview via POST /compute-direct-input
 *   Deal pricing + pro forma read from the same computed result
 *
 * Place at: client/src/pages/modeling/projects/workspace/inputs.tsx
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Settings2, Sun, TrendingUp, TrendingDown, DollarSign, Percent, ChevronDown,
  ChevronRight, Save, Plus, Trash2, Calculator, RefreshCw, Eye, EyeOff,
  Store, Anchor, Home, Building2, Warehouse, Bed, Wrench, Users, Zap,
  Shield, Receipt, BarChart3, Globe, ArrowUp, Hash, Info,
  type LucideIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ModelingProject } from '@shared/schema';
import { getModelConfig } from '@shared/asset-class-model-config';
import type {
  AssetClassModelConfig, InputSectionConfig, InputFieldDef,
  GrowthCategoryConfig, UnitMixTypeConfig
} from '@shared/asset-class-model-config';
import { PLModeToggle, FinancialSourceBadge } from '@/components/modeling/pl-mode-toggle';
import type { ModelInputMode } from '@/components/modeling/pl-mode-toggle';
import { getCOAFields, getCOAFieldsGrouped, type COAFieldDef, type COACustomLine } from '@shared/direct-input-coa';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';


// ═══════════════════════════════════════════════════════════════════════════
// Constants & Helpers
// ═══════════════════════════════════════════════════════════════════════════

const ICON_MAP: Record<string, LucideIcon> = {
  'settings': Settings2, 'sun': Sun, 'trending-up': TrendingUp,
  'dollar-sign': DollarSign, 'percent': Percent, 'store': Store,
  'anchor': Anchor, 'home': Home, 'building': Building2,
  'warehouse': Warehouse, 'bed': Bed, 'wrench': Wrench,
  'users': Users, 'zap': Zap, 'shield': Shield, 'receipt': Receipt,
  'bar-chart': BarChart3, 'globe': Globe, 'arrow-up': ArrowUp,
  'fuel': Store,
};

function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] || Settings2;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const AVG_DAYS_PER_MONTH = 365.25 / 12;

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


/** Calculate monthly revenue for a unit row based on rate type */
function calcMonthlyRevenue(count: number, rate: number, occupancy: number, rateType: string): number {
  const occPct = occupancy / 100;
  switch (rateType) {
    case 'nightly':
      return count * rate * occPct * AVG_DAYS_PER_MONTH;
    case 'per_sf_annual':
      return count * rate / 12 * occPct;
    case 'monthly':
    default:
      return count * rate * occPct;
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// Sticky NOI Summary Bar
// ═══════════════════════════════════════════════════════════════════════════

function NOISummaryBar({
  totalRevenue,
  totalExpenses,
  noi,
  isDirty,
  isSaving,
  source,
}: {
  totalRevenue: number;
  totalExpenses: number;
  noi: number;
  isDirty: boolean;
  isSaving: boolean;
  source?: string;
}) {
  return (
    <div className="sticky top-0 z-20 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-lg shadow-sm">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Revenue</p>
              <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="text-muted-foreground text-lg">−</div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Expenses</p>
              <p className="text-lg font-bold text-red-500 tabular-nums">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className="text-muted-foreground text-lg">=</div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Year 1 NOI</p>
              <p className={`text-xl font-bold tabular-nums ${noi >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {formatCurrency(noi)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {source && <FinancialSourceBadge source={source as any} />}
            {isDirty && (
              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-600 border-amber-200">
                {isSaving ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Saving...</> : 'Unsaved'}
              </Badge>
            )}
            {!isDirty && totalRevenue > 0 && (
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200">
                Saved
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// Embedded Unit Mix Table (compact inline version)
// ═══════════════════════════════════════════════════════════════════════════

interface UnitRow {
  typeId: string;
  name: string;
  section: string;
  enabled: boolean;
  count: number;
  avgSF: number;
  monthlyRate: number;
  annualRate: number;
  occupancy: number;
  inSeasonRate?: number;
  offSeasonRate?: number;
}

function EmbeddedUnitMix({
  project,
  config,
  rows,
  setRows,
  rateType,
}: {
  project: ModelingProject;
  config: AssetClassModelConfig;
  rows: UnitRow[];
  setRows: React.Dispatch<React.SetStateAction<UnitRow[]>>;
  rateType: string;
}) {
  const unitMixConfig = config.unitMix;

  const updateRow = (typeId: string, field: keyof UnitRow, value: any) => {
    setRows(prev => prev.map(r => {
      if (r.typeId !== typeId) return r;
      const updated = { ...r, [field]: value };
      if (field === 'monthlyRate') updated.annualRate = parseFloat(value) * 12;
      if (field === 'annualRate') updated.monthlyRate = parseFloat(value) / 12;
      return updated;
    }));
  };

  const enabledRows = rows.filter(r => r.enabled);
  const sections = [...new Set(rows.map(r => r.section))];

  if (!unitMixConfig.showTab || unitMixConfig.types.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Home className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">{unitMixConfig.tabLabel}</h4>
        <Badge variant="secondary" className="text-xs ml-auto">
          {enabledRows.length} active · {enabledRows.reduce((s, r) => s + r.count, 0)} {config.terms.unitPlural}
        </Badge>
      </div>

      {sections.map(section => {
        const sectionRows = rows.filter(r => r.section === section);
        return (
          <div key={section} className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">{section}</p>

            {/* Column Headers */}
            <div className="grid gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1"
              style={{ gridTemplateColumns: '2fr 36px 70px' + (unitMixConfig.showSF ? ' 70px' : '') + ' 90px 70px 90px' }}>
              <span>Type</span>
              <span className="text-center">On</span>
              <span className="text-right">{unitMixConfig.countColumnLabel}</span>
              {unitMixConfig.showSF && <span className="text-right">{unitMixConfig.sfColumnLabel || 'SF'}</span>}
              <span className="text-right">{unitMixConfig.rateColumnLabel}</span>
              <span className="text-right">Occ %</span>
              <span className="text-right">Mo Rev</span>
            </div>

            {sectionRows.map(row => {
              const monthlyRev = row.enabled ? calcMonthlyRevenue(row.count, row.monthlyRate, row.occupancy, rateType) : 0;
              return (
                <div
                  key={row.typeId}
                  className={cn(
                    "grid gap-2 items-center py-1 px-1 rounded transition-all",
                    row.enabled ? "bg-muted/20" : "opacity-40"
                  )}
                  style={{ gridTemplateColumns: '2fr 36px 70px' + (unitMixConfig.showSF ? ' 70px' : '') + ' 90px 70px 90px' }}
                >
                  <span className="text-xs font-medium truncate">{row.name}</span>
                  <div className="flex justify-center">
                    <Switch
                      checked={row.enabled}
                      onCheckedChange={(v) => updateRow(row.typeId, 'enabled', v)}
                      className="scale-[0.65]"
                    />
                  </div>
                  <Input
                    type="number" min="0" step="1"
                    value={row.count || ''}
                    onChange={(e) => updateRow(row.typeId, 'count', parseInt(e.target.value) || 0)}
                    disabled={!row.enabled}
                    className="h-7 text-right text-xs"
                  />
                  {unitMixConfig.showSF && (
                    <Input
                      type="number" min="0" step="1"
                      value={row.avgSF || ''}
                      onChange={(e) => updateRow(row.typeId, 'avgSF', parseInt(e.target.value) || 0)}
                      disabled={!row.enabled}
                      className="h-7 text-right text-xs"
                    />
                  )}
                  <div className="relative">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                    <Input
                      type="number" min="0" step="1"
                      value={row.monthlyRate || ''}
                      onChange={(e) => updateRow(row.typeId, 'monthlyRate', parseFloat(e.target.value) || 0)}
                      disabled={!row.enabled}
                      className="h-7 text-right text-xs pl-4"
                    />
                  </div>
                  <div className="relative">
                    <Input
                      type="number" min="0" max="100" step="1"
                      value={row.occupancy || ''}
                      onChange={(e) => updateRow(row.typeId, 'occupancy', parseFloat(e.target.value) || 0)}
                      disabled={!row.enabled}
                      className="h-7 text-right text-xs pr-4"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                  </div>
                  <div className="text-right text-xs font-medium tabular-nums">
                    {row.enabled ? fmtCurrency(monthlyRev) : '—'}
                  </div>
                </div>
              );
            })}

            {/* Section subtotal */}
            {(() => {
              const sectionEnabled = sectionRows.filter(r => r.enabled);
              if (sectionEnabled.length === 0) return null;
              const subtotal = sectionEnabled.reduce((s, r) => s + calcMonthlyRevenue(r.count, r.monthlyRate, r.occupancy, rateType), 0);
              return (
                <div className="flex justify-between text-xs px-1 pt-1 border-t border-dashed">
                  <span className="text-muted-foreground">
                    {sectionEnabled.reduce((s, r) => s + r.count, 0)} {config.terms.unitPlural}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {fmtCurrency(subtotal)} / mo
                  </span>
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// COA Field Rendering (from direct-input-form, adapted for inline)
// ═══════════════════════════════════════════════════════════════════════════

function getInputIcon(type: string) {
  switch (type) {
    case 'currency': return <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />;
    case 'percent': return <Percent className="h-3.5 w-3.5 text-muted-foreground" />;
    case 'number': return <Hash className="h-3.5 w-3.5 text-muted-foreground" />;
    default: return null;
  }
}


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

function COAFieldRow({
  field,
  value,
  onChange,
}: {
  field: COAFieldDef;
  value: string;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Label className="text-xs text-muted-foreground w-44 truncate cursor-help">
              {field.label}
              {field.pctOf && <span className="text-[10px] ml-1 opacity-60">(% of {field.pctOf})</span>}
            </Label>
          </TooltipTrigger>
          {field.hint && (
            <TooltipContent side="left">
              <p className="text-xs">{field.hint}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      <COAFormattedInput field={field} value={value} onChange={onChange} />
    </div>
  );
}

function COASection({
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
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const visibleKeys = new Set(visibleFields.map(f => f.key));

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  const isRevenue = category === 'revenue';

  return (
    <div className="space-y-2">
      {Object.entries(fieldGroups).map(([group, fields]) => {
        const categoryFields = fields.filter(f => f.category === category && visibleKeys.has(f.key));
        if (categoryFields.length === 0) return null;
        const isCollapsed = collapsedGroups.has(`${category}-${group}`);

        return (
          <div key={`${category}-${group}`}>
            <button
              onClick={() => toggleGroup(`${category}-${group}`)}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 hover:text-foreground transition-colors"
            >
              {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {group}
            </button>
            {!isCollapsed && (
              <div className="space-y-1.5 pl-2">
                {categoryFields.map(field => (
                  <COAFieldRow
                    key={field.key}
                    field={field}
                    value={values[field.key] ?? ''}
                    onChange={onChange}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Custom Lines */}
      {customLines.map(line => (
        <div key={line.id} className="flex items-center gap-2 pl-2">
          <Input
            value={line.label}
            onChange={(e) => onUpdateCustomLine(line.id, 'label', e.target.value)}
            placeholder="Line item name"
            className="h-7 text-xs flex-1"
          />
          <div className="relative w-28">
            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              value={line.amount || ''}
              onChange={(e) => onUpdateCustomLine(line.id, 'amount', e.target.value)}
              placeholder="0"
              className="h-7 text-xs pl-6 tabular-nums"
            />
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemoveCustomLine(line.id)}>
            <Trash2 className="h-3 w-3 text-red-500" />
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className={`text-xs ${isRevenue ? 'text-emerald-600 hover:text-emerald-700' : 'text-red-500 hover:text-red-600'}`}
        onClick={onAddCustomLine}
      >
        <Plus className="h-3 w-3 mr-1" />
        Add {isRevenue ? 'Revenue' : 'Expense'} Line
      </Button>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// Month Selector (for seasonality)
// ═══════════════════════════════════════════════════════════════════════════

function MonthSelector({
  selectedMonths,
  onChange,
  seasonLabel,
}: {
  selectedMonths: number[];
  onChange: (months: number[]) => void;
  seasonLabel: string;
}) {
  const toggle = (month: number) => {
    if (selectedMonths.includes(month)) {
      onChange(selectedMonths.filter(m => m !== month));
    } else {
      onChange([...selectedMonths, month].sort((a, b) => a - b));
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{seasonLabel} Months</Label>
      <div className="grid grid-cols-6 gap-1.5">
        {MONTHS.map((name, idx) => {
          const monthNum = idx + 1;
          const isSelected = selectedMonths.includes(monthNum);
          return (
            <button
              key={monthNum}
              type="button"
              onClick={() => toggle(monthNum)}
              className={cn(
                "px-2 py-1.5 rounded text-xs font-medium border transition-all",
                isSelected
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
              )}
            >
              {name}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {selectedMonths.length} months selected as {seasonLabel.toLowerCase()}
      </p>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// Dynamic Field Renderer (for config-driven input sections)
// ═══════════════════════════════════════════════════════════════════════════


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

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: InputFieldDef;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === 'select' && field.options) {
    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{field.label}</Label>
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger className="h-8">
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">
        {field.label}
        {field.tooltip && (
          <span className="ml-1 text-muted-foreground/50" title={field.tooltip}>ⓘ</span>
        )}
      </Label>
      <DynFormattedInput field={field} value={value} onChange={onChange} />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface InputsAssumptionsProps {
  project: ModelingProject;
}

export default function InputsAssumptions({ project }: InputsAssumptionsProps) {
  const config = useMemo(() => getModelConfig(project.assetClass), [project.assetClass]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const assetClass = project?.assetClass ?? 'marina';
  const projectId = project?.id;

  // Current financial data mode
  const currentMode: ModelInputMode =
    ((project as any)?.modelInputMode as ModelInputMode) ?? 'auto';
  const hasUploadedActuals = !!((project as any)?.hasActuals || (project as any)?.actualsCount > 0);
  const showDirectInput = currentMode === 'direct_input' || currentMode === 'hybrid' ||
    (currentMode === 'auto' && !hasUploadedActuals);

  // ─── Generic Config Inputs (deal structure, etc.) ──────────────
  const [configInputs, setConfigInputs] = useState<Record<string, string>>({});
  const [seasonMonths, setSeasonMonths] = useState<number[]>([]);
  const [growthRates, setGrowthRates] = useState<Record<string, string>>({});
  const [enabledUnitTypes, setEnabledUnitTypes] = useState<Set<string>>(new Set());
  const [enabledProfitCenters, setEnabledProfitCenters] = useState<Set<string>>(new Set());

  // ─── COA Direct Input State ────────────────────────────────────
  const [coaValues, setCoaValues] = useState<Record<string, string>>({});
  const [customRevenue, setCustomRevenue] = useState<COACustomLine[]>([]);
  const [customExpenses, setCustomExpenses] = useState<COACustomLine[]>([]);
  const [showAllCOAFields, setShowAllCOAFields] = useState(false);

  // ─── Unit Mix State ────────────────────────────────────────────
  const [unitRows, setUnitRows] = useState<UnitRow[]>([]);
  const rateType: string = (config.unitMix as any).rateType || 'monthly';

  // ─── Dirty / Save state ────────────────────────────────────────
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ─────────────────────────────────────────────────────────────
  // INITIALIZE FROM PROJECT
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    // Config-driven inputs
    const initial: Record<string, string> = {};
    for (const section of config.inputSections) {
      for (const field of section.fields) {
        const projectValue = (project as any)?.[field.id];
        initial[field.id] = projectValue != null ? String(projectValue) : (field.defaultValue != null ? String(field.defaultValue) : '');
      }
    }
    if (project.purchasePrice) initial.purchasePrice = String(project.purchasePrice);
    if (project.holdPeriodYears) initial.holdPeriod = String(project.holdPeriodYears);
    setConfigInputs(initial);

    // Season months
    if (config.hasSeasonal && config.seasonConfig.defaultInSeasonMonths) {
      const projectSeasons = (project as any)?.inSeasonMonths;
      setSeasonMonths(projectSeasons || config.seasonConfig.defaultInSeasonMonths);
    }

    // Growth rates
    const rates: Record<string, string> = {};
    for (const cat of config.growthCategories) {
      const projectRate = (project as any)?.[`growth_${cat.id}`];
      rates[cat.id] = projectRate != null ? String(projectRate) : String(cat.defaultRate);
      if (cat.subcategories) {
        for (const sub of cat.subcategories) {
          const subRate = (project as any)?.[`growth_${sub.id}`];
          rates[sub.id] = subRate != null ? String(subRate) : String(sub.defaultRate);
        }
      }
    }
    setGrowthRates(rates);

    // Enabled unit types
    const projectUnitTypes = (project as any)?.enabledStorageTypes;
    if (projectUnitTypes && Array.isArray(projectUnitTypes)) {
      setEnabledUnitTypes(new Set(projectUnitTypes));
    }

    // Enabled profit centers
    const projectPCs = (project as any)?.enabledProfitCenters;
    if (projectPCs && Array.isArray(projectPCs)) {
      setEnabledProfitCenters(new Set(projectPCs));
    }

    // COA values from inputAssumptions
    const cm = (project?.customMetrics as any) ?? {};
    const savedAssumptions = cm.inputAssumptions ?? {};
    const coaInit: Record<string, string> = {};
    const fields = getCOAFields(assetClass);
    for (const field of fields) {
      const val = savedAssumptions[field.key];
      if (val !== undefined && val !== null) {
        coaInit[field.key] = String(val);
      } else if (field.defaultValue !== undefined) {
        coaInit[field.key] = String(field.defaultValue);
      }
    }
    setCoaValues(coaInit);
    setCustomRevenue(savedAssumptions.customRevenueLines ?? []);
    setCustomExpenses(savedAssumptions.customExpenseLines ?? []);

    // Unit mix rows
    const projectUnits = (project as any)?.storageTypes || [];
    const initialRows: UnitRow[] = config.unitMix.types.map(t => {
      const existing = projectUnits.find((u: any) => u.id === t.id || u.typeId === t.id);
      return {
        typeId: t.id,
        name: t.name,
        section: t.section,
        enabled: existing ? (existing.isEnabled ?? existing.enabled ?? false) : false,
        count: existing?.count ?? existing?.totalSlips ?? 0,
        avgSF: existing?.avgSF ?? t.defaultFields?.avgSF ?? 0,
        monthlyRate: existing?.monthlyRate ? parseFloat(existing.monthlyRate) : 0,
        annualRate: existing?.annualRate ? parseFloat(existing.annualRate) : 0,
        occupancy: existing?.occupancy ?? (existing?.occupancyPercent ? parseFloat(existing.occupancyPercent) : 95),
        inSeasonRate: existing?.inSeasonRate ? parseFloat(existing.inSeasonRate) : 0,
        offSeasonRate: existing?.offSeasonRate ? parseFloat(existing.offSeasonRate) : 0,
      };
    });
    setUnitRows(initialRows);

    setIsDirty(false);
  }, [project.id, config, assetClass]);


  // ─────────────────────────────────────────────────────────────
  // COA FIELD GROUPS + VISIBLE FIELDS
  // ─────────────────────────────────────────────────────────────

  const coaFieldGroups = useMemo(() => getCOAFieldsGrouped(assetClass), [assetClass]);

  const visibleCOAFields = useMemo(() => {
    const fields = getCOAFields(assetClass);
    if (showAllCOAFields) return fields;
    return fields.filter(f => {
      if (f.showWhen === 'nonzero') {
        const val = Number(coaValues[f.key] ?? 0);
        return val > 0;
      }
      return true;
    });
  }, [assetClass, showAllCOAFields, coaValues]);


  // ─────────────────────────────────────────────────────────────
  // LIVE COMPUTE (preview from engine)
  // ─────────────────────────────────────────────────────────────

  const hasActiveUnitMix = useMemo(() => {
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
    }
    if (customRevenue.length > 0) {
      assumptions.customRevenueLines = customRevenue;
    }
    if (customExpenses.length > 0) {
      assumptions.customExpenseLines = customExpenses;
    }
    return assumptions;
  }, [coaValues, customRevenue, customExpenses, hasActiveUnitMix]);

  const { data: computedFinancials } = useQuery({
    queryKey: ['/api/modeling/projects', projectId, 'direct-input-preview',
      JSON.stringify(coaValues), JSON.stringify(customRevenue), JSON.stringify(customExpenses), JSON.stringify(unitRows), rateType],
    queryFn: async () => {
      const assumptions = buildAssumptionsPayload();
      const res = await apiRequest('POST', `/api/modeling/projects/${projectId}/compute-direct-input`, {
        assetClass,
        inputAssumptions: assumptions,
        unitMix: unitRows.filter(r => r.enabled).map(r => ({
          label: r.name,
          count: r.count,
          monthlyRent: r.monthlyRate,
          nightlyRate: rateType === 'nightly' ? r.monthlyRate : undefined,
          occupancy: r.occupancy / 100,
          avgSF: r.avgSF,
        })),
      });
      return res.json();
    },
    enabled: !!projectId && showDirectInput && Object.values(coaValues).some(v => Number(v) > 0),
    staleTime: 2000,
  });

  // Unit mix revenue (client-side)
  const unitMixMonthlyRevenue = useMemo(() => {
    return unitRows.filter(r => r.enabled).reduce(
      (sum, r) => sum + calcMonthlyRevenue(r.count, r.monthlyRate, r.occupancy, rateType), 0
    );
  }, [unitRows, rateType]);

  // Combined financials (no double-count: rental keys excluded from compute when unit mix active)
  // unitMixAnnualRevenue kept for display subtotal only
  const totalRevenue = computedFinancials?.totalRevenue ?? 0;
  const totalExpenses = computedFinancials?.totalExpenses ?? 0;
  const noi = totalRevenue - totalExpenses;


  // ─────────────────────────────────────────────────────────────
  // SAVE (unified — all data in one PATCH)
  // ─────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      const assumptions = buildAssumptionsPayload();
      const existingMetrics = (project?.customMetrics as any) ?? {};

      // Build project-level fields
      const projectData: Record<string, any> = {
        // Config-driven fields
        ...configInputs,
        inSeasonMonths: seasonMonths,
        enabledStorageTypes: Array.from(enabledUnitTypes),
        enabledProfitCenters: Array.from(enabledProfitCenters),
        // Unit mix / storage types
        storageTypes: unitRows.map(r => ({
          id: r.typeId,
          name: r.name,
          section: r.section,
          isEnabled: r.enabled,
          totalSlips: r.count,
          count: r.count,
          avgSF: r.avgSF,
          monthlyRate: String(r.monthlyRate),
          annualRate: String(r.annualRate),
          occupancyPercent: String(r.occupancy),
          inSeasonRate: String(r.inSeasonRate || 0),
          offSeasonRate: String(r.offSeasonRate || 0),
        })),
        // Input assumptions (COA + custom lines)
        customMetrics: {
          ...existingMetrics,
          inputAssumptions: assumptions,
        unitMix: unitRows.filter(r => r.enabled).map(r => ({
          label: r.name,
          count: r.count,
          monthlyRent: r.monthlyRate,
          nightlyRate: rateType === 'nightly' ? r.monthlyRate : undefined,
          occupancy: r.occupancy / 100,
          avgSF: r.avgSF,
        })),
        },
      };

      // Growth rates
      for (const [key, value] of Object.entries(growthRates)) {
        projectData[`growth_${key}`] = parseFloat(value) || 0;
      }

      // Parse numeric fields
      if (projectData.purchasePrice) projectData.purchasePrice = parseFloat(projectData.purchasePrice) || 0;
      if (projectData.holdPeriod) {
        projectData.holdPeriodYears = parseInt(projectData.holdPeriod) || 5;
        delete projectData.holdPeriod;
      }

      return apiRequest('PATCH', `/api/modeling/projects/${projectId}`, projectData);
    },
    onSuccess: () => {
      setIsDirty(false);
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', String(projectId)] });
      queryClient.invalidateQueries({ queryKey: [`/api/modeling/projects/${projectId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'deal-pricing'] });
      queryClient.invalidateQueries({ queryKey: [`/api/modeling/projects/${projectId}/pricing`] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save. Please try again.', variant: 'destructive' });
    },
  });

  // Auto-save debounce (1.5s after last change)
  useEffect(() => {
    if (!isDirty) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveMutation.mutate();
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [coaValues, customRevenue, customExpenses, unitRows, configInputs, growthRates, seasonMonths, isDirty]);


  // ─────────────────────────────────────────────────────────────
  // CHANGE HANDLERS
  // ─────────────────────────────────────────────────────────────

  const updateConfigInput = (id: string, value: string) => {
    setConfigInputs(prev => ({ ...prev, [id]: value }));
    setIsDirty(true);
  };

  const handleCOAChange = (key: string, value: string) => {
    setCoaValues(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const addCustomLine = (category: 'revenue' | 'expense') => {
    const newLine: COACustomLine = { id: `custom_${Date.now()}`, label: '', amount: 0, category };
    if (category === 'revenue') setCustomRevenue(prev => [...prev, newLine]);
    else setCustomExpenses(prev => [...prev, newLine]);
    setIsDirty(true);
  };

  const updateCustomLine = (category: 'revenue' | 'expense', id: string, field: 'label' | 'amount', value: string) => {
    const setter = category === 'revenue' ? setCustomRevenue : setCustomExpenses;
    setter(prev => prev.map(l => l.id === id ? { ...l, [field]: field === 'amount' ? Number(value.replace(/[^0-9.]/g, '')) : value } : l));
    setIsDirty(true);
  };

  const removeCustomLine = (category: 'revenue' | 'expense', id: string) => {
    const setter = category === 'revenue' ? setCustomRevenue : setCustomExpenses;
    setter(prev => prev.filter(l => l.id !== id));
    setIsDirty(true);
  };

  // Wrap setUnitRows to mark dirty
  const setUnitRowsDirty: typeof setUnitRows = (arg) => {
    setUnitRows(arg);
    setIsDirty(true);
  };

  const toggleUnitType = (id: string) => {
    setEnabledUnitTypes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setIsDirty(true);
  };

  const toggleProfitCenter = (id: string) => {
    setEnabledProfitCenters(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setIsDirty(true);
  };

  const handleModeChange = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [`/api/modeling/projects/${projectId}`] });
  }, [queryClient, projectId]);


  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Inputs & Assumptions</h2>
          <p className="text-sm text-muted-foreground">
            Configure all financial inputs for your {config.terms.property} analysis
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !isDirty}
          size="sm"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save All'}
        </Button>
      </div>

      {/* ─── P&L Mode Toggle ───────────────────────────────────── */}
      <PLModeToggle project={project} onModeChange={handleModeChange} />

      {/* ─── Sticky NOI Summary (only when direct input active) ── */}
      {showDirectInput && (
        <NOISummaryBar
          totalRevenue={totalRevenue}
          totalExpenses={totalExpenses}
          noi={noi}
          isDirty={isDirty}
          isSaving={saveMutation.isPending}
          source={showDirectInput ? 'direct_input' : 'none'}
        />
      )}

      {/* ─── Upload Mode Message ───────────────────────────────── */}
      {currentMode === 'upload' && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="py-4 px-4">
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-blue-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">Upload Mode Active</p>
                <p className="text-xs text-muted-foreground">
                  Financial data will come from your uploaded P&L statements on the Historical P&L tab.
                  Switch to "Direct Input" above to enter assumptions manually.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════
           REVENUE SECTION (Direct Input / Hybrid)
           ═══════════════════════════════════════════════════════════ */}
      {showDirectInput && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Revenue
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllCOAFields(!showAllCOAFields)}
                className="text-xs h-7"
              >
                {showAllCOAFields ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                {showAllCOAFields ? 'Essential Only' : 'All Fields'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Embedded Unit Mix */}
            <EmbeddedUnitMix
              project={project}
              config={config}
              rows={unitRows}
              setRows={setUnitRowsDirty}
              rateType={rateType}
            />

            {/* Unit mix annual revenue subtotal */}
            {unitMixMonthlyRevenue > 0 && (
              <div className="flex justify-between items-center py-2 px-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-md">
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {config.unitMix.tabLabel} Annual Revenue
                </span>
                <span className="text-sm font-bold text-emerald-600 tabular-nums">
                  {formatCurrency(unitMixMonthlyRevenue * 12)}
                </span>
              </div>
            )}

            <Separator className="my-2" />

            {/* COA Revenue Fields */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Additional Revenue (from COA)
              </p>
              <COASection
                category="revenue"
                fieldGroups={coaFieldGroups}
                visibleFields={visibleCOAFields}
                values={coaValues}
                onChange={handleCOAChange}
                customLines={customRevenue}
                onAddCustomLine={() => addCustomLine('revenue')}
                onUpdateCustomLine={(id, field, value) => updateCustomLine('revenue', id, field, value)}
                onRemoveCustomLine={(id) => removeCustomLine('revenue', id)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════
           EXPENSE SECTION (Direct Input / Hybrid)
           ═══════════════════════════════════════════════════════════ */}
      {showDirectInput && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <COASection
              category="expense"
              fieldGroups={coaFieldGroups}
              visibleFields={visibleCOAFields}
              values={coaValues}
              onChange={handleCOAChange}
              customLines={customExpenses}
              onAddCustomLine={() => addCustomLine('expense')}
              onUpdateCustomLine={(id, field, value) => updateCustomLine('expense', id, field, value)}
              onRemoveCustomLine={(id) => removeCustomLine('expense', id)}
            />
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════
           DEAL & GROWTH ASSUMPTIONS (always visible)
           ═══════════════════════════════════════════════════════════ */}
      <Accordion type="multiple" defaultValue={['deal-structure', 'growth']} className="space-y-3">

        {/* ─── Config-driven Input Sections (Deal Structure, etc.) ─── */}
        {config.inputSections.map(section => {
          const SectionIcon = getIcon(section.icon);
          const halfFields = section.fields.filter(f => f.width === 'half' || !f.width);
          const fullFields = section.fields.filter(f => f.width === 'full');
          const thirdFields = section.fields.filter(f => f.width === 'third');

          return (
            <AccordionItem key={section.id} value={section.id} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-2">
                  <SectionIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{section.label}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-3">
                  {fullFields.map(field => (
                    <DynamicField
                      key={field.id}
                      field={field}
                      value={configInputs[field.id] || ''}
                      onChange={(v) => updateConfigInput(field.id, v)}
                    />
                  ))}
                  {halfFields.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {halfFields.map(field => (
                        <DynamicField
                          key={field.id}
                          field={field}
                          value={configInputs[field.id] || ''}
                          onChange={(v) => updateConfigInput(field.id, v)}
                        />
                      ))}
                    </div>
                  )}
                  {thirdFields.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {thirdFields.map(field => (
                        <DynamicField
                          key={field.id}
                          field={field}
                          value={configInputs[field.id] || ''}
                          onChange={(v) => updateConfigInput(field.id, v)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}

        {/* ─── Seasonality ───────────────────────────────────────── */}
        {config.hasSeasonal && config.seasonConfig.seasonLabel && (
          <AccordionItem value="seasonality" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Seasonality</span>
                <Badge variant="secondary" className="ml-2 text-xs">
                  {seasonMonths.length} {config.seasonConfig.seasonLabel?.toLowerCase()} months
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <MonthSelector
                selectedMonths={seasonMonths}
                onChange={(months) => { setSeasonMonths(months); setIsDirty(true); }}
                seasonLabel={config.seasonConfig.seasonLabel}
              />
              {(config.seasonConfig.type === 'marina' || config.seasonConfig.type === 'str') && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {config.seasonConfig.offSeasonLabel} Discount %
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="1" min="0" max="100"
                        value={configInputs.offSeasonDiscount || '25'}
                        onChange={(e) => updateConfigInput('offSeasonDiscount', e.target.value)}
                        className="h-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ─── Unit Types Toggle (only in upload mode — in direct input, unit mix is embedded above) ─── */}
        {config.unitMix.showTab && config.unitMix.types.length > 0 && !showDirectInput && (
          <AccordionItem value="unit-types" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{config.unitMix.tabLabel}</span>
                <Badge variant="secondary" className="ml-2 text-xs">
                  {enabledUnitTypes.size} enabled
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <p className="text-xs text-muted-foreground mb-3">
                Select which {config.terms.unitPlural} this {config.terms.property} offers.
              </p>
              {[...new Set(config.unitMix.types.map(t => t.section))].map(section => {
                const sectionTypes = config.unitMix.types.filter(t => t.section === section);
                return (
                  <div key={section} className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{section}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {sectionTypes.map(unitType => (
                        <label
                          key={unitType.id}
                          className={cn(
                            "flex items-center gap-2 rounded-md border p-2 cursor-pointer transition-all text-sm",
                            enabledUnitTypes.has(unitType.id)
                              ? "border-blue-500/40 bg-blue-500/5"
                              : "border-muted hover:bg-muted/30"
                          )}
                        >
                          <Switch
                            checked={enabledUnitTypes.has(unitType.id)}
                            onCheckedChange={() => toggleUnitType(unitType.id)}
                            className="scale-75"
                          />
                          <span>{unitType.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ─── Profit Centers Toggle ─────────────────────────────── */}
        {config.profitCenters.showTab && config.profitCenters.departments.length > 0 && (
          <AccordionItem value="profit-centers" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{config.profitCenters.tabLabel}</span>
                <Badge variant="secondary" className="ml-2 text-xs">
                  {enabledProfitCenters.size} enabled
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <p className="text-xs text-muted-foreground mb-3">
                Enable revenue departments for this {config.terms.property}.
              </p>
              <div className="space-y-1.5">
                {config.profitCenters.departments.map(dept => {
                  const DeptIcon = getIcon(dept.icon);
                  return (
                    <label
                      key={dept.id}
                      className={cn(
                        "flex items-center gap-3 rounded-md border p-3 cursor-pointer transition-all",
                        enabledProfitCenters.has(dept.id)
                          ? "border-blue-500/40 bg-blue-500/5"
                          : "border-muted hover:bg-muted/30"
                      )}
                    >
                      <Switch
                        checked={enabledProfitCenters.has(dept.id)}
                        onCheckedChange={() => toggleProfitCenter(dept.id)}
                        className="scale-75"
                      />
                      <DeptIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{dept.name}</p>
                        <p className="text-xs text-muted-foreground">{dept.description}</p>
                      </div>
                      <Badge variant="outline" className="ml-auto text-xs capitalize">
                        {dept.category}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ─── Growth Assumptions ─────────────────────────────────── */}
        <AccordionItem value="growth" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Growth Assumptions</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <p className="text-xs text-muted-foreground mb-3">
              Annual growth rates applied to the pro forma projection.
            </p>
            <div className="space-y-3">
              {config.growthCategories.map(cat => {
                const CatIcon = getIcon(cat.icon);
                return (
                  <div key={cat.id}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <CatIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label className="text-sm font-medium">{cat.label}</Label>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{cat.description}</p>
                    {cat.subcategories ? (
                      <div className="grid grid-cols-2 gap-2 ml-5">
                        {cat.subcategories.map(sub => (
                          <div key={sub.id} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{sub.label}</Label>
                            <div className="relative">
                              <Input
                                type="number" step="0.1" min="-10" max="25"
                                value={growthRates[sub.id] || String(sub.defaultRate)}
                                onChange={(e) => { setGrowthRates(prev => ({ ...prev, [sub.id]: e.target.value })); setIsDirty(true); }}
                                className="pr-6 h-8"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="w-48">
                        <div className="relative">
                          <Input
                            type="number" step="0.1" min="-10" max="25"
                            value={growthRates[cat.id] || String(cat.defaultRate)}
                            onChange={(e) => { setGrowthRates(prev => ({ ...prev, [cat.id]: e.target.value })); setIsDirty(true); }}
                            className="pr-6 h-8"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* ─── Formula Breakdowns (collapsible) ────────────────── */}
      {showDirectInput && computedFinancials?.formulaBreakdowns &&
        Object.keys(computedFinancials.formulaBreakdowns).length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground w-full justify-start">
              <Info className="h-3.5 w-3.5 mr-1" />
              View Calculation Formulas
              <ChevronDown className="h-3.5 w-3.5 ml-auto" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="bg-muted/30">
              <CardContent className="py-2 px-3 space-y-1">
                {Object.entries(computedFinancials.formulaBreakdowns).map(([label, formula]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono text-[11px]">{formula as string}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
