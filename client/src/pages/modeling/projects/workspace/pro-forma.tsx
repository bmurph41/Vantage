import { useState } from 'react';
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
  BarChart3,
  TrendingUp,
  Download,
  ChevronDown,
  ChevronRight,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';

interface WorkspaceProFormaProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function WorkspaceProForma({ projectId, onTabChange }: WorkspaceProFormaProps) {
  const [viewMode, setViewMode] = useState<'monthly' | 'annual'>('annual');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['revenue']));
  const { toast } = useToast();

  const { data: config } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
  });

  const { data: assumptions } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'assumptions'],
  });

  const { data: proFormaData, isLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'pro-forma'],
  });

  const holdPeriod = config?.holdPeriod || 5;
  const startDate = config?.startDate || '2026-01-31';
  const seasonMonths = config?.seasonMonths || [4, 5, 6, 7, 8, 9, 10];
  const startYear = parseInt(startDate.split('-')[0]);
  const years = Array.from({ length: holdPeriod }, (_, i) => startYear + i);

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

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const isSeasonalMonth = (monthIndex: number) => seasonMonths.includes(monthIndex + 1);

  const emptyAnnualData = {
    years,
    categories: {
      Revenue: {},
      COGS: {},
      Expenses: {},
    },
  };

  const data = proFormaData || emptyAnnualData;
  const hasData = proFormaData && Object.values(proFormaData.categories || {}).some(
    (cat: any) => Object.keys(cat).length > 0
  );

  const getCategoryTotal = (category: string, yearIndex: number) => {
    const items = data.categories[category] || {};
    return Object.values(items).reduce((sum: number, values: any) => 
      sum + (values[yearIndex] || 0), 0
    );
  };

  const getGrowthRate = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const revenueByYear = years.map((_, i) => getCategoryTotal('Revenue', i));
  const cogsByYear = years.map((_, i) => getCategoryTotal('COGS', i));
  const expensesByYear = years.map((_, i) => getCategoryTotal('Expenses', i));
  const grossProfitByYear = revenueByYear.map((rev, i) => rev - cogsByYear[i]);
  const noiByYear = grossProfitByYear.map((gp, i) => gp - expensesByYear[i]);

  const exportProForma = () => {
    const csvRows: string[] = [];
    
    csvRows.push(['Category', 'Line Item', ...years.map(y => `Year ${y}`)].join(','));
    
    Object.entries(data.categories).forEach(([category, items]: [string, any]) => {
      Object.entries(items).forEach(([item, values]: [string, any]) => {
        csvRows.push([category, item, ...values.map((v: number) => v.toString())].join(','));
      });
      csvRows.push([category, 'Total', ...years.map((_, i) => getCategoryTotal(category, i).toString())].join(','));
      csvRows.push('');
    });
    
    csvRows.push(['Summary', 'Gross Profit', ...grossProfitByYear.map(v => v.toString())].join(','));
    csvRows.push(['Summary', 'NOI', ...noiByYear.map(v => v.toString())].join(','));
    
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
          <h2 className="text-xl font-semibold">Pro Forma Projections</h2>
          <p className="text-sm text-muted-foreground">
            {holdPeriod}-year projections based on trailing 12-month actuals with growth assumptions
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button variant="outline" size="sm" onClick={exportProForma} data-testid="button-export-proforma">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {!hasData && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h4 className="font-semibold mb-2">No Projection Data Yet</h4>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Upload historical P&L data to generate pro forma projections. Financial data from Doc Intel will flow here automatically.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Year 1 Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(revenueByYear[0])}</div>
            <p className="text-xs text-muted-foreground mt-1">
              T12 baseline with growth applied
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Year {holdPeriod} Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(revenueByYear[holdPeriod - 1])}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">
                {formatPercent(getGrowthRate(revenueByYear[holdPeriod - 1], revenueByYear[0]))}
              </span>
              <span className="text-xs text-muted-foreground">total growth</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Year 1 NOI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(noiByYear[0])}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {revenueByYear[0] > 0 ? ((noiByYear[0] / revenueByYear[0]) * 100).toFixed(1) : 0}% margin
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Year {holdPeriod} NOI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(noiByYear[holdPeriod - 1])}</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">
                {formatPercent(getGrowthRate(noiByYear[holdPeriod - 1], noiByYear[0]))}
              </span>
              <span className="text-xs text-muted-foreground">total growth</span>
            </div>
          </CardContent>
        </Card>
      </div>

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
                  <TableHead className="w-64 sticky left-0 bg-background">Category / Line Item</TableHead>
                  <TableHead className="text-right w-28 bg-muted/30">T12 Actual</TableHead>
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
                {['Revenue', 'COGS', 'Expenses'].map((category) => {
                  const items = data.categories[category] || {};
                  const t12Total = Object.values(items).reduce((sum: number, values: any) => sum + (values[0] || 0) / (1 + (assumptions?.growthRates?.[Object.keys(items)[0]] || 3) / 100), 0);
                  
                  return (
                    <>
                      <TableRow 
                        key={category}
                        className="bg-muted/50 cursor-pointer hover:bg-muted"
                        onClick={() => toggleCategory(category)}
                        data-testid={`row-category-${category.toLowerCase()}`}
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
                        <TableCell className="text-right font-semibold bg-muted/30">
                          {formatCurrency(t12Total)}
                        </TableCell>
                        {years.map((_, i) => (
                          <TableCell key={i} className="text-right font-semibold">
                            {formatCurrency(getCategoryTotal(category, i))}
                          </TableCell>
                        ))}
                        <TableCell className="text-right text-muted-foreground">
                          {formatPercent(
                            (Math.pow(getCategoryTotal(category, holdPeriod - 1) / getCategoryTotal(category, 0), 1 / holdPeriod) - 1) * 100
                          )}
                        </TableCell>
                      </TableRow>

                      {expandedCategories.has(category) && Object.entries(items).map(([itemName, values]: [string, any]) => {
                        const t12Value = values[0] / (1 + (assumptions?.growthRates?.[itemName.toLowerCase().replace(/\s+/g, '_')] || 3) / 100);
                        return (
                          <TableRow key={itemName} className="text-sm">
                            <TableCell className="pl-10 sticky left-0 bg-background">
                              {itemName}
                            </TableCell>
                            <TableCell className="text-right bg-muted/30">
                              {formatCurrency(t12Value)}
                            </TableCell>
                            {values.map((value: number, i: number) => (
                              <TableCell key={i} className="text-right">
                                {formatCurrency(value)}
                              </TableCell>
                            ))}
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {formatPercent(
                                (Math.pow(values[holdPeriod - 1] / values[0], 1 / holdPeriod) - 1) * 100
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </>
                  );
                })}

                <TableRow className="bg-muted font-bold border-t-2">
                  <TableCell className="sticky left-0 bg-muted">Gross Profit</TableCell>
                  <TableCell className="text-right bg-muted/70">
                    {formatCurrency(grossProfitByYear[0] / 1.03)}
                  </TableCell>
                  {grossProfitByYear.map((gp, i) => (
                    <TableCell key={i} className="text-right">{formatCurrency(gp)}</TableCell>
                  ))}
                  <TableCell className="text-right text-muted-foreground">
                    {formatPercent(
                      (Math.pow(grossProfitByYear[holdPeriod - 1] / grossProfitByYear[0], 1 / holdPeriod) - 1) * 100
                    )}
                  </TableCell>
                </TableRow>

                <TableRow className="bg-primary/10 font-bold">
                  <TableCell className="sticky left-0 bg-primary/10">Net Operating Income</TableCell>
                  <TableCell className="text-right opacity-70">
                    {formatCurrency(noiByYear[0] / 1.03)}
                  </TableCell>
                  {noiByYear.map((noi, i) => (
                    <TableCell 
                      key={i} 
                      className={`text-right ${noi >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {formatCurrency(noi)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right text-green-600">
                    {formatPercent(
                      (Math.pow(noiByYear[holdPeriod - 1] / noiByYear[0], 1 / holdPeriod) - 1) * 100
                    )}
                  </TableCell>
                </TableRow>

                <TableRow className="border-t-2">
                  <TableCell className="sticky left-0 bg-background text-muted-foreground">NOI Margin</TableCell>
                  <TableCell className="text-right text-muted-foreground bg-muted/30">
                    {revenueByYear[0] > 0 ? ((noiByYear[0] / 1.03) / (revenueByYear[0] / 1.03) * 100).toFixed(1) : 0}%
                  </TableCell>
                  {noiByYear.map((noi, i) => (
                    <TableCell key={i} className="text-right text-muted-foreground">
                      {revenueByYear[i] > 0 ? ((noi / revenueByYear[i]) * 100).toFixed(1) : 0}%
                    </TableCell>
                  ))}
                  <TableCell className="text-right text-muted-foreground">-</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium mb-1">Pro Forma Methodology</h4>
              <p className="text-sm text-muted-foreground">
                Projections are calculated using your trailing 12-month (T12) actual data as the baseline. 
                Revenue grows by the category-specific growth rates you set in Assumptions. 
                COGS is calculated as (1 - Gross Profit Margin) × Revenue for applicable departments. 
                Seasonal departments show $0 during off-season months, with revenue concentrated in your defined in-season period.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {onTabChange && (
        <WorkflowNavigation currentTab="proforma" onNavigate={onTabChange} />
      )}
    </div>
  );
}
