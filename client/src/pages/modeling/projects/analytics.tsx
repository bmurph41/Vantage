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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  ComposedChart,
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Percent, 
  Building2, 
  Target, 
  Activity,
  Download,
  Zap,
  BarChart3,
  Calendar,
  FileText
} from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { AnalyticsPDFDocument } from './analytics-pdf';

type AnalyticsData = {
  totalDeals: number;
  totalPurchasePrice: number;
  avgCapRate: number;
  avgEbitda: number;
  successRate: number;
  avgPricePerUnit: number;
  totalUnits: number;
  activeDealsValue: number;
  activeDealsCount: number;
  closedDealsThisMonth: number;
  dealVelocity: number;
  dealsByOutcome: Array<{ outcome: string; count: number }>;
  dealsByBroker: Array<{ 
    brokerId: string; 
    brokerName: string; 
    count: number; 
    totalValue: number;
    wonCount: number;
    lostCount: number;
    passedCount: number;
    winRate: number;
    avgDealSize: number;
  }>;
  dealsByRegion: Array<{ region: string; count: number; totalValue: number }>;
  dealsByState: Array<{ state: string; count: number; totalValue: number }>;
  dealsByMonth: Array<{ month: string; count: number; totalValue: number }>;
  capRateDistribution: Array<{ range: string; count: number }>;
  priceDistribution: Array<{ range: string; count: number }>;
};

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
};

