import { useState } from 'react';
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
  Info
} from 'lucide-react';

interface WorkspaceHistoricalPLProps {
  projectId: string;
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

export default function WorkspaceHistoricalPL({ projectId }: WorkspaceHistoricalPLProps) {
  const { toast } = useToast();
  const [selectedYear, setSelectedYear] = useState('2024');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Revenue', 'COGS', 'Expenses']));
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [syncSources, setSyncSources] = useState({
    rent_roll: true,
    fuel_sales: true,
    ship_store: true
  });

  const { data: plData, isLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'historical-pl', selectedYear],
  });

  const { data: actualsData, isLoading: actualsLoading } = useQuery<any>({
    queryKey: [`/api/modeling/projects/${projectId}/actuals?year=${selectedYear}`],
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

  const sampleData: PLLineItem[] = [
    { id: '1', category: 'Revenue', subcategory: 'Wet Slips', description: 'Wet Slip Rentals', type: 'revenue', monthlyData: { Jan: 0, Feb: 0, Mar: 15000, Apr: 45000, May: 85000, Jun: 120000, Jul: 135000, Aug: 130000, Sep: 95000, Oct: 55000, Nov: 20000, Dec: 0 }, annualTotal: 700000 },
    { id: '2', category: 'Revenue', subcategory: 'Dry Storage', description: 'Dry Rack Storage', type: 'revenue', monthlyData: { Jan: 0, Feb: 0, Mar: 8000, Apr: 22000, May: 38000, Jun: 52000, Jul: 58000, Aug: 55000, Sep: 42000, Oct: 28000, Nov: 12000, Dec: 0 }, annualTotal: 315000 },
    { id: '3', category: 'Revenue', subcategory: 'Fuel Sales', description: 'Fuel Sales', type: 'revenue', monthlyData: { Jan: 0, Feb: 0, Mar: 12000, Apr: 35000, May: 68000, Jun: 95000, Jul: 110000, Aug: 105000, Sep: 75000, Oct: 42000, Nov: 15000, Dec: 0 }, annualTotal: 557000, dataSource: 'fuel_sales' },
    { id: '4', category: 'Revenue', subcategory: 'Ship Store', description: 'Retail Sales', type: 'revenue', monthlyData: { Jan: 0, Feb: 0, Mar: 5000, Apr: 15000, May: 28000, Jun: 42000, Jul: 48000, Aug: 45000, Sep: 32000, Oct: 18000, Nov: 8000, Dec: 0 }, annualTotal: 241000, dataSource: 'ship_store' },
    { id: '5', category: 'Revenue', subcategory: 'Third-Party Leases', description: 'Restaurant Lease', type: 'revenue', monthlyData: { Jan: 8000, Feb: 8000, Mar: 8000, Apr: 8000, May: 8000, Jun: 8000, Jul: 8000, Aug: 8000, Sep: 8000, Oct: 8000, Nov: 8000, Dec: 8000 }, annualTotal: 96000 },
    { id: '6', category: 'COGS', subcategory: 'Fuel', description: 'Fuel Cost of Goods', type: 'cogs', monthlyData: { Jan: 0, Feb: 0, Mar: 10200, Apr: 29750, May: 57800, Jun: 80750, Jul: 93500, Aug: 89250, Sep: 63750, Oct: 35700, Nov: 12750, Dec: 0 }, annualTotal: 473450, dataSource: 'fuel_sales' },
    { id: '7', category: 'COGS', subcategory: 'Ship Store', description: 'Retail Cost of Goods', type: 'cogs', monthlyData: { Jan: 0, Feb: 0, Mar: 3250, Apr: 9750, May: 18200, Jun: 27300, Jul: 31200, Aug: 29250, Sep: 20800, Oct: 11700, Nov: 5200, Dec: 0 }, annualTotal: 156650, dataSource: 'ship_store' },
    { id: '8', category: 'Expenses', subcategory: 'Payroll', description: 'Salaries & Wages', type: 'expense', monthlyData: { Jan: 25000, Feb: 25000, Mar: 32000, Apr: 45000, May: 55000, Jun: 62000, Jul: 65000, Aug: 62000, Sep: 52000, Oct: 38000, Nov: 28000, Dec: 25000 }, annualTotal: 514000 },
    { id: '9', category: 'Expenses', subcategory: 'Utilities', description: 'Electric & Water', type: 'expense', monthlyData: { Jan: 3500, Feb: 3500, Mar: 4200, Apr: 5800, May: 7500, Jun: 9200, Jul: 10500, Aug: 10200, Sep: 8500, Oct: 6200, Nov: 4500, Dec: 3500 }, annualTotal: 77100 },
    { id: '10', category: 'Expenses', subcategory: 'Insurance', description: 'Property & Liability', type: 'expense', monthlyData: { Jan: 8500, Feb: 8500, Mar: 8500, Apr: 8500, May: 8500, Jun: 8500, Jul: 8500, Aug: 8500, Sep: 8500, Oct: 8500, Nov: 8500, Dec: 8500 }, annualTotal: 102000 },
  ];

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
    : (plData?.lineItems || sampleData);

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Historical P&L</h2>
          <p className="text-sm text-muted-foreground">
            Actual financial performance by month and category
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2022">2022</SelectItem>
              <SelectItem value="2023">2023</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
            </SelectContent>
          </Select>
          
          <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-sync-operations">
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Operations
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

      {!hasActualsData && (
        <Card className="bg-amber-50/50 border-amber-200">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">Using Sample Data</p>
                <p className="text-xs text-amber-700">
                  Click "Sync Operations" to import real data from Rent Roll, Fuel Sales, and Ship Store modules.
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                className="border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={() => setShowSyncDialog(true)}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
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
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Monthly Detail</CardTitle>
              <CardDescription>
                Click category rows to expand/collapse line items
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-24 h-8" data-testid="select-year-detail">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2022">2022</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setShowSyncDialog(true)}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Sync
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
              <div className="h-4 w-px bg-border" />
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
                  <>
                    <TableRow 
                      key={category}
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
                      {months.map((month, idx) => (
                        <TableCell 
                          key={month} 
                          className={`text-right font-semibold ${!isSeasonalMonth(idx) ? 'bg-muted/30' : ''}`}
                        >
                          {formatCurrency(getCategoryTotal(category, month))}
                        </TableCell>
                      ))}
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
                  </>
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
