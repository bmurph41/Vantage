import { useState, useMemo, Fragment } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  History
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';
import { useDepartmentOrder } from '@/hooks/useDepartmentOrder';

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

export default function WorkspaceProForma({ projectId, onTabChange }: WorkspaceProFormaProps) {
  const [viewMode, setViewMode] = useState<'monthly' | 'annual'>('annual');
  const [selectedYear, setSelectedYear] = useState('2026');
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
  const { toast } = useToast();

  // Fetch project configuration
  const { data: config } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
  });

  // Mutation to update hold period (syncs everywhere) - Requirement J
  const updateHoldPeriodMutation = useMutation({
    mutationFn: async (newHoldPeriod: number) => {
      const response = await fetch(`/api/modeling/projects/${projectId}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ holdPeriod: newHoldPeriod }),
      });
      if (!response.ok) throw new Error('Failed to update hold period');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'config'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'pro-forma'] });
      toast({ title: 'Updated', description: 'Hold period updated and synced.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update hold period.', variant: 'destructive' });
    },
  });

  // Fetch assumptions/growth rates
  const { data: assumptions } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'assumptions'],
  });

  // Fetch pro forma projections
  const { data: proFormaData, isLoading: proFormaLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'pro-forma'],
  });

  // Fetch uploaded documents to determine available periods
  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects', projectId, 'documents'],
  });

  // Fetch historical actuals data - this would come from processed documents
  const { data: historicalData } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'historical-actuals'],
  });

  // Fetch actuals by year from document uploads
  const { data: actualsData } = useQuery<any>({
    queryKey: [`/api/modeling/projects/${projectId}/actuals`],
  });

  const holdPeriod = config?.holdPeriod || 7;
  const startDate = config?.startDate || '2026-01-31';
  const seasonMonths = config?.seasonMonths || [4, 5, 6, 7, 8, 9, 10];
  const startYear = parseInt(startDate.split('-')[0]);
  const years = Array.from({ length: holdPeriod }, (_, i) => startYear + i);

  // Process documents to determine available historical periods
  const historicalPeriods = useMemo((): DocumentPeriod[] => {
    if (!documents || documents.length === 0) {
      // Return empty array if no documents - will show placeholder
      return [];
    }

    // Group documents by their fiscal period
    const periodsMap = new Map<string, DocumentPeriod>();

    documents
      .filter((doc: any) => doc.status === 'completed')
      .forEach((doc: any) => {
        // Extract period info from document metadata
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

    // Sort periods chronologically (oldest first)
    return Array.from(periodsMap.values()).sort((a, b) => 
      new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
    );
  }, [documents]);

  // Get the most recent period (the "baseline" for projections)
  const baselinePeriod = historicalPeriods.length > 0 
    ? historicalPeriods[historicalPeriods.length - 1] 
    : null;

  // Historical periods excluding the baseline (for showing historical trend)
  const priorPeriods = historicalPeriods.slice(0, -1);

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

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const formatPercentSimple = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return `${value.toFixed(1)}%`;
  };

  const isSeasonalMonth = (monthIndex: number) => seasonMonths.includes(monthIndex + 1);

  const inferDepartmentClient = (subcategory: string, _category?: string): string => {
    const lower = subcategory.toLowerCase();
    if (lower.includes('slip') || lower.includes('dock') || lower.includes('berth') || lower.includes('mooring') || lower.includes('storage') || lower.includes('land storage'))
      return 'Storage';
    if (lower.includes('fuel') || lower.includes('gas') || lower.includes('diesel'))
      return 'Fuel';
    if (lower.includes('store') || lower.includes('merchandise') || lower.includes('retail') || lower.includes('chandlery'))
      return "Ship's Store";
    if (lower.includes('service') || lower.includes('repair') || lower.includes('mechanic') || lower.includes('bottom paint') || lower.includes('bottom wash') || lower.includes('shrink wrap') || lower.includes('hauling'))
      return 'Service';
    if (lower.includes('brokerage') || lower.includes('broker') || lower.includes('finance commission'))
      return 'Boat Brokerage';
    if (lower.includes('new boat') || lower.includes('used boat') || lower.includes('boat sale') || lower.includes('trade'))
      return 'Boat Sales';
    if (lower.includes('payroll') || lower.includes('wage') || lower.includes('salary') || lower.includes('benefit') || lower.includes('workers comp') || lower.includes('soc security') || lower.includes('futa') || lower.includes('disability') || lower.includes('family leave') || lower.includes('medical insurance'))
      return 'Payroll';
    if (lower.includes('launch') || lower.includes('haul') || lower.includes('electric') || lower.includes('power') || lower.includes('amenity') || lower.includes('dockside'))
      return 'Marina & Amenities';
    return 'General';
  };

  // Get monthly periods for the selected year
  const selectedYearInt = parseInt(selectedYear);
  const getMonthKey = (year: number, month: number) => {
    const monthStr = (month + 1).toString().padStart(2, '0');
    return `${year}-${monthStr}`;
  };

  // Build data structure from actuals and projections
  const tableData = useMemo(() => {
    // Structure: { category: { lineItem: { historical: {periodId: value}, projected: [year values] } } }
    const data: Record<string, Record<string, { historical: Record<string, number>; projected: number[] }>> = {
      Revenue: {},
      COGS: {},
      Expenses: {}
    };

    // Populate from actuals data if available
    if (actualsData?.grouped) {
      actualsData.grouped.forEach((item: any) => {
        const category = item.category as keyof typeof data;
        if (data[category]) {
          const lineItemName = item.subcategory || item.description || 'Other';
          if (!data[category][lineItemName]) {
            data[category][lineItemName] = { historical: {}, projected: Array(holdPeriod).fill(0) };
          }
          // Map to baseline period if we have one
          if (baselinePeriod) {
            data[category][lineItemName].historical[baselinePeriod.id] = item.annualTotal || 0;
          }
        }
      });
    }

    // Populate from pro forma projections if available
    if (proFormaData?.categories) {
      Object.entries(proFormaData.categories).forEach(([category, items]: [string, any]) => {
        if (data[category as keyof typeof data]) {
          Object.entries(items).forEach(([itemName, values]: [string, any]) => {
            if (!data[category as keyof typeof data][itemName]) {
              data[category as keyof typeof data][itemName] = { historical: {}, projected: [] };
            }
            data[category as keyof typeof data][itemName].projected = values;
          });
        }
      });
    }

    return data;
  }, [actualsData, proFormaData, baselinePeriod, holdPeriod]);

  const serverDeptMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (actualsData?.grouped) {
      actualsData.grouped.forEach((item: any) => {
        if (item.subcategory && item.department) {
          map[item.subcategory] = item.department;
        }
      });
    }
    return map;
  }, [actualsData]);

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
      const expenses = monthlyProj.expenses;
      const noi = monthlyProj.noi;
      // Gross profit in monthly view = Revenue - Expenses (COGS is included in expenses)
      const grossProfit = revenue - expenses;
      return {
        revenue,
        cogs: 0,
        expenses,
        grossProfit,
        noi,
        noiMargin: revenue > 0 ? (noi / revenue) * 100 : 0
      };
    }
    return { revenue: 0, cogs: 0, expenses: 0, grossProfit: 0, noi: 0, noiMargin: 0 };
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
    return { revenue, cogs, expenses, grossProfit, noi, noiMargin };
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

  const hasHistoricalData = historicalPeriods.length > 0;

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
    <div className="space-y-6">
      {onTabChange && (
        <WorkflowNavigation currentTab="proforma" onNavigate={onTabChange} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Pro Forma Projections</h2>
          <p className="text-sm text-muted-foreground">
            {hasHistoricalData 
              ? `${holdPeriod}-year projections based on ${baselinePeriod?.label || 'historical'} data with growth assumptions`
              : `${holdPeriod}-year projections - upload documents to populate baseline actuals`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Hold Period Selector - Requirement J */}
          <Select 
            value={holdPeriod.toString()} 
            onValueChange={(v) => updateHoldPeriodMutation.mutate(parseInt(v))}
            disabled={updateHoldPeriodMutation.isPending}
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
          <Button variant="outline" size="sm" onClick={exportProForma}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <div className="text-2xl font-bold">{formatCurrency(baselineSummary?.revenue)}</div>
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
                        {formatPercent(growth)}
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
            <div className="text-2xl font-bold">{formatCurrency(baselineSummary?.noi)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatPercentSimple(baselineSummary?.noiMargin)} margin
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
            <div className="text-2xl font-bold">{formatCurrency(year1Summary.noi)}</div>
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
                        {formatPercent(growth)}
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
            <div className="text-2xl font-bold">{formatCurrency(finalYearSummary.noi)}</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">
                {formatPercent(calculateCAGR(year1Summary.noi, finalYearSummary.noi, holdPeriod - 1))}
              </span>
              <span className="text-xs text-muted-foreground">CAGR</span>
            </div>
          </CardContent>
        </Card>
      </div>

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
                    <div className="text-xl font-bold">{formatCurrency(baselineSummary?.revenue)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">Cost of Goods Sold</div>
                    <div className="text-xl font-bold">{formatCurrency(baselineSummary?.cogs)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">Gross Profit</div>
                    <div className="text-xl font-bold">{formatCurrency(baselineSummary?.grossProfit)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">Gross Margin</div>
                    <div className="text-xl font-bold">{formatPercentSimple(baselineSummary?.revenue ? ((baselineSummary.grossProfit / baselineSummary.revenue) * 100) : 0)}</div>
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
                            <span className="text-sm text-muted-foreground">{formatPercentSimple(pct)}</span>
                            <span className="font-medium">{formatCurrency(baseValue)}</span>
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
                    <div className="text-xl font-bold">{formatCurrency(baselineSummary?.revenue)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">Total Expenses</div>
                    <div className="text-xl font-bold">{formatCurrency((baselineSummary?.cogs || 0) + (baselineSummary?.expenses || 0))}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border border-green-200 bg-green-50 dark:bg-green-950/30">
                    <div className="text-sm text-muted-foreground">Net Operating Income</div>
                    <div className="text-xl font-bold text-green-600">{formatCurrency(baselineSummary?.noi)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">NOI Margin</div>
                    <div className="text-xl font-bold">{formatPercentSimple(baselineSummary?.noiMargin)}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">NOI Waterfall</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200">
                      <span>Revenue</span>
                      <span className="font-medium">{formatCurrency(baselineSummary?.revenue)}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200">
                      <span>(-) Cost of Goods Sold</span>
                      <span className="font-medium text-red-600">{formatCurrency(baselineSummary?.cogs)}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-slate-900/50 border">
                      <span className="font-medium">= Gross Profit</span>
                      <span className="font-medium">{formatCurrency(baselineSummary?.grossProfit)}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200">
                      <span>(-) Operating Expenses</span>
                      <span className="font-medium text-red-600">{formatCurrency(baselineSummary?.expenses)}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-green-100 dark:bg-green-900/30 border border-green-300">
                      <span className="font-bold">= Net Operating Income</span>
                      <span className="font-bold text-green-600">{formatCurrency(baselineSummary?.noi)}</span>
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
                    <div className="text-xl font-bold">{formatCurrency(year1Summary.revenue)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">Year 1 Expenses</div>
                    <div className="text-xl font-bold">{formatCurrency(year1Summary.cogs + year1Summary.expenses)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border border-green-200 bg-green-50 dark:bg-green-950/30">
                    <div className="text-sm text-muted-foreground">Year 1 NOI</div>
                    <div className="text-xl font-bold text-green-600">{formatCurrency(year1Summary.noi)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">vs Baseline</div>
                    <div className="text-xl font-bold">{formatPercent(calculateYoYGrowth(year1Summary.noi, baselineSummary?.noi || 0))}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Year 1 NOI Waterfall</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200">
                      <span>Revenue</span>
                      <span className="font-medium">{formatCurrency(year1Summary.revenue)}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200">
                      <span>(-) Cost of Goods Sold</span>
                      <span className="font-medium text-red-600">{formatCurrency(year1Summary.cogs)}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-slate-900/50 border">
                      <span className="font-medium">= Gross Profit</span>
                      <span className="font-medium">{formatCurrency(year1Summary.grossProfit)}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200">
                      <span>(-) Operating Expenses</span>
                      <span className="font-medium text-red-600">{formatCurrency(year1Summary.expenses)}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-green-100 dark:bg-green-900/30 border border-green-300">
                      <span className="font-bold">= Net Operating Income</span>
                      <span className="font-bold text-green-600">{formatCurrency(year1Summary.noi)}</span>
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
                    <div className="text-xl font-bold">{formatCurrency(finalYearSummary.revenue)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">Year {holdPeriod} Expenses</div>
                    <div className="text-xl font-bold">{formatCurrency(finalYearSummary.cogs + finalYearSummary.expenses)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border border-green-200 bg-green-50 dark:bg-green-950/30">
                    <div className="text-sm text-muted-foreground">Year {holdPeriod} NOI</div>
                    <div className="text-xl font-bold text-green-600">{formatCurrency(finalYearSummary.noi)}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background border">
                    <div className="text-sm text-muted-foreground">{holdPeriod - 1}Y CAGR</div>
                    <div className="text-xl font-bold text-green-600">{formatPercent(calculateCAGR(year1Summary.noi, finalYearSummary.noi, holdPeriod - 1))}</div>
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Year {holdPeriod} NOI Waterfall</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200">
                      <span>Revenue</span>
                      <span className="font-medium">{formatCurrency(finalYearSummary.revenue)}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200">
                      <span>(-) Cost of Goods Sold</span>
                      <span className="font-medium text-red-600">{formatCurrency(finalYearSummary.cogs)}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-slate-900/50 border">
                      <span className="font-medium">= Gross Profit</span>
                      <span className="font-medium">{formatCurrency(finalYearSummary.grossProfit)}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200">
                      <span>(-) Operating Expenses</span>
                      <span className="font-medium text-red-600">{formatCurrency(finalYearSummary.expenses)}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-green-100 dark:bg-green-900/30 border border-green-300">
                      <span className="font-bold">= Net Operating Income</span>
                      <span className="font-bold text-green-600">{formatCurrency(finalYearSummary.noi)}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border">
                  <h4 className="text-sm font-medium mb-2">NOI Growth Over Hold Period</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-xs text-muted-foreground">Year 1</div>
                      <div className="font-medium">{formatCurrency(year1Summary.noi)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Total Growth</div>
                      <div className="font-medium text-green-600">{formatPercent(calculateYoYGrowth(finalYearSummary.noi, year1Summary.noi))}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Year {holdPeriod}</div>
                      <div className="font-medium">{formatCurrency(finalYearSummary.noi)}</div>
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
                      {/* Category Header Row */}
                      <TableRow 
                        className="bg-muted cursor-pointer hover:bg-muted"
                        onClick={() => toggleCategory(category)}
                        data-testid={`row-category-${category.toLowerCase()}`}
                      >
                        <TableCell className="font-semibold sticky left-0 bg-muted z-10">
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
                          <TableCell key={period.id} className="text-right font-semibold bg-blue-50/60 dark:bg-blue-950/20 text-blue-900 dark:text-blue-100">
                            {formatCurrency(getCategoryTotal(category, period.id))}
                          </TableCell>
                        ))}

                        {/* Baseline total */}
                        <TableCell className="text-right font-semibold bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">
                          {formatCurrency(baselineTotal)}
                        </TableCell>

                        {/* Projected totals - Monthly or Annual */}
                        {viewMode === 'monthly' ? (
                          // Monthly totals for selected year
                          months.map((_, monthIndex) => {
                            const value = getMonthlyTotal(category, selectedYearInt, monthIndex);
                            return (
                              <TableCell 
                                key={monthIndex} 
                                className={`text-right font-semibold ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}
                              >
                                {formatCurrency(value)}
                              </TableCell>
                            );
                          })
                        ) : (
                          // Annual totals
                          years.map((_, i) => (
                            <TableCell key={i} className="text-right font-semibold">
                              {formatCurrency(getCategoryProjectedTotal(category, i))}
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
                            )
                          ) : (
                            formatPercent(calculateCAGR(
                              getCategoryProjectedTotal(category, 0),
                              getCategoryProjectedTotal(category, holdPeriod - 1),
                              holdPeriod - 1
                            ))
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
                              onClick={() => toggleDepartment(`${category}-${department}`)}
                            >
                              <TableCell className="pl-6 font-medium sticky left-0 bg-slate-50 dark:bg-slate-900 z-10">
                                <div className="flex items-center gap-1.5">
                                  {expandedDepartments.has(`${category}-${department}`) ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  )}
                                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{department}</span>
                                </div>
                              </TableCell>

                              {showHistorical && priorPeriods.map(period => {
                                const deptHistTotal = Object.values(deptItems).reduce((sum, v) => sum + (v.historical[period.id] || 0), 0);
                                return (
                                  <TableCell key={period.id} className="text-right text-xs font-medium text-muted-foreground bg-blue-50/60 dark:bg-blue-950/20">
                                    {formatCurrency(deptHistTotal)}
                                  </TableCell>
                                );
                              })}

                              <TableCell className="text-right text-xs font-medium text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">
                                {formatCurrency(baselinePeriod ? Object.values(deptItems).reduce((sum, v) => sum + (v.historical[baselinePeriod.id] || 0), 0) : 0)}
                              </TableCell>

                              {viewMode === 'monthly' ? (
                                months.map((_, monthIndex) => {
                                  const deptMonthTotal = Object.keys(deptItems).reduce((sum, itemName) => 
                                    sum + getLineItemMonthlyValue(category, itemName, selectedYearInt, monthIndex), 0);
                                  return (
                                    <TableCell key={monthIndex} className={`text-right text-xs font-medium text-muted-foreground ${isSeasonalMonth(monthIndex) ? 'bg-green-50/60 dark:bg-green-950/20' : ''}`}>
                                      {formatCurrency(deptMonthTotal)}
                                    </TableCell>
                                  );
                                })
                              ) : (
                                years.map((_, i) => {
                                  const deptYearTotal = Object.values(deptItems).reduce((sum, v) => sum + (v.projected[i] || 0), 0);
                                  return (
                                    <TableCell key={i} className="text-right text-xs font-medium text-muted-foreground">
                                      {formatCurrency(deptYearTotal)}
                                    </TableCell>
                                  );
                                })
                              )}

                              <TableCell className="text-right text-xs text-muted-foreground">-</TableCell>
                            </TableRow>

                            {expandedDepartments.has(`${category}-${department}`) && Object.entries(deptItems).map(([itemName, values]) => {
                              const baselineValue = baselinePeriod ? (values.historical[baselinePeriod.id] || 0) : 0;
                              return (
                                <TableRow key={itemName} className="text-sm">
                                  <TableCell className="pl-10 sticky left-0 bg-background z-10">
                                    {itemName}
                                  </TableCell>

                                  {showHistorical && priorPeriods.map(period => (
                                    <TableCell key={period.id} className="text-right bg-blue-50/60 dark:bg-blue-950/20 text-blue-900 dark:text-blue-100">
                                      {formatCurrency(values.historical[period.id])}
                                    </TableCell>
                                  ))}

                                  <TableCell className="text-right bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">
                                    {formatCurrency(baselineValue)}
                                  </TableCell>

                                  {viewMode === 'monthly' ? (
                                    months.map((_, monthIndex) => {
                                      const monthValue = getLineItemMonthlyValue(category, itemName, selectedYearInt, monthIndex);
                                      return (
                                        <TableCell 
                                          key={monthIndex} 
                                          className={`text-right ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}
                                        >
                                          {formatCurrency(monthValue)}
                                        </TableCell>
                                      );
                                    })
                                  ) : (
                                    values.projected.map((value: number, i: number) => (
                                      <TableCell key={i} className="text-right">
                                        {formatCurrency(value)}
                                      </TableCell>
                                    ))
                                  )}

                                  <TableCell className="text-right text-xs text-muted-foreground">
                                    {viewMode === 'monthly' ? (
                                      formatCurrency(
                                        months.reduce((sum, _, monthIndex) => 
                                          sum + getLineItemMonthlyValue(category, itemName, selectedYearInt, monthIndex), 0)
                                      )
                                    ) : (
                                      formatPercent(calculateCAGR(
                                        values.projected[0],
                                        values.projected[holdPeriod - 1],
                                        holdPeriod - 1
                                      ))
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

                {/* Gross Profit Row */}
                <TableRow className="bg-muted font-bold border-t-2">
                  <TableCell className="sticky left-0 bg-muted z-10">Gross Profit</TableCell>

                  {showHistorical && priorPeriods.map(period => {
                    const summary = calculatePeriodSummary(period.id);
                    return (
                      <TableCell key={period.id} className="text-right bg-blue-100/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100">
                        {formatCurrency(summary.grossProfit)}
                      </TableCell>
                    );
                  })}

                  <TableCell className="text-right bg-blue-100 dark:bg-blue-900/30 border-x border-blue-200 dark:border-blue-800">
                    {formatCurrency(baselineSummary?.grossProfit)}
                  </TableCell>

                  {viewMode === 'monthly' ? (
                    months.map((_, monthIndex) => {
                      const summary = calculateMonthSummary(selectedYearInt, monthIndex);
                      return (
                        <TableCell 
                          key={monthIndex} 
                          className={`text-right ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}
                        >
                          {formatCurrency(summary.grossProfit)}
                        </TableCell>
                      );
                    })
                  ) : (
                    years.map((_, i) => {
                      const summary = calculateYearSummary(i);
                      return (
                        <TableCell key={i} className="text-right">{formatCurrency(summary.grossProfit)}</TableCell>
                      );
                    })
                  )}

                  <TableCell className="text-right text-muted-foreground">
                    {viewMode === 'monthly' ? (
                      formatCurrency(months.reduce((sum, _, monthIndex) => sum + calculateMonthSummary(selectedYearInt, monthIndex).grossProfit, 0))
                    ) : (
                      formatPercent(calculateCAGR(
                        calculateYearSummary(0).grossProfit,
                        calculateYearSummary(holdPeriod - 1).grossProfit,
                        holdPeriod - 1
                      ))
                    )}
                  </TableCell>
                </TableRow>

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
                        {formatCurrency(summary.noi)}
                      </TableCell>
                    );
                  })}

                  <TableCell className={`text-right bg-blue-100 dark:bg-blue-900/30 border-x border-blue-200 dark:border-blue-800 ${(baselineSummary?.noi || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(baselineSummary?.noi)}
                  </TableCell>

                  {viewMode === 'monthly' ? (
                    months.map((_, monthIndex) => {
                      const summary = calculateMonthSummary(selectedYearInt, monthIndex);
                      return (
                        <TableCell 
                          key={monthIndex} 
                          className={`text-right ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''} ${summary.noi >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {formatCurrency(summary.noi)}
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
                          {formatCurrency(summary.noi)}
                        </TableCell>
                      );
                    })
                  )}

                  <TableCell className="text-right text-green-600">
                    {viewMode === 'monthly' ? (
                      formatCurrency(months.reduce((sum, _, monthIndex) => sum + calculateMonthSummary(selectedYearInt, monthIndex).noi, 0))
                    ) : (
                      formatPercent(calculateCAGR(
                        calculateYearSummary(0).noi,
                        calculateYearSummary(holdPeriod - 1).noi,
                        holdPeriod - 1
                      ))
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
                        {formatPercentSimple(summary.noiMargin)}
                      </TableCell>
                    );
                  })}

                  <TableCell className="text-right text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">
                    {formatPercentSimple(baselineSummary?.noiMargin)}
                  </TableCell>

                  {viewMode === 'monthly' ? (
                    months.map((_, monthIndex) => {
                      const summary = calculateMonthSummary(selectedYearInt, monthIndex);
                      return (
                        <TableCell 
                          key={monthIndex} 
                          className={`text-right text-muted-foreground ${isSeasonalMonth(monthIndex) ? 'bg-green-50 dark:bg-green-950/30' : ''}`}
                        >
                          {formatPercentSimple(summary.noiMargin)}
                        </TableCell>
                      );
                    })
                  ) : (
                    years.map((_, i) => {
                      const summary = calculateYearSummary(i);
                      return (
                        <TableCell key={i} className="text-right text-muted-foreground">
                          {formatPercentSimple(summary.noiMargin)}
                        </TableCell>
                      );
                    })
                  )}

                  <TableCell className="text-right text-muted-foreground">-</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
  );
}