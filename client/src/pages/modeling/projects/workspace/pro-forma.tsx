import { useState, useMemo, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
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

export default function WorkspaceProForma({ projectId, onTabChange }: WorkspaceProFormaProps) {
  const [viewMode, setViewMode] = useState<'monthly' | 'annual'>('annual');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['revenue']));
  const [showHistorical, setShowHistorical] = useState(true);
  const { toast } = useToast();

  // Fetch project configuration
  const { data: config } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
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
        <Card>
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

        <Card>
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

        <Card>
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

        <Card>
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

      {/* Main Pro Forma Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Annual Pro Forma</CardTitle>
              <CardDescription>
                Projected P&L for {holdPeriod}-year hold period starting {new Date(startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
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
                  
                  {/* Historical Period Columns (excluding baseline) */}
                  {showHistorical && priorPeriods.map(period => (
                    <TableHead key={period.id} className="text-right w-28 bg-slate-50 dark:bg-slate-900/50">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-help">
                              <div className="text-xs text-muted-foreground">Historical</div>
                              <div>{period.shortLabel}</div>
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
                  
                  {/* Projected Year Columns */}
                  {years.map((year, i) => (
                    <TableHead key={year} className="text-right w-28">
                      <div>Year {i + 1}</div>
                      <div className="text-xs text-muted-foreground font-normal">{year}</div>
                    </TableHead>
                  ))}
                  
                  <TableHead className="text-right w-24">CAGR</TableHead>
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
                        className="bg-muted/50 cursor-pointer hover:bg-muted"
                        onClick={() => toggleCategory(category)}
                        data-testid={`row-category-${category.toLowerCase()}`}
                      >
                        <TableCell className="font-semibold sticky left-0 bg-muted/50 z-10">
                          <div className="flex items-center gap-2">
                            {expandedCategories.has(category) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {category}
                          </div>
                        </TableCell>
                        
                        {/* Historical totals */}
                        {showHistorical && priorPeriods.map(period => (
                          <TableCell key={period.id} className="text-right font-semibold bg-slate-50 dark:bg-slate-900/50">
                            {formatCurrency(getCategoryTotal(category, period.id))}
                          </TableCell>
                        ))}
                        
                        {/* Baseline total */}
                        <TableCell className="text-right font-semibold bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">
                          {formatCurrency(baselineTotal)}
                        </TableCell>
                        
                        {/* Projected totals */}
                        {years.map((_, i) => (
                          <TableCell key={i} className="text-right font-semibold">
                            {formatCurrency(getCategoryProjectedTotal(category, i))}
                          </TableCell>
                        ))}
                        
                        {/* CAGR */}
                        <TableCell className="text-right text-muted-foreground">
                          {formatPercent(calculateCAGR(
                            getCategoryProjectedTotal(category, 0),
                            getCategoryProjectedTotal(category, holdPeriod - 1),
                            holdPeriod - 1
                          ))}
                        </TableCell>
                      </TableRow>

                      {/* Line Item Rows */}
                      {expandedCategories.has(category) && Object.entries(items).map(([itemName, values]) => {
                        const baselineValue = baselinePeriod ? (values.historical[baselinePeriod.id] || 0) : 0;
                        return (
                          <TableRow key={itemName} className="text-sm">
                            <TableCell className="pl-10 sticky left-0 bg-background z-10">
                              {itemName}
                            </TableCell>
                            
                            {/* Historical values */}
                            {showHistorical && priorPeriods.map(period => (
                              <TableCell key={period.id} className="text-right bg-slate-50 dark:bg-slate-900/50">
                                {formatCurrency(values.historical[period.id])}
                              </TableCell>
                            ))}
                            
                            {/* Baseline value */}
                            <TableCell className="text-right bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">
                              {formatCurrency(baselineValue)}
                            </TableCell>
                            
                            {/* Projected values */}
                            {values.projected.map((value: number, i: number) => (
                              <TableCell key={i} className="text-right">
                                {formatCurrency(value)}
                              </TableCell>
                            ))}
                            
                            {/* Line item CAGR */}
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {formatPercent(calculateCAGR(
                                values.projected[0],
                                values.projected[holdPeriod - 1],
                                holdPeriod - 1
                              ))}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </Fragment>
                  );
                })}

                {/* Gross Profit Row */}
                <TableRow className="bg-muted font-bold border-t-2">
                  <TableCell className="sticky left-0 bg-muted z-10">Gross Profit</TableCell>
                  
                  {showHistorical && priorPeriods.map(period => {
                    const summary = calculatePeriodSummary(period.id);
                    return (
                      <TableCell key={period.id} className="text-right bg-slate-100 dark:bg-slate-800/50">
                        {formatCurrency(summary.grossProfit)}
                      </TableCell>
                    );
                  })}
                  
                  <TableCell className="text-right bg-blue-100 dark:bg-blue-900/30 border-x border-blue-200 dark:border-blue-800">
                    {formatCurrency(baselineSummary?.grossProfit)}
                  </TableCell>
                  
                  {years.map((_, i) => {
                    const summary = calculateYearSummary(i);
                    return (
                      <TableCell key={i} className="text-right">{formatCurrency(summary.grossProfit)}</TableCell>
                    );
                  })}
                  
                  <TableCell className="text-right text-muted-foreground">
                    {formatPercent(calculateCAGR(
                      calculateYearSummary(0).grossProfit,
                      calculateYearSummary(holdPeriod - 1).grossProfit,
                      holdPeriod - 1
                    ))}
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
                        className={`text-right ${summary.noi >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {formatCurrency(summary.noi)}
                      </TableCell>
                    );
                  })}
                  
                  <TableCell className={`text-right bg-blue-100 dark:bg-blue-900/30 border-x border-blue-200 dark:border-blue-800 ${(baselineSummary?.noi || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(baselineSummary?.noi)}
                  </TableCell>
                  
                  {years.map((_, i) => {
                    const summary = calculateYearSummary(i);
                    return (
                      <TableCell 
                        key={i} 
                        className={`text-right ${summary.noi >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {formatCurrency(summary.noi)}
                      </TableCell>
                    );
                  })}
                  
                  <TableCell className="text-right text-green-600">
                    {formatPercent(calculateCAGR(
                      calculateYearSummary(0).noi,
                      calculateYearSummary(holdPeriod - 1).noi,
                      holdPeriod - 1
                    ))}
                  </TableCell>
                </TableRow>

                {/* NOI Margin Row */}
                <TableRow className="border-t-2">
                  <TableCell className="sticky left-0 bg-background text-muted-foreground z-10">NOI Margin</TableCell>
                  
                  {showHistorical && priorPeriods.map(period => {
                    const summary = calculatePeriodSummary(period.id);
                    return (
                      <TableCell key={period.id} className="text-right text-muted-foreground bg-slate-50 dark:bg-slate-900/50">
                        {formatPercentSimple(summary.noiMargin)}
                      </TableCell>
                    );
                  })}
                  
                  <TableCell className="text-right text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border-x border-blue-200 dark:border-blue-800">
                    {formatPercentSimple(baselineSummary?.noiMargin)}
                  </TableCell>
                  
                  {years.map((_, i) => {
                    const summary = calculateYearSummary(i);
                    return (
                      <TableCell key={i} className="text-right text-muted-foreground">
                        {formatPercentSimple(summary.noiMargin)}
                      </TableCell>
                    );
                  })}
                  
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
