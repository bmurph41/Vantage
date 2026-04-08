import { useState, useMemo, useEffect, Fragment, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { inferDepartmentClient } from '@/lib/department-inference';
import { useHoldPeriod } from '@/hooks/use-hold-period';
import { getProFormaConfig } from '@shared/pro-forma-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RevenueSourceToggle } from '@/components/modeling/RevenueSourceToggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Download,
  ChevronDown,
  ChevronRight,
  Calendar,
  RefreshCw,
  Info,
  FileSpreadsheet,
  AlertCircle,
  History,
  Settings2,
  Pencil,
  MoreHorizontal,
  FolderInput,
  EyeOff,
  Undo2,
  Brain
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { ExportPdfButton } from '@/components/ui/export-pdf-button';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, ResponsiveContainer, Legend, ReferenceLine, Area, AreaChart, ComposedChart } from 'recharts';
import type { ProjectAssumptions, ProFormaData } from '@/types/modeling';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';
import { useDepartmentOrder } from '@/hooks/useDepartmentOrder';
import { useModelingPnlOverrides, VALID_DEPARTMENTS } from '@/hooks/useModelingPnlOverrides';
import { REVENUE_CATEGORIES, OPEX_CATEGORIES, DEPARTMENTAL_EXPENSE_CATEGORIES } from '@/components/modeling/growth-rates/index';

interface WorkspaceProFormaProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

// Types for historical periods and document metadata
interface DocumentPeriod {
  id: string;
  periodType: 'fiscal_year' | 'calendar_year' | 'trailing_12' | 'custom';
  startDate: string;
  endDate: string;
  year?: number;
  documentIds: string[];
  label: string;
  shortLabel: string;
  isT12: boolean;
}

interface HistoricalDataPoint {
  period: DocumentPeriod;
  revenue: number;
  cogs: number;
  expenses: number;
  grossProfit: number;
  noi: number;
  categories: Record<string, Record<string, number>>;
}

