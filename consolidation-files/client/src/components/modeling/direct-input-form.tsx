// =============================================================================
// DIRECT INPUT P&L FORM
// File: client/src/components/modeling/direct-input-form.tsx
//
// Renders all COA fields for the project's asset class as editable inputs.
// Saves to project.customMetrics.inputAssumptions via PATCH.
// Shows live-computed P&L summary from the engine.
// Supports "Add Revenue" / "Add Expense" custom lines.
// =============================================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { getCOAFields, getCOAFieldsGrouped, type COAFieldDef, type COACustomLine } from '@shared/direct-input-coa';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DollarSign,
  Percent,
  Hash,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Info,
  Eye,
  EyeOff,
  Calculator,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DirectInputFormProps {
  project: any;
  onFinancialsComputed?: (financials: any) => void;
}

interface FormValues {
  [key: string]: number | string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DirectInputForm({ project, onFinancialsComputed }: DirectInputFormProps) {
  const queryClient = useQueryClient();
  const assetClass = project?.assetClass ?? 'marina';
  const projectId = project?.id;

  // Load saved assumptions from project
  const savedAssumptions = useMemo(() => {
    const cm = (project?.customMetrics as any) ?? {};
    return cm.inputAssumptions ?? {};
  }, [project?.customMetrics]);

  const savedCustomRevenue: COACustomLine[] = useMemo(() => savedAssumptions.customRevenueLines ?? [], [savedAssumptions]);
  const savedCustomExpenses: COACustomLine[] = useMemo(() => savedAssumptions.customExpenseLines ?? [], [savedAssumptions]);

  // Form state
  const [values, setValues] = useState<FormValues>({});
  const [customRevenue, setCustomRevenue] = useState<COACustomLine[]>([]);
  const [customExpenses, setCustomExpenses] = useState<COACustomLine[]>([]);
  const [showAllFields, setShowAllFields] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Initialize form from saved assumptions
  useEffect(() => {
    if (savedAssumptions && Object.keys(savedAssumptions).length > 0) {
      const formValues: FormValues = {};
      const fields = getCOAFields(assetClass);
      for (const field of fields) {
        const val = savedAssumptions[field.key];
        if (val !== undefined && val !== null) {
          formValues[field.key] = val;
        } else if (field.defaultValue !== undefined) {
          formValues[field.key] = field.defaultValue;
        }
      }
      setValues(formValues);
      setCustomRevenue(savedCustomRevenue);
      setCustomExpenses(savedCustomExpenses);
      setIsDirty(false);
    } else {
      // Initialize with defaults
      const formValues: FormValues = {};
      const fields = getCOAFields(assetClass);
      for (const field of fields) {
        if (field.defaultValue !== undefined) {
          formValues[field.key] = field.defaultValue;
        }
      }
      setValues(formValues);
    }
  }, [assetClass, savedAssumptions, savedCustomRevenue, savedCustomExpenses]);

  // Field groups
  const fieldGroups = useMemo(() => getCOAFieldsGrouped(assetClass), [assetClass]);

  // Visible fields (filter by showWhen)
  const visibleFields = useMemo(() => {
    const fields = getCOAFields(assetClass);
    if (showAllFields) return fields;
    return fields.filter(f => {
      if (f.showWhen === 'nonzero') {
        const val = Number(values[f.key] ?? 0);
        return val > 0;
      }
      return true; // 'always' or undefined = show
    });
  }, [assetClass, showAllFields, values]);

  // Computed financials (live preview)
  const { data: computedFinancials, refetch: refetchFinancials } = useQuery({
    queryKey: ['/api/modeling/projects', projectId, 'direct-input-preview', JSON.stringify(values), JSON.stringify(customRevenue), JSON.stringify(customExpenses)],
    queryFn: async () => {
      // We compute client-side for instant preview using the same logic
      // The server engine will compute on save via getProjectFinancials
      const assumptions = buildAssumptionsPayload();
      // POST to a lightweight compute endpoint or compute locally
      const res = await apiRequest('POST', `/api/modeling/projects/${projectId}/compute-direct-input`, {
        assetClass,
        inputAssumptions: assumptions,
      });
      return res.json();
    },
    enabled: !!projectId && Object.values(values).some(v => Number(v) > 0),
    staleTime: 2000,
  });

  useEffect(() => {
    if (computedFinancials && onFinancialsComputed) {
      onFinancialsComputed(computedFinancials);
    }
  }, [computedFinancials, onFinancialsComputed]);

  // Build the assumptions object for saving
  const buildAssumptionsPayload = useCallback(() => {
    const assumptions: Record<string, any> = {};
    for (const [key, val] of Object.entries(values)) {
      const numVal = Number(val);
      if (!isNaN(numVal) && numVal !== 0) {
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
  }, [values, customRevenue, customExpenses]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const assumptions = buildAssumptionsPayload();
      const existingMetrics = (project?.customMetrics as any) ?? {};
      const res = await apiRequest('PATCH', `/api/modeling/projects/${projectId}`, {
        customMetrics: {
          ...existingMetrics,
          inputAssumptions: assumptions,
        },
      });
      return res.json();
    },
    onSuccess: () => {
      setIsDirty(false);
      setLastSaved(new Date());
      // Invalidate project + financials queries
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: [`/api/modeling/projects/${projectId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'deal-pricing'] });
    },
  });

  // Auto-save debounce
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      saveMutation.mutate();
    }, 1500);
    return () => clearTimeout(timer);
  }, [values, customRevenue, customExpenses, isDirty]);

  // Field change handler
  const handleChange = (key: string, rawValue: string) => {
    const cleaned = rawValue.replace(/[^0-9.]/g, '');
    setValues(prev => ({ ...prev, [key]: cleaned }));
    setIsDirty(true);
  };

  // Custom line handlers
  const addCustomLine = (category: 'revenue' | 'expense') => {
    const newLine: COACustomLine = {
      id: `custom_${Date.now()}`,
      label: '',
      amount: 0,
      category,
    };
    if (category === 'revenue') {
      setCustomRevenue(prev => [...prev, newLine]);
    } else {
      setCustomExpenses(prev => [...prev, newLine]);
    }
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

  // Toggle group collapse
  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  // Get icon for field type
  const getInputIcon = (type: COAFieldDef['inputType']) => {
    switch (type) {
      case 'currency': return <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />;
      case 'percent': return <Percent className="h-3.5 w-3.5 text-muted-foreground" />;
      case 'number': return <Hash className="h-3.5 w-3.5 text-muted-foreground" />;
      default: return null;
    }
  };

  // Summary from computed
  const totalRevenue = computedFinancials?.totalRevenue ?? 0;
  const totalExpenses = computedFinancials?.totalExpenses ?? 0;
  const noi = computedFinancials?.noi ?? 0;

  return (
    <div className="space-y-4">
      {/* Header with save status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold">Direct Input Assumptions</h3>
          {isDirty && (
            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-600 border-amber-200">
              Unsaved
            </Badge>
          )}
          {!isDirty && lastSaved && (
            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200">
              Saved
            </Badge>
          )}
          {saveMutation.isPending && (
            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200">
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Saving...
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllFields(!showAllFields)}
            className="text-xs"
          >
            {showAllFields ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
            {showAllFields ? 'Hide Optional' : 'Show All Fields'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
            className="text-xs"
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            Save
          </Button>
        </div>
      </div>

      {/* Live P&L Summary */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="py-3 px-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Revenue</p>
              <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency(totalRevenue)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Expenses</p>
              <p className="text-lg font-bold text-red-500 tabular-nums">{formatCurrency(totalExpenses)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Year 1 NOI</p>
              <p className={`text-lg font-bold tabular-nums ${noi >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {formatCurrency(noi)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            Revenue
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {renderFieldsByCategory('revenue', fieldGroups, visibleFields, values, handleChange, collapsedGroups, toggleGroup, getInputIcon)}

          {/* Custom Revenue Lines */}
          {customRevenue.map(line => (
            <div key={line.id} className="flex items-center gap-2 pl-2">
              <Input
                value={line.label}
                onChange={(e) => updateCustomLine('revenue', line.id, 'label', e.target.value)}
                placeholder="Line item name"
                className="h-8 text-sm flex-1"
              />
              <div className="relative w-32">
                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={line.amount || ''}
                  onChange={(e) => updateCustomLine('revenue', line.id, 'amount', e.target.value)}
                  placeholder="0"
                  className="h-8 text-sm pl-7 tabular-nums"
                />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCustomLine('revenue', line.id)}>
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="text-xs text-emerald-600 hover:text-emerald-700" onClick={() => addCustomLine('revenue')}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Revenue Line
          </Button>
        </CardContent>
      </Card>

      {/* Expense Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            Expenses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {renderFieldsByCategory('expense', fieldGroups, visibleFields, values, handleChange, collapsedGroups, toggleGroup, getInputIcon)}

          {/* Custom Expense Lines */}
          {customExpenses.map(line => (
            <div key={line.id} className="flex items-center gap-2 pl-2">
              <Input
                value={line.label}
                onChange={(e) => updateCustomLine('expense', line.id, 'label', e.target.value)}
                placeholder="Line item name"
                className="h-8 text-sm flex-1"
              />
              <div className="relative w-32">
                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={line.amount || ''}
                  onChange={(e) => updateCustomLine('expense', line.id, 'amount', e.target.value)}
                  placeholder="0"
                  className="h-8 text-sm pl-7 tabular-nums"
                />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCustomLine('expense', line.id)}>
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-600" onClick={() => addCustomLine('expense')}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Expense Line
          </Button>
        </CardContent>
      </Card>

      {/* Formula breakdowns */}
      {computedFinancials?.formulaBreakdowns && Object.keys(computedFinancials.formulaBreakdowns).length > 0 && (
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

// ---------------------------------------------------------------------------
// Field rendering helper
// ---------------------------------------------------------------------------

function renderFieldsByCategory(
  category: 'revenue' | 'expense',
  fieldGroups: Record<string, COAFieldDef[]>,
  visibleFields: COAFieldDef[],
  values: FormValues,
  handleChange: (key: string, value: string) => void,
  collapsedGroups: Set<string>,
  toggleGroup: (group: string) => void,
  getInputIcon: (type: COAFieldDef['inputType']) => React.ReactNode,
) {
  const visibleKeys = new Set(visibleFields.map(f => f.key));
  const renderedGroups: string[] = [];

  return Object.entries(fieldGroups).map(([group, fields]) => {
    const categoryFields = fields.filter(f => f.category === category && visibleKeys.has(f.key));
    if (categoryFields.length === 0) return null;
    if (renderedGroups.includes(group)) return null;
    renderedGroups.push(group);

    const isCollapsed = collapsedGroups.has(group);

    return (
      <div key={`${category}-${group}`}>
        <button
          onClick={() => toggleGroup(group)}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 hover:text-foreground transition-colors"
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {group}
        </button>
        {!isCollapsed && (
          <div className="space-y-2 pl-2">
            {categoryFields.map(field => (
              <div key={field.key} className="flex items-center gap-2">
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
                <div className="relative flex-1 max-w-[160px]">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2">
                    {getInputIcon(field.inputType)}
                  </span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={values[field.key] ?? ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.defaultValue !== undefined ? String(field.defaultValue) : '0'}
                    className="h-8 text-sm pl-7 tabular-nums"
                  />
                </div>
                {field.inputType === 'percent' && (
                  <span className="text-xs text-muted-foreground">%</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  });
}

export default DirectInputForm;
