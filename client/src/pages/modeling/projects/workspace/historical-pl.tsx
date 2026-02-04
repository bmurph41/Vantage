import { useState, Fragment, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
  Database,
  Fuel,
  Store,
  Anchor,
  Link2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  BarChart3,
  Layers,
  Calendar,
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Activity,
  Target,
  Sparkles
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';

interface WorkspaceHistoricalPLProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

type PLLineItem = {
  id: string;
  category: string;
  subcategory: string;
  description: string;
  type: 'revenue' | 'expense' | 'cogs';
  monthlyData: Record<string, number>;
  annualTotal: number;
  dataSource?: string;
};

type DataSourceSummary = {
  dataSource: string;
  count: number;
  totalAmount: string;
};

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dataSourceIcons: Record<string, any> = {
  rent_roll: Anchor,
  fuel_sales: Fuel,
  ship_store: Store,
  quickbooks: Database,
  manual_entry: FileSpreadsheet,
  csv_import: FileSpreadsheet,
  doc_intel: FileSpreadsheet
};

const dataSourceLabels: Record<string, string> = {
  rent_roll: 'Rent Roll',
  fuel_sales: 'Fuel Sales',
  ship_store: 'Ship Store',
  quickbooks: 'QuickBooks',
  manual_entry: 'Manual Entry',
  csv_import: 'CSV Import',
  doc_intel: 'Document Intelligence'
};

export default function WorkspaceHistoricalPL({ projectId, onTabChange }: WorkspaceHistoricalPLProps) {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Revenue', 'COGS', 'Expenses']));
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [syncSources, setSyncSources] = useState({
    rent_roll: true,
    fuel_sales: true,
    ship_store: true
  });
  const [viewMode, setViewMode] = useState<'single' | 'all' | 'compare'>('single');
  const [compareYears, setCompareYears] = useState<string[]>([]);
  const [showMonthly, setShowMonthly] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showMoM, setShowMoM] = useState(false);
  const [showYoY, setShowYoY] = useState(false);

  const { data: availableYearsData } = useQuery<{ years: number[] }>({
    queryKey: [`/api/modeling/projects/${projectId}/actuals/years`],
  });

  const availableYears = useMemo(() => {
    const years = availableYearsData?.years || [];
    return years.map(String);
  }, [availableYearsData]);

  useEffect(() => {
    if (availableYears.length > 0 && !selectedYear) {
      const latestYear = availableYears[availableYears.length - 1];
      setSelectedYear(latestYear);
      if (availableYears.length >= 2) {
        const prevYear = availableYears[availableYears.length - 2];
        setCompareYears([prevYear, latestYear]);
      } else {
        setCompareYears([latestYear, latestYear]);
      }
    }
  }, [availableYears, selectedYear]);

  const { data: plData, isLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'historical-pl', selectedYear],
    enabled: !!selectedYear,
  });

  const { data: actualsData, isLoading: actualsLoading } = useQuery<any>({
    queryKey: [`/api/modeling/projects/${projectId}/actuals?year=${selectedYear}`],
    enabled: !!selectedYear,
  });

  const { data: multiYearData } = useQuery<{ byYear: Record<number, any[]>; years: number[] }>({
    queryKey: [`/api/modeling/projects/${projectId}/actuals/multi-year?years=${availableYears.join(',')}`],
    enabled: availableYears.length > 1,
  });

  const priorYearActuals = useMemo(() => {
    if (!multiYearData?.byYear || !selectedYear) return null;
    const priorYear = parseInt(selectedYear) - 1;
    return multiYearData.byYear[priorYear] || null;
  }, [multiYearData, selectedYear]);

  const { data: dataSources } = useQuery<DataSourceSummary[]>({
    queryKey: [`/api/modeling/projects/${projectId}/data-sources`],
  });

  const { data: syncHistory } = useQuery<any[]>({
    queryKey: [`/api/modeling/projects/${projectId}/sync-history`],
  });

  const { data: config } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
  });

  // Get valuator project context to determine if this is an owned marina or acquisition
  const { data: projectContext } = useQuery<{ projectType?: string; marinaId?: string }>({
    queryKey: [`/api/operations/projects/${projectId}/context`],
  });

  // Only show Sync Operations button for owned marinas, not acquisitions/broker listings
  const isOwnedMarina = projectContext?.projectType === 'OWNED';

  const syncMutation = useMutation({
    mutationFn: async (sources: string[]) => {
      return apiRequest(`/api/modeling/projects/${projectId}/sync-operations`, {
        method: 'POST',
        body: JSON.stringify({
          dataSources: sources,
          syncType: 'manual'
        })
      });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/modeling/projects/${projectId}/actuals?year=${selectedYear}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/modeling/projects/${projectId}/data-sources`] });
      queryClient.invalidateQueries({ queryKey: [`/api/modeling/projects/${projectId}/sync-history`] });
      setShowSyncDialog(false);
      toast({
        title: 'Data Synced Successfully',
        description: `Imported ${result.recordsImported} records from Operations modules.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Sync Failed',
        description: error.message || 'Failed to sync operations data',
        variant: 'destructive'
      });
    }
  });

  const seasonMonths = config?.seasonMonths || [4, 5, 6, 7, 8, 9, 10];

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
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const isSeasonalMonth = (monthIndex: number) => seasonMonths.includes(monthIndex + 1);

  const emptyData: PLLineItem[] = [];

  const hasActualsData = actualsData?.grouped && actualsData.grouped.length > 0;
  
  const lineItems = hasActualsData 
    ? actualsData.grouped.map((item: any, idx: number) => ({
        id: `actual-${idx}`,
        category: item.category,
        subcategory: item.subcategory,
        description: item.subcategory,
        type: item.category === 'Revenue' ? 'revenue' : item.category === 'COGS' ? 'cogs' : 'expense',
        monthlyData: item.monthlyData,
        annualTotal: item.annualTotal,
        dataSource: actualsData.raw?.[0]?.dataSource
      }))
    : (plData?.lineItems || emptyData);

  const groupedData = lineItems.reduce((acc: Record<string, PLLineItem[]>, item: PLLineItem) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, PLLineItem[]>);

  const getCategoryTotal = (category: string, month: string) => {
    return (groupedData[category] || []).reduce((sum: number, item: PLLineItem) => 
      sum + (item.monthlyData[month] || 0), 0
    );
  };

  const getCategoryAnnualTotal = (category: string) => {
    return (groupedData[category] || []).reduce((sum: number, item: PLLineItem) => 
      sum + item.annualTotal, 0
    );
  };

  const totalRevenue = getCategoryAnnualTotal('Revenue');
  const totalCOGS = getCategoryAnnualTotal('COGS');
  const totalExpenses = getCategoryAnnualTotal('Expenses');
  const grossProfit = totalRevenue - totalCOGS;
  const netIncome = grossProfit - totalExpenses;

  const priorYearTotals = useMemo(() => {
    if (!priorYearActuals) return null;
    const grouped = priorYearActuals.reduce((acc: Record<string, number>, item: any) => {
      if (!acc[item.category]) acc[item.category] = 0;
      acc[item.category] += item.annualTotal || 0;
      return acc;
    }, {});
    const revenue = grouped['Revenue'] || 0;
    const cogs = grouped['COGS'] || 0;
    const expenses = grouped['Expenses'] || 0;
    return {
      revenue,
      cogs,
      expenses,
      grossProfit: revenue - cogs,
      netIncome: revenue - cogs - expenses
    };
  }, [priorYearActuals]);

  const yoyChanges = useMemo(() => {
    if (!priorYearTotals || priorYearTotals.revenue === 0) return null;
    const calcChange = (current: number, prior: number) => 
      prior === 0 ? null : ((current - prior) / Math.abs(prior)) * 100;
    return {
      revenue: calcChange(totalRevenue, priorYearTotals.revenue),
      grossProfit: calcChange(grossProfit, priorYearTotals.grossProfit),
      expenses: calcChange(totalExpenses, priorYearTotals.expenses),
      netIncome: calcChange(netIncome, priorYearTotals.netIncome),
      grossMargin: totalRevenue > 0 && priorYearTotals.revenue > 0
        ? ((grossProfit / totalRevenue) * 100) - ((priorYearTotals.grossProfit / priorYearTotals.revenue) * 100)
        : null,
      operatingMargin: totalRevenue > 0 && priorYearTotals.revenue > 0
        ? ((netIncome / totalRevenue) * 100) - ((priorYearTotals.netIncome / priorYearTotals.revenue) * 100)
        : null
    };
  }, [totalRevenue, grossProfit, totalExpenses, netIncome, priorYearTotals]);

  const momChanges = useMemo(() => {
    const changes: Record<string, number | null> = {};
    for (let i = 1; i < months.length; i++) {
      const prevMonth = months[i - 1];
      const currMonth = months[i];
      const prevTotal = getCategoryTotal('Revenue', prevMonth);
      const currTotal = getCategoryTotal('Revenue', currMonth);
      changes[currMonth] = prevTotal === 0 ? null : ((currTotal - prevTotal) / Math.abs(prevTotal)) * 100;
    }
    return changes;
  }, [lineItems]);

  const seasonalAnalysis = useMemo(() => {
    const inSeasonRevenue = months.filter((_, idx) => seasonMonths.includes(idx + 1))
      .reduce((sum, month) => sum + getCategoryTotal('Revenue', month), 0);
    const offSeasonRevenue = months.filter((_, idx) => !seasonMonths.includes(idx + 1))
      .reduce((sum, month) => sum + getCategoryTotal('Revenue', month), 0);
    const total = inSeasonRevenue + offSeasonRevenue;
    return {
      inSeasonRevenue,
      offSeasonRevenue,
      inSeasonPct: total > 0 ? (inSeasonRevenue / total) * 100 : 0,
      offSeasonPct: total > 0 ? (offSeasonRevenue / total) * 100 : 0
    };
  }, [lineItems, seasonMonths]);

  const monthlyPerformance = useMemo(() => {
    const monthlyRevenue = months.map(month => ({
      month,
      revenue: getCategoryTotal('Revenue', month),
      expenses: getCategoryTotal('Expenses', month),
      noi: getCategoryTotal('Revenue', month) - getCategoryTotal('COGS', month) - getCategoryTotal('Expenses', month)
    }));
    const sortedByRevenue = [...monthlyRevenue].sort((a, b) => b.revenue - a.revenue);
    const sortedByNoi = [...monthlyRevenue].sort((a, b) => b.noi - a.noi);
    return {
      monthly: monthlyRevenue,
      bestRevenueMonth: sortedByRevenue[0]?.month || '-',
      worstRevenueMonth: sortedByRevenue[sortedByRevenue.length - 1]?.month || '-',
      bestNoiMonth: sortedByNoi[0]?.month || '-',
      worstNoiMonth: sortedByNoi[sortedByNoi.length - 1]?.month || '-',
      avgMonthlyRevenue: totalRevenue / 12,
      avgMonthlyNoi: netIncome / 12
    };
  }, [lineItems, totalRevenue, netIncome]);

  const handleSync = () => {
    const sources = Object.entries(syncSources)
      .filter(([_, enabled]) => enabled)
      .map(([source]) => source);
    
    if (sources.length === 0) {
      toast({
        title: 'Select Data Sources',
        description: 'Please select at least one data source to sync',
        variant: 'destructive'
      });
      return;
    }
    
    syncMutation.mutate(sources);
  };

  const lastSync = syncHistory?.[0];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {onTabChange && (
        <WorkflowNavigation currentTab="historical" onNavigate={onTabChange} />
      )}
      
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold">Historical P&L</h2>
          <p className="text-sm text-muted-foreground">
            Actual financial performance by month and category
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="h-9">
            <TabsList className="h-9">
              <TabsTrigger value="single" className="text-xs px-3">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                Single Year
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs px-3">
                <Layers className="h-3.5 w-3.5 mr-1.5" />
                All Years
              </TabsTrigger>
              <TabsTrigger value="compare" className="text-xs px-3">
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                Compare
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {viewMode === 'single' && (
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-24 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {viewMode === 'compare' && (
            <div className="flex items-center gap-2">
              <Select value={compareYears[0]} onValueChange={(v) => setCompareYears([v, compareYears[1]])}>
                <SelectTrigger className="w-20 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">vs</span>
              <Select value={compareYears[1]} onValueChange={(v) => setCompareYears([compareYears[0], v])}>
                <SelectTrigger className="w-20 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={showAnalytics ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowAnalytics(!showAnalytics)}
                  className="h-9"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  {showAnalytics ? "Hide Analytics" : "Analytics"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{showAnalytics ? "Click to return to P&L view" : "Show analytics and insights"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMonthly(!showMonthly)}
            className="h-9"
          >
            {showMonthly ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
            {showMonthly ? 'Monthly' : 'Annual'}
          </Button>
          
          {/* Sync button only shown for owned marinas, not for acquisitions/prospective deals */}
          {isOwnedMarina && (
            <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-9" data-testid="button-sync-operations">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Sync Operations Data</DialogTitle>
                  <DialogDescription>
                    Import actual financial data from your marina's operational systems into this modeling project.
                  </DialogDescription>
                </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Select Data Sources</Label>
                  
                  <div className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Checkbox 
                      id="rent_roll"
                      checked={syncSources.rent_roll}
                      onCheckedChange={(checked) => setSyncSources(prev => ({ ...prev, rent_roll: !!checked }))}
                    />
                    <Anchor className="h-5 w-5 text-blue-500" />
                    <div className="flex-1">
                      <Label htmlFor="rent_roll" className="font-medium cursor-pointer">Rent Roll</Label>
                      <p className="text-xs text-muted-foreground">Slip/rack revenue from marina units</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Checkbox 
                      id="fuel_sales"
                      checked={syncSources.fuel_sales}
                      onCheckedChange={(checked) => setSyncSources(prev => ({ ...prev, fuel_sales: !!checked }))}
                    />
                    <Fuel className="h-5 w-5 text-amber-500" />
                    <div className="flex-1">
                      <Label htmlFor="fuel_sales" className="font-medium cursor-pointer">Fuel Sales</Label>
                      <p className="text-xs text-muted-foreground">Revenue and COGS from fuel operations</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Checkbox 
                      id="ship_store"
                      checked={syncSources.ship_store}
                      onCheckedChange={(checked) => setSyncSources(prev => ({ ...prev, ship_store: !!checked }))}
                    />
                    <Store className="h-5 w-5 text-green-500" />
                    <div className="flex-1">
                      <Label htmlFor="ship_store" className="font-medium cursor-pointer">Ship Store</Label>
                      <p className="text-xs text-muted-foreground">Retail sales and inventory costs</p>
                    </div>
                  </div>
                </div>

                {lastSync && (
                  <div className="bg-muted/50 p-3 rounded-lg text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Last synced: {new Date(lastSync.completedAt || lastSync.createdAt).toLocaleDateString()} 
                      {' '}at {new Date(lastSync.completedAt || lastSync.createdAt).toLocaleTimeString()}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {lastSync.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                      )}
                      <span>{lastSync.recordsImported} records imported</span>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSyncDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSync} 
                  disabled={syncMutation.isPending}
                  data-testid="button-confirm-sync"
                >
                  {syncMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Now
                    </>
                  )}
                </Button>
              </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <Button variant="outline" size="sm" data-testid="button-export-pl">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {dataSources && dataSources.length > 0 && (
        <Card className="bg-blue-50/50 border-blue-200">
          <CardContent className="py-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Data Sources:</span>
              </div>
              {dataSources.map((source) => {
                const Icon = dataSourceIcons[source.dataSource] || Database;
                return (
                  <Badge key={source.dataSource} variant="secondary" className="gap-1">
                    <Icon className="h-3 w-3" />
                    {dataSourceLabels[source.dataSource] || source.dataSource}
                    <span className="text-xs text-muted-foreground ml-1">
                      ({formatCurrency(parseFloat(source.totalAmount))})
                    </span>
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!hasActualsData && lineItems.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h4 className="font-semibold mb-2">No P&L Data Yet</h4>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              {isOwnedMarina 
                ? "Upload financial documents via Doc Intel or sync operations data to populate your historical P&L statement."
                : "Upload financial documents via Doc Intel to populate your historical P&L statement for this prospective acquisition."}
            </p>
            <div className="flex justify-center gap-3">
              {isOwnedMarina && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowSyncDialog(true)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Operations Data
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onTabChange?.('uploads')}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Upload Documents
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-total-revenue">
              {formatCurrency(totalRevenue)}
            </div>
            {yoyChanges?.revenue !== null && yoyChanges?.revenue !== undefined && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${yoyChanges.revenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {yoyChanges.revenue >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {yoyChanges.revenue >= 0 ? '+' : ''}{yoyChanges.revenue.toFixed(1)}% YoY
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gross Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-gross-profit">
              {formatCurrency(grossProfit)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0}% margin
            </p>
            {yoyChanges?.grossProfit !== null && yoyChanges?.grossProfit !== undefined && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${yoyChanges.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {yoyChanges.grossProfit >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {yoyChanges.grossProfit >= 0 ? '+' : ''}{yoyChanges.grossProfit.toFixed(1)}% YoY
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-expenses">
              {formatCurrency(totalExpenses)}
            </div>
            {yoyChanges?.expenses !== null && yoyChanges?.expenses !== undefined && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${yoyChanges.expenses <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {yoyChanges.expenses <= 0 ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                {yoyChanges.expenses >= 0 ? '+' : ''}{yoyChanges.expenses.toFixed(1)}% YoY
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Operating Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-noi">
              {formatCurrency(netIncome)}
            </div>
            {yoyChanges?.netIncome !== null && yoyChanges?.netIncome !== undefined && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${yoyChanges.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {yoyChanges.netIncome >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {yoyChanges.netIncome >= 0 ? '+' : ''}{yoyChanges.netIncome.toFixed(1)}% YoY
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showAnalytics && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Historical Analytics & Insights
            </CardTitle>
            <CardDescription className="text-xs">
              Key performance metrics, margins, and year-over-year analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Gross Margin</span>
                  <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="text-xl font-bold">
                  {totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0}%
                </div>
                {yoyChanges?.grossMargin !== null && yoyChanges?.grossMargin !== undefined ? (
                  <div className={`flex items-center gap-1 text-xs ${yoyChanges.grossMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {yoyChanges.grossMargin >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {yoyChanges.grossMargin >= 0 ? '+' : ''}{yoyChanges.grossMargin.toFixed(1)}pp vs prior year
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No prior year data</div>
                )}
              </div>
              
              <div className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Operating Margin</span>
                  <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="text-xl font-bold">
                  {totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) : 0}%
                </div>
                {yoyChanges?.operatingMargin !== null && yoyChanges?.operatingMargin !== undefined ? (
                  <div className={`flex items-center gap-1 text-xs ${yoyChanges.operatingMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {yoyChanges.operatingMargin >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {yoyChanges.operatingMargin >= 0 ? '+' : ''}{yoyChanges.operatingMargin.toFixed(1)}pp vs prior year
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No prior year data</div>
                )}
              </div>
              
              <div className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Revenue Growth</span>
                  {yoyChanges?.revenue !== null && yoyChanges?.revenue !== undefined && yoyChanges.revenue >= 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                  )}
                </div>
                <div className={`text-xl font-bold ${yoyChanges?.revenue !== null && yoyChanges?.revenue !== undefined && yoyChanges.revenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {yoyChanges?.revenue !== null && yoyChanges?.revenue !== undefined 
                    ? `${yoyChanges.revenue >= 0 ? '+' : ''}${yoyChanges.revenue.toFixed(1)}%`
                    : 'N/A'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Year-over-year change
                </div>
              </div>
              
              <div className="p-3 rounded-lg border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Expense Ratio</span>
                  <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="text-xl font-bold">
                  {totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-xs text-muted-foreground">
                  of total revenue
                </div>
              </div>
            </div>
            
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="p-3 rounded-lg border">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Seasonal Performance
                </h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">In-Season Revenue</span>
                      <span className="font-medium">{formatCurrency(seasonalAnalysis.inSeasonRevenue)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${seasonalAnalysis.inSeasonPct}%` }} />
                    </div>
                    <div className="text-xs text-right text-muted-foreground mt-0.5">{seasonalAnalysis.inSeasonPct.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Off-Season Revenue</span>
                      <span className="font-medium">{formatCurrency(seasonalAnalysis.offSeasonRevenue)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-gray-400 h-2 rounded-full" style={{ width: `${seasonalAnalysis.offSeasonPct}%` }} />
                    </div>
                    <div className="text-xs text-right text-muted-foreground mt-0.5">{seasonalAnalysis.offSeasonPct.toFixed(1)}%</div>
                  </div>
                </div>
              </div>
              
              <div className="p-3 rounded-lg border">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Monthly Performance
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Best Revenue Month</span>
                    <span className="font-medium text-green-600">{monthlyPerformance.bestRevenueMonth}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lowest Revenue Month</span>
                    <span className="font-medium text-red-600">{monthlyPerformance.worstRevenueMonth}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Best NOI Month</span>
                    <span className="font-medium text-green-600">{monthlyPerformance.bestNoiMonth}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Monthly Revenue</span>
                    <span className="font-medium">{formatCurrency(monthlyPerformance.avgMonthlyRevenue)}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-3 rounded-lg border">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Key Insights
                </h4>
                <div className="space-y-2 text-xs">
                  {seasonalAnalysis.inSeasonPct > 70 && (
                    <div className="flex items-start gap-2 p-2 rounded bg-blue-50 text-blue-800">
                      <Info className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{seasonalAnalysis.inSeasonPct.toFixed(0)}% of revenue concentrated in-season months</span>
                    </div>
                  )}
                  {yoyChanges?.revenue !== null && yoyChanges?.revenue !== undefined && yoyChanges.revenue > 5 && (
                    <div className="flex items-start gap-2 p-2 rounded bg-green-50 text-green-800">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>Strong revenue growth of {yoyChanges.revenue.toFixed(1)}% YoY</span>
                    </div>
                  )}
                  {yoyChanges?.expenses !== null && yoyChanges?.expenses !== undefined && yoyChanges.expenses > 8 && (
                    <div className="flex items-start gap-2 p-2 rounded bg-amber-50 text-amber-800">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>Expenses grew {yoyChanges.expenses.toFixed(1)}% YoY - review cost controls</span>
                    </div>
                  )}
                  {(!yoyChanges || (yoyChanges.revenue === null && yoyChanges.expenses === null)) && (
                    <div className="flex items-start gap-2 p-2 rounded bg-gray-50 text-gray-700">
                      <Info className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>Upload prior year data for YoY analysis</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-4">
              <div className="p-3 rounded-lg border">
                <h4 className="text-sm font-medium mb-3">Revenue Mix by Category</h4>
                <div className="space-y-2">
                  {Object.entries(groupedData).filter(([cat]) => cat === 'Revenue').flatMap(([_, items]) => 
                    items.slice(0, 5).map((item: PLLineItem) => {
                      const pct = totalRevenue > 0 ? (item.annualTotal / totalRevenue) * 100 : 0;
                      return (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground truncate flex-1">{item.description}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-32 bg-muted rounded-full h-2">
                              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="w-16 text-right font-medium">{formatCurrency(item.annualTotal)}</span>
                            <span className="w-12 text-right text-muted-foreground">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Monthly Detail {selectedYear && `- ${selectedYear}`}</CardTitle>
              <CardDescription>
                Click category rows to expand/collapse line items
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showMoM ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowMoM(!showMoM)}
                      className="h-8 text-xs"
                    >
                      <TrendingUp className="h-3 w-3 mr-1" />
                      MoM
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Show month-over-month changes</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Badge variant="outline" className="gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                In-Season
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-300" />
                Off-Season
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-64 sticky left-0 bg-background">Category / Line Item</TableHead>
                  {months.map((month, idx) => (
                    <TableHead 
                      key={month} 
                      className={`text-right w-24 ${!isSeasonalMonth(idx) ? 'bg-muted/30' : ''}`}
                    >
                      {month}
                    </TableHead>
                  ))}
                  <TableHead className="text-right w-28 font-bold">Annual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {['Revenue', 'COGS', 'Expenses'].map((category) => (
                  <Fragment key={category}>
                    <TableRow 
                      className="bg-muted/50 cursor-pointer hover:bg-muted"
                      onClick={() => toggleCategory(category)}
                    >
                      <TableCell className="font-semibold sticky left-0 bg-muted/50">
                        <div className="flex items-center gap-2">
                          {expandedCategories.has(category) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          {category}
                        </div>
                      </TableCell>
                      {months.map((month, idx) => {
                        const value = getCategoryTotal(category, month);
                        const prevMonth = idx > 0 ? months[idx - 1] : null;
                        const prevValue = prevMonth ? getCategoryTotal(category, prevMonth) : null;
                        const momChange = prevValue && prevValue !== 0 ? ((value - prevValue) / Math.abs(prevValue)) * 100 : null;
                        return (
                          <TableCell 
                            key={month} 
                            className={`text-right font-semibold ${!isSeasonalMonth(idx) ? 'bg-muted/30' : ''}`}
                          >
                            <div className="flex flex-col items-end">
                              <span>{formatCurrency(value)}</span>
                              {showMoM && momChange !== null && idx > 0 && (
                                <span className={`text-xs ${momChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {momChange >= 0 ? '+' : ''}{momChange.toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-bold">
                        {formatCurrency(getCategoryAnnualTotal(category))}
                      </TableCell>
                    </TableRow>

                    {expandedCategories.has(category) && (groupedData[category] || []).map((item: PLLineItem) => {
                      const SourceIcon = item.dataSource ? dataSourceIcons[item.dataSource] : null;
                      return (
                        <TableRow key={item.id} className="text-sm">
                          <TableCell className="pl-10 sticky left-0 bg-background">
                            <div className="flex items-center gap-2">
                              {SourceIcon && (
                                <SourceIcon className="h-3 w-3 text-muted-foreground" />
                              )}
                              <div className="flex flex-col">
                                <span>{item.description}</span>
                                <span className="text-xs text-muted-foreground">{item.subcategory}</span>
                              </div>
                            </div>
                          </TableCell>
                          {months.map((month, idx) => (
                            <TableCell 
                              key={month} 
                              className={`text-right ${!isSeasonalMonth(idx) ? 'bg-muted/30 text-muted-foreground' : ''}`}
                            >
                              {formatCurrency(item.monthlyData[month])}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.annualTotal)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </Fragment>
                ))}

                <TableRow className="bg-muted font-bold border-t-2">
                  <TableCell className="sticky left-0 bg-muted">Gross Profit</TableCell>
                  {months.map((month, idx) => {
                    const revenue = getCategoryTotal('Revenue', month);
                    const cogs = getCategoryTotal('COGS', month);
                    return (
                      <TableCell 
                        key={month} 
                        className={`text-right ${!isSeasonalMonth(idx) ? 'bg-muted/70' : ''}`}
                      >
                        {formatCurrency(revenue - cogs)}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right">{formatCurrency(grossProfit)}</TableCell>
                </TableRow>

                <TableRow className="bg-primary/10 font-bold">
                  <TableCell className="sticky left-0 bg-primary/10">Net Operating Income</TableCell>
                  {months.map((month, idx) => {
                    const revenue = getCategoryTotal('Revenue', month);
                    const cogs = getCategoryTotal('COGS', month);
                    const expenses = getCategoryTotal('Expenses', month);
                    const noi = revenue - cogs - expenses;
                    return (
                      <TableCell 
                        key={month} 
                        className={`text-right ${noi >= 0 ? 'text-green-600' : 'text-red-600'} ${!isSeasonalMonth(idx) ? 'opacity-60' : ''}`}
                      >
                        {formatCurrency(noi)}
                      </TableCell>
                    );
                  })}
                  <TableCell className={`text-right ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(netIncome)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