interface LineItemData {
  name: string;
  category: 'Revenue' | 'COGS' | 'Expenses';
  historical: Record<string, number>; // keyed by period id
  projected: number[]; // indexed by year
  growthRate: number;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthsFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Generate period label based on document metadata
 * Examples:
 * - "2024 Actual" for full calendar year
 * - "FY 2024 Actual" for fiscal year
 * - "T12 Nov. '25 Actual" for trailing 12 months ending November 2025
 */
function generatePeriodLabel(period: DocumentPeriod): { label: string; shortLabel: string } {
  const endDate = new Date(period.endDate);
  const startDate = new Date(period.startDate);

  if (period.periodType === 'trailing_12' || period.isT12) {
    const monthName = months[endDate.getMonth()];
    const yearShort = endDate.getFullYear().toString().slice(-2);
    return {
      label: `T12 ${monthName}. '${yearShort} Actual`,
      shortLabel: `T12 ${monthName}'${yearShort}`
    };
  }

  if (period.periodType === 'fiscal_year') {
    return {
      label: `FY ${period.year || endDate.getFullYear()} Actual`,
      shortLabel: `FY${period.year || endDate.getFullYear()}`
    };
  }

  // Calendar year or default
  const year = period.year || endDate.getFullYear();
  return {
    label: `${year} Actual`,
    shortLabel: `${year}`
  };
}

/**
 * Determine if a period is a trailing 12-month period
 */
function isTrailing12(startDate: string, endDate: string): boolean {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Check if it spans ~12 months but doesn't align with calendar year
  const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  const isFullYear = monthsDiff >= 11 && monthsDiff <= 12;
  const isCalendarYear = start.getMonth() === 0 && end.getMonth() === 11;

  return isFullYear && !isCalendarYear;
}

type KPIDrilldownType = 'baseline-revenue' | 'baseline-noi' | 'year1-noi' | 'exit-noi' | null;

function departmentNameToCategoryKey(deptName: string, category: 'Revenue' | 'COGS' | 'Expenses'): { key: string; isRevenue: boolean } | null {
  const normalizedName = deptName.toLowerCase().trim();
  if (category === 'Revenue' || category === 'COGS') {
    for (const group of Object.values(REVENUE_CATEGORIES)) {
      for (const cat of group) {
        if (cat.label.toLowerCase() === normalizedName || cat.id?.toLowerCase() === normalizedName) {
          return { key: cat.key, isRevenue: true };
        }
      }
    }
  }
  if (category === 'Expenses' || category === 'COGS') {
    for (const group of Object.values(OPEX_CATEGORIES)) {
      for (const cat of group) {
        if (cat.label.toLowerCase() === normalizedName || cat.id?.toLowerCase() === normalizedName) {
          return { key: cat.key, isRevenue: false };
        }
      }
    }
    for (const cat of DEPARTMENTAL_EXPENSE_CATEGORIES) {
      if (cat.label.toLowerCase() === normalizedName || cat.id?.toLowerCase() === normalizedName) {
        return { key: cat.key, isRevenue: false };
      }
    }
  }
  return null;
}

function InlineGrowthEditor({
  departmentName,
  category,
  years,
  currentRates,
  onSave,
  onCancel,
  isSaving,
}: {
  departmentName: string;
  category: 'Revenue' | 'COGS' | 'Expenses';
  years: number[];
  currentRates: number[];
  onSave: (rates: number[]) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [rates, setRates] = useState<number[]>(() => [...currentRates]);
  const [setAllValue, setSetAllValue] = useState('');

  const handleYearChange = (index: number, value: number) => {
    const newRates = [...rates];
    newRates[index] = value;
    setRates(newRates);
  };

  const handleApplyAll = () => {
    const val = parseFloat(setAllValue);
    if (!isNaN(val)) {
      setRates(Array(years.length).fill(val));
    }
  };

  const typeLabel = category === 'Revenue' || category === 'COGS' ? 'Revenue' : 'Expense';

  return (
    <div className="w-72 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-bold">{departmentName} {typeLabel} Growth Rate</h4>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground whitespace-nowrap">Set All:</Label>
        <Input
          type="number"
          step="0.5"
          min={-50}
          max={100}
          placeholder={String(rates[0] ?? 3.0)}
          value={setAllValue}
          onChange={(e) => setSetAllValue(e.target.value)}
          className="h-7 text-xs w-20 text-right"
        />
        <span className="text-xs text-muted-foreground">%</span>
        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={handleApplyAll}>
          Apply
        </Button>
      </div>

      <div className="space-y-1.5">
        {years.map((year, idx) => (
          <div key={year} className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground w-24">Year {idx + 1} ({year}):</Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                step="0.5"
                min={-50}
                max={100}
                value={rates[idx] ?? 3.0}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v)) handleYearChange(idx, v);
                }}
                className="h-7 text-xs w-20 text-right"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" className="text-xs h-7" onClick={() => onSave(rates)} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

export default function WorkspaceProForma({ projectId, onTabChange }: WorkspaceProFormaProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'monthly' | 'annual'>('annual');
  const [selectedYear, setSelectedYear] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['revenue']));
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const { sortDepartments } = useDepartmentOrder();
  const toggleDepartment = (key: string) => {
    setExpandedDepartments(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const [showHistorical, setShowHistorical] = useState(true);
  const [selectedKPI, setSelectedKPI] = useState<KPIDrilldownType>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<{ department: string; category: 'Revenue' | 'COGS' | 'Expenses' } | null>(null);
  const { toast } = useToast();

  const {
    moveToDepartment,
    excludeLineItem,
    restoreLineItem,
    removeDepartmentOverride,
    getDepartmentOverride,
    getExcludedItems,
    isPending: overridesPending,
  } = useModelingPnlOverrides(projectId);

  // Fetch project configuration
  const { holdPeriod, setHoldPeriod, isUpdating: holdPeriodUpdating, config } = useHoldPeriod(projectId);

  // Fetch assumptions/growth rates
  const { data: assumptions } = useQuery<ProjectAssumptions | null>({
    queryKey: ['/api/modeling/projects', projectId, 'assumptions'],
  });

  // Fetch pro forma projections
  const { data: proFormaData, isLoading: proFormaLoading } = useQuery<ProFormaData>({
    queryKey: ['/api/modeling/projects', projectId, 'pro-forma'],
  });

  // Fetch uploaded documents to determine available periods
  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects', projectId, 'documents'],
  });

  // Fetch actuals by year from document uploads
  const { data: actualsData } = useQuery<Record<string, unknown>>({
    queryKey: ['/api/modeling/projects', projectId, 'actuals'],
  });

  // Fetch available actuals years for historical trend columns
  const { data: actualsYearsData } = useQuery<{ years: number[] }>({
    queryKey: ['/api/modeling/projects', projectId, 'actuals', 'years'],
  });

  // Fetch multi-year actuals for prior historical periods
  const availableActualsYears = actualsYearsData?.years || [];
  const { data: multiYearActuals } = useQuery<{ byYear: Record<number, any[]> }>({
    queryKey: ['/api/modeling/projects', projectId, 'actuals', 'multi-year', { years: availableActualsYears.join(',') }],
    queryFn: () => fetch(`/api/modeling/projects/${projectId}/actuals/multi-year?years=${availableActualsYears.join(',')}`, { credentials: 'include' }).then(r => r.json()),
    enabled: availableActualsYears.length > 0,
  });

  // Fetch scenarios for inline growth rate editing
  const { data: scenarios = [] } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects', projectId, 'scenarios'],
  });

  const activeScenario = useMemo(() => {
    return scenarios.find((s: any) => s.scenarioType === 'base' && s.isCurrentVersion);
  }, [scenarios]);

  // Guard: no projection data yet — show CTA instead of broken/empty tab
  const hasNoData = !proFormaData && !isLoadingProForma;
  if (hasNoData && !activeScenario) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center space-y-4">
        <div className="rounded-full bg-blue-100 dark:bg-blue-950 p-4">
          <BarChart3 className="h-8 w-8 text-blue-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-1">Pro Forma Not Yet Generated</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Complete your property assumptions on the Inputs tab — occupancy, revenue lines,
            and unit mix — to generate a pro forma projection automatically.
          </p>
        </div>
        <Button size="sm" onClick={() => window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'inputs' }))}>
          Go to Inputs
        </Button>
      </div>
    );
  }

  const getGrowthRatesForDepartment = (department: string, category: 'Revenue' | 'COGS' | 'Expenses'): number[] => {
    if (!activeScenario?.assumptions) return Array(holdPeriod).fill(3.0);
    const mapping = departmentNameToCategoryKey(department, category);
    if (!mapping) return Array(holdPeriod).fill(3.0);
    const { key, isRevenue } = mapping;
    const assumptions = activeScenario.assumptions;
    if (isRevenue) {
      if (assumptions.growthRatesByYear?.[key]) {
        const arr = assumptions.growthRatesByYear[key];
        if (arr.length >= holdPeriod) return arr.slice(0, holdPeriod);
        return [...arr, ...Array(holdPeriod - arr.length).fill(arr[arr.length - 1] ?? 3.0)];
      }
      if (assumptions.growthRates?.[key] !== undefined) {
        return Array(holdPeriod).fill(assumptions.growthRates[key]);
      }
    } else {
      if (assumptions.expenseGrowthByYear?.[key]) {
        const arr = assumptions.expenseGrowthByYear[key];
        if (arr.length >= holdPeriod) return arr.slice(0, holdPeriod);
        return [...arr, ...Array(holdPeriod - arr.length).fill(arr[arr.length - 1] ?? 3.0)];
      }
      if (assumptions.expenseGrowth?.[key] !== undefined) {
        return Array(holdPeriod).fill(assumptions.expenseGrowth[key]);
      }
    }
    return Array(holdPeriod).fill(3.0);
  };

  const saveMutation = useMutation({
    mutationFn: async ({ categoryKey, rates, isRevenue }: { categoryKey: string; rates: number[]; isRevenue: boolean }) => {
      if (!activeScenario) throw new Error('No active scenario found');
      const currentAssumptions = { ...activeScenario.assumptions };

      if (isRevenue) {
        const growthRatesByYear = { ...(currentAssumptions.growthRatesByYear || {}) };
        growthRatesByYear[categoryKey] = rates;
        currentAssumptions.growthRatesByYear = growthRatesByYear;
        const growthRates = { ...(currentAssumptions.growthRates || {}) };
        growthRates[categoryKey] = rates[0];
        currentAssumptions.growthRates = growthRates;
      } else {
        const expenseGrowthByYear = { ...(currentAssumptions.expenseGrowthByYear || {}) };
        expenseGrowthByYear[categoryKey] = rates;
        currentAssumptions.expenseGrowthByYear = expenseGrowthByYear;
        const expenseGrowth = { ...(currentAssumptions.expenseGrowth || {}) };
        expenseGrowth[categoryKey] = rates[0];
        currentAssumptions.expenseGrowth = expenseGrowth;
      }

      return apiRequest('PATCH', `/api/modeling/projects/${projectId}/scenarios/${activeScenario.id}`, {
        assumptions: currentAssumptions,
        createNewVersion: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'scenarios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'assumptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'pro-forma'] });
      toast({ title: 'Updated', description: 'Growth rate updated. Pro Forma recalculating...' });
      setEditingDepartment(null);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update growth rate.', variant: 'destructive' });
    },
  });

  const handleInlineSave = (department: string, category: 'Revenue' | 'COGS' | 'Expenses', rates: number[]) => {
    const mapping = departmentNameToCategoryKey(department, category);
    if (!mapping) {
      toast({ title: 'Error', description: 'Could not map department to category key.', variant: 'destructive' });
      return;
    }
    saveMutation.mutate({ categoryKey: mapping.key, rates, isRevenue: mapping.isRevenue });
  };

  const startDate = config?.startDate || `${new Date().getFullYear()}-01-31`;
  const seasonMonths = config?.seasonMonths || [4, 5, 6, 7, 8, 9, 10];
  const startYear = parseInt(startDate.split('-')[0]);
  const years = Array.from({ length: holdPeriod }, (_, i) => startYear + i);

  useEffect(() => {
    if (!selectedYear && years.length > 0) {
      setSelectedYear(String(years[0]));
    }
  }, [years, selectedYear]);

  // Process documents and actuals years to determine available historical periods
  const historicalPeriods = useMemo((): DocumentPeriod[] => {
    const periodsMap = new Map<string, DocumentPeriod>();

    if (documents && documents.length > 0) {
      documents
        .filter((doc: any) => doc.status === 'completed')
        .forEach((doc: any) => {
          const fiscalYear = doc.fiscalYear || doc.metadata?.fiscalYear;
          const periodStart = doc.periodStart || doc.metadata?.periodStart;
          const periodEnd = doc.periodEnd || doc.metadata?.periodEnd;

          if (fiscalYear || (periodStart && periodEnd)) {
            const isT12 = periodStart && periodEnd ? isTrailing12(periodStart, periodEnd) : false;
            const periodKey = isT12 
              ? `t12-${periodEnd}` 
              : fiscalYear?.toString() || new Date(periodEnd).getFullYear().toString();

            if (!periodsMap.has(periodKey)) {
              const endDate = periodEnd || `${fiscalYear}-12-31`;
              const startDateCalc = periodStart || `${fiscalYear}-01-01`;
              const period: DocumentPeriod = {
                id: periodKey,
                periodType: isT12 ? 'trailing_12' : 'calendar_year',
                startDate: startDateCalc,
                endDate: endDate,
                year: fiscalYear || new Date(endDate).getFullYear(),
                documentIds: [doc.id],
                label: '',
                shortLabel: '',
                isT12
              };
              const labels = generatePeriodLabel(period);
              period.label = labels.label;
              period.shortLabel = labels.shortLabel;
              periodsMap.set(periodKey, period);
            } else {
              periodsMap.get(periodKey)!.documentIds.push(doc.id);
            }
          }
        });
    }

    // Also create periods from actuals years (data from DB) even if no document metadata
    if (availableActualsYears.length > 0) {
      availableActualsYears.forEach((year: number) => {
        const periodKey = year.toString();
        if (!periodsMap.has(periodKey)) {
          const period: DocumentPeriod = {
            id: periodKey,
            periodType: 'calendar_year',
            startDate: `${year}-01-01`,
            endDate: `${year}-12-31`,
            year,
            documentIds: [],
            label: `${year} Actual`,
            shortLabel: `${year}`,
            isT12: false
          };
          periodsMap.set(periodKey, period);
        }
      });
    }

    return Array.from(periodsMap.values()).sort((a, b) => 
      new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
    );
  }, [documents, availableActualsYears]);

  // Derive the baseline period from the pro forma engine's latest historical year,
  // falling back to document-based periods
  const latestHistoricalYear = proFormaData?.latestHistoricalYear;
  const linePositions = (proFormaData as any)?.metrics?.linePositions || { managementFee: 'below', capex: 'below', reserves: 'below' };

  const baselinePeriod = useMemo((): DocumentPeriod | null => {
    // First check if we have a period from documents matching the engine's baseline year
    if (historicalPeriods.length > 0) {
      if (latestHistoricalYear) {
        const match = historicalPeriods.find(p => p.year === latestHistoricalYear);
        if (match) return match;
      }
      return historicalPeriods[historicalPeriods.length - 1];
    }
    // If no document-based periods, but the engine has data, create a synthetic baseline period
    if (latestHistoricalYear && proFormaData) {
      const hasLineItems = (proFormaData.revenue?.lineItems?.length || 0) > 0 || 
                           (proFormaData.expenses?.lineItems?.length || 0) > 0;
      if (hasLineItems) {
        return {
          id: `baseline-${latestHistoricalYear}`,
          periodType: 'calendar_year',
          startDate: `${latestHistoricalYear}-01-01`,
          endDate: `${latestHistoricalYear}-12-31`,
          year: latestHistoricalYear,
          documentIds: [],
          label: `${latestHistoricalYear} Actual`,
          shortLabel: `${latestHistoricalYear}`,
          isT12: false
        };
      }
    }
    return null;
  }, [historicalPeriods, latestHistoricalYear, proFormaData]);

  // Historical periods excluding the baseline (for showing historical trend)
  const priorPeriods = historicalPeriods.filter(p => p.id !== baselinePeriod?.id);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const isSeasonalMonth = (monthIndex: number) => seasonMonths.includes(monthIndex + 1);


  // Get monthly periods for the selected year
  const selectedYearInt = parseInt(selectedYear);
  const getMonthKey = (year: number, month: number) => {
    const monthStr = (month + 1).toString().padStart(2, '0');
    return `${year}-${monthStr}`;
  };

  // Build data structure from pro forma engine response and actuals
  const tableData = useMemo(() => {
    const data: Record<string, Record<string, { historical: Record<string, number>; projected: number[] }>> = {
      Revenue: {},
      COGS: {},
      Expenses: {}
    };

    // Primary source: pro forma engine line items (has both baseAmount and projections)
    if (proFormaData?.revenue?.lineItems) {
      proFormaData.revenue.lineItems.forEach((item: any) => {
        const name = item.name || 'Other';
        data.Revenue[name] = {
          historical: baselinePeriod ? { [baselinePeriod.id]: item.baseAmount || 0 } : {},
          projected: item.projections || Array(holdPeriod).fill(0)
        };
      });
    }

    // COGS line items from pro forma engine (separate from expenses)
    if (proFormaData?.cogs?.lineItems) {
      proFormaData.cogs.lineItems.forEach((item: any) => {
        const name = item.name || 'Other';
        data.COGS[name] = {
          historical: baselinePeriod ? { [baselinePeriod.id]: item.baseAmount || 0 } : {},
          projected: item.projections || Array(holdPeriod).fill(0)
        };
      });
    }

    if (proFormaData?.expenses?.lineItems) {
      proFormaData.expenses.lineItems.forEach((item: any) => {
        const name = item.name || 'Other';
        const category = item.category === 'COGS' ? 'COGS' : 'Expenses';
        data[category][name] = {
          historical: baselinePeriod ? { [baselinePeriod.id]: item.baseAmount || 0 } : {},
          projected: item.projections || Array(holdPeriod).fill(0)
        };
      });
    }

    // Supplement with actuals data if pro forma didn't have certain line items
    if (actualsData?.grouped) {
      (actualsData as any).grouped.forEach((item: any) => {
        const category = item.category as keyof typeof data;
        if (data[category]) {
          const lineItemName = item.subcategory || item.description || 'Other';
          if (!data[category][lineItemName]) {
            data[category][lineItemName] = { historical: {}, projected: Array(holdPeriod).fill(0) };
          }
          if (baselinePeriod && !data[category][lineItemName].historical[baselinePeriod.id]) {
            data[category][lineItemName].historical[baselinePeriod.id] = item.annualTotal || 0;
          }
        }
      });
    }

    // Populate multi-year historical data for prior periods
    if (multiYearActuals?.byYear) {
      Object.entries(multiYearActuals.byYear).forEach(([yearStr, items]) => {
        const year = Number(yearStr);
        const periodKey = year.toString();
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            const category = item.category as keyof typeof data;
            if (data[category]) {
              const lineItemName = item.subcategory || item.description || 'Other';
              if (!data[category][lineItemName]) {
                data[category][lineItemName] = { historical: {}, projected: Array(holdPeriod).fill(0) };
              }
              data[category][lineItemName].historical[periodKey] = item.annualTotal || 0;
            }
          });
        }
      });
    }

    return data;
  }, [actualsData, proFormaData, baselinePeriod, holdPeriod, multiYearActuals]);

  const serverDeptMap = useMemo(() => {
    const map: Record<string, string> = {};
    // Department info from pro forma engine line items
    if (proFormaData?.revenue?.lineItems) {
      proFormaData.revenue.lineItems.forEach((item: any) => {
        if (item.name && item.department) {
          map[item.name] = item.department;
        }
      });
    }
    if (proFormaData?.expenses?.lineItems) {
      proFormaData.expenses.lineItems.forEach((item: any) => {
        if (item.name && item.department) {
          map[item.name] = item.department;
        }
      });
    }
    // Also use actuals data
    if (actualsData?.grouped) {
      actualsData.grouped.forEach((item: any) => {
        if (item.subcategory && item.department) {
          map[item.subcategory] = item.department;
        }
      });
    }
    return map;
  }, [actualsData, proFormaData]);

  const departmentGroupedData = useMemo(() => {
    const result: Record<string, Record<string, Record<string, { historical: Record<string, number>; projected: number[] }>>> = {};
    for (const [category, items] of Object.entries(tableData)) {
      result[category] = {};
      for (const [itemName, values] of Object.entries(items)) {
        const dept = serverDeptMap[itemName] || inferDepartmentClient(itemName, category);
        if (!result[category][dept]) {
          result[category][dept] = {};
        }
        result[category][dept][itemName] = values;
      }
    }
    return result;
  }, [tableData, serverDeptMap]);

  // Calculate totals for each category and period
  const getCategoryTotal = (category: string, periodId: string) => {
    const items = tableData[category] || {};
    return Object.values(items).reduce((sum, item) => 
      sum + (item.historical[periodId] || 0), 0
    );
  };

  const getCategoryProjectedTotal = (category: string, yearIndex: number) => {
    const items = tableData[category] || {};
    return Object.values(items).reduce((sum, item) => 
      sum + (item.projected[yearIndex] || 0), 0
    );
  };

  // Get monthly totals from proFormaData for a specific category
  // Note: Pro-forma engine includes COGS within expenses for monthly projections
  const getMonthlyTotal = (category: 'Revenue' | 'COGS' | 'Expenses', year: number, monthIndex: number) => {
    if (!proFormaData) return 0;
    const monthKey = getMonthKey(year, monthIndex);
    if (category === 'Revenue') {
      return proFormaData.revenue?.totalsMonthly?.[monthKey] || 0;
    } else if (category === 'COGS') {
      // COGS is included in expenses in the monthly projections
      // Return 0 as COGS is not tracked separately at monthly level
      return 0;
    } else {
      return proFormaData.expenses?.totalsMonthly?.[monthKey] || 0;
    }
  };

  // Get monthly line item value from proFormaData
  const getLineItemMonthlyValue = (category: string, itemName: string, year: number, monthIndex: number) => {
    if (!proFormaData) return 0;
    const monthKey = getMonthKey(year, monthIndex);
    // Map category to the correct lineItems array
    let lineItems: any[] = [];
    if (category === 'Revenue') {
      lineItems = proFormaData.revenue?.lineItems || [];
    } else if (category === 'Expenses' || category === 'COGS') {
      // Both COGS and Expenses are in expenses lineItems
      lineItems = proFormaData.expenses?.lineItems || [];
    }
    const item = lineItems.find((li: any) => li.name === itemName);
    return item?.projectionsMonthly?.[monthKey] || 0;
  };

  // Calculate monthly summary for a specific month
  // Note: Monthly projections from pro-forma engine have COGS combined into expenses
  // Gross profit = Revenue - Expenses (which includes COGS), NOI = Gross Profit in monthly view
  const calculateMonthSummary = (year: number, monthIndex: number) => {
    const monthKey = getMonthKey(year, monthIndex);
    const monthlyProj = proFormaData?.monthlyProjections?.find((p: any) => p.periodKey === monthKey);
    if (monthlyProj) {
      const revenue = monthlyProj.revenue;
      const cogs = monthlyProj.cogs || 0;
      const grossProfit = monthlyProj.grossProfit || (revenue - cogs);
      const expenses = monthlyProj.expenses;
      const noi = monthlyProj.noi;
      return {
        revenue,
        cogs,
        expenses,
        grossProfit,
        noi,
        noiMargin: revenue > 0 ? (noi / revenue) * 100 : 0,
        managementFee: monthlyProj.managementFee || 0,
        capex: monthlyProj.capex || 0,
        reserves: monthlyProj.reserves || 0,
        cashFlowBeforeDebtService: monthlyProj.cashFlowBeforeDebtService || 0,
        debtService: monthlyProj.debtService || 0,
        leveredCashFlow: monthlyProj.leveredCashFlow || 0,
      };
    }
    return { revenue: 0, cogs: 0, expenses: 0, grossProfit: 0, noi: 0, noiMargin: 0, managementFee: 0, capex: 0, reserves: 0, cashFlowBeforeDebtService: 0, debtService: 0, leveredCashFlow: 0 };
  };

  // Summary calculations by period
  const calculatePeriodSummary = (periodId: string) => {
    const revenue = getCategoryTotal('Revenue', periodId);
    const cogs = getCategoryTotal('COGS', periodId);
    const expenses = getCategoryTotal('Expenses', periodId);
    const grossProfit = revenue - cogs;
    const noi = grossProfit - expenses;
    const noiMargin = revenue > 0 ? (noi / revenue) * 100 : 0;
    return { revenue, cogs, expenses, grossProfit, noi, noiMargin };
  };

  const calculateYearSummary = (yearIndex: number) => {
    const revenue = getCategoryProjectedTotal('Revenue', yearIndex);
    const cogs = getCategoryProjectedTotal('COGS', yearIndex);
    const expenses = getCategoryProjectedTotal('Expenses', yearIndex);
    const grossProfit = revenue - cogs;
    const noi = grossProfit - expenses;
    const noiMargin = revenue > 0 ? (noi / revenue) * 100 : 0;
    const annualProj = proFormaData?.annualProjections?.[yearIndex];
    return {
      revenue, cogs, expenses, grossProfit, noi, noiMargin,
      managementFee: annualProj?.managementFee || 0,
      capex: annualProj?.capex || 0,
      reserves: annualProj?.reserves || 0,
      cashFlowBeforeDebtService: annualProj?.cashFlowBeforeDebtService || 0,
      debtService: annualProj?.debtService || 0,
      leveredCashFlow: annualProj?.leveredCashFlow || 0,
    };
  };

  // Calculate CAGR
  const calculateCAGR = (startValue: number, endValue: number, periods: number) => {
    if (startValue <= 0 || endValue <= 0 || periods <= 0) return null;
    return (Math.pow(endValue / startValue, 1 / periods) - 1) * 100;
  };

  // Calculate YoY growth between historical periods
  const calculateYoYGrowth = (current: number, previous: number) => {
    if (previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  // Check if we have any data
  const hasData = Object.values(tableData).some(category => 
    Object.keys(category).length > 0
  );

  const hasHistoricalData = baselinePeriod !== null;

  // Export functionality
  const exportProForma = () => {
    const csvRows: string[] = [];

    // Build header row
    const headerCells = ['Category', 'Line Item'];
    if (showHistorical) {
      priorPeriods.forEach(p => headerCells.push(p.shortLabel));
    }
    if (baselinePeriod) {
      headerCells.push(baselinePeriod.shortLabel);
    }
    years.forEach((year, i) => headerCells.push(`Year ${i + 1} (${year})`));
    headerCells.push('CAGR');
    csvRows.push(headerCells.join(','));

    // Add data rows
    Object.entries(tableData).forEach(([category, items]) => {
      Object.entries(items).forEach(([itemName, values]) => {
        const row = [category, itemName];
        if (showHistorical) {
          priorPeriods.forEach(p => row.push((values.historical[p.id] || 0).toString()));
        }
        if (baselinePeriod) {
          row.push((values.historical[baselinePeriod.id] || 0).toString());
        }
        values.projected.forEach(v => row.push(v.toString()));
        row.push(''); // CAGR placeholder
        csvRows.push(row.join(','));
      });
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pro-forma-${projectId}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Pro forma data exported to CSV",
    });
  };

  if (proFormaLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Baseline summary for KPI cards
  const baselineSummary = baselinePeriod ? calculatePeriodSummary(baselinePeriod.id) : null;
  const year1Summary = calculateYearSummary(0);
  const finalYearSummary = calculateYearSummary(holdPeriod - 1);

  return (
    <div className="fm-page" ref={pdfRef}>
      {onTabChange && (
        <WorkflowNavigation currentTab="proforma" onNavigate={onTabChange} />
      )}

      {/* Header */}
      <div className="fm-header">
        <div>
          <div className="fm-header-title">Pro Forma Projections</div>
          <div className="fm-header-sub">{hasHistoricalData 
              ? `${holdPeriod}-year projections based on ${baselinePeriod?.label || 'historical'} data with growth assumptions`
              : `${holdPeriod}-year projections - upload documents to populate baseline actuals`
            }</div>
        </div>
        <div className="flex items-center gap-2">
          {/* Hold Period Selector - Requirement J */}
          <Select 
            value={holdPeriod.toString()} 
            onValueChange={(v) => setHoldPeriod(parseInt(v))}
            disabled={holdPeriodUpdating}
          >
            <SelectTrigger className="w-[130px]" data-testid="select-hold-period-proforma">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 Years</SelectItem>
              <SelectItem value="5">5 Years</SelectItem>
              <SelectItem value="7">7 Years</SelectItem>
              <SelectItem value="10">10 Years</SelectItem>
              <SelectItem value="15">15 Years</SelectItem>
            </SelectContent>
          </Select>
          {priorPeriods.length > 0 && (
            <Button
              variant={showHistorical ? "default" : "outline"}
              size="sm"
              onClick={() => setShowHistorical(!showHistorical)}
              className="gap-2"
            >
              <History className="h-4 w-4" />
              Historical
            </Button>
          )}
          <Select value={viewMode} onValueChange={(v: 'monthly' | 'annual') => setViewMode(v)}>
            <SelectTrigger className="w-32" data-testid="select-view-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="annual">Annual View</SelectItem>
              <SelectItem value="monthly">Monthly View</SelectItem>
            </SelectContent>
          </Select>
          {viewMode === 'monthly' && (
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {viewMode === 'annual' && activeScenario && (
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setEditMode(!editMode);
                if (editMode) setEditingDepartment(null);
              }}
              className="gap-2"
            >
              <Settings2 className="h-4 w-4" />
              Adjust Assumptions
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportProForma}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/document-intelligence/${projectId}`}>
              <Brain className="h-4 w-4 mr-2" />
              Extract Document
            </a>
          </Button>
          <ExportPdfButton contentRef={pdfRef} filename="pro-forma-projections" title="Pro Forma Projections" />
        </div>
      </div>
      <div className="fm-body">

      {/* Revenue Source Toggle */}
      <RevenueSourceToggle projectId={projectId} />

      {/* Document Status Banner */}
      {!hasHistoricalData && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800 dark:text-amber-200">No Historical Data Available</h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Upload P&L statements in the Documents tab to populate the baseline actuals column. 
                  The system will automatically detect the period (calendar year, fiscal year, or trailing 12 months) 
                  and display the appropriate column headers.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${selectedKPI === 'baseline-revenue' ? 'ring-2 ring-primary border-primary' : ''}`}
          onClick={() => setSelectedKPI(selectedKPI === 'baseline-revenue' ? null : 'baseline-revenue')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {baselinePeriod?.shortLabel || 'Baseline'} Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tabular-nums">{formatCurrency(baselineSummary?.revenue, { dash: true })}</div>
            {priorPeriods.length > 0 && (
              <div className="flex items-center gap-1 mt-1">
                {(() => {
                  const prevSummary = calculatePeriodSummary(priorPeriods[priorPeriods.length - 1].id);
                  const growth = calculateYoYGrowth(baselineSummary?.revenue || 0, prevSummary.revenue);
                  const isPositive = growth !== null && growth >= 0;
                  return (
                    <>
                      {isPositive ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      <span className={`text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(growth, { showSign: true, dash: true })}
                      </span>
                      <span className="text-xs text-muted-foreground">YoY</span>
                    </>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${selectedKPI === 'baseline-noi' ? 'ring-2 ring-primary border-primary' : ''}`}
          onClick={() => setSelectedKPI(selectedKPI === 'baseline-noi' ? null : 'baseline-noi')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {baselinePeriod?.shortLabel || 'Baseline'} NOI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tabular-nums">{formatCurrency(baselineSummary?.noi, { dash: true })}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatPercent(baselineSummary?.noiMargin, { dash: true })} margin
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${selectedKPI === 'year1-noi' ? 'ring-2 ring-primary border-primary' : ''}`}
          onClick={() => setSelectedKPI(selectedKPI === 'year1-noi' ? null : 'year1-noi')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Year 1 NOI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tabular-nums">{formatCurrency(year1Summary.noi, { dash: true })}</div>
            {baselineSummary && (
              <div className="flex items-center gap-1 mt-1">
                {(() => {
                  const growth = calculateYoYGrowth(year1Summary.noi, baselineSummary.noi);
                  const isPositive = growth !== null && growth >= 0;
                  return (
                    <>
                      {isPositive ? (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      <span className={`text-xs ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercent(growth, { showSign: true, dash: true })}
                      </span>
                      <span className="text-xs text-muted-foreground">vs baseline</span>
                    </>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${selectedKPI === 'exit-noi' ? 'ring-2 ring-primary border-primary' : ''}`}
          onClick={() => setSelectedKPI(selectedKPI === 'exit-noi' ? null : 'exit-noi')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Year {holdPeriod} NOI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tabular-nums">{formatCurrency(finalYearSummary.noi, { dash: true })}</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">
                {formatPercent(calculateCAGR(year1Summary.noi, finalYearSummary.noi, holdPeriod - 1), { showSign: true, dash: true })}
              </span>
              <span className="text-xs text-muted-foreground">CAGR</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── NOI Projection Chart ── */}
      {years.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">NOI Projection — {holdPeriod}-Year Hold</CardTitle>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded" /> Revenue</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-400 inline-block rounded" /> OpEx</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500/80 inline-block rounded-sm" /> NOI</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4 px-5">
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={years.map(year => {
                const rev = (() => {
                  if (!proFormaData?.revenue?.lineItems) return 0;
                  return proFormaData.revenue.lineItems.reduce((s: number, item: any) => {
                    const v = item.yearlyValues?.[year] ?? item.projectedValues?.[String(year)] ?? 0;
                    return s + (typeof v === 'number' ? v : parseFloat(v) || 0);
                  }, 0);
                })();
                const cogs = (() => {
                  if (!proFormaData?.cogs?.lineItems) return 0;
                  return proFormaData.cogs.lineItems.reduce((s: number, item: any) => {
                    const v = item.yearlyValues?.[year] ?? item.projectedValues?.[String(year)] ?? 0;
                    return s + (typeof v === 'number' ? v : parseFloat(v) || 0);
                  }, 0);
                })();
                const exp = (() => {
                  if (!proFormaData?.expenses?.lineItems) return 0;
                  return proFormaData.expenses.lineItems.reduce((s: number, item: any) => {
                    const v = item.yearlyValues?.[year] ?? item.projectedValues?.[String(year)] ?? 0;
                    return s + (typeof v === 'number' ? v : parseFloat(v) || 0);
                  }, 0);
                })();
                const noi = rev - cogs - exp;
                return { year: String(year), revenue: Math.round(rev), opex: Math.round(cogs + exp), noi: Math.round(noi) };
              })} margin={{ top: 4, right: 16, left: 16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : `${v}`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={64} />
                <RechartTooltip formatter={(v: number, name: string) => [`${v.toLocaleString()}`, name === 'revenue' ? 'Revenue' : name === 'opex' ? 'OpEx' : 'NOI']} contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" opacity={0.15} radius={[2,2,0,0]} />
                <Bar dataKey="opex" fill="hsl(var(--destructive))" opacity={0.15} radius={[2,2,0,0]} />
                <Line type="monotone" dataKey="noi" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* KPI Drilldown Panel */}
      {selectedKPI && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">
                  {selectedKPI === 'baseline-revenue' && `${baselinePeriod?.shortLabel || 'Baseline'} Revenue Breakdown`}
                  {selectedKPI === 'baseline-noi' && `${baselinePeriod?.shortLabel || 'Baseline'} NOI Breakdown`}
                  {selectedKPI === 'year1-noi' && 'Year 1 NOI Breakdown'}
                  {selectedKPI === 'exit-noi' && `Year ${holdPeriod} NOI Breakdown`}
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Annual totals • Click card again to close
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedKPI(null)}>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Empty state for baseline metrics when no historical data */}
            {(selectedKPI === 'baseline-revenue' || selectedKPI === 'baseline-noi') && !baselinePeriod && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="h-10 w-10 text-amber-500 mb-3" />
                <h4 className="font-medium text-lg mb-1">No Baseline Data Available</h4>
                <p className="text-sm text-muted-foreground max-w-md">
                  Upload P&L documents in the Documents tab to populate baseline actuals. 
                  Once uploaded, you'll see a detailed breakdown of revenue and NOI.
                </p>
              </div>
            )}

            {selectedKPI === 'baseline-revenue' && baselinePeriod && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">Total Revenue</div>
                    <div className="text-xl font-bold">{formatCurrency(baselineSummary?.revenue, { dash: true })}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">Cost of Goods Sold</div>
                    <div className="text-xl font-bold">{formatCurrency(baselineSummary?.cogs, { dash: true })}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">Gross Profit</div>
                    <div className="text-xl font-bold">{formatCurrency(baselineSummary?.grossProfit, { dash: true })}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">Gross Margin</div>
                    <div className="text-xl font-bold">{formatPercent(baselineSummary?.revenue ? ((baselineSummary.grossProfit / baselineSummary.revenue) * 100) : 0, { dash: true })}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Revenue by Category</h4>
                  <div className="space-y-2">
                    {Object.entries(tableData.Revenue || {}).map(([name, values]) => {
                      const baseValue = baselinePeriod ? values.historical[baselinePeriod.id] || 0 : 0;
                      const pct = baselineSummary?.revenue ? (baseValue / baselineSummary.revenue) * 100 : 0;
                      return (
                        <div key={name} className="flex items-center justify-between p-2 rounded bg-background border">
                          <span className="text-sm">{name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">{formatPercent(pct, { dash: true })}</span>
                            <span className="font-medium">{formatCurrency(baseValue, { dash: true })}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {selectedKPI === 'baseline-noi' && baselinePeriod && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">Revenue</div>
                    <div className="text-xl font-bold">{formatCurrency(baselineSummary?.revenue, { dash: true })}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">Total Expenses</div>
                    <div className="text-xl font-bold">{formatCurrency((baselineSummary?.cogs || 0) + (baselineSummary?.expenses || 0), { dash: true })}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border border-green-200 bg-green-50 dark:bg-green-950/30">
                    <div className="text-sm text-muted-foreground">Net Operating Income</div>
                    <div className="text-xl font-bold text-green-600">{formatCurrency(baselineSummary?.noi, { dash: true })}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">NOI Margin</div>
                    <div className="text-xl font-bold">{formatPercent(baselineSummary?.noiMargin, { dash: true })}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">NOI Waterfall</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200">
                      <span>Revenue</span>
                      <span className="font-medium">{formatCurrency(baselineSummary?.revenue, { dash: true })}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200">
                      <span>(-) Cost of Goods Sold</span>
                      <span className="font-medium text-red-600">{formatCurrency(baselineSummary?.cogs, { dash: true })}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-slate-900/50 border">
                      <span className="font-medium">= Gross Profit</span>
                      <span className="font-medium">{formatCurrency(baselineSummary?.grossProfit, { dash: true })}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200">
                      <span>(-) Operating Expenses</span>
                      <span className="font-medium text-red-600">{formatCurrency(baselineSummary?.expenses, { dash: true })}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-green-100 dark:bg-green-900/30 border border-green-300">
                      <span className="font-bold">= Net Operating Income</span>
                      <span className="font-bold text-green-600">{formatCurrency(baselineSummary?.noi, { dash: true })}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedKPI === 'year1-noi' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">Year 1 Revenue</div>
                    <div className="text-xl font-bold">{formatCurrency(year1Summary.revenue, { dash: true })}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">Year 1 Expenses</div>
                    <div className="text-xl font-bold">{formatCurrency(year1Summary.cogs + year1Summary.expenses, { dash: true })}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border border-green-200 bg-green-50 dark:bg-green-950/30">
                    <div className="text-sm text-muted-foreground">Year 1 NOI</div>
                    <div className="text-xl font-bold text-green-600">{formatCurrency(year1Summary.noi, { dash: true })}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">vs Baseline</div>
                    <div className="text-xl font-bold">{formatPercent(calculateYoYGrowth(year1Summary.noi, baselineSummary?.noi || 0), { showSign: true, dash: true })}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Year 1 NOI Waterfall</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200">
                      <span>Revenue</span>
                      <span className="font-medium">{formatCurrency(year1Summary.revenue, { dash: true })}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200">
                      <span>(-) Cost of Goods Sold</span>
                      <span className="font-medium text-red-600">{formatCurrency(year1Summary.cogs, { dash: true })}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-slate-900/50 border">
                      <span className="font-medium">= Gross Profit</span>
                      <span className="font-medium">{formatCurrency(year1Summary.grossProfit, { dash: true })}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200">
                      <span>(-) Operating Expenses</span>
                      <span className="font-medium text-red-600">{formatCurrency(year1Summary.expenses, { dash: true })}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-green-100 dark:bg-green-900/30 border border-green-300">
                      <span className="font-bold">= Net Operating Income</span>
                      <span className="font-bold text-green-600">{formatCurrency(year1Summary.noi, { dash: true })}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedKPI === 'exit-noi' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">Year {holdPeriod} Revenue</div>
                    <div className="text-xl font-bold">{formatCurrency(finalYearSummary.revenue, { dash: true })}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">Year {holdPeriod} Expenses</div>
                    <div className="text-xl font-bold">{formatCurrency(finalYearSummary.cogs + finalYearSummary.expenses, { dash: true })}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border border-green-200 bg-green-50 dark:bg-green-950/30">
                    <div className="text-sm text-muted-foreground">Year {holdPeriod} NOI</div>
                    <div className="text-xl font-bold text-green-600">{formatCurrency(finalYearSummary.noi, { dash: true })}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">{holdPeriod - 1}Y CAGR</div>
                    <div className="text-xl font-bold text-green-600">{formatPercent(calculateCAGR(year1Summary.noi, finalYearSummary.noi, holdPeriod - 1), { showSign: true, dash: true })}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Year {holdPeriod} NOI Waterfall</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200">
                      <span>Revenue</span>
                      <span className="font-medium">{formatCurrency(finalYearSummary.revenue, { dash: true })}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200">
                      <span>(-) Cost of Goods Sold</span>
                      <span className="font-medium text-red-600">{formatCurrency(finalYearSummary.cogs, { dash: true })}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-slate-900/50 border">
                      <span className="font-medium">= Gross Profit</span>
                      <span className="font-medium">{formatCurrency(finalYearSummary.grossProfit, { dash: true })}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200">
                      <span>(-) Operating Expenses</span>
                      <span className="font-medium text-red-600">{formatCurrency(finalYearSummary.expenses, { dash: true })}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-green-100 dark:bg-green-900/30 border border-green-300">
                      <span className="font-bold">= Net Operating Income</span>
                      <span className="font-bold text-green-600">{formatCurrency(finalYearSummary.noi, { dash: true })}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border">
                  <h4 className="text-sm font-medium mb-2">NOI Growth Over Hold Period</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground">Year 1</div>
                      <div className="font-medium">{formatCurrency(year1Summary.noi, { dash: true })}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Total Growth</div>
                      <div className="font-medium text-green-600">{formatPercent(calculateYoYGrowth(finalYearSummary.noi, year1Summary.noi), { showSign: true, dash: true })}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Year {holdPeriod}</div>
                      <div className="font-medium">{formatCurrency(finalYearSummary.noi, { dash: true })}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Pro Forma Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{viewMode === 'monthly' ? `Monthly Pro Forma - ${selectedYear}` : 'Annual Pro Forma'}</CardTitle>
              <CardDescription>
                {viewMode === 'monthly' 
                  ? `Monthly breakout for ${selectedYear} showing seasonal patterns`
                  : `Projected P&L for ${holdPeriod}-year hold period starting ${new Date(startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                }
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Hold Period: {holdPeriod} years</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-64 sticky left-0 bg-background z-10">Category / Line Item</TableHead>

                  {/* Historical Period Columns (excluding baseline) - blue tint to signify actuals */}
                  {showHistorical && priorPeriods.map(period => (
                    <TableHead key={period.id} className="text-right w-28 bg-blue-50/60 dark:bg-blue-950/20">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div className="text-xs text-blue-600/70 dark:text-blue-400/70">Historical</div>
                              <div className="text-blue-700 dark:text-blue-300">{period.shortLabel}</div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{period.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(period.startDate).toLocaleDateString()} - {new Date(period.endDate).toLocaleDateString()}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                  ))}

                  {/* Baseline/Actuals Column */}
                  <TableHead className="text-right w-32 bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="cursor-help">
                            <div className="flex items-center justify-end gap-1">
                              <FileSpreadsheet className="h-3 w-3" />
                              <span className="text-xs text-blue-600 dark:text-blue-400">Baseline</span>
                            </div>
                            <div className="font-semibold text-blue-700 dark:text-blue-300">
                              {baselinePeriod?.shortLabel || 'Actuals'}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {baselinePeriod ? (
                            <>
                              <p className="font-medium">{baselinePeriod.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(baselinePeriod.startDate).toLocaleDateString()} - {new Date(baselinePeriod.endDate).toLocaleDateString()}
                              </p>
                              <p className="text-xs mt-1">From {baselinePeriod.documentIds.length} document(s)</p>
                            </>
                          ) : (
                            <p>Upload documents to populate baseline data</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>

                  {/* Monthly or Annual Columns based on viewMode */}
                  {viewMode === 'monthly' ? (
                    // Monthly columns for selected year
                    months.map((month, i) => (
                      <TableHead 
                        key={i} 
                        className={`text-right w-24 ${isSeasonalMonth(i) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}
                      >
                        <div>{month}</div>
                        <div className="text-xs text-muted-foreground font-normal">
                          {isSeasonalMonth(i) ? 'In-Season' : 'Off-Season'}
                        </div>
                      </TableHead>
                    ))
                  ) : (
                    // Annual columns
                    years.map((year, i) => (
                      <TableHead key={year} className="text-right w-28">
                        <div>Year {i + 1}</div>
                        <div className="text-xs text-muted-foreground font-normal">{year}</div>
                      </TableHead>
                    ))
                  )}

                  <TableHead className="text-right w-24">{viewMode === 'monthly' ? 'Total' : 'CAGR'}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {(['Revenue', 'COGS', 'Expenses'] as const).map((category) => {
                  const items = tableData[category] || {};
                  const baselineTotal = baselinePeriod ? getCategoryTotal(category, baselinePeriod.id) : 0;

                  return (
                    <Fragment key={category}>
                      {category === 'Expenses' && (
                        <TableRow className="bg-muted font-bold border-t-2">
                          <TableCell className="sticky left-0 bg-muted z-10">Gross Profit</TableCell>

                          {showHistorical && priorPeriods.map(period => {
                            const summary = calculatePeriodSummary(period.id);
                            return (
                              <TableCell key={period.id} className="text-right bg-blue-100/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100">
                                {formatCurrency(summary.grossProfit, { dash: true })}
                              </TableCell>
                            );
                          })}

                          <TableCell className="text-right bg-blue-100 dark:bg-blue-900/30 border-x border-blue-200 dark:border-blue-800">
                            {formatCurrency(baselineSummary?.grossProfit, { dash: true })}
                          </TableCell>

                          {viewMode === 'monthly' ? (
                            months.map((_, monthIndex) => {
                              const summary = calculateMonthSummary(selectedYearInt, monthIndex);
                              return (
                                <TableCell 
                                  key={monthIndex} 
                                  className={`text-right ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}
                                >
                                  {formatCurrency(summary.grossProfit, { dash: true })}
                                </TableCell>
                              );
                            })
                          ) : (
                            years.map((_, i) => {
                              const summary = calculateYearSummary(i);
                              return (
                                <TableCell key={i} className="text-right">{formatCurrency(summary.grossProfit, { dash: true })}</TableCell>
                              );
                            })
                          )}

                          <TableCell className="text-right text-muted-foreground">
                            {viewMode === 'monthly' ? (
                              formatCurrency(months.reduce((sum, _, monthIndex) => sum + calculateMonthSummary(selectedYearInt, monthIndex).grossProfit, 0), { dash: true })
                            ) : (
                              formatPercent(calculateCAGR(
                                calculateYearSummary(0).grossProfit,
                                calculateYearSummary(holdPeriod - 1).grossProfit,
                                holdPeriod - 1
                              ), { showSign: true, dash: true })
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                      {/* Category Header Row */}
                      <TableRow 
                        className="bg-muted cursor-pointer hover:bg-muted"
                        onClick={() => toggleCategory(category)}
                        data-testid={`row-category-${category.toLowerCase()}`}
                      >
                        <TableCell className="font-bold text-sm sticky left-0 bg-muted z-10">
                          <div className="flex items-center gap-2">
                            {expandedCategories.has(category) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {category}
                          </div>
                        </TableCell>

                        {/* Historical totals - blue tint for actuals */}
                        {showHistorical && priorPeriods.map(period => (
                          <TableCell key={period.id} className="text-right font-bold bg-blue-50/60 dark:bg-blue-950/20 text-blue-900 dark:text-blue-100">
                            {formatCurrency(getCategoryTotal(category, period.id), { dash: true })}
                          </TableCell>
                        ))}

                        {/* Baseline total */}
                        <TableCell className="text-right font-bold bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">
                          {formatCurrency(baselineTotal, { dash: true })}
                        </TableCell>

                        {/* Projected totals - Monthly or Annual */}
                        {viewMode === 'monthly' ? (
                          // Monthly totals for selected year
                          months.map((_, monthIndex) => {
                            const value = getMonthlyTotal(category, selectedYearInt, monthIndex);
                            return (
                              <TableCell 
                                key={monthIndex} 
                                className={`text-right font-bold ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}
                              >
                                {formatCurrency(value, { dash: true })}
                              </TableCell>
                            );
                          })
                        ) : (
                          // Annual totals
                          years.map((_, i) => (
                            <TableCell key={i} className="text-right font-bold">
                              {formatCurrency(getCategoryProjectedTotal(category, i), { dash: true })}
                            </TableCell>
                          ))
                        )}

                        {/* CAGR or Annual Total */}
                        <TableCell className="text-right text-muted-foreground">
                          {viewMode === 'monthly' ? (
                            // Show annual total for the selected year
                            formatCurrency(
                              months.reduce((sum, _, monthIndex) => {
                                return sum + getMonthlyTotal(category, selectedYearInt, monthIndex);
                              }, 0)
                            , { dash: true })
                          ) : (
                            formatPercent(calculateCAGR(
                              getCategoryProjectedTotal(category, 0),
                              getCategoryProjectedTotal(category, holdPeriod - 1),
                              holdPeriod - 1
                            ), { showSign: true, dash: true })
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Department-grouped Line Item Rows */}
                      {expandedCategories.has(category) && (() => {
                        const deptEntries = Object.entries(departmentGroupedData[category] || {});
                        const sortedDepts = sortDepartments(deptEntries.map(([d]) => d), category);
                        return sortedDepts.map(department => {
                          const deptItems = (departmentGroupedData[category] || {})[department] || {};
                          return (
                          <Fragment key={`${category}-${department}`}>
                            <TableRow 
                              className="bg-slate-50 dark:bg-slate-900 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                              onClick={() => {
                                toggleDepartment(`${category}-${department}`);
                                if (editMode && viewMode === 'annual') {
                                  const mapping = departmentNameToCategoryKey(department, category);
                                  if (mapping) {
                                    setEditingDepartment(
                                      editingDepartment?.department === department && editingDepartment?.category === category
                                        ? null
                                        : { department, category }
                                    );
                                  }
                                }
                              }}
                            >
                              <TableCell className="pl-6 font-medium sticky left-0 bg-slate-50 dark:bg-slate-900 z-10">
                                <div className="flex items-center gap-1.5">
                                  {expandedDepartments.has(`${category}-${department}`) ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  )}
                                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{department}</span>
                                  {editMode && viewMode === 'annual' && (
                                    <Popover
                                      open={editingDepartment?.department === department && editingDepartment?.category === category}
                                      onOpenChange={(open) => {
                                        if (!open) setEditingDepartment(null);
                                      }}
                                    >
                                      <PopoverTrigger asChild>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingDepartment(
                                              editingDepartment?.department === department && editingDepartment?.category === category
                                                ? null
                                                : { department, category }
                                            );
                                          }}
                                          className="ml-1 p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent side="right" align="start" className="w-auto p-4">
                                        <InlineGrowthEditor
                                          departmentName={department}
                                          category={category}
                                          years={years}
                                          currentRates={getGrowthRatesForDepartment(department, category)}
                                          onSave={(rates) => handleInlineSave(department, category, rates)}
                                          onCancel={() => setEditingDepartment(null)}
                                          isSaving={saveMutation.isPending}
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                </div>
                              </TableCell>

                              {showHistorical && priorPeriods.map(period => {
                                const deptHistTotal = Object.values(deptItems).reduce((sum, v) => sum + (v.historical[period.id] || 0), 0);
                                return (
                                  <TableCell key={period.id} className="text-right text-xs font-medium text-muted-foreground bg-blue-50/60 dark:bg-blue-950/20">
                                    {formatCurrency(deptHistTotal, { dash: true })}
                                  </TableCell>
                                );
                              })}

                              <TableCell className="text-right text-xs font-medium text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">
                                {formatCurrency(baselinePeriod ? Object.values(deptItems).reduce((sum, v) => sum + (v.historical[baselinePeriod.id] || 0), 0) : 0, { dash: true })}
                              </TableCell>

                              {viewMode === 'monthly' ? (
                                months.map((_, monthIndex) => {
                                  const deptMonthTotal = Object.keys(deptItems).reduce((sum, itemName) => 
                                    sum + getLineItemMonthlyValue(category, itemName, selectedYearInt, monthIndex), 0);
                                  return (
                                    <TableCell key={monthIndex} className={`text-right text-xs font-medium text-muted-foreground ${isSeasonalMonth(monthIndex) ? 'bg-green-50/60 dark:bg-green-950/20' : ''}`}>
                                      {formatCurrency(deptMonthTotal, { dash: true })}
                                    </TableCell>
                                  );
                                })
                              ) : (
                                years.map((_, i) => {
                                  const deptYearTotal = Object.values(deptItems).reduce((sum, v) => sum + (v.projected[i] || 0), 0);
                                  return (
                                    <TableCell key={i} className="text-right text-xs font-medium text-muted-foreground">
                                      {formatCurrency(deptYearTotal, { dash: true })}
                                    </TableCell>
                                  );
                                })
                              )}

                              <TableCell className="text-right text-xs text-muted-foreground">-</TableCell>
                            </TableRow>

                            {expandedDepartments.has(`${category}-${department}`) && Object.entries(deptItems).map(([itemName, values]) => {
                              const baselineValue = baselinePeriod ? (values.historical[baselinePeriod.id] || 0) : 0;
                              return (
                                <TableRow key={itemName} className="text-sm group">
                                  <TableCell className="pl-10 text-[11px] sticky left-0 bg-background z-10">
                                    <div className="flex items-center gap-1">
                                      <span className="truncate">{itemName}</span>
                                      {getDepartmentOverride(itemName) && (
                                        <Badge variant="outline" className="text-[10px] h-5 bg-blue-50 text-blue-700 border-blue-300 shrink-0">
                                          <FolderInput className="h-2.5 w-2.5 mr-0.5" />
                                          Moved
                                        </Badge>
                                      )}
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 w-5 p-0 shrink-0 opacity-0 group-hover:opacity-100 ml-auto"
                                          >
                                            <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-52">
                                          <DropdownMenuSub>
                                            <DropdownMenuSubTrigger>
                                              <FolderInput className="h-3.5 w-3.5 mr-2" />
                                              Move to Department
                                            </DropdownMenuSubTrigger>
                                            <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                                              {VALID_DEPARTMENTS.filter(d => d !== department).map(dept => (
                                                <DropdownMenuItem
                                                  key={dept}
                                                  onClick={() => moveToDepartment(itemName, dept, category)}
                                                  disabled={overridesPending}
                                                >
                                                  {dept}
                                                </DropdownMenuItem>
                                              ))}
                                              {getDepartmentOverride(itemName) && (
                                                <>
                                                  <DropdownMenuSeparator />
                                                  <DropdownMenuItem
                                                    onClick={() => removeDepartmentOverride(itemName)}
                                                    disabled={overridesPending}
                                                    className="text-muted-foreground"
                                                  >
                                                    <Undo2 className="h-3.5 w-3.5 mr-2" />
                                                    Restore Original
                                                  </DropdownMenuItem>
                                                </>
                                              )}
                                            </DropdownMenuSubContent>
                                          </DropdownMenuSub>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            onClick={() => excludeLineItem(itemName, category)}
                                            disabled={overridesPending}
                                            className="text-red-600 focus:text-red-600"
                                          >
                                            <EyeOff className="h-3.5 w-3.5 mr-2" />
                                            Exclude from P&L
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </TableCell>

                                  {showHistorical && priorPeriods.map(period => (
                                    <TableCell key={period.id} className="text-right bg-blue-50/60 dark:bg-blue-950/20 text-blue-900 dark:text-blue-100">
                                      {formatCurrency(values.historical[period.id], { dash: true })}
                                    </TableCell>
                                  ))}

                                  <TableCell className="text-right bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">
                                    {formatCurrency(baselineValue, { dash: true })}
                                  </TableCell>

                                  {viewMode === 'monthly' ? (
                                    months.map((_, monthIndex) => {
                                      const monthValue = getLineItemMonthlyValue(category, itemName, selectedYearInt, monthIndex);
                                      return (
                                        <TableCell 
                                          key={monthIndex} 
                                          className={`text-right ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}
                                        >
                                          {formatCurrency(monthValue, { dash: true })}
                                        </TableCell>
                                      );
                                    })
                                  ) : (
                                    values.projected.map((value: number, i: number) => (
                                      <TableCell key={i} className="text-right">
                                        {formatCurrency(value, { dash: true })}
                                      </TableCell>
                                    ))
                                  )}

                                  <TableCell className="text-right text-xs text-muted-foreground">
                                    {viewMode === 'monthly' ? (
                                      formatCurrency(
                                        months.reduce((sum, _, monthIndex) => 
                                          sum + getLineItemMonthlyValue(category, itemName, selectedYearInt, monthIndex), 0)
                                      , { dash: true })
                                    ) : (
                                      formatPercent(calculateCAGR(
                                        values.projected[0],
                                        values.projected[holdPeriod - 1],
                                        holdPeriod - 1
                                      ), { showSign: true, dash: true })
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </Fragment>
                        );
                        });
                      })()}
                    </Fragment>
                  );
                })}

                {/* Above-the-Line Items (if any) */}
                {(linePositions.managementFee === 'above' || linePositions.capex === 'above' || linePositions.reserves === 'above') && (
                  <>
                    <TableRow className="border-t bg-amber-50/30 dark:bg-amber-950/10">
                      <TableCell colSpan={100} className="sticky left-0 z-10 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 py-1">
                        Above-the-Line Adjustments
                      </TableCell>
                    </TableRow>
                    {linePositions.managementFee === 'above' && (
                      <TableRow>
                        <TableCell className="sticky left-0 bg-background z-10 pl-6 text-amber-700 dark:text-amber-400 text-[11px]">Management Fee ↑</TableCell>
                        {showHistorical && priorPeriods.map(period => (
                          <TableCell key={period.id} className="text-right text-muted-foreground bg-blue-50/60 dark:bg-blue-950/20">-</TableCell>
                        ))}
                        <TableCell className="text-right text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">-</TableCell>
                        {viewMode === 'monthly' ? (
                          months.map((_, monthIndex) => {
                            const summary = calculateMonthSummary(selectedYearInt, monthIndex);
                            return (
                              <TableCell key={monthIndex} className={`text-right text-red-500 text-[11px] ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}>
                                ({formatCurrency(summary.managementFee, { dash: true })})
                              </TableCell>
                            );
                          })
                        ) : (
                          years.map((_, i) => {
                            const summary = calculateYearSummary(i);
                            return <TableCell key={i} className="text-right text-red-500 text-[11px]">({formatCurrency(summary.managementFee, { dash: true })})</TableCell>;
                          })
                        )}
                        <TableCell className="text-right text-muted-foreground">-</TableCell>
                      </TableRow>
                    )}
                    {linePositions.capex === 'above' && (
                      <TableRow>
                        <TableCell className="sticky left-0 bg-background z-10 pl-6 text-amber-700 dark:text-amber-400 text-[11px]">Capital Expenditures ↑</TableCell>
                        {showHistorical && priorPeriods.map(period => (
                          <TableCell key={period.id} className="text-right text-muted-foreground bg-blue-50/60 dark:bg-blue-950/20">-</TableCell>
                        ))}
                        <TableCell className="text-right text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">-</TableCell>
                        {viewMode === 'monthly' ? (
                          months.map((_, monthIndex) => {
                            const summary = calculateMonthSummary(selectedYearInt, monthIndex);
                            return (
                              <TableCell key={monthIndex} className={`text-right text-red-500 text-[11px] ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}>
                                ({formatCurrency(summary.capex, { dash: true })})
                              </TableCell>
                            );
                          })
                        ) : (
                          years.map((_, i) => {
                            const summary = calculateYearSummary(i);
                            return <TableCell key={i} className="text-right text-red-500 text-[11px]">({formatCurrency(summary.capex, { dash: true })})</TableCell>;
                          })
                        )}
                        <TableCell className="text-right text-muted-foreground">-</TableCell>
                      </TableRow>
                    )}
                    {linePositions.reserves === 'above' && (
                      <TableRow>
                        <TableCell className="sticky left-0 bg-background z-10 pl-6 text-amber-700 dark:text-amber-400 text-[11px]">Replacement Reserves ↑</TableCell>
                        {showHistorical && priorPeriods.map(period => (
                          <TableCell key={period.id} className="text-right text-muted-foreground bg-blue-50/60 dark:bg-blue-950/20">-</TableCell>
                        ))}
                        <TableCell className="text-right text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">-</TableCell>
                        {viewMode === 'monthly' ? (
                          months.map((_, monthIndex) => {
                            const summary = calculateMonthSummary(selectedYearInt, monthIndex);
                            return (
                              <TableCell key={monthIndex} className={`text-right text-red-500 text-[11px] ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}>
                                ({formatCurrency(summary.reserves, { dash: true })})
                              </TableCell>
                            );
                          })
                        ) : (
                          years.map((_, i) => {
                            const summary = calculateYearSummary(i);
                            return <TableCell key={i} className="text-right text-red-500 text-[11px]">({formatCurrency(summary.reserves, { dash: true })})</TableCell>;
                          })
                        )}
                        <TableCell className="text-right text-muted-foreground">-</TableCell>
                      </TableRow>
                    )}
                  </>
                )}

                {/* Net Operating Income Row */}
                <TableRow className="bg-primary/10 font-bold">
                  <TableCell className="sticky left-0 bg-primary/10 z-10">Net Operating Income</TableCell>

                  {showHistorical && priorPeriods.map(period => {
                    const summary = calculatePeriodSummary(period.id);
                    return (
                      <TableCell 
                        key={period.id} 
                        className={`text-right bg-blue-100/60 dark:bg-blue-950/30 ${summary.noi >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}
                      >
                        {formatCurrency(summary.noi, { dash: true })}
                      </TableCell>
                    );
                  })}

                  <TableCell className={`text-right bg-blue-100 dark:bg-blue-900/30 border-x border-blue-200 dark:border-blue-800 ${(baselineSummary?.noi || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(baselineSummary?.noi, { dash: true })}
                  </TableCell>

                  {viewMode === 'monthly' ? (
                    months.map((_, monthIndex) => {
                      const summary = calculateMonthSummary(selectedYearInt, monthIndex);
                      return (
                        <TableCell 
                          key={monthIndex} 
                          className={`text-right ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''} ${summary.noi >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {formatCurrency(summary.noi, { dash: true })}
                        </TableCell>
                      );
                    })
                  ) : (
                    years.map((_, i) => {
                      const summary = calculateYearSummary(i);
                      return (
                        <TableCell 
                          key={i} 
                          className={`text-right ${summary.noi >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {formatCurrency(summary.noi, { dash: true })}
                        </TableCell>
                      );
                    })
                  )}

                  <TableCell className="text-right text-green-600">
                    {viewMode === 'monthly' ? (
                      formatCurrency(months.reduce((sum, _, monthIndex) => sum + calculateMonthSummary(selectedYearInt, monthIndex).noi, 0), { dash: true })
                    ) : (
                      formatPercent(calculateCAGR(
                        calculateYearSummary(0).noi,
                        calculateYearSummary(holdPeriod - 1).noi,
                        holdPeriod - 1
                      ), { showSign: true, dash: true })
                    )}
                  </TableCell>
                </TableRow>

                {/* NOI Margin Row */}
                <TableRow className="border-t-2">
                  <TableCell className="sticky left-0 bg-background text-muted-foreground z-10">NOI Margin</TableCell>

                  {showHistorical && priorPeriods.map(period => {
                    const summary = calculatePeriodSummary(period.id);
                    return (
                      <TableCell key={period.id} className="text-right text-blue-700 dark:text-blue-300 bg-blue-50/60 dark:bg-blue-950/20">
                        {formatPercent(summary.noiMargin, { dash: true })}
                      </TableCell>
                    );
                  })}

                  <TableCell className="text-right text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">
                    {formatPercent(baselineSummary?.noiMargin, { dash: true })}
                  </TableCell>

                  {viewMode === 'monthly' ? (
                    months.map((_, monthIndex) => {
                      const summary = calculateMonthSummary(selectedYearInt, monthIndex);
                      return (
                        <TableCell 
                          key={monthIndex} 
                          className={`text-right text-muted-foreground ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}
                        >
                          {formatPercent(summary.noiMargin, { dash: true })}
                        </TableCell>
                      );
                    })
                  ) : (
                    years.map((_, i) => {
                      const summary = calculateYearSummary(i);
                      return (
                        <TableCell key={i} className="text-right text-muted-foreground">
                          {formatPercent(summary.noiMargin, { dash: true })}
                        </TableCell>
                      );
                    })
                  )}

                  <TableCell className="text-right text-muted-foreground">-</TableCell>
                </TableRow>

                <>
                  {(linePositions.managementFee === 'below' || linePositions.capex === 'below' || linePositions.reserves === 'below') && (
                    <TableRow className="border-t-2 bg-muted/30">
                      <TableCell colSpan={100} className="sticky left-0 z-10 text-xs font-semibold uppercase tracking-wider text-muted-foreground py-1">
                        Below-the-Line Adjustments
                      </TableCell>
                    </TableRow>
                  )}

                  {linePositions.managementFee === 'below' && <TableRow>
                    <TableCell className="sticky left-0 bg-background z-10 pl-6 text-muted-foreground">Management Fee</TableCell>
                    {showHistorical && priorPeriods.map(period => (
                      <TableCell key={period.id} className="text-right text-muted-foreground bg-blue-50/60 dark:bg-blue-950/20">-</TableCell>
                    ))}
                    <TableCell className="text-right text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">-</TableCell>
                    {viewMode === 'monthly' ? (
                      months.map((_, monthIndex) => {
                        const summary = calculateMonthSummary(selectedYearInt, monthIndex);
                        return (
                          <TableCell key={monthIndex} className={`text-right text-red-500 ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}>
                            ({formatCurrency(summary.managementFee, { dash: true })})
                          </TableCell>
                        );
                      })
                    ) : (
                      years.map((_, i) => {
                        const summary = calculateYearSummary(i);
                        return <TableCell key={i} className="text-right text-red-500">({formatCurrency(summary.managementFee, { dash: true })})</TableCell>;
                      })
                    )}
                    <TableCell className="text-right text-muted-foreground">-</TableCell>
                  </TableRow>}

                  {linePositions.capex === 'below' && <TableRow>
                    <TableCell className="sticky left-0 bg-background z-10 pl-6 text-muted-foreground">Capital Expenditures</TableCell>
                    {showHistorical && priorPeriods.map(period => (
                      <TableCell key={period.id} className="text-right text-muted-foreground bg-blue-50/60 dark:bg-blue-950/20">-</TableCell>
                    ))}
                    <TableCell className="text-right text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">-</TableCell>
                    {viewMode === 'monthly' ? (
                      months.map((_, monthIndex) => {
                        const summary = calculateMonthSummary(selectedYearInt, monthIndex);
                        return (
                          <TableCell key={monthIndex} className={`text-right text-red-500 ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}>
                            ({formatCurrency(summary.capex, { dash: true })})
                          </TableCell>
                        );
                      })
                    ) : (
                      years.map((_, i) => {
                        const summary = calculateYearSummary(i);
                        return <TableCell key={i} className="text-right text-red-500">({formatCurrency(summary.capex, { dash: true })})</TableCell>;
                      })
                    )}
                    <TableCell className="text-right text-muted-foreground">-</TableCell>
                  </TableRow>}

                  {linePositions.reserves === 'below' && <TableRow>
                    <TableCell className="sticky left-0 bg-background z-10 pl-6 text-muted-foreground">Replacement Reserves</TableCell>
                    {showHistorical && priorPeriods.map(period => (
                      <TableCell key={period.id} className="text-right text-muted-foreground bg-blue-50/60 dark:bg-blue-950/20">-</TableCell>
                    ))}
                    <TableCell className="text-right text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">-</TableCell>
                    {viewMode === 'monthly' ? (
                      months.map((_, monthIndex) => {
                        const summary = calculateMonthSummary(selectedYearInt, monthIndex);
                        return (
                          <TableCell key={monthIndex} className={`text-right text-red-500 ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}>
                            ({formatCurrency(summary.reserves, { dash: true })})
                          </TableCell>
                        );
                      })
                    ) : (
                      years.map((_, i) => {
                        const summary = calculateYearSummary(i);
                        return <TableCell key={i} className="text-right text-red-500">({formatCurrency(summary.reserves, { dash: true })})</TableCell>;
                      })
                    )}
                    <TableCell className="text-right text-muted-foreground">-</TableCell>
                  </TableRow>}

                  <TableRow className="bg-amber-50/50 dark:bg-amber-950/10 font-semibold border-t">
                    <TableCell className="sticky left-0 bg-amber-50/50 dark:bg-amber-950/10 z-10">Cash Flow Before Debt Service</TableCell>
                    {showHistorical && priorPeriods.map(period => (
                      <TableCell key={period.id} className="text-right text-muted-foreground bg-blue-50/60 dark:bg-blue-950/20">-</TableCell>
                    ))}
                    <TableCell className="text-right text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">-</TableCell>
                    {viewMode === 'monthly' ? (
                      months.map((_, monthIndex) => {
                        const summary = calculateMonthSummary(selectedYearInt, monthIndex);
                        return (
                          <TableCell key={monthIndex} className={`text-right ${summary.cashFlowBeforeDebtService >= 0 ? 'text-amber-700 dark:text-amber-400' : 'text-red-600'} ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}>
                            {formatCurrency(summary.cashFlowBeforeDebtService, { dash: true })}
                          </TableCell>
                        );
                      })
                    ) : (
                      years.map((_, i) => {
                        const summary = calculateYearSummary(i);
                        return (
                          <TableCell key={i} className={`text-right ${summary.cashFlowBeforeDebtService >= 0 ? 'text-amber-700 dark:text-amber-400' : 'text-red-600'}`}>
                            {formatCurrency(summary.cashFlowBeforeDebtService, { dash: true })}
                          </TableCell>
                        );
                      })
                    )}
                    <TableCell className="text-right text-amber-700 dark:text-amber-400">
                      {viewMode === 'monthly' ? (
                        formatCurrency(months.reduce((sum, _, monthIndex) => sum + calculateMonthSummary(selectedYearInt, monthIndex).cashFlowBeforeDebtService, 0), { dash: true })
                      ) : (
                        formatPercent(calculateCAGR(
                          calculateYearSummary(0).cashFlowBeforeDebtService,
                          calculateYearSummary(holdPeriod - 1).cashFlowBeforeDebtService,
                          holdPeriod - 1
                        ), { showSign: true, dash: true })
                      )}
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell className="sticky left-0 bg-background z-10 pl-6 text-muted-foreground">Annual Debt Service</TableCell>
                    {showHistorical && priorPeriods.map(period => (
                      <TableCell key={period.id} className="text-right text-muted-foreground bg-blue-50/60 dark:bg-blue-950/20">-</TableCell>
                    ))}
                    <TableCell className="text-right text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">-</TableCell>
                    {viewMode === 'monthly' ? (
                      months.map((_, monthIndex) => {
                        const summary = calculateMonthSummary(selectedYearInt, monthIndex);
                        return (
                          <TableCell key={monthIndex} className={`text-right text-red-500 ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}>
                            ({formatCurrency(summary.debtService, { dash: true })})
                          </TableCell>
                        );
                      })
                    ) : (
                      years.map((_, i) => {
                        const summary = calculateYearSummary(i);
                        return <TableCell key={i} className="text-right text-red-500">({formatCurrency(summary.debtService, { dash: true })})</TableCell>;
                      })
                    )}
                    <TableCell className="text-right text-muted-foreground">-</TableCell>
                  </TableRow>

                  <TableRow className="bg-emerald-50 dark:bg-emerald-950/20 font-bold border-t-2">
                    <TableCell className="sticky left-0 bg-emerald-50 dark:bg-emerald-950/20 z-10">Cash Flow After Debt Service</TableCell>
                    {showHistorical && priorPeriods.map(period => (
                      <TableCell key={period.id} className="text-right text-muted-foreground bg-blue-50/60 dark:bg-blue-950/20">-</TableCell>
                    ))}
                    <TableCell className="text-right text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">-</TableCell>
                    {viewMode === 'monthly' ? (
                      months.map((_, monthIndex) => {
                        const summary = calculateMonthSummary(selectedYearInt, monthIndex);
                        return (
                          <TableCell key={monthIndex} className={`text-right ${summary.leveredCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'} ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}>
                            {formatCurrency(summary.leveredCashFlow, { dash: true })}
                          </TableCell>
                        );
                      })
                    ) : (
                      years.map((_, i) => {
                        const summary = calculateYearSummary(i);
                        return (
                          <TableCell key={i} className={`text-right ${summary.leveredCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(summary.leveredCashFlow, { dash: true })}
                          </TableCell>
                        );
                      })
                    )}
                    <TableCell className="text-right text-emerald-600">
                      {viewMode === 'monthly' ? (
                        formatCurrency(months.reduce((sum, _, monthIndex) => sum + calculateMonthSummary(selectedYearInt, monthIndex).leveredCashFlow, 0), { dash: true })
                      ) : (
                        formatPercent(calculateCAGR(
                          calculateYearSummary(0).leveredCashFlow,
                          calculateYearSummary(holdPeriod - 1).leveredCashFlow,
                          holdPeriod - 1
                        ), { showSign: true, dash: true })
                      )}
                    </TableCell>
                  </TableRow>
                </>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {getExcludedItems().length > 0 && (
        <Card className="mt-4">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-muted-foreground" />
              Excluded Line Items ({getExcludedItems().length})
            </CardTitle>
            <CardDescription className="text-xs">
              These items have been excluded from the P&L. Click restore to bring them back.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="flex flex-wrap gap-2">
              {getExcludedItems().map(item => (
                <Badge
                  key={item.id}
                  variant="outline"
                  className="text-xs px-2 py-1 bg-red-50 text-red-700 border-red-200 cursor-pointer hover:bg-red-100 transition-colors"
                  onClick={() => restoreLineItem(item.lineItemKey)}
                >
                  {item.lineItemKey}
                  <Undo2 className="h-3 w-3 ml-1.5" />
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Methodology Card */}
      <Card className="border-dashed">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium mb-1">Pro Forma Methodology</h4>
              <p className="text-sm text-muted-foreground">
                {hasHistoricalData ? (
                  <>
                    Projections are calculated using your <strong>{baselinePeriod?.label}</strong> data as the baseline. 
                    Revenue grows by the category-specific growth rates you set in Assumptions. 
                    COGS is calculated as (1 - Gross Profit Margin) × Revenue for applicable departments. 
                    Seasonal departments show $0 during off-season months, with revenue concentrated in your defined in-season period.
                    {priorPeriods.length > 0 && (
                      <> Historical columns ({priorPeriods.map(p => p.shortLabel).join(', ')}) are shown for trend analysis.</>
                    )}
                  </>
                ) : (
                  <>
                    Upload P&L documents in the Documents tab to establish your baseline actuals. 
                    The system will automatically detect whether your data represents a calendar year, fiscal year, 
                    or trailing 12-month period and label the columns accordingly. 
                    Multiple years of historical data will be displayed for trend analysis.
                  </>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}