export default function ModelingAnalytics() {
  const [filters, setFilters] = useState({
    region: '',
    state: '',
    dealOutcome: '',
    brokerId: '',
    minPrice: '',
    maxPrice: '',
    minSize: '',
    maxSize: '',
    startDate: '',
    endDate: '',
  });

  const [brokerSortField, setBrokerSortField] = useState<'count' | 'totalValue' | 'winRate' | 'avgDealSize'>('totalValue');
  const [brokerSortDirection, setBrokerSortDirection] = useState<'asc' | 'desc'>('desc');

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

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/crm/contacts'],
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

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const exportToCSV = () => {
    if (!analytics) return;

    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Deals', analytics.totalDeals.toString()],
      ['Total Purchase Price', formatCurrency(analytics.totalPurchasePrice)],
      ['Average Cap Rate', formatPercent(analytics.avgCapRate)],
      ['Average EBITDA', formatCurrency(analytics.avgEbitda)],
      ['Success Rate', formatPercent(analytics.successRate)],
      ['Average Price Per Unit', formatCurrency(analytics.avgPricePerUnit)],
      ['Total Units', analytics.totalUnits.toString()],
      ['Active Deals Value', formatCurrency(analytics.activeDealsValue)],
      ['Active Deals Count', analytics.activeDealsCount.toString()],
      ['Closed Deals This Month', analytics.closedDealsThisMonth.toString()],
      ['Deal Velocity (per month)', formatNumber(analytics.dealVelocity)],
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
      '',
      'Broker Performance',
      'Broker Name,Total Deals,Total Value,Won,Lost,Passed,Win Rate,Avg Deal Size',
      ...analytics.dealsByBroker.map(b => 
        `${b.brokerName},${b.count},${b.totalValue},${b.wonCount},${b.lostCount},${b.passedCount},${formatPercent(b.winRate)},${b.avgDealSize}`
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `modeling-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = async () => {
    if (!analytics) return;

    try {
      const doc = <AnalyticsPDFDocument analytics={analytics} filters={filters} />;
      const asPdf = pdf(doc);
      const blob = await asPdf.toBlob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `modeling-analytics-${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    }
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
    name: item.outcome.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    fill: OUTCOME_COLORS[item.outcome] || '#6b7280',
  })) || [];

  const sortedBrokerData = [...(analytics?.dealsByBroker || [])].sort((a, b) => {
    const multiplier = brokerSortDirection === 'asc' ? 1 : -1;
    return (a[brokerSortField] - b[brokerSortField]) * multiplier;
  });

  const topBrokersChartData = sortedBrokerData.slice(0, 10).map((item) => ({
    name: item.brokerName.length > 20 ? item.brokerName.substring(0, 20) + '...' : item.brokerName,
    deals: item.count,
    value: item.totalValue,
    winRate: item.winRate,
  }));

  const regionChartData = analytics?.dealsByRegion.map((item) => ({
    name: item.region,
    deals: item.count,
    value: item.totalValue,
  })) || [];

  const stateChartData = analytics?.dealsByState.slice(0, 10).map((item) => ({
    name: item.state,
    deals: item.count,
    value: item.totalValue,
  })) || [];

  const monthChartData = analytics?.dealsByMonth.map((item) => ({
    name: item.month,
    deals: item.count,
    value: item.totalValue,
  })) || [];

  const capRateChartData = analytics?.capRateDistribution || [];
  const priceChartData = analytics?.priceDistribution || [];

  const handleSort = (field: typeof brokerSortField) => {
    if (brokerSortField === field) {
      setBrokerSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setBrokerSortField(field);
      setBrokerSortDirection('desc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Filters</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={!analytics}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToPDF}
              disabled={!analytics}
              data-testid="button-export-pdf"
            >
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Date</label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              data-testid="input-filter-start-date"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">End Date</label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              data-testid="input-filter-end-date"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Broker</label>
            <Select
              value={filters.brokerId || "all"}
              onValueChange={(value) => setFilters({ ...filters, brokerId: value === "all" ? "" : value })}
            >
              <SelectTrigger data-testid="select-filter-broker">
                <SelectValue placeholder="All brokers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brokers</SelectItem>
                {contacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.firstName} {contact.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Deal Outcome</label>
            <Select
              value={filters.dealOutcome || "all"}
              onValueChange={(value) => setFilters({ ...filters, dealOutcome: value === "all" ? "" : value })}
            >
              <SelectTrigger data-testid="select-filter-outcome">
                <SelectValue placeholder="All outcomes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All outcomes</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
          <div className="space-y-2">
            <label className="text-sm font-medium">Max Size (Units)</label>
            <Input
              type="number"
              placeholder="Max storage units"
              value={filters.maxSize}
              onChange={(e) => setFilters({ ...filters, maxSize: e.target.value })}
              data-testid="input-filter-max-size"
            />
          </div>
        </div>
        <div className="mt-4">
          <Button
            variant="outline"
            onClick={() => setFilters({ 
              region: '', 
              state: '', 
              dealOutcome: '', 
              brokerId: '',
              minPrice: '', 
              maxPrice: '', 
              minSize: '', 
              maxSize: '',
              startDate: '',
              endDate: '',
            })}
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
          {/* Primary Metrics */}
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

          {/* Secondary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Price/Unit</p>
                  <p className="text-xl font-bold mt-1" data-testid="text-avg-price-per-unit">
                    {formatCurrency(analytics.avgPricePerUnit)}
                  </p>
                </div>
                <BarChart3 className="h-6 w-6 text-muted-foreground" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Deals</p>
                  <p className="text-xl font-bold mt-1" data-testid="text-active-deals">
                    {analytics.activeDealsCount}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(analytics.activeDealsValue)}
                  </p>
                </div>
                <Activity className="h-6 w-6 text-muted-foreground" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Closed This Month</p>
                  <p className="text-xl font-bold mt-1" data-testid="text-closed-this-month">
                    {analytics.closedDealsThisMonth}
                  </p>
                </div>
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Deal Velocity</p>
                  <p className="text-xl font-bold mt-1" data-testid="text-deal-velocity">
                    {formatNumber(analytics.dealVelocity)}/mo
                  </p>
                </div>
                <Zap className="h-6 w-6 text-muted-foreground" />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Units</p>
                  <p className="text-xl font-bold mt-1" data-testid="text-total-units">
                    {formatNumber(analytics.totalUnits)}
                  </p>
                </div>
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
            </Card>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Deals by Outcome */}
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

            {/* Deals Over Time */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Deals Over Time</h3>
              {monthChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={monthChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      formatter={(value, name) => {
                        if (name === 'value') return formatCurrency(value as number);
                        return value;
                      }}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="deals" fill="#3b82f6" name="Deals" />
                    <Line yAxisId="right" dataKey="value" stroke="#10b981" name="Total Value" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No time series data available
                </div>
              )}
            </Card>

            {/* Cap Rate Distribution */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Cap Rate Distribution</h3>
              {capRateChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={capRateChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#8b5cf6" name="Deals" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No cap rate data available
                </div>
              )}
            </Card>

            {/* Price Distribution */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Price Distribution</h3>
              {priceChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={priceChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#f59e0b" name="Deals" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No price data available
                </div>
              )}
            </Card>

            {/* Top Brokers by Deal Count */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Top Brokers by Deal Count</h3>
              {topBrokersChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topBrokersChartData}>
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

            {/* Broker Win Rate Comparison */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Broker Win Rate</h3>
              {topBrokersChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topBrokersChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip formatter={(value) => formatPercent(value as number)} />
                    <Legend />
                    <Bar dataKey="winRate" fill="#10b981" name="Win Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No broker win rate data available
                </div>
              )}
            </Card>

            {/* Deals by Region */}
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

            {/* Deals by State (Top 10) */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Top 10 States by Deal Count</h3>
              {stateChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stateChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="deals" fill="#ef4444" name="Deals" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No state data available
                </div>
              )}
            </Card>
          </div>

          {/* Broker Performance Table */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Broker Performance</h3>
            {sortedBrokerData.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Broker Name</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('count')}
                      >
                        Total Deals {brokerSortField === 'count' && (brokerSortDirection === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('totalValue')}
                      >
                        Total Value {brokerSortField === 'totalValue' && (brokerSortDirection === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead>Won</TableHead>
                      <TableHead>Lost</TableHead>
                      <TableHead>Passed</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('winRate')}
                      >
                        Win Rate {brokerSortField === 'winRate' && (brokerSortDirection === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('avgDealSize')}
                      >
                        Avg Deal Size {brokerSortField === 'avgDealSize' && (brokerSortDirection === 'asc' ? '↑' : '↓')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedBrokerData.map((broker) => (
                      <TableRow key={broker.brokerId}>
                        <TableCell className="font-medium">{broker.brokerName}</TableCell>
                        <TableCell>{broker.count}</TableCell>
                        <TableCell>{formatCurrency(broker.totalValue)}</TableCell>
                        <TableCell className="text-green-600">{broker.wonCount}</TableCell>
                        <TableCell className="text-red-600">{broker.lostCount}</TableCell>
                        <TableCell className="text-gray-600">{broker.passedCount}</TableCell>
                        <TableCell>{formatPercent(broker.winRate)}</TableCell>
                        <TableCell>{formatCurrency(broker.avgDealSize)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No broker performance data available
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
