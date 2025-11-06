import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, DollarSign, BarChart3, Map, Calendar, Lightbulb, Download } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface AnalyticsFilters {
  states?: string[];
  yearSoldMin?: number;
  yearSoldMax?: number;
  priceMin?: number;
  priceMax?: number;
  pricePerSlipMin?: number;
  pricePerSlipMax?: number;
  waterTypes?: string[];
  capacityMin?: number;
  capacityMax?: number;
}

interface MetricResult {
  metric: string;
  value: number;
  sampleSize: number;
  groupValue?: string;
}

interface ComparativeAnalysis {
  overall: {
    count: number;
    avgPrice: number;
    medianPrice: number;
    avgPricePerSlip: number;
    medianPricePerSlip: number;
    avgCapRate: number;
    medianCapRate: number;
    avgCapacity: number;
    totalValue: number;
  };
  byState?: Record<string, MetricResult[]>;
  byYear?: Record<string, MetricResult[]>;
  byWaterType?: Record<string, MetricResult[]>;
  byPriceRange?: Record<string, MetricResult[]>;
  trends?: {
    priceOverTime: Array<{ year: number; avgPrice: number; count: number }>;
    capRateOverTime: Array<{ year: number; avgCapRate: number; count: number }>;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D'];

export default function AnalyticsIndex() {
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [selectedState, setSelectedState] = useState<string[]>([]);
  const [selectedWaterType, setSelectedWaterType] = useState<string[]>([]);

  const { data, isLoading, refetch } = useQuery<{ analysis: ComparativeAnalysis; insights: string[] }>({
    queryKey: ['/api/analytics/calculate', filters],
    enabled: false,
  });

  const handleCalculate = () => {
    refetch();
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Sales Comps Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Deep-dive comparative analysis with statistical insights
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCalculate} data-testid="button-calculate-analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Calculate Metrics
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter sales comps by state, price, year, and other criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Year Sold (Min)</Label>
              <Input
                type="number"
                placeholder="2010"
                value={filters.yearSoldMin || ''}
                onChange={(e) => setFilters({ ...filters, yearSoldMin: e.target.value ? parseInt(e.target.value) : undefined })}
                data-testid="input-year-min"
              />
            </div>
            <div className="space-y-2">
              <Label>Year Sold (Max)</Label>
              <Input
                type="number"
                placeholder="2025"
                value={filters.yearSoldMax || ''}
                onChange={(e) => setFilters({ ...filters, yearSoldMax: e.target.value ? parseInt(e.target.value) : undefined })}
                data-testid="input-year-max"
              />
            </div>
            <div className="space-y-2">
              <Label>Price Min ($)</Label>
              <Input
                type="number"
                placeholder="1000000"
                value={filters.priceMin || ''}
                onChange={(e) => setFilters({ ...filters, priceMin: e.target.value ? parseFloat(e.target.value) : undefined })}
                data-testid="input-price-min"
              />
            </div>
            <div className="space-y-2">
              <Label>Price Max ($)</Label>
              <Input
                type="number"
                placeholder="10000000"
                value={filters.priceMax || ''}
                onChange={(e) => setFilters({ ...filters, priceMax: e.target.value ? parseFloat(e.target.value) : undefined })}
                data-testid="input-price-max"
              />
            </div>
            <div className="space-y-2">
              <Label>Price/Slip Min ($)</Label>
              <Input
                type="number"
                placeholder="10000"
                value={filters.pricePerSlipMin || ''}
                onChange={(e) => setFilters({ ...filters, pricePerSlipMin: e.target.value ? parseFloat(e.target.value) : undefined })}
                data-testid="input-price-per-slip-min"
              />
            </div>
            <div className="space-y-2">
              <Label>Price/Slip Max ($)</Label>
              <Input
                type="number"
                placeholder="50000"
                value={filters.pricePerSlipMax || ''}
                onChange={(e) => setFilters({ ...filters, pricePerSlipMax: e.target.value ? parseFloat(e.target.value) : undefined })}
                data-testid="input-price-per-slip-max"
              />
            </div>
            <div className="space-y-2">
              <Label>Capacity Min (slips)</Label>
              <Input
                type="number"
                placeholder="50"
                value={filters.capacityMin || ''}
                onChange={(e) => setFilters({ ...filters, capacityMin: e.target.value ? parseInt(e.target.value) : undefined })}
                data-testid="input-capacity-min"
              />
            </div>
            <div className="space-y-2">
              <Label>Capacity Max (slips)</Label>
              <Input
                type="number"
                placeholder="500"
                value={filters.capacityMax || ''}
                onChange={(e) => setFilters({ ...filters, capacityMax: e.target.value ? parseInt(e.target.value) : undefined })}
                data-testid="input-capacity-max"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results */}
      {data && !isLoading && (
        <>
          {/* Key Insights */}
          {data.insights && data.insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Key Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {data.insights.map((insight, idx) => (
                    <li key={idx} className="flex items-start gap-2" data-testid={`insight-${idx}`}>
                      <span className="text-primary mt-1">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Overall Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Comps</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="metric-total-count">
                  {data.analysis.overall.count.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Sale Price</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="metric-avg-price">
                  {formatCurrency(data.analysis.overall.avgPrice)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Median: {formatCurrency(data.analysis.overall.medianPrice)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Price/Slip</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="metric-avg-price-per-slip">
                  {formatCurrency(data.analysis.overall.avgPricePerSlip)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Median: {formatCurrency(data.analysis.overall.medianPricePerSlip)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Cap Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="metric-avg-cap-rate">
                  {formatPercent(data.analysis.overall.avgCapRate)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Median: {formatPercent(data.analysis.overall.medianCapRate)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Price Trends Over Time */}
            {data.analysis.trends && data.analysis.trends.priceOverTime.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Price Trends Over Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data.analysis.trends.priceOverTime}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Line type="monotone" dataKey="avgPrice" stroke="#8884d8" name="Avg Price" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Cap Rate Trends */}
            {data.analysis.trends && data.analysis.trends.capRateOverTime.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Cap Rate Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data.analysis.trends.capRateOverTime}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis tickFormatter={(value) => formatPercent(value)} />
                      <Tooltip formatter={(value: number) => formatPercent(value)} />
                      <Legend />
                      <Line type="monotone" dataKey="avgCapRate" stroke="#82ca9d" name="Avg Cap Rate" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* By State */}
            {data.analysis.byState && Object.keys(data.analysis.byState).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Map className="h-5 w-5" />
                    Average Price by State
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={Object.entries(data.analysis.byState).map(([state, metrics]) => ({
                        state,
                        avgPrice: metrics.find(m => m.metric === 'avgPrice')?.value || 0,
                        count: metrics.find(m => m.metric === 'count')?.value || 0,
                      })).sort((a, b) => b.avgPrice - a.avgPrice).slice(0, 10)}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="state" />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="avgPrice" fill="#8884d8" name="Avg Price" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* By Water Type */}
            {data.analysis.byWaterType && Object.keys(data.analysis.byWaterType).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Distribution by Water Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={Object.entries(data.analysis.byWaterType).map(([type, metrics]) => ({
                          name: type,
                          value: metrics.find(m => m.metric === 'count')?.value || 0,
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {Object.keys(data.analysis.byWaterType).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* By Price Range */}
            {data.analysis.byPriceRange && Object.keys(data.analysis.byPriceRange).length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Metrics by Price Range</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={Object.entries(data.analysis.byPriceRange).map(([range, metrics]) => ({
                        range,
                        count: metrics.find(m => m.metric === 'count')?.value || 0,
                        avgPricePerSlip: metrics.find(m => m.metric === 'avgPricePerSlip')?.value || 0,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis yAxisId="left" tickFormatter={(value) => value.toLocaleString()} />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Count" />
                      <Bar yAxisId="right" dataKey="avgPricePerSlip" fill="#82ca9d" name="Avg Price/Slip" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Empty State */}
      {!data && !isLoading && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Analytics Data</h3>
              <p className="text-muted-foreground mb-4">
                Click "Calculate Metrics" to generate comparative analytics for your sales comps
              </p>
              <Button onClick={handleCalculate} data-testid="button-calculate-empty">
                Calculate Metrics
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
