import { useState, Fragment, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { inferDepartmentClient } from '@/lib/department-inference';
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
  BarChart3,
  Layers,
  Calendar,
  ArrowUpCircle,
  Eye,
  EyeOff,
  Flag
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';
import { useModelingAddbacks } from '@/hooks/useModelingAddbacks';
import { AddbackEditor } from '@/components/modeling/AddbackEditor';
import { AddbacksTrackerPanel } from '@/components/modeling/AddbacksTracker';
import { useDepartmentOrder } from '@/hooks/useDepartmentOrder';
import { useDisplayOverrides } from '@/hooks/useDisplayOverrides';
import { DepartmentOrderSettings } from '@/components/modeling/DepartmentOrderSettings';
import { InlineEditableName } from '@/components/modeling/InlineEditableName';
import type { ProjectConfig, HistoricalPLData, ActualsData } from '@/types/modeling';
import { ExportPdfButton } from '@/components/ui/export-pdf-button';

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
  department?: string;
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
  const pdfRef = useRef<HTMLDivElement>(null);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Revenue', 'COGS', 'Expenses']));
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [syncSources, setSyncSources] = useState({
    rent_roll: true,
    fuel_sales: true,
    ship_store: true
  });
  const [viewMode, setViewMode] = useState<'single' | 'all' | 'compare'>('single');
  const [compareYears, setCompareYears] = useState<string[]>([]);
  const [displayMode, setDisplayMode] = useState<'monthly' | 'annual'>('monthly');
  const [showMoM, setShowMoM] = useState(false);
  const [showNormalized, setShowNormalized] = useState(false);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const { revenueCogsOrder, expensesOrder, updateRevenueCogsOrder, updateExpensesOrder, resetRevenueCogsOrder, resetExpensesOrder, sortDepartments } = useDepartmentOrder();

  const { 
    addbacks: allAddbacks,
    isLineItemAddedBack,
    isCategoryAddedBack, 
    isMonthCellAddedBack,
    toggleLineItemAddback,
    toggleCategoryAddback,
    toggleMonthCellAddback,
    getAnyAddback,
    getAddbackForLineItem,
    getAddbackForCategory,
    getAddbackForMonthCell,
    activeAddbacks,
    createOrUpdate: createOrUpdateAddback,
    toggleAddback,
    deleteAddback,
    isPending: addbackPending,
    getAddbacksSummary,
  } = useModelingAddbacks(projectId);

  const {
    getDisplayName,
    getOverride,
    hasOverride,
    getOrgDefaultSuggestion,
    saveOverride,
    deleteOverride,
    isPending: overridePending,
  } = useDisplayOverrides(projectId);

  const { data: availableYearsData } = useQuery<{ years: number[] }>({
    queryKey: [`/api/modeling/projects/${projectId}/actuals/years`],
  });

  const availableYears = useMemo(() => {
    const years = availableYearsData?.years || [];
    return years.map(String);
  }, [availableYearsData]);

  const yearRange = useMemo(() => {
    if (availableYears.length === 0) return [];
    const numericYears = availableYears.map(Number);
    const minYear = Math.min(...numericYears);
    const maxYear = Math.max(...numericYears);
    const range: number[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      range.push(y);
    }
    return range;
  }, [availableYears]);

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

  const { data: plData, isLoading } = useQuery<HistoricalPLData>({
    queryKey: ['/api/modeling/projects', projectId, 'historical-pl', selectedYear],
    enabled: !!selectedYear,
  });

  const { data: actualsData, isLoading: actualsLoading } = useQuery<ActualsData>({
    queryKey: [`/api/modeling/projects/${projectId}/actuals?year=${selectedYear}`],
    enabled: !!selectedYear,
  });

  const { data: allYearsActualsData } = useQuery<ActualsData>({
    queryKey: [`/api/modeling/projects/${projectId}/actuals/multi-year?years=${yearRange.join(',')}`],
    enabled: displayMode === 'annual' && yearRange.length > 0,
  });

  const { data: dataSources } = useQuery<DataSourceSummary[]>({
    queryKey: [`/api/modeling/projects/${projectId}/data-sources`],
  });

  const { data: syncHistory } = useQuery<any[]>({
    queryKey: [`/api/modeling/projects/${projectId}/sync-history`],
  });

  const { data: config } = useQuery<ProjectConfig>({
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
      queryClient.invalidateQueries({ queryKey: [`/api/modeling/projects/${projectId}/actuals/multi-year?years=${yearRange.join(',')}`] });
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

  const promoteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/pnl/promote-to-actuals', { modelingProjectId: projectId });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/modeling/projects/${projectId}/actuals`] });
      queryClient.invalidateQueries({ queryKey: [`/api/modeling/projects/${projectId}/actuals/years`] });
      queryClient.invalidateQueries({ queryKey: [`/api/modeling/projects/${projectId}/actuals/multi-year?years=${yearRange.join(',')}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/modeling/projects/${projectId}/data-sources`] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'historical-pl'] });
      setShowPromoteDialog(false);
      toast({
        title: 'P&L Data Imported',
        description: `Promoted ${result.promoted} line items from uploaded P&L documents${result.years?.length ? ` (${result.years.join(', ')})` : ''}.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import P&L document data',
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

  const toggleDepartment = (key: string) => {
    setExpandedDepartments(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
        dataSource: actualsData.raw?.[0]?.dataSource,
        department: item.department || 'General'
      }))
    : (plData?.lineItems || emptyData);

  const groupedData = lineItems.reduce((acc: Record<string, Record<string, PLLineItem[]>>, item: PLLineItem) => {
    const dept = item.department || 'General';
    if (!acc[item.category]) {
      acc[item.category] = {};
    }
    if (!acc[item.category][dept]) {
      acc[item.category][dept] = [];
    }
    acc[item.category][dept].push(item);
    return acc;
  }, {} as Record<string, Record<string, PLLineItem[]>>);

  const getCategoryItems = (category: string): PLLineItem[] =>
    Object.values(groupedData[category] || {}).flat();


  const getCategoryTotal = (category: string, month: string) => {
    return getCategoryItems(category).reduce((sum: number, item: PLLineItem) => 
      sum + (item.monthlyData[month] || 0), 0
    );
  };

  const getCategoryAnnualTotal = (category: string) => {
    return getCategoryItems(category).reduce((sum: number, item: PLLineItem) => 
      sum + item.annualTotal, 0
    );
  };

  const getAdjustedMonthlyValue = (item: PLLineItem, month: string, monthIdx: number) => {
    const rawValue = item.monthlyData[month] || 0;
    const yearNum = parseInt(selectedYear);
    const monthNum = monthIdx + 1;
    if (isCategoryAddedBack(item.category)) {
      return showNormalized ? 0 : rawValue;
    }
    if (isLineItemAddedBack(item.subcategory)) {
      const lineAddback = getAddbackForLineItem(item.subcategory);
      if (lineAddback && lineAddback.values.length > 0) {
        const yearValue = lineAddback.values.find(v => v.year === yearNum && v.month == null);
        if (yearValue) {
          const customAmount = parseFloat(yearValue.amount) || 0;
          return customAmount / 12;
        }
      }
      return showNormalized ? 0 : rawValue;
    }
    if (isMonthCellAddedBack(item.subcategory, yearNum, monthNum)) {
      const cellAddback = getAddbackForMonthCell(item.subcategory, yearNum, monthNum);
      if (cellAddback && cellAddback.values.length > 0) {
        return parseFloat(cellAddback.values[0].amount) || 0;
      }
      return showNormalized ? 0 : rawValue;
    }
    return rawValue;
  };

  const getAdjustedCategoryTotal = (category: string, month: string, monthIdx: number) => {
    if (isCategoryAddedBack(category) && showNormalized) return 0;
    return getCategoryItems(category).reduce((sum: number, item: PLLineItem) => {
      return sum + getAdjustedMonthlyValue(item, month, monthIdx);
    }, 0);
  };

  const getAdjustedCategoryAnnualTotal = (category: string) => {
    if (isCategoryAddedBack(category) && showNormalized) return 0;
    return getCategoryItems(category).reduce((sum: number, item: PLLineItem) => {
      let itemTotal = 0;
      months.forEach((month, idx) => {
        itemTotal += getAdjustedMonthlyValue(item, month, idx);
      });
      return sum + itemTotal;
    }, 0);
  };

  const totalRevenue = getCategoryAnnualTotal('Revenue');
  const totalCOGS = getCategoryAnnualTotal('COGS');
  const totalExpenses = getCategoryAnnualTotal('Expenses');
  const grossProfit = totalRevenue - totalCOGS;
  const netIncome = grossProfit - totalExpenses;

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

  const annualDataByYear = useMemo(() => {
    if (!allYearsActualsData?.byYear) return {};
    const dataByYear: Record<number, Record<string, Record<string, number>>> = {};
    for (const year of yearRange) {
      dataByYear[year] = { Revenue: {}, COGS: {}, Expenses: {} };
    }
    for (const [yearStr, items] of Object.entries(allYearsActualsData.byYear)) {
      const year = Number(yearStr);
      if (!dataByYear[year]) continue;
      for (const item of (items as any[])) {
        const cat = item.category || 'Expenses';
        const subcat = item.subcategory || 'Other';
        if (!dataByYear[year][cat]) dataByYear[year][cat] = {};
        dataByYear[year][cat][subcat] = (dataByYear[year][cat][subcat] || 0) + (item.annualTotal || 0);
      }
    }
    return dataByYear;
  }, [allYearsActualsData, yearRange]);

  const annualSubcatDeptMap = useMemo(() => {
    if (!allYearsActualsData?.byYear) return {};
    const map: Record<string, string> = {};
    for (const items of Object.values(allYearsActualsData.byYear)) {
      for (const item of (items as any[])) {
        if (item.subcategory && item.department) {
          map[item.subcategory] = item.department;
        }
      }
    }
    return map;
  }, [allYearsActualsData]);

  const getAnnualCategoryTotal = (category: string, year: number) => {
    const catData = annualDataByYear[year]?.[category];
    if (!catData) return 0;
    return Object.values(catData).reduce((sum, val) => sum + val, 0);
  };

  const getAnnualSubcategoryAmount = (category: string, subcategory: string, year: number) => {
    return annualDataByYear[year]?.[category]?.[subcategory] || 0;
  };

  const annualSubcategories = useMemo(() => {
    const subcats: Record<string, Set<string>> = { Revenue: new Set(), COGS: new Set(), Expenses: new Set() };
    for (const year of yearRange) {
      for (const cat of ['Revenue', 'COGS', 'Expenses']) {
        const catData = annualDataByYear[year]?.[cat];
        if (catData) {
          Object.keys(catData).forEach(sub => subcats[cat].add(sub));
        }
      }
    }
    return {
      Revenue: Array.from(subcats.Revenue),
      COGS: Array.from(subcats.COGS),
      Expenses: Array.from(subcats.Expenses)
    };
  }, [annualDataByYear, yearRange]);

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
    <div className="space-y-6" ref={pdfRef}>
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
          
          <Tabs value={displayMode} onValueChange={(v) => setDisplayMode(v as 'monthly' | 'annual')} className="h-9">
            <TabsList className="h-9">
              <TabsTrigger value="monthly" className="text-xs px-3">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                Monthly
              </TabsTrigger>
              <TabsTrigger value="annual" className="text-xs px-3">
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                Annual
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <DepartmentOrderSettings
            revenueCogsOrder={revenueCogsOrder}
            expensesOrder={expensesOrder}
            onUpdateRevenueCogsOrder={updateRevenueCogsOrder}
            onUpdateExpensesOrder={updateExpensesOrder}
            onResetRevenueCogsOrder={resetRevenueCogsOrder}
            onResetExpensesOrder={resetExpensesOrder}
          />
          
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

          <Dialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-9" data-testid="button-import-pnl">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Import P&L Docs
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import P&L Document Data</DialogTitle>
                <DialogDescription>
                  Promote extracted line items from uploaded P&L documents into this project's historicals. 
                  Each line item will be mapped to the marina chart of accounts with department-level classification.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                  <p className="font-medium">What this does:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                    <li>Reads parsed P&L facts from uploaded documents</li>
                    <li>Maps each line to Storage, Fuel, Service, Ship Store, etc.</li>
                    <li>Creates historical actuals that feed the Pro Forma engine</li>
                    <li>Existing manual entries are preserved (upsert by line item)</li>
                  </ul>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPromoteDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => promoteMutation.mutate()}
                  disabled={promoteMutation.isPending}
                  data-testid="button-confirm-promote"
                >
                  {promoteMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Import Now
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" data-testid="button-export-pl">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <ExportPdfButton contentRef={pdfRef} filename="historical-pl" title="Historical P&L" />
        </div>
      </div>

      {dataSources && dataSources.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
            <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
            <Link2 className="h-3 w-3" />
            <span>Data Sources ({dataSources.length})</span>
          </summary>
          <div className="flex items-center gap-2 flex-wrap mt-1.5 ml-5">
            {dataSources.map((source) => {
              const Icon = dataSourceIcons[source.dataSource] || Database;
              return (
                <Badge key={source.dataSource} variant="secondary" className="gap-1 text-xs py-0.5">
                  <Icon className="h-3 w-3" />
                  {dataSourceLabels[source.dataSource] || source.dataSource}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({formatCurrency(parseFloat(source.totalAmount), { dash: true })})
                  </span>
                </Badge>
              );
            })}
          </div>
        </details>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>
                {displayMode === 'monthly' ? `Monthly Detail - ${selectedYear || ''}` : 'Annual Comparison'}
              </CardTitle>
              <CardDescription>
                Click category rows to expand/collapse line items
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {displayMode === 'monthly' && (
                <>
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={showNormalized ? "default" : "outline"}
                          size="sm"
                          onClick={() => setShowNormalized(!showNormalized)}
                          className="h-8 text-xs"
                        >
                          {showNormalized ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                          Normalized
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Toggle between raw and normalized (addback-adjusted) view</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {allAddbacks.length > 0 && (
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                          <ArrowUpCircle className="h-3 w-3 text-amber-600" />
                          {activeAddbacks.length} Addback{activeAddbacks.length !== 1 ? 's' : ''}
                        </Button>
                      </SheetTrigger>
                      <SheetContent className="w-[380px] sm:w-[420px]">
                        <SheetHeader>
                          <SheetTitle className="flex items-center gap-2">
                            <ArrowUpCircle className="h-5 w-5 text-amber-600" />
                            Addbacks Manager
                          </SheetTitle>
                        </SheetHeader>
                        <div className="mt-4">
                          <AddbacksTrackerPanel
                            addbacks={allAddbacks}
                            onToggle={(id, isActive) => toggleAddback({ addbackId: id, isActive })}
                            onDelete={(id) => deleteAddback(id)}
                            isPending={addbackPending}
                          />
                        </div>
                      </SheetContent>
                    </Sheet>
                  )}
                  <Badge variant="outline" className="gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    In-Season
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                    Off-Season
                  </Badge>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto relative isolate">
            {displayMode === 'monthly' ? (
              <Table className="w-full table-fixed">
                <colgroup>
                  <col style={{ width: '15%', minWidth: '140px' }} />
                  {months.map((_, idx) => (
                    <col key={idx} style={{ width: `${65 / 12}%` }} />
                  ))}
                  <col style={{ width: '7%', minWidth: '70px' }} />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-20 bg-white dark:bg-background border-r min-w-[140px] max-w-[200px] py-2"></TableHead>
                    {months.map((month, idx) => (
                      <TableHead 
                        key={month} 
                        className={`text-center px-1 py-2 text-sm font-bold ${!isSeasonalMonth(idx) ? 'bg-muted/30' : ''}`}
                      >
                        {month}
                      </TableHead>
                    ))}
                    <TableHead className="text-center px-1 py-2 text-sm font-bold">Annual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {['Revenue', 'COGS', 'Expenses'].map((category) => (
                    <Fragment key={category}>
                      <TableRow 
                        className="bg-muted/50 cursor-pointer hover:bg-muted group"
                        onClick={() => toggleCategory(category)}
                      >
                        <TableCell className="font-semibold whitespace-nowrap sticky left-0 z-10 bg-muted border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] w-[15%] min-w-[140px] max-w-[200px] overflow-hidden text-ellipsis px-3 py-1.5 text-sm">
                          <div className="flex items-center gap-1.5">
                            {expandedCategories.has(category) ? (
                              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                            )}
                            {category}
                            {isCategoryAddedBack(category) && (
                              <Badge variant="outline" className="ml-2 text-xs bg-amber-50 text-amber-700 border-amber-300">
                                <ArrowUpCircle className="h-3 w-3 mr-1" />
                                Added Back
                              </Badge>
                            )}
                            <AddbackEditor
                              scope="category"
                              lineItemKey={category}
                              lineItemLabel={`${category} (Entire Category)`}
                              category={category}
                              year={selectedYear ? parseInt(selectedYear) : undefined}
                              existingAddback={getAnyAddback(category, 'category')}
                              isActive={isCategoryAddedBack(category)}
                              onSave={(data) => createOrUpdateAddback(data)}
                              onToggle={() => toggleCategoryAddback(category)}
                              onDelete={(id) => deleteAddback(id)}
                              isPending={addbackPending}
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`h-6 w-6 p-0 ml-auto ${isCategoryAddedBack(category) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                >
                                  {isCategoryAddedBack(category) ? (
                                    <ArrowUpCircle className="h-3.5 w-3.5 text-amber-600" />
                                  ) : (
                                    <ArrowUpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </Button>
                              }
                            />
                          </div>
                        </TableCell>
                        {months.map((month, idx) => {
                          const value = getAdjustedCategoryTotal(category, month, idx);
                          const prevMonth = idx > 0 ? months[idx - 1] : null;
                          const prevValue = prevMonth ? getCategoryTotal(category, prevMonth) : null;
                          const momChange = prevValue && prevValue !== 0 ? ((value - prevValue) / Math.abs(prevValue)) * 100 : null;
                          return (
                            <TableCell 
                              key={month} 
                              className={`text-right font-semibold whitespace-nowrap px-2 py-1.5 text-xs ${!isSeasonalMonth(idx) ? 'bg-muted/30' : 'bg-background'}`}
                            >
                              <div className="flex flex-col items-end">
                                <span className="text-xs">{formatCurrency(value, { dash: true })}</span>
                                {showMoM && momChange !== null && idx > 0 && (
                                  <span className={`text-xs ${momChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {momChange >= 0 ? '+' : ''}{momChange.toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-right font-bold bg-background whitespace-nowrap px-2 py-1.5 text-xs">
                          {formatCurrency(getAdjustedCategoryAnnualTotal(category), { dash: true })}
                        </TableCell>
                      </TableRow>

                      {expandedCategories.has(category) && (() => {
                        const entries = Object.entries(groupedData[category] || {});
                        const sortedDepts = sortDepartments(entries.map(([d]) => d), category);
                        return sortedDepts.map(department => {
                          const deptItems = (groupedData[category] || {})[department] || [];
                          return (
                          <Fragment key={`${category}-${department}`}>
                            <TableRow 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleDepartment(`${category}-${department}`)}
                            >
                              <TableCell className="pl-5 font-medium whitespace-nowrap sticky left-0 z-10 bg-slate-50 dark:bg-slate-900 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] w-[15%] min-w-[140px] max-w-[200px] px-3 py-1">
                                <div className="flex items-center gap-1">
                                  {expandedDepartments.has(`${category}-${department}`) ? (
                                    <ChevronDown className="h-3 w-3 shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3 shrink-0" />
                                  )}
                                  <InlineEditableName
                                    originalName={department}
                                    displayName={getDisplayName(department, 'department')}
                                    isOverridden={hasOverride(department, 'department')}
                                    suggestion={getOrgDefaultSuggestion(department, 'department')}
                                    isPending={overridePending}
                                    className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                                    onSave={async (newName) => {
                                      await saveOverride({ scope: 'department', originalName: department, displayName: newName, category });
                                    }}
                                    onRevert={hasOverride(department, 'department') ? async () => {
                                      const override = getOverride(department, 'department');
                                      if (override) await deleteOverride(override.id);
                                    } : undefined}
                                  />
                                </div>
                              </TableCell>
                              {months.map((month, idx) => {
                                const deptTotal = deptItems.reduce((sum: number, item: PLLineItem) => sum + getAdjustedMonthlyValue(item, month, idx), 0);
                                return (
                                  <TableCell key={month} className={`text-right whitespace-nowrap px-2 py-1 text-xs font-medium text-muted-foreground ${!isSeasonalMonth(idx) ? 'bg-slate-50 dark:bg-slate-900' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                    {formatCurrency(deptTotal, { dash: true })}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-right whitespace-nowrap px-2 py-1 text-xs font-medium text-muted-foreground bg-slate-100 dark:bg-slate-800">
                                {formatCurrency(deptItems.reduce((sum: number, item: PLLineItem) => {
                                  return months.reduce((itemSum, month, idx) => itemSum + getAdjustedMonthlyValue(item, month, idx), 0);
                                }, 0), { dash: true })}
                              </TableCell>
                            </TableRow>

                            {expandedDepartments.has(`${category}-${department}`) && deptItems.map((item: PLLineItem) => {
                              const SourceIcon = item.dataSource ? dataSourceIcons[item.dataSource] : null;
                              return (
                                <TableRow key={item.id} className={`group ${(isLineItemAddedBack(item.subcategory) || isCategoryAddedBack(category)) && showNormalized ? 'opacity-50 line-through' : ''}`}>
                                  <TableCell className="pl-9 whitespace-nowrap sticky left-0 z-10 bg-background border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] w-[15%] min-w-[140px] max-w-[200px] overflow-hidden text-ellipsis px-3 py-1 text-xs">
                                    <div className="flex items-center gap-2">
                                      {SourceIcon && (
                                        <SourceIcon className="h-3 w-3 text-muted-foreground" />
                                      )}
                                      <div className="flex flex-col">
                                        <InlineEditableName
                                          originalName={item.subcategory}
                                          displayName={getDisplayName(item.subcategory, 'line_item', category, department)}
                                          isOverridden={hasOverride(item.subcategory, 'line_item', category, department)}
                                          suggestion={getOrgDefaultSuggestion(item.subcategory, 'line_item')}
                                          isPending={overridePending}
                                          onSave={async (newName) => {
                                            await saveOverride({ scope: 'line_item', originalName: item.subcategory, displayName: newName, category, department });
                                          }}
                                          onRevert={hasOverride(item.subcategory, 'line_item', category, department) ? async () => {
                                            const override = getOverride(item.subcategory, 'line_item', category, department);
                                            if (override) await deleteOverride(override.id);
                                          } : undefined}
                                        />
                                        {hasOverride(item.subcategory, 'line_item', category, department) && (
                                          <span className="text-[10px] text-muted-foreground/60">{item.subcategory}</span>
                                        )}
                                      </div>
                                      {isLineItemAddedBack(item.subcategory) && (
                                        <Badge variant="outline" className="ml-1 text-[10px] h-5 bg-amber-50 text-amber-700 border-amber-300">
                                          <ArrowUpCircle className="h-2.5 w-2.5 mr-0.5" />
                                          Addback
                                        </Badge>
                                      )}
                                      <AddbackEditor
                                        scope="line_item"
                                        lineItemKey={item.subcategory}
                                        lineItemLabel={item.description}
                                        category={category}
                                        department={department}
                                        year={selectedYear ? parseInt(selectedYear) : undefined}
                                        currentValue={item.annualTotal}
                                        existingAddback={getAnyAddback(item.subcategory, 'line_item')}
                                        isActive={isLineItemAddedBack(item.subcategory)}
                                        onSave={(data) => createOrUpdateAddback(data)}
                                        onToggle={() => toggleLineItemAddback(item.subcategory, item.description, category, undefined, department)}
                                        onDelete={(id) => deleteAddback(id)}
                                        isPending={addbackPending}
                                        trigger={
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className={`h-5 w-5 p-0 ml-auto shrink-0 ${isLineItemAddedBack(item.subcategory) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                                          >
                                            {isLineItemAddedBack(item.subcategory) ? (
                                              <ArrowUpCircle className="h-3 w-3 text-amber-600" />
                                            ) : (
                                              <ArrowUpCircle className="h-3 w-3 text-muted-foreground" />
                                            )}
                                          </Button>
                                        }
                                      />
                                    </div>
                                  </TableCell>
                                  {months.map((month, idx) => {
                                    const rawValue = item.monthlyData[month] || 0;
                                    const displayValue = getAdjustedMonthlyValue(item, month, idx);
                                    const isCellAddedBack = isMonthCellAddedBack(item.subcategory, parseInt(selectedYear), idx + 1);
                                    const yearNum = parseInt(selectedYear);
                                    const monthNum = idx + 1;
                                    return (
                                      <TableCell 
                                        key={month} 
                                        className={`text-right relative group/cell whitespace-nowrap px-2 py-1 ${!isSeasonalMonth(idx) ? 'bg-muted/30 text-muted-foreground' : ''} ${isCellAddedBack ? 'bg-amber-50/70 dark:bg-amber-950/20' : ''}`}
                                      >
                                        <div className="flex items-center justify-end gap-0.5">
                                          <span className={`text-xs ${isCellAddedBack && displayValue !== rawValue ? 'text-amber-700 dark:text-amber-400 font-medium' : ''}`}>
                                            {formatCurrency(displayValue, { dash: true })}
                                          </span>
                                          {isCellAddedBack && (
                                            <Flag className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                                          )}
                                          {!isCellAddedBack && (
                                            <AddbackEditor
                                              scope="month_cell"
                                              lineItemKey={item.subcategory}
                                              lineItemLabel={item.description}
                                              category={category}
                                              department={department}
                                              year={yearNum}
                                              month={monthNum}
                                              currentValue={rawValue}
                                              existingAddback={getAnyAddback(item.subcategory, 'month_cell', yearNum, monthNum)}
                                              isActive={false}
                                              onSave={(data) => createOrUpdateAddback(data)}
                                              onToggle={() => toggleMonthCellAddback(item.subcategory, item.description, category, yearNum, monthNum, undefined, department)}
                                              onDelete={(id) => deleteAddback(id)}
                                              isPending={addbackPending}
                                              trigger={
                                                <button className="h-3.5 w-3.5 p-0 opacity-0 group-hover/cell:opacity-60 hover:!opacity-100 shrink-0 transition-opacity">
                                                  <ArrowUpCircle className="h-3 w-3 text-muted-foreground" />
                                                </button>
                                              }
                                            />
                                          )}
                                          {isCellAddedBack && (
                                            <AddbackEditor
                                              scope="month_cell"
                                              lineItemKey={item.subcategory}
                                              lineItemLabel={item.description}
                                              category={category}
                                              department={department}
                                              year={yearNum}
                                              month={monthNum}
                                              currentValue={rawValue}
                                              existingAddback={getAnyAddback(item.subcategory, 'month_cell', yearNum, monthNum)}
                                              isActive={true}
                                              onSave={(data) => createOrUpdateAddback(data)}
                                              onToggle={() => toggleMonthCellAddback(item.subcategory, item.description, category, yearNum, monthNum, undefined, department)}
                                              onDelete={(id) => deleteAddback(id)}
                                              isPending={addbackPending}
                                              trigger={
                                                <button className="h-3.5 w-3.5 p-0 shrink-0">
                                                  <ArrowUpCircle className="h-3 w-3 text-amber-600" />
                                                </button>
                                              }
                                            />
                                          )}
                                        </div>
                                      </TableCell>
                                    );
                                  })}
                                  <TableCell className="text-right font-medium whitespace-nowrap px-2 py-1 text-xs">
                                    {formatCurrency(months.reduce((sum, month, idx) => sum + getAdjustedMonthlyValue(item, month, idx), 0), { dash: true })}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </Fragment>
                        );
                        });
                      })()}
                    </Fragment>
                  ))}

                  <TableRow className="bg-muted font-bold border-t-2">
                    <TableCell className="whitespace-nowrap sticky left-0 z-10 bg-muted border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] w-[15%] min-w-[140px] max-w-[200px] px-3 py-1.5 text-sm">Gross Profit</TableCell>
                    {months.map((month, idx) => {
                      const revenue = getAdjustedCategoryTotal('Revenue', month, idx);
                      const cogs = getAdjustedCategoryTotal('COGS', month, idx);
                      return (
                        <TableCell 
                          key={month} 
                          className={`text-right whitespace-nowrap px-2 py-1.5 text-xs ${!isSeasonalMonth(idx) ? 'bg-muted/70' : 'bg-muted'}`}
                        >
                          {formatCurrency(revenue - cogs, { dash: true })}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right whitespace-nowrap px-2 py-1.5 text-xs bg-muted">{formatCurrency(getAdjustedCategoryAnnualTotal('Revenue') - getAdjustedCategoryAnnualTotal('COGS'), { dash: true })}</TableCell>
                  </TableRow>

                  <TableRow className="bg-muted/30">
                    <TableCell className="whitespace-nowrap sticky left-0 z-10 bg-background border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] text-xs text-muted-foreground w-[15%] min-w-[140px] max-w-[200px] px-3 py-1">Gross Profit Margin</TableCell>
                    {months.map((month, idx) => {
                      const revenue = getAdjustedCategoryTotal('Revenue', month, idx);
                      const cogs = getAdjustedCategoryTotal('COGS', month, idx);
                      const gp = revenue - cogs;
                      const margin = revenue !== 0 ? (gp / revenue) * 100 : null;
                      return (
                        <TableCell 
                          key={month} 
                          className={`text-right text-xs text-muted-foreground whitespace-nowrap px-2 py-1 ${!isSeasonalMonth(idx) ? 'bg-muted/20' : 'bg-muted/30'}`}
                        >
                          {formatPercent(margin, { dash: true })}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap px-2 py-1 bg-muted/30">
                      {(() => {
                        const adjRev = getAdjustedCategoryAnnualTotal('Revenue');
                        const adjGP = adjRev - getAdjustedCategoryAnnualTotal('COGS');
                        return formatPercent(adjRev !== 0 ? (adjGP / adjRev) * 100 : null, { dash: true });
                      })()}
                    </TableCell>
                  </TableRow>

                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell className="whitespace-nowrap sticky left-0 z-10 bg-blue-50 dark:bg-blue-950 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] w-[15%] min-w-[140px] max-w-[200px] px-3 py-1.5 text-sm">{config?.bottomLineMetric === 'ebitda' ? 'EBITDA' : 'NOI'}</TableCell>
                    {months.map((month, idx) => {
                      const revenue = getAdjustedCategoryTotal('Revenue', month, idx);
                      const cogs = getAdjustedCategoryTotal('COGS', month, idx);
                      const expenses = getAdjustedCategoryTotal('Expenses', month, idx);
                      const noi = revenue - cogs - expenses;
                      return (
                        <TableCell 
                          key={month} 
                          className={`text-right whitespace-nowrap px-2 py-1.5 text-xs bg-primary/10 ${noi >= 0 ? 'text-green-600' : 'text-red-600'} ${!isSeasonalMonth(idx) ? 'opacity-60' : ''}`}
                        >
                          {formatCurrency(noi, { dash: true })}
                        </TableCell>
                      );
                    })}
                    {(() => {
                      const displayNOI = getAdjustedCategoryAnnualTotal('Revenue') - getAdjustedCategoryAnnualTotal('COGS') - getAdjustedCategoryAnnualTotal('Expenses');
                      return (
                        <TableCell className={`text-right whitespace-nowrap px-2 py-1.5 text-xs bg-primary/10 ${displayNOI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(displayNOI, { dash: true })}
                        </TableCell>
                      );
                    })()}
                  </TableRow>

                  <TableRow className="bg-primary/5">
                    <TableCell className="whitespace-nowrap sticky left-0 z-10 bg-background border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] text-xs text-muted-foreground w-[15%] min-w-[140px] max-w-[200px] px-3 py-1">Operating Margin</TableCell>
                    {months.map((month, idx) => {
                      const revenue = getAdjustedCategoryTotal('Revenue', month, idx);
                      const cogs = getAdjustedCategoryTotal('COGS', month, idx);
                      const expenses = getAdjustedCategoryTotal('Expenses', month, idx);
                      const noi = revenue - cogs - expenses;
                      const margin = revenue !== 0 ? (noi / revenue) * 100 : null;
                      return (
                        <TableCell 
                          key={month} 
                          className={`text-right text-xs whitespace-nowrap px-2 py-1 bg-primary/5 ${margin !== null && margin >= 0 ? 'text-green-600' : 'text-red-600'} ${!isSeasonalMonth(idx) ? 'opacity-60' : ''}`}
                        >
                          {formatPercent(margin, { dash: true })}
                        </TableCell>
                      );
                    })}
                    {(() => {
                      const normRev = getAdjustedCategoryAnnualTotal('Revenue');
                      const displayNOI = normRev - getAdjustedCategoryAnnualTotal('COGS') - getAdjustedCategoryAnnualTotal('Expenses');
                      return (
                        <TableCell className={`text-right text-xs whitespace-nowrap px-2 py-1 bg-primary/5 ${displayNOI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercent(normRev !== 0 ? (displayNOI / normRev) * 100 : null, { dash: true })}
                        </TableCell>
                      );
                    })()}
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <div className="overflow-x-auto">
              <Table className="w-full">
                <colgroup>
                  <col style={{ width: '200px', minWidth: '160px' }} />
                  {yearRange.map((year) => (
                    <col key={year} style={{ minWidth: '100px' }} />
                  ))}
                </colgroup>
                <TableHeader>
                  <TableRow className="border-b-2">
                    <TableHead className="sticky left-0 z-20 bg-white dark:bg-background border-r px-2 py-2"></TableHead>
                    {yearRange.map((year) => (
                      <TableHead key={year} className="text-center px-2 py-2 font-bold text-sm">
                        {year}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {['Revenue', 'COGS', 'Expenses'].map((category) => (
                    <Fragment key={category}>
                      <TableRow 
                        className="bg-muted/50 cursor-pointer hover:bg-muted"
                        onClick={() => toggleCategory(category)}
                      >
                        <TableCell className="font-semibold whitespace-nowrap sticky left-0 z-10 bg-muted border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] px-2 py-1.5 text-sm overflow-hidden text-ellipsis">
                          <div className="flex items-center gap-1.5">
                            {expandedCategories.has(category) ? (
                              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                            )}
                            {category}
                          </div>
                        </TableCell>
                        {yearRange.map((year) => {
                          const total = getAnnualCategoryTotal(category, year);
                          const hasData = availableYears.includes(String(year));
                          return (
                            <TableCell 
                              key={year} 
                              className={`text-right font-semibold text-sm px-2 py-1.5 ${!hasData ? 'text-muted-foreground/50' : ''}`}
                            >
                              {hasData ? formatCurrency(total, { dash: true }) : '-'}
                            </TableCell>
                          );
                        })}
                      </TableRow>

                      {expandedCategories.has(category) && (() => {
                        const subcats = annualSubcategories[category as keyof typeof annualSubcategories] || [];
                        const deptGrouped: Record<string, string[]> = {};
                        subcats.forEach((sub: string) => {
                          const dept = annualSubcatDeptMap[sub] || inferDepartmentClient(sub, category);
                          if (!deptGrouped[dept]) deptGrouped[dept] = [];
                          deptGrouped[dept].push(sub);
                        });
                        const sortedDepts = sortDepartments(Object.keys(deptGrouped), category);
                        return sortedDepts.map(department => {
                          const deptSubcats = deptGrouped[department] || [];
                          return (
                            <Fragment key={`${category}-${department}`}>
                              <TableRow
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleDepartment(`${category}-${department}`)}
                              >
                                <TableCell className="pl-5 whitespace-nowrap sticky left-0 z-10 bg-slate-50 dark:bg-slate-900 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] px-2 py-1">
                                  <div className="flex items-center gap-1">
                                    {expandedDepartments.has(`${category}-${department}`) ? (
                                      <ChevronDown className="h-3 w-3 shrink-0" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 shrink-0" />
                                    )}
                                    <InlineEditableName
                                      originalName={department}
                                      displayName={getDisplayName(department, 'department')}
                                      isOverridden={hasOverride(department, 'department')}
                                      suggestion={getOrgDefaultSuggestion(department, 'department')}
                                      isPending={overridePending}
                                      className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                                      onSave={async (newName) => {
                                        await saveOverride({ scope: 'department', originalName: department, displayName: newName, category });
                                      }}
                                      onRevert={hasOverride(department, 'department') ? async () => {
                                        const override = getOverride(department, 'department');
                                        if (override) await deleteOverride(override.id);
                                      } : undefined}
                                    />
                                  </div>
                                </TableCell>
                                {yearRange.map((year) => {
                                  const deptTotal = deptSubcats.reduce((sum: number, sub: string) => sum + getAnnualSubcategoryAmount(category, sub, year), 0);
                                  const hasData = availableYears.includes(String(year));
                                  return (
                                    <TableCell
                                      key={year}
                                      className={`text-right text-xs font-medium text-muted-foreground bg-slate-50 dark:bg-slate-900 px-2 py-1 ${!hasData ? 'text-muted-foreground/50' : ''}`}
                                    >
                                      {hasData ? formatCurrency(deptTotal, { dash: true }) : '-'}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>

                              {expandedDepartments.has(`${category}-${department}`) && deptSubcats.map((subcategory: string) => (
                                <TableRow key={`${category}-${subcategory}`}>
                                  <TableCell className="pl-9 whitespace-nowrap sticky left-0 z-10 bg-background border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] px-2 py-1 text-xs truncate">
                                    <div className="flex flex-col">
                                      <InlineEditableName
                                        originalName={subcategory}
                                        displayName={getDisplayName(subcategory, 'line_item', category, department)}
                                        isOverridden={hasOverride(subcategory, 'line_item', category, department)}
                                        suggestion={getOrgDefaultSuggestion(subcategory, 'line_item')}
                                        isPending={overridePending}
                                        onSave={async (newName) => {
                                          await saveOverride({ scope: 'line_item', originalName: subcategory, displayName: newName, category, department });
                                        }}
                                        onRevert={hasOverride(subcategory, 'line_item', category, department) ? async () => {
                                          const override = getOverride(subcategory, 'line_item', category, department);
                                          if (override) await deleteOverride(override.id);
                                        } : undefined}
                                      />
                                      {hasOverride(subcategory, 'line_item', category, department) && (
                                        <span className="text-[10px] text-muted-foreground/60">{subcategory}</span>
                                      )}
                                    </div>
                                  </TableCell>
                                  {yearRange.map((year) => {
                                    const amount = getAnnualSubcategoryAmount(category, subcategory, year);
                                    const hasData = availableYears.includes(String(year));
                                    return (
                                      <TableCell 
                                        key={year} 
                                        className={`text-right text-xs px-2 py-1 ${!hasData ? 'text-muted-foreground/50' : ''}`}
                                      >
                                        {hasData && amount !== 0 ? formatCurrency(amount, { dash: true }) : '-'}
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              ))}
                            </Fragment>
                          );
                        });
                      })()}
                    </Fragment>
                  ))}

                  <TableRow className="bg-muted font-bold border-t-2">
                    <TableCell className="whitespace-nowrap sticky left-0 z-10 bg-muted border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] px-2 py-1.5 text-sm">Gross Profit</TableCell>
                    {yearRange.map((year) => {
                      const revenue = getAnnualCategoryTotal('Revenue', year);
                      const cogs = getAnnualCategoryTotal('COGS', year);
                      const hasData = availableYears.includes(String(year));
                      return (
                        <TableCell 
                          key={year} 
                          className={`text-right text-sm font-bold bg-muted px-2 py-1.5 ${!hasData ? 'text-muted-foreground/50' : ''}`}
                        >
                          {hasData ? formatCurrency(revenue - cogs, { dash: true }) : '-'}
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  <TableRow className="bg-muted/30">
                    <TableCell className="whitespace-nowrap sticky left-0 z-10 bg-background border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] text-xs text-muted-foreground px-2 py-1">Gross Profit Margin</TableCell>
                    {yearRange.map((year) => {
                      const revenue = getAnnualCategoryTotal('Revenue', year);
                      const cogs = getAnnualCategoryTotal('COGS', year);
                      const gp = revenue - cogs;
                      const margin = revenue !== 0 ? (gp / revenue) * 100 : null;
                      const hasData = availableYears.includes(String(year));
                      return (
                        <TableCell 
                          key={year} 
                          className={`text-right text-xs text-muted-foreground bg-muted/30 px-2 py-1 ${!hasData ? 'opacity-50' : ''}`}
                        >
                          {hasData ? formatPercent(margin, { dash: true }) : '-'}
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell className="whitespace-nowrap sticky left-0 z-10 bg-blue-50 dark:bg-blue-950 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] px-2 py-1.5 text-sm">{config?.bottomLineMetric === 'ebitda' ? 'EBITDA' : 'NOI'}</TableCell>
                    {yearRange.map((year) => {
                      const revenue = getAnnualCategoryTotal('Revenue', year);
                      const cogs = getAnnualCategoryTotal('COGS', year);
                      const expenses = getAnnualCategoryTotal('Expenses', year);
                      const noi = revenue - cogs - expenses;
                      const hasData = availableYears.includes(String(year));
                      return (
                        <TableCell 
                          key={year} 
                          className={`text-right text-sm font-bold bg-primary/10 px-2 py-1.5 ${!hasData ? 'text-muted-foreground/50' : noi >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {hasData ? formatCurrency(noi, { dash: true }) : '-'}
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  <TableRow className="bg-primary/5">
                    <TableCell className="whitespace-nowrap sticky left-0 z-10 bg-background border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] text-xs text-muted-foreground px-2 py-1">Operating Margin</TableCell>
                    {yearRange.map((year) => {
                      const revenue = getAnnualCategoryTotal('Revenue', year);
                      const cogs = getAnnualCategoryTotal('COGS', year);
                      const expenses = getAnnualCategoryTotal('Expenses', year);
                      const noi = revenue - cogs - expenses;
                      const margin = revenue !== 0 ? (noi / revenue) * 100 : null;
                      const hasData = availableYears.includes(String(year));
                      return (
                        <TableCell 
                          key={year} 
                          className={`text-right text-xs bg-primary/5 px-2 py-1 ${!hasData ? 'opacity-50' : margin !== null && margin >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {hasData ? formatPercent(margin, { dash: true }) : '-'}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
