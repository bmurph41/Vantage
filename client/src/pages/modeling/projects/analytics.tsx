import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, DollarSign, Percent, Building2, Target } from 'lucide-react';

type AnalyticsData = {
  totalDeals: number;
  totalPurchasePrice: number;
  avgCapRate: number;
  avgEbitda: number;
  successRate: number;
  dealsByOutcome: Array<{ outcome: string; count: number }>;
  dealsByBroker: Array<{ brokerId: string; brokerName: string; count: number; totalValue: number }>;
  dealsByRegion: Array<{ region: string; count: number; totalValue: number }>;
};

export default function ModelingAnalytics() {
  const [filters, setFilters] = useState({
    region: '',
    state: '',
    dealOutcome: '',
    minPrice: '',
    maxPrice: '',
    minSize: '',
    maxSize: '',
  });

  const queryParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) queryParams.append(key, value);
  });

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/modeling/analytics', ...Object.values(filters)],
    queryFn: async () => {
      const response = await fetch(`/api/modeling/analytics?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const OUTCOME_COLORS: Record<string, string> = {
    won: '#10b981',
    lost: '#ef4444',
    passed: '#6b7280',
    under_review: '#f59e0b',
    active: '#3b82f6',
  };

  const outcomeChartData = analytics?.dealsByOutcome.map((item) => ({
    ...item,
    name: item.outcome.replace('_', ' '),
    fill: OUTCOME_COLORS[item.outcome] || '#6b7280',
  })) || [];

  const brokerChartData = analytics?.dealsByBroker.slice(0, 10).map((item) => ({
    name: item.brokerName.length > 20 ? item.brokerName.substring(0, 20) + '...' : item.brokerName,
    deals: item.count,
    value: item.totalValue,
  })) || [];

  const regionChartData = analytics?.dealsByRegion.map((item) => ({
    name: item.region,
    deals: item.count,
    value: item.totalValue,
  })) || [];

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h3 className="font-semibold mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Region</label>
            <Input
              placeholder="e.g., Southeast"
              value={filters.region}
              onChange={(e) => setFilters({ ...filters, region: e.target.value })}
              data-testid="input-filter-region"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">State</label>
            <Input
              placeholder="e.g., FL"
              value={filters.state}
              onChange={(e) => setFilters({ ...filters, state: e.target.value })}
              data-testid="input-filter-state"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Deal Outcome</label>
            <Select
              value={filters.dealOutcome}
              onValueChange={(value) => setFilters({ ...filters, dealOutcome: value })}
            >
              <SelectTrigger data-testid="select-filter-outcome">
                <SelectValue placeholder="All outcomes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All outcomes</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Min Price</label>
            <Input
              type="number"
              placeholder="Min purchase price"
              value={filters.minPrice}
              onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
              data-testid="input-filter-min-price"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Max Price</label>
            <Input
              type="number"
              placeholder="Max purchase price"
              value={filters.maxPrice}
              onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
              data-testid="input-filter-max-price"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Min Size (Units)</label>
            <Input
              type="number"
              placeholder="Min storage units"
              value={filters.minSize}
              onChange={(e) => setFilters({ ...filters, minSize: e.target.value })}
              data-testid="input-filter-min-size"
            />
          </div>
        </div>
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={() => setFilters({ region: '', state: '', dealOutcome: '', minPrice: '', maxPrice: '', minSize: '', maxSize: '' })}
            data-testid="button-reset-filters"
          >
            Reset Filters
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading analytics...</div>
      ) : !analytics ? (
        <div className="text-center py-8 text-muted-foreground">Failed to load analytics</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Deals</p>
                  <p className="text-2xl font-bold mt-1" data-testid="text-total-deals">
                    {analytics.totalDeals}
                  </p>
                </div>
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold mt-1" data-testid="text-total-value">
                    {formatCurrency(analytics.totalPurchasePrice)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Cap Rate</p>
                  <p className="text-2xl font-bold mt-1" data-testid="text-avg-cap-rate">
                    {formatPercent(analytics.avgCapRate)}
                  </p>
                </div>
                <Percent className="h-8 w-8 text-muted-foreground" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg EBITDA</p>
                  <p className="text-2xl font-bold mt-1" data-testid="text-avg-ebitda">
                    {formatCurrency(analytics.avgEbitda)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold mt-1" data-testid="text-success-rate">
                    {formatPercent(analytics.successRate)}
                  </p>
                </div>
                <Target className="h-8 w-8 text-muted-foreground" />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Deals by Outcome</h3>
              {outcomeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={outcomeChartData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {outcomeChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No outcome data available
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Top Brokers by Deal Count</h3>
              {brokerChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={brokerChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="deals" fill="#3b82f6" name="Deals" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No broker data available
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Deals by Region</h3>
              {regionChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={regionChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="deals" fill="#10b981" name="Deals" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No region data available
                </div>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Total Value by Broker</h3>
              {brokerChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={brokerChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Legend />
                    <Bar dataKey="value" fill="#f59e0b" name="Total Value" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No broker value data available
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
