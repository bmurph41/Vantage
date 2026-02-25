/**
 * inputs.tsx — Asset-Class-Aware Inputs & Assumptions
 * 
 * REPLACES the entire existing inputs.tsx.
 * 
 * Instead of hardcoding marina-specific sections (In-Season Months, 
 * Storage Types, Profit Centers toggles, etc.), this reads from
 * getModelConfig() and renders sections dynamically.
 * 
 * Place at: client/src/pages/modeling/projects/workspace/inputs.tsx
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Settings2, Sun, TrendingUp, DollarSign, Percent, ChevronDown, Save,
  Store, Anchor, Home, Building2, Warehouse, Bed, Wrench, Users, Zap,
  Shield, Receipt, BarChart3, Globe, ArrowUp, type LucideIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ModelingProject } from '@shared/schema';
import { getModelConfig } from '@shared/asset-class-model-config';
import type {
  AssetClassModelConfig, InputSectionConfig, InputFieldDef,
  GrowthCategoryConfig, UnitMixTypeConfig
} from '@shared/asset-class-model-config';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

// ─── Icon Map ────────────────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  'settings': Settings2, 'sun': Sun, 'trending-up': TrendingUp,
  'dollar-sign': DollarSign, 'percent': Percent, 'store': Store,
  'anchor': Anchor, 'home': Home, 'building': Building2,
  'warehouse': Warehouse, 'bed': Bed, 'wrench': Wrench,
  'users': Users, 'zap': Zap, 'shield': Shield, 'receipt': Receipt,
  'bar-chart': BarChart3, 'globe': Globe, 'arrow-up': ArrowUp,
  'fuel': Store, // fallback
};

function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] || Settings2;
}

// ─── Month Selector ──────────────────────────────────────────────
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

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

// ─── Dynamic Field Renderer ──────────────────────────────────────
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
          <SelectTrigger>
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
      <div className="relative">
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
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

interface InputsAssumptionsProps {
  project: ModelingProject;
}

export default function InputsAssumptions({ project }: InputsAssumptionsProps) {
  const config = useMemo(() => getModelConfig(project.assetClass), [project.assetClass]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ─── Local State ─────────────────────────────────────────────
  // Generic key-value for all input fields
  const [inputs, setInputs] = useState<Record<string, string>>({});
  // Season months
  const [seasonMonths, setSeasonMonths] = useState<number[]>([]);
  // Growth rates
  const [growthRates, setGrowthRates] = useState<Record<string, string>>({});
  // Unit mix toggles
  const [enabledUnitTypes, setEnabledUnitTypes] = useState<Set<string>>(new Set());
  // Profit center toggles
  const [enabledProfitCenters, setEnabledProfitCenters] = useState<Set<string>>(new Set());

  // ─── Initialize from project + config ──────────────────────
  useEffect(() => {
    // Initialize inputs from project data
    const initial: Record<string, string> = {};
    for (const section of config.inputSections) {
      for (const field of section.fields) {
        // Read from project if available, else use default
        const projectValue = (project as any)?.[field.id];
        initial[field.id] = projectValue != null ? String(projectValue) : (field.defaultValue != null ? String(field.defaultValue) : '');
      }
    }
    // Map known project fields
    if (project.purchasePrice) initial.purchasePrice = String(project.purchasePrice);
    if (project.holdPeriodYears) initial.holdPeriod = String(project.holdPeriodYears);
    setInputs(initial);

    // Initialize season months
    if (config.hasSeasonal && config.seasonConfig.defaultInSeasonMonths) {
      const projectSeasons = (project as any)?.inSeasonMonths;
      setSeasonMonths(projectSeasons || config.seasonConfig.defaultInSeasonMonths);
    }

    // Initialize growth rates from config defaults
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

    // Initialize enabled unit types from project
    const projectUnitTypes = (project as any)?.enabledStorageTypes;
    if (projectUnitTypes && Array.isArray(projectUnitTypes)) {
      setEnabledUnitTypes(new Set(projectUnitTypes));
    }

    // Initialize enabled profit centers from project
    const projectPCs = (project as any)?.enabledProfitCenters;
    if (projectPCs && Array.isArray(projectPCs)) {
      setEnabledProfitCenters(new Set(projectPCs));
    }
  }, [project.id, config]);

  // ─── Save Mutation ─────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiRequest('PATCH', `/api/modeling/projects/${project.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', String(project.id)] });
      toast({ title: 'Saved', description: 'Inputs & assumptions saved.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save. Please try again.', variant: 'destructive' });
    },
  });

  const handleSave = () => {
    const data: Record<string, any> = {
      ...inputs,
      inSeasonMonths: seasonMonths,
      enabledStorageTypes: Array.from(enabledUnitTypes),
      enabledProfitCenters: Array.from(enabledProfitCenters),
    };
    // Add growth rates
    for (const [key, value] of Object.entries(growthRates)) {
      data[`growth_${key}`] = parseFloat(value) || 0;
    }
    // Parse numeric fields
    if (data.purchasePrice) data.purchasePrice = parseFloat(data.purchasePrice) || 0;
    if (data.holdPeriod) data.holdPeriodYears = parseInt(data.holdPeriod) || 5;
    saveMutation.mutate(data);
  };

  // ─── Helpers ─────────────────────────────────────────────────
  const updateInput = (id: string, value: string) => {
    setInputs(prev => ({ ...prev, [id]: value }));
  };

  const toggleUnitType = (id: string) => {
    setEnabledUnitTypes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleProfitCenter = (id: string) => {
    setEnabledProfitCenters(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };


  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Inputs & Assumptions</h2>
          <p className="text-sm text-muted-foreground">
            Configure your {config.terms.property} analysis parameters
          </p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending} size="sm">
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Dynamic Input Sections */}
      <Accordion type="multiple" defaultValue={config.inputSections.map(s => s.id)} className="space-y-3">
        {config.inputSections.map(section => {
          const SectionIcon = getIcon(section.icon);
          // Group fields by width
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
                  {/* Full-width fields */}
                  {fullFields.map(field => (
                    <DynamicField
                      key={field.id}
                      field={field}
                      value={inputs[field.id] || ''}
                      onChange={(v) => updateInput(field.id, v)}
                    />
                  ))}
                  {/* Half-width fields in 2-col grid */}
                  {halfFields.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {halfFields.map(field => (
                        <DynamicField
                          key={field.id}
                          field={field}
                          value={inputs[field.id] || ''}
                          onChange={(v) => updateInput(field.id, v)}
                        />
                      ))}
                    </div>
                  )}
                  {/* Third-width fields in 3-col grid */}
                  {thirdFields.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {thirdFields.map(field => (
                        <DynamicField
                          key={field.id}
                          field={field}
                          value={inputs[field.id] || ''}
                          onChange={(v) => updateInput(field.id, v)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}

        {/* ─── Seasonality Section (only if asset class has seasons) ───── */}
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
                onChange={setSeasonMonths}
                seasonLabel={config.seasonConfig.seasonLabel}
              />
              {/* Off-season discount field for applicable types */}
              {(config.seasonConfig.type === 'marina' || config.seasonConfig.type === 'str') && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {config.seasonConfig.offSeasonLabel} Discount %
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        max="100"
                        value={inputs.offSeasonDiscount || '25'}
                        onChange={(e) => updateInput('offSeasonDiscount', e.target.value)}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* ─── Unit Types / Storage Types Toggle (only if tab is shown) ─── */}
        {config.unitMix.showTab && config.unitMix.types.length > 0 && (
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
                Detailed pricing is configured in the {config.unitMix.tabLabel} tab.
              </p>
              {/* Group by section */}
              {[...new Set(config.unitMix.types.map(t => t.section))].map(section => {
                const sectionTypes = config.unitMix.types.filter(t => t.section === section);
                return (
                  <div key={section} className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                      {section}
                    </p>
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

        {/* ─── Profit Centers / Departments Toggle (only if shown) ──── */}
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
                Detailed financials are configured in the {config.profitCenters.tabLabel} tab.
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

        {/* ─── Growth Assumptions ───────────────────────────────────── */}
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
                                type="number"
                                step="0.1"
                                min="-10"
                                max="25"
                                value={growthRates[sub.id] || String(sub.defaultRate)}
                                onChange={(e) => setGrowthRates(prev => ({ ...prev, [sub.id]: e.target.value }))}
                                className="pr-6"
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
                            type="number"
                            step="0.1"
                            min="-10"
                            max="25"
                            value={growthRates[cat.id] || String(cat.defaultRate)}
                            onChange={(e) => setGrowthRates(prev => ({ ...prev, [cat.id]: e.target.value }))}
                            className="pr-6"
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
    </div>
  );
}
