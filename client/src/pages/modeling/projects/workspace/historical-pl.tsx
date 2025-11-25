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
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  Download,
  Filter
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
};

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function WorkspaceHistoricalPL({ projectId }: WorkspaceHistoricalPLProps) {
  const [selectedYear, setSelectedYear] = useState('2024');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['revenue', 'expense']));

  const { data: plData, isLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'historical-pl', selectedYear],
  });

  const { data: config } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
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
    { id: '3', category: 'Revenue', subcategory: 'Fuel', description: 'Fuel Sales', type: 'revenue', monthlyData: { Jan: 0, Feb: 0, Mar: 12000, Apr: 35000, May: 68000, Jun: 95000, Jul: 110000, Aug: 105000, Sep: 75000, Oct: 42000, Nov: 15000, Dec: 0 }, annualTotal: 557000 },
    { id: '4', category: 'Revenue', subcategory: 'Ship Store', description: 'Retail Sales', type: 'revenue', monthlyData: { Jan: 0, Feb: 0, Mar: 5000, Apr: 15000, May: 28000, Jun: 42000, Jul: 48000, Aug: 45000, Sep: 32000, Oct: 18000, Nov: 8000, Dec: 0 }, annualTotal: 241000 },
    { id: '5', category: 'Revenue', subcategory: 'Third-Party Leases', description: 'Restaurant Lease', type: 'revenue', monthlyData: { Jan: 8000, Feb: 8000, Mar: 8000, Apr: 8000, May: 8000, Jun: 8000, Jul: 8000, Aug: 8000, Sep: 8000, Oct: 8000, Nov: 8000, Dec: 8000 }, annualTotal: 96000 },
    { id: '6', category: 'COGS', subcategory: 'Fuel', description: 'Fuel Cost of Goods', type: 'cogs', monthlyData: { Jan: 0, Feb: 0, Mar: 10200, Apr: 29750, May: 57800, Jun: 80750, Jul: 93500, Aug: 89250, Sep: 63750, Oct: 35700, Nov: 12750, Dec: 0 }, annualTotal: 473450 },
    { id: '7', category: 'COGS', subcategory: 'Ship Store', description: 'Retail Cost of Goods', type: 'cogs', monthlyData: { Jan: 0, Feb: 0, Mar: 3250, Apr: 9750, May: 18200, Jun: 27300, Jul: 31200, Aug: 29250, Sep: 20800, Oct: 11700, Nov: 5200, Dec: 0 }, annualTotal: 156650 },
    { id: '8', category: 'Expenses', subcategory: 'Payroll', description: 'Salaries & Wages', type: 'expense', monthlyData: { Jan: 25000, Feb: 25000, Mar: 32000, Apr: 45000, May: 55000, Jun: 62000, Jul: 65000, Aug: 62000, Sep: 52000, Oct: 38000, Nov: 28000, Dec: 25000 }, annualTotal: 514000 },
    { id: '9', category: 'Expenses', subcategory: 'Utilities', description: 'Electric & Water', type: 'expense', monthlyData: { Jan: 3500, Feb: 3500, Mar: 4200, Apr: 5800, May: 7500, Jun: 9200, Jul: 10500, Aug: 10200, Sep: 8500, Oct: 6200, Nov: 4500, Dec: 3500 }, annualTotal: 77100 },
    { id: '10', category: 'Expenses', subcategory: 'Insurance', description: 'Property & Liability', type: 'expense', monthlyData: { Jan: 8500, Feb: 8500, Mar: 8500, Apr: 8500, May: 8500, Jun: 8500, Jul: 8500, Aug: 8500, Sep: 8500, Oct: 8500, Nov: 8500, Dec: 8500 }, annualTotal: 102000 },
  ];

  const lineItems = plData?.lineItems || sampleData;

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
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gross Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(grossProfit)}</div>
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
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Operating Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
            <div className="flex items-center gap-2">
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

                    {expandedCategories.has(category) && (groupedData[category] || []).map((item: PLLineItem) => (
                      <TableRow key={item.id} className="text-sm">
                        <TableCell className="pl-10 sticky left-0 bg-background">
                          <div className="flex flex-col">
                            <span>{item.description}</span>
                            <span className="text-xs text-muted-foreground">{item.subcategory}</span>
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
                    ))}
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
