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
  Flag,
  X
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';
import { useModelingAddbacks } from '@/hooks/useModelingAddbacks';

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

  const { 
    isLineItemAddedBack,
    isCategoryAddedBack, 
    isMonthCellAddedBack,
    toggleLineItemAddback,
    toggleCategoryAddback,
    toggleMonthCellAddback,
    activeAddbacks,
    isPending: addbackPending,
    getAddbacksSummary,
  } = useModelingAddbacks(projectId);

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

  const { data: plData, isLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'historical-pl', selectedYear],
    enabled: !!selectedYear,
  });

  const { data: actualsData, isLoading: actualsLoading } = useQuery<any>({
    queryKey: [`/api/modeling/projects/${projectId}/actuals?year=${selectedYear}`],
    enabled: !!selectedYear,
  });

  const { data: allYearsActualsData } = useQuery<any>({
    queryKey: [`/api/modeling/projects/${projectId}/actuals`],
    enabled: displayMode === 'annual' && yearRange.length > 0,
  });

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

  const promoteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/pnl/promote-to-actuals', {
        method: 'POST',
        body: JSON.stringify({ modelingProjectId: projectId })
      });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/modeling/projects/${projectId}/actuals`] });
      queryClient.invalidateQueries({ queryKey: [`/api/modeling/projects/${projectId}/actuals/years`] });
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

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined || !isFinite(value)) return '-';
    return `${Math.round(value)}%`;
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

  const getNormalizedMonthlyValue = (item: PLLineItem, month: string, monthIdx: number) => {
    const rawValue = item.monthlyData[month] || 0;
    if (!showNormalized) return rawValue;
    if (isCategoryAddedBack(item.category)) return 0;
    if (isLineItemAddedBack(item.subcategory)) return 0;
    if (isMonthCellAddedBack(item.subcategory, parseInt(selectedYear), monthIdx + 1)) return 0;
    return rawValue;
  };

  const getNormalizedCategoryTotal = (category: string, month: string, monthIdx: number) => {
    if (!showNormalized) return getCategoryTotal(category, month);
    if (isCategoryAddedBack(category)) return 0;
    return (groupedData[category] || []).reduce((sum: number, item: PLLineItem) => {
      return sum + getNormalizedMonthlyValue(item, month, monthIdx);
    }, 0);
  };

  const getNormalizedCategoryAnnualTotal = (category: string) => {
    if (!showNormalized) return getCategoryAnnualTotal(category);
    if (isCategoryAddedBack(category)) return 0;
    return (groupedData[category] || []).reduce((sum: number, item: PLLineItem) => {
      let itemTotal = 0;
      months.forEach((month, idx) => {
        itemTotal += getNormalizedMonthlyValue(item, month, idx);
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
    if (!allYearsActualsData?.grouped) return {};
    const dataByYear: Record<number, Record<string, Record<string, number>>> = {};
    for (const year of yearRange) {
      dataByYear[year] = { Revenue: {}, COGS: {}, Expenses: {} };
    }
    for (const item of allYearsActualsData.grouped) {
      const year = item.year || parseInt(selectedYear);
      if (!dataByYear[year]) continue;
      const cat = item.category || 'Expenses';
      const subcat = item.subcategory || 'Other';
      if (!dataByYear[year][cat]) dataByYear[year][cat] = {};
      dataByYear[year][cat][subcat] = (dataByYear[year][cat][subcat] || 0) + (item.annualTotal || 0);
    }
    return dataByYear;
  }, [allYearsActualsData, yearRange, selectedYear]);

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
                  {activeAddbacks.length > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      <ArrowUpCircle className="h-3 w-3" />
                      {activeAddbacks.length} Addback{activeAddbacks.length !== 1 ? 's' : ''}
                    </Badge>
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
        <CardContent>
          <div className="overflow-x-auto">
            {displayMode === 'monthly' ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap sticky left-0 z-20 bg-background border-r">Category / Line Item</TableHead>
                    {months.map((month, idx) => (
                      <TableHead 
                        key={month} 
                        className={`text-center w-24 font-bold underline ${!isSeasonalMonth(idx) ? 'bg-muted/30' : ''}`}
                      >
                        {month}
                      </TableHead>
                    ))}
                    <TableHead className="text-center w-28 font-bold underline">Annual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {['Revenue', 'COGS', 'Expenses'].map((category) => (
                    <Fragment key={category}>
                      <TableRow 
                        className="bg-muted/50 cursor-pointer hover:bg-muted group"
                        onClick={() => toggleCategory(category)}
                      >
                        <TableCell className="font-semibold whitespace-nowrap sticky left-0 z-10 bg-muted/50 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                          <div className="flex items-center gap-2">
                            {expandedCategories.has(category) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {category}
                            {isCategoryAddedBack(category) && (
                              <Badge variant="outline" className="ml-2 text-xs bg-amber-50 text-amber-700 border-amber-300">
                                <ArrowUpCircle className="h-3 w-3 mr-1" />
                                Added Back
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 ml-auto opacity-0 group-hover:opacity-100 hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCategoryAddback(category);
                              }}
                              disabled={addbackPending}
                            >
                              {isCategoryAddedBack(category) ? (
                                <X className="h-3.5 w-3.5 text-amber-600" />
                              ) : (
                                <ArrowUpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        {months.map((month, idx) => {
                          const value = showNormalized ? getNormalizedCategoryTotal(category, month, idx) : getCategoryTotal(category, month);
                          const prevMonth = idx > 0 ? months[idx - 1] : null;
                          const prevValue = prevMonth ? getCategoryTotal(category, prevMonth) : null;
                          const momChange = prevValue && prevValue !== 0 ? ((value - prevValue) / Math.abs(prevValue)) * 100 : null;
                          return (
                            <TableCell 
                              key={month} 
                              className={`text-right font-semibold ${!isSeasonalMonth(idx) ? 'bg-muted/30' : 'bg-background'}`}
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
                        <TableCell className="text-right font-bold bg-background">
                          {formatCurrency(showNormalized ? getNormalizedCategoryAnnualTotal(category) : getCategoryAnnualTotal(category))}
                        </TableCell>
                      </TableRow>

                      {expandedCategories.has(category) && (groupedData[category] || []).map((item: PLLineItem) => {
                        const SourceIcon = item.dataSource ? dataSourceIcons[item.dataSource] : null;
                        return (
                          <TableRow key={item.id} className={`text-sm group ${isLineItemAddedBack(item.subcategory) || isCategoryAddedBack(category) ? 'opacity-50 line-through' : ''}`}>
                            <TableCell className="pl-10 whitespace-nowrap sticky left-0 z-10 bg-background border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                              <div className="flex items-center gap-2">
                                {SourceIcon && (
                                  <SourceIcon className="h-3 w-3 text-muted-foreground" />
                                )}
                                <div className="flex flex-col">
                                  <span>{item.description}</span>
                                  <span className="text-xs text-muted-foreground">{item.subcategory}</span>
                                </div>
                                {isLineItemAddedBack(item.subcategory) && (
                                  <Badge variant="outline" className="ml-1 text-[10px] h-5 bg-amber-50 text-amber-700 border-amber-300">
                                    <ArrowUpCircle className="h-2.5 w-2.5 mr-0.5" />
                                    Addback
                                  </Badge>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 ml-auto opacity-0 group-hover:opacity-100 hover:opacity-100 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleLineItemAddback(item.subcategory, item.description, category);
                                  }}
                                  disabled={addbackPending}
                                >
                                  {isLineItemAddedBack(item.subcategory) ? (
                                    <X className="h-3 w-3 text-amber-600" />
                                  ) : (
                                    <ArrowUpCircle className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                            {months.map((month, idx) => {
                              const rawValue = item.monthlyData[month] || 0;
                              const displayValue = showNormalized ? getNormalizedMonthlyValue(item, month, idx) : rawValue;
                              const isCellAddedBack = isMonthCellAddedBack(item.subcategory, parseInt(selectedYear), idx + 1);
                              return (
                                <TableCell 
                                  key={month} 
                                  className={`text-right relative ${!isSeasonalMonth(idx) ? 'bg-muted/30 text-muted-foreground' : ''} ${isCellAddedBack ? 'bg-amber-50' : ''}`}
                                  onDoubleClick={() => toggleMonthCellAddback(item.subcategory, item.description, category, parseInt(selectedYear), idx + 1)}
                                  title={isCellAddedBack ? 'Double-click to remove month addback' : 'Double-click to add back this month'}
                                >
                                  <span className={isCellAddedBack && showNormalized ? 'line-through opacity-50' : ''}>
                                    {formatCurrency(displayValue)}
                                  </span>
                                  {isCellAddedBack && (
                                    <Flag className="h-2.5 w-2.5 text-amber-500 absolute top-1 right-1" />
                                  )}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-right font-medium">
                              {formatCurrency(showNormalized ? months.reduce((sum, month, idx) => sum + getNormalizedMonthlyValue(item, month, idx), 0) : item.annualTotal)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </Fragment>
                  ))}

                  <TableRow className="bg-muted font-bold border-t-2">
                    <TableCell className="whitespace-nowrap sticky left-0 z-10 bg-muted border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">Gross Profit</TableCell>
                    {months.map((month, idx) => {
                      const revenue = showNormalized ? getNormalizedCategoryTotal('Revenue', month, idx) : getCategoryTotal('Revenue', month);
                      const cogs = showNormalized ? getNormalizedCategoryTotal('COGS', month, idx) : getCategoryTotal('COGS', month);
                      return (
                        <TableCell 
                          key={month} 
                          className={`text-right ${!isSeasonalMonth(idx) ? 'bg-muted/70' : 'bg-muted'}`}
                        >
                          {formatCurrency(revenue - cogs)}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right bg-muted">{formatCurrency(showNormalized ? (getNormalizedCategoryAnnualTotal('Revenue') - getNormalizedCategoryAnnualTotal('COGS')) : grossProfit)}</TableCell>
                  </TableRow>

                  <TableRow className="bg-muted/30">
                    <TableCell className="whitespace-nowrap sticky left-0 z-10 bg-muted/30 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] text-sm text-muted-foreground">Gross Profit Margin</TableCell>
                    {months.map((month, idx) => {
                      const revenue = showNormalized ? getNormalizedCategoryTotal('Revenue', month, idx) : getCategoryTotal('Revenue', month);
                      const cogs = showNormalized ? getNormalizedCategoryTotal('COGS', month, idx) : getCategoryTotal('COGS', month);
                      const gp = revenue - cogs;
                      const margin = revenue !== 0 ? (gp / revenue) * 100 : null;
                      return (
                        <TableCell 
                          key={month} 
                          className={`text-right text-sm text-muted-foreground ${!isSeasonalMonth(idx) ? 'bg-muted/20' : 'bg-muted/30'}`}
                        >
                          {formatPercent(margin)}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right text-sm text-muted-foreground bg-muted/30">
                      {(() => {
                        const normRev = showNormalized ? getNormalizedCategoryAnnualTotal('Revenue') : totalRevenue;
                        const normGP = showNormalized ? (getNormalizedCategoryAnnualTotal('Revenue') - getNormalizedCategoryAnnualTotal('COGS')) : grossProfit;
                        return formatPercent(normRev !== 0 ? (normGP / normRev) * 100 : null);
                      })()}
                    </TableCell>
                  </TableRow>

                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell className="whitespace-nowrap sticky left-0 z-10 bg-primary/10 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">{config?.bottomLineMetric === 'ebitda' ? 'EBITDA' : 'NOI'}</TableCell>
                    {months.map((month, idx) => {
                      const revenue = showNormalized ? getNormalizedCategoryTotal('Revenue', month, idx) : getCategoryTotal('Revenue', month);
                      const cogs = showNormalized ? getNormalizedCategoryTotal('COGS', month, idx) : getCategoryTotal('COGS', month);
                      const expenses = showNormalized ? getNormalizedCategoryTotal('Expenses', month, idx) : getCategoryTotal('Expenses', month);
                      const noi = revenue - cogs - expenses;
                      return (
                        <TableCell 
                          key={month} 
                          className={`text-right bg-primary/10 ${noi >= 0 ? 'text-green-600' : 'text-red-600'} ${!isSeasonalMonth(idx) ? 'opacity-60' : ''}`}
                        >
                          {formatCurrency(noi)}
                        </TableCell>
                      );
                    })}
                    {(() => {
                      const normalizedNOI = getNormalizedCategoryAnnualTotal('Revenue') - getNormalizedCategoryAnnualTotal('COGS') - getNormalizedCategoryAnnualTotal('Expenses');
                      const displayNOI = showNormalized ? normalizedNOI : netIncome;
                      return (
                        <TableCell className={`text-right bg-primary/10 ${displayNOI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(displayNOI)}
                        </TableCell>
                      );
                    })()}
                  </TableRow>

                  <TableRow className="bg-primary/5">
                    <TableCell className="whitespace-nowrap sticky left-0 z-10 bg-primary/5 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] text-sm text-muted-foreground">Operating Margin</TableCell>
                    {months.map((month, idx) => {
                      const revenue = showNormalized ? getNormalizedCategoryTotal('Revenue', month, idx) : getCategoryTotal('Revenue', month);
                      const cogs = showNormalized ? getNormalizedCategoryTotal('COGS', month, idx) : getCategoryTotal('COGS', month);
                      const expenses = showNormalized ? getNormalizedCategoryTotal('Expenses', month, idx) : getCategoryTotal('Expenses', month);
                      const noi = revenue - cogs - expenses;
                      const margin = revenue !== 0 ? (noi / revenue) * 100 : null;
                      return (
                        <TableCell 
                          key={month} 
                          className={`text-right text-sm bg-primary/5 ${margin !== null && margin >= 0 ? 'text-green-600' : 'text-red-600'} ${!isSeasonalMonth(idx) ? 'opacity-60' : ''}`}
                        >
                          {formatPercent(margin)}
                        </TableCell>
                      );
                    })}
                    {(() => {
                      const normRev = showNormalized ? getNormalizedCategoryAnnualTotal('Revenue') : totalRevenue;
                      const normalizedNOI = getNormalizedCategoryAnnualTotal('Revenue') - getNormalizedCategoryAnnualTotal('COGS') - getNormalizedCategoryAnnualTotal('Expenses');
                      const displayNOI = showNormalized ? normalizedNOI : netIncome;
                      return (
                        <TableCell className={`text-right text-sm bg-primary/5 ${displayNOI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercent(normRev !== 0 ? (displayNOI / normRev) * 100 : null)}
                        </TableCell>
                      );
                    })()}
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap sticky left-0 z-20 bg-background border-r">Category / Line Item</TableHead>
                    {yearRange.map((year) => (
                      <TableHead key={year} className="text-center w-28 font-bold underline">
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
                        <TableCell className="font-semibold whitespace-nowrap sticky left-0 z-10 bg-muted/50 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                          <div className="flex items-center gap-2">
                            {expandedCategories.has(category) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
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
                              className={`text-right font-semibold bg-background ${!hasData ? 'text-muted-foreground/50' : ''}`}
                            >
                              {hasData ? formatCurrency(total) : '-'}
                            </TableCell>
                          );
                        })}
                      </TableRow>

                      {expandedCategories.has(category) && annualSubcategories[category as keyof typeof annualSubcategories]?.map((subcategory) => (
                        <TableRow key={`${category}-${subcategory}`} className="text-sm">
                          <TableCell className="pl-10 whitespace-nowrap sticky left-0 z-10 bg-background border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                            <span>{subcategory}</span>
                          </TableCell>
                          {yearRange.map((year) => {
                            const amount = getAnnualSubcategoryAmount(category, subcategory, year);
                            const hasData = availableYears.includes(String(year));
                            return (
                              <TableCell 
                                key={year} 
                                className={`text-right bg-background ${!hasData ? 'text-muted-foreground/50' : ''}`}
                              >
                                {hasData && amount !== 0 ? formatCurrency(amount) : '-'}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}

                  <TableRow className="bg-muted font-bold border-t-2">
                    <TableCell className="whitespace-nowrap sticky left-0 z-10 bg-muted border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">Gross Profit</TableCell>
                    {yearRange.map((year) => {
                      const revenue = getAnnualCategoryTotal('Revenue', year);
                      const cogs = getAnnualCategoryTotal('COGS', year);
                      const hasData = availableYears.includes(String(year));
                      return (
                        <TableCell 
                          key={year} 
                          className={`text-right bg-muted ${!hasData ? 'text-muted-foreground/50' : ''}`}
                        >
                          {hasData ? formatCurrency(revenue - cogs) : '-'}
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  <TableRow className="bg-muted/30">
                    <TableCell className="whitespace-nowrap sticky left-0 z-10 bg-muted/30 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] text-sm text-muted-foreground">Gross Profit Margin</TableCell>
                    {yearRange.map((year) => {
                      const revenue = getAnnualCategoryTotal('Revenue', year);
                      const cogs = getAnnualCategoryTotal('COGS', year);
                      const gp = revenue - cogs;
                      const margin = revenue !== 0 ? (gp / revenue) * 100 : null;
                      const hasData = availableYears.includes(String(year));
                      return (
                        <TableCell 
                          key={year} 
                          className={`text-right text-sm text-muted-foreground bg-muted/30 ${!hasData ? 'opacity-50' : ''}`}
                        >
                          {hasData ? formatPercent(margin) : '-'}
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  <TableRow className="bg-primary/10 font-bold">
                    <TableCell className="whitespace-nowrap sticky left-0 z-10 bg-primary/10 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">{config?.bottomLineMetric === 'ebitda' ? 'EBITDA' : 'NOI'}</TableCell>
                    {yearRange.map((year) => {
                      const revenue = getAnnualCategoryTotal('Revenue', year);
                      const cogs = getAnnualCategoryTotal('COGS', year);
                      const expenses = getAnnualCategoryTotal('Expenses', year);
                      const noi = revenue - cogs - expenses;
                      const hasData = availableYears.includes(String(year));
                      return (
                        <TableCell 
                          key={year} 
                          className={`text-right bg-primary/10 ${!hasData ? 'text-muted-foreground/50' : noi >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {hasData ? formatCurrency(noi) : '-'}
                        </TableCell>
                      );
                    })}
                  </TableRow>

                  <TableRow className="bg-primary/5">
                    <TableCell className="whitespace-nowrap sticky left-0 z-10 bg-primary/5 border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] text-sm text-muted-foreground">Operating Margin</TableCell>
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
                          className={`text-right text-sm bg-primary/5 ${!hasData ? 'opacity-50' : margin !== null && margin >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {hasData ? formatPercent(margin) : '-'}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
