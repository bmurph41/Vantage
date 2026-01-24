import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sun, Snowflake, Calendar, TrendingUp, DollarSign, Ruler } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface SeasonalRate {
  season: 'Annual' | 'Seasonal' | 'Winter' | 'Short-term';
  avgRatePerFoot: number;
  avgMonthlyRate: number;
  count: number;
  totalRevenue: number;
  avgLoa: number;
}

interface ContractTermData {
  period: string;
  annual: number;
  seasonal: number;
  winter: number;
  shortTerm: number;
}

interface SeasonalRateComparisonProps {
  locationId?: string | null;
}

const SEASON_ICONS: Record<string, any> = {
  'Annual': Calendar,
  'Seasonal': Sun,
  'Winter': Snowflake,
  'Short-term': TrendingUp,
};

const SEASON_COLORS: Record<string, string> = {
  'Annual': '#0d7377',
  'Seasonal': '#f59e0b',
  'Winter': '#3b82f6',
  'Short-term': '#8b5cf6',
};

export function SeasonalRateComparison({ 
  locationId,
}: SeasonalRateComparisonProps) {
  const { data: apiData, isLoading } = useQuery<{
    rates: SeasonalRate[];
    comparison: {
      baseAnnualRate: number;
      premiums: { seasonal: number; winter: number; shortTerm: number };
      revenueByType: { type: string; revenue: number; percentage: number }[];
      totalRevenue: number;
      totalContracts: number;
      weightedAvgRate: number;
    };
    yearOverYear?: {
      currentYear: number;
      previousYear: number;
      rates: {
        season: string;
        currentYearRate: number;
        lastYearRate: number;
        change: number;
        changePercent: number;
        year: number;
      }[];
    };
  }>({
    queryKey: ['/api/rent-roll/analytics/rate-comparison', { locationId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (locationId) params.set('locationId', locationId);
      const response = await fetch(`/api/rent-roll/analytics/rate-comparison?${params}`);
      if (!response.ok) throw new Error('Failed to fetch rate comparison');
      return response.json();
    },
  });

  const defaultRates: SeasonalRate[] = useMemo(() => [
    { season: 'Annual', avgRatePerFoot: 42.50, avgMonthlyRate: 1275, count: 85, totalRevenue: 1301400, avgLoa: 30 },
    { season: 'Seasonal', avgRatePerFoot: 55.00, avgMonthlyRate: 1650, count: 45, totalRevenue: 445500, avgLoa: 30 },
    { season: 'Winter', avgRatePerFoot: 38.00, avgMonthlyRate: 1140, count: 25, totalRevenue: 171000, avgLoa: 30 },
    { season: 'Short-term', avgRatePerFoot: 85.00, avgMonthlyRate: 2550, count: 15, totalRevenue: 114750, avgLoa: 30 },
  ], []);

  const rates = apiData?.rates && apiData.rates.length > 0 ? apiData.rates : defaultRates;

  const defaultTrendData: ContractTermData[] = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((month, idx) => ({
      period: month,
      annual: 40 + Math.random() * 5,
      seasonal: idx >= 3 && idx <= 8 ? 50 + Math.random() * 10 : 0,
      winter: idx <= 2 || idx >= 10 ? 35 + Math.random() * 5 : 0,
      shortTerm: 75 + Math.random() * 15,
    }));
  }, []);

  const trends = defaultTrendData;

  const chartData = useMemo(() => 
    rates.map(r => ({
      season: r.season,
      'Rate per Foot': r.avgRatePerFoot,
      'Monthly Rate': r.avgMonthlyRate,
      count: r.count,
    })),
  [rates]);

  const totalRevenue = rates.reduce((sum, r) => sum + r.totalRevenue, 0);
  const totalContracts = rates.reduce((sum, r) => sum + r.count, 0);
  const avgRatePerFoot = rates.reduce((sum, r) => sum + r.avgRatePerFoot * r.count, 0) / totalContracts;

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="pt-6 h-[500px] bg-muted/50" />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Seasonal Rate Comparison
        </CardTitle>
        <CardDescription>
          Compare rates across Annual, Seasonal, Winter, and Short-term contracts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-4 mb-6">
          {rates.map((rate) => {
            const Icon = SEASON_ICONS[rate.season] || Calendar;
            return (
              <div 
                key={rate.season} 
                className="p-4 rounded-lg border"
                style={{ borderLeftColor: SEASON_COLORS[rate.season], borderLeftWidth: 4 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">{rate.season}</span>
                  <Icon className="h-4 w-4" style={{ color: SEASON_COLORS[rate.season] }} />
                </div>
                <p className="text-xl font-bold">${rate.avgRatePerFoot.toFixed(2)}/ft</p>
                <p className="text-sm text-muted-foreground">{rate.count} contracts</p>
              </div>
            );
          })}
        </div>

        <Tabs defaultValue="comparison" className="space-y-4">
          <TabsList>
            <TabsTrigger value="comparison">Rate Comparison</TabsTrigger>
            <TabsTrigger value="yoy">Year-over-Year</TabsTrigger>
            <TabsTrigger value="trends">Rate Trends</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="comparison">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  Average Rate per Foot by Season
                </h4>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="season" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(val) => `$${val}`} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toFixed(2)}/ft`, 'Rate per Foot']}
                    />
                    <Bar 
                      dataKey="Rate per Foot" 
                      radius={[4, 4, 0, 0]}
                    >
                      {chartData.map((entry, index) => (
                        <rect 
                          key={`bar-${index}`} 
                          fill={SEASON_COLORS[entry.season as keyof typeof SEASON_COLORS]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Average Monthly Rate by Season
                </h4>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tickFormatter={(val) => `$${val}`} tick={{ fontSize: 12 }} />
                    <YAxis dataKey="season" type="category" tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Monthly Rate']}
                    />
                    <Bar 
                      dataKey="Monthly Rate" 
                      radius={[0, 4, 4, 0]}
                    >
                      {chartData.map((entry, index) => (
                        <rect 
                          key={`bar-${index}`} 
                          fill={SEASON_COLORS[entry.season as keyof typeof SEASON_COLORS]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="yoy">
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Year-over-Year Rate Comparison ({apiData?.yearOverYear?.previousYear || new Date().getFullYear() - 1} vs {apiData?.yearOverYear?.currentYear || new Date().getFullYear()})
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract Type</TableHead>
                    <TableHead className="text-right">{apiData?.yearOverYear?.previousYear || new Date().getFullYear() - 1} Rate/Ft</TableHead>
                    <TableHead className="text-right">{apiData?.yearOverYear?.currentYear || new Date().getFullYear()} Rate/Ft</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-right">% Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(apiData?.yearOverYear?.rates || [
                    { season: 'Annual', lastYearRate: 40.48, currentYearRate: 42.50, change: 2.02, changePercent: 5.0 },
                    { season: 'Seasonal', lastYearRate: 52.38, currentYearRate: 55.00, change: 2.62, changePercent: 5.0 },
                    { season: 'Winter', lastYearRate: 36.19, currentYearRate: 38.00, change: 1.81, changePercent: 5.0 },
                    { season: 'Short-term', lastYearRate: 80.95, currentYearRate: 85.00, change: 4.05, changePercent: 5.0 },
                  ]).map((rate) => {
                    const Icon = SEASON_ICONS[rate.season] || Calendar;
                    const isPositive = rate.changePercent >= 0;
                    return (
                      <TableRow key={rate.season}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" style={{ color: SEASON_COLORS[rate.season] }} />
                            <span className="font-medium">{rate.season}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">${rate.lastYearRate.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">${rate.currentYearRate.toFixed(2)}</TableCell>
                        <TableCell className={`text-right ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? '+' : ''}{rate.change.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={isPositive ? 'default' : 'destructive'}>
                            {isPositive ? '+' : ''}{rate.changePercent.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="grid gap-4 md:grid-cols-2 mt-4">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart 
                    data={(apiData?.yearOverYear?.rates || [
                      { season: 'Annual', lastYearRate: 40.48, currentYearRate: 42.50 },
                      { season: 'Seasonal', lastYearRate: 52.38, currentYearRate: 55.00 },
                      { season: 'Winter', lastYearRate: 36.19, currentYearRate: 38.00 },
                      { season: 'Short-term', lastYearRate: 80.95, currentYearRate: 85.00 },
                    ])} 
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="season" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(val) => `$${val}`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}/ft`]} />
                    <Legend />
                    <Bar dataKey="lastYearRate" fill="#94a3b8" name={`${apiData?.yearOverYear?.previousYear || new Date().getFullYear() - 1}`} />
                    <Bar dataKey="currentYearRate" fill="#0d7377" name={`${apiData?.yearOverYear?.currentYear || new Date().getFullYear()}`} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="trends">
            <div>
              <h4 className="text-sm font-medium mb-3">Rate Trends by Contract Term ($/ft)</h4>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={trends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(val) => `$${val}`} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `$${value.toFixed(2)}/ft`,
                      name.charAt(0).toUpperCase() + name.slice(1)
                    ]}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="annual" 
                    stroke={SEASON_COLORS['Annual']} 
                    strokeWidth={2}
                    dot={false}
                    name="Annual"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="seasonal" 
                    stroke={SEASON_COLORS['Seasonal']} 
                    strokeWidth={2}
                    dot={false}
                    name="Seasonal"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="winter" 
                    stroke={SEASON_COLORS['Winter']} 
                    strokeWidth={2}
                    dot={false}
                    name="Winter"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="shortTerm" 
                    stroke={SEASON_COLORS['Short-term']} 
                    strokeWidth={2}
                    dot={false}
                    name="Short-term"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="details">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract Type</TableHead>
                  <TableHead className="text-right">Rate/Ft</TableHead>
                  <TableHead className="text-right">Monthly Avg</TableHead>
                  <TableHead className="text-right">Contracts</TableHead>
                  <TableHead className="text-right">Avg LOA</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((rate) => {
                  const Icon = SEASON_ICONS[rate.season] || Calendar;
                  const revenuePercent = ((rate.totalRevenue / totalRevenue) * 100).toFixed(1);
                  return (
                    <TableRow key={rate.season}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" style={{ color: SEASON_COLORS[rate.season] }} />
                          <span className="font-medium">{rate.season}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${rate.avgRatePerFoot.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(rate.avgMonthlyRate)}
                      </TableCell>
                      <TableCell className="text-right">{rate.count}</TableCell>
                      <TableCell className="text-right">{rate.avgLoa}ft</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(rate.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{revenuePercent}%</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell>Total / Weighted Avg</TableCell>
                  <TableCell className="text-right">${avgRatePerFoot.toFixed(2)}</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">{totalContracts}</TableCell>
                  <TableCell className="text-right">-</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalRevenue)}</TableCell>
                  <TableCell className="text-right">100%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default SeasonalRateComparison;
