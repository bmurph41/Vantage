import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Anchor, 
  Building2, 
  MapPin, 
  BarChart3,
  Activity,
  Briefcase,
  Home,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";

interface EconomicIndicator {
  seriesId: string;
  name: string;
  category: 'population' | 'income' | 'employment' | 'housing';
  value: number | null;
  date: string | null;
  yoyChange: number | null;
  fiveYearCagr: number | null;
  dataPoints: Array<{ date: string; value: number }>;
}

interface MarketStats {
  stateCode: string;
  stateName: string;
  region: string | null;
  totalMarinas: number;
  totalWetSlips: number;
  totalDryRacks: number;
  transactionCount: number;
  avgSalePrice: number | null;
  medianSalePrice: number | null;
  avgPricePerSlip: number | null;
  medianPricePerSlip: number | null;
  avgCapRate: number | null;
  medianCapRate: number | null;
  priceGrowth1Yr: number | null;
  priceGrowth3Yr: number | null;
  priceGrowth5Yr: number | null;
  yearlyStats: Array<{
    year: number;
    txCount: number;
    avgPrice: number | null;
    avgPricePerSlip: number | null;
  }>;
}

interface DemographicsOverview {
  economicIndicators: EconomicIndicator[];
  marketStats: MarketStats;
  lastUpdated: string;
}

interface StateOption {
  code: string;
  name: string;
  hasData: boolean;
  transactionCount: number;
}

interface NationalOverview {
  totalTransactions: number;
  totalMarinas: number;
  avgPricePerSlip: number | null;
  topStates: Array<{ stateCode: string; stateName: string; transactionCount: number }>;
}

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "N/A";
  return `$${Math.round(value).toLocaleString('en-US')}`;
};

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "N/A";
  return new Intl.NumberFormat('en-US').format(Math.round(value));
};

const formatPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "N/A";
  return `${value.toFixed(2)}%`;
};

const TrendIndicator = ({ value }: { value: number | null }) => {
  if (value === null) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (value > 0) return <ArrowUpRight className="h-4 w-4 text-green-600" />;
  if (value < 0) return <ArrowDownRight className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'population': return <Users className="h-5 w-5" />;
    case 'income': return <DollarSign className="h-5 w-5" />;
    case 'employment': return <Briefcase className="h-5 w-5" />;
    case 'housing': return <Home className="h-5 w-5" />;
    default: return <Activity className="h-5 w-5" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'population': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
    case 'income': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
    case 'employment': return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
    case 'housing': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
};

export default function DemographicsIndex() {
  const [selectedState, setSelectedState] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");

  const { data: states, isLoading: statesLoading } = useQuery<StateOption[]>({
    queryKey: ['/api/demographics/states'],
  });

  const { data: nationalData, isLoading: nationalLoading } = useQuery<NationalOverview>({
    queryKey: ['/api/demographics/national'],
  });

  const { data: stateData, isLoading: stateLoading, error: stateError } = useQuery<DemographicsOverview>({
    queryKey: ['/api/demographics/overview', selectedState],
    enabled: !!selectedState,
  });

  const statesWithData = states?.filter(s => s.hasData) || [];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-demographics-title">
            Market Demographics
          </h1>
          <p className="text-muted-foreground text-sm" data-testid="text-demographics-description">
            Analyze regional economic indicators and marina market trends
          </p>
        </div>
        <div className="w-full md:w-72">
          <Select value={selectedState} onValueChange={setSelectedState}>
            <SelectTrigger data-testid="select-state-trigger">
              <SelectValue placeholder="Select a state to analyze" />
            </SelectTrigger>
            <SelectContent>
              {statesLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading states...</div>
              ) : statesWithData.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No sales data available</div>
              ) : (
                statesWithData.map(state => (
                  <SelectItem key={state.code} value={state.code} data-testid={`select-state-${state.code}`}>
                    <div className="flex items-center justify-between w-full gap-2">
                      <span>{state.name}</span>
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {state.transactionCount} comps
                      </Badge>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedState ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                National Overview
              </CardTitle>
              <CardDescription>
                Marina market summary across all states with sales data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {nationalLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : nationalData ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-primary/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Building2 className="h-4 w-4" />
                      Total Transactions
                    </div>
                    <div className="text-2xl font-bold" data-testid="text-total-transactions">
                      {formatNumber(nationalData.totalTransactions)}
                    </div>
                  </div>
                  <div className="bg-primary/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Anchor className="h-4 w-4" />
                      Marinas Tracked
                    </div>
                    <div className="text-2xl font-bold" data-testid="text-total-marinas">
                      {formatNumber(nationalData.totalMarinas)}
                    </div>
                  </div>
                  <div className="bg-primary/5 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <DollarSign className="h-4 w-4" />
                      Avg Price Per Slip
                    </div>
                    <div className="text-2xl font-bold" data-testid="text-avg-pps">
                      {formatCurrency(nationalData.avgPricePerSlip)}
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {nationalData && nationalData.topStates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Top States by Transaction Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={nationalData.topStates.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="stateCode" width={40} />
                      <Tooltip 
                        formatter={(value: number) => [value, 'Transactions']}
                        labelFormatter={(label) => {
                          const state = nationalData.topStates.find(s => s.stateCode === label);
                          return state?.stateName || label;
                        }}
                      />
                      <Bar dataKey="transactionCount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MapPin className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select a State to Explore</h3>
              <p className="text-muted-foreground text-sm text-center max-w-md">
                Choose a state from the dropdown above to view detailed economic indicators, 
                marina market statistics, and historical trends.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : stateLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : stateError ? (
        <Card className="border-destructive">
          <CardContent className="py-8 text-center">
            <p className="text-destructive">Failed to load demographics data. Please try again.</p>
          </CardContent>
        </Card>
      ) : stateData ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="economic" data-testid="tab-economic">
              <TrendingUp className="h-4 w-4 mr-2" />
              Economic Indicators
            </TabsTrigger>
            <TabsTrigger value="market" data-testid="tab-market">
              <Anchor className="h-4 w-4 mr-2" />
              Marina Market
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline" className="text-sm">
                {stateData.marketStats.stateName}
              </Badge>
              {stateData.marketStats.region && (
                <Badge variant="secondary" className="text-sm">
                  {stateData.marketStats.region} Region
                </Badge>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                Last updated: {new Date(stateData.lastUpdated).toLocaleDateString()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Marinas</p>
                      <p className="text-2xl font-bold" data-testid="text-state-marinas">
                        {formatNumber(stateData.marketStats.totalMarinas)}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Anchor className="h-6 w-6 text-blue-600 dark:text-blue-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Price/Slip</p>
                      <p className="text-2xl font-bold" data-testid="text-state-pps">
                        {formatCurrency(stateData.marketStats.avgPricePerSlip)}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <TrendIndicator value={stateData.marketStats.priceGrowth1Yr} />
                        <span className={`text-xs ${(stateData.marketStats.priceGrowth1Yr || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {stateData.marketStats.priceGrowth1Yr !== null ? `${stateData.marketStats.priceGrowth1Yr.toFixed(1)}% YoY` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-green-600 dark:text-green-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Median Cap Rate</p>
                      <p className="text-2xl font-bold" data-testid="text-state-caprate">
                        {formatPercent(stateData.marketStats.medianCapRate)}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                      <Activity className="h-6 w-6 text-amber-600 dark:text-amber-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Capacity</p>
                      <p className="text-2xl font-bold" data-testid="text-state-capacity">
                        {formatNumber(stateData.marketStats.totalWetSlips + stateData.marketStats.totalDryRacks)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(stateData.marketStats.totalWetSlips)} wet / {formatNumber(stateData.marketStats.totalDryRacks)} dry
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-purple-600 dark:text-purple-300" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {stateData.marketStats.yearlyStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Transaction History</CardTitle>
                  <CardDescription>Marina sales activity and pricing trends by year</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[...stateData.marketStats.yearlyStats].reverse()}>
                        <defs>
                          <linearGradient id="colorTxCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => formatCurrency(v)} />
                        <Tooltip 
                          formatter={(value: number, name: string) => {
                            if (name === 'txCount') return [value, 'Transactions'];
                            if (name === 'avgPricePerSlip') return [formatCurrency(value), 'Avg $/Slip'];
                            return [value, name];
                          }}
                        />
                        <Legend />
                        <Area yAxisId="left" type="monotone" dataKey="txCount" name="Transactions" stroke="hsl(var(--primary))" fill="url(#colorTxCount)" />
                        <Line yAxisId="right" type="monotone" dataKey="avgPricePerSlip" name="Avg $/Slip" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 4 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="economic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Economic Indicators for {stateData.marketStats.stateName}
                </CardTitle>
                <CardDescription>
                  Regional economic data from the Federal Reserve (FRED)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stateData.economicIndicators.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Economic data not available for this state.</p>
                    <p className="text-sm mt-2">FRED API data may be loading or unavailable.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {stateData.economicIndicators.map((indicator) => (
                      <Card key={indicator.seriesId} className="border-0 shadow-sm bg-muted/30">
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getCategoryColor(indicator.category)}`}>
                              {getCategoryIcon(indicator.category)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{indicator.name}</p>
                              <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-xl font-bold" data-testid={`text-indicator-${indicator.category}`}>
                                  {indicator.category === 'income' 
                                    ? formatCurrency(indicator.value)
                                    : indicator.category === 'employment'
                                    ? formatPercent(indicator.value)
                                    : formatNumber(indicator.value)}
                                </span>
                                {indicator.yoyChange !== null && (
                                  <div className="flex items-center gap-1">
                                    <TrendIndicator value={indicator.yoyChange} />
                                    <span className={`text-xs ${indicator.yoyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {indicator.yoyChange.toFixed(1)}%
                                    </span>
                                  </div>
                                )}
                              </div>
                              {indicator.date && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  As of {new Date(indicator.date).toLocaleDateString()}
                                </p>
                              )}
                              {indicator.fiveYearCagr !== null && (
                                <p className="text-xs text-muted-foreground">
                                  5-Year CAGR: {indicator.fiveYearCagr.toFixed(2)}%
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {stateData.economicIndicators.some(i => i.dataPoints.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Historical Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          type="category"
                          allowDuplicatedCategory={false}
                          tickFormatter={(v) => new Date(v).getFullYear().toString()}
                        />
                        <YAxis />
                        <Tooltip 
                          labelFormatter={(v) => new Date(v as string).toLocaleDateString()}
                        />
                        <Legend />
                        {stateData.economicIndicators
                          .filter(i => i.dataPoints.length > 0 && i.category !== 'population')
                          .slice(0, 3)
                          .map((indicator, idx) => (
                            <Line
                              key={indicator.seriesId}
                              data={[...indicator.dataPoints].reverse()}
                              type="monotone"
                              dataKey="value"
                              name={indicator.name.replace(stateData.marketStats.stateName + ' ', '')}
                              stroke={`hsl(var(--chart-${idx + 1}))`}
                              strokeWidth={2}
                              dot={false}
                            />
                          ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="market" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Supply Overview</CardTitle>
                  <CardDescription>Marina capacity in {stateData.marketStats.stateName}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Anchor className="h-5 w-5 text-blue-600" />
                        <span className="font-medium">Total Marinas</span>
                      </div>
                      <span className="text-xl font-bold">{formatNumber(stateData.marketStats.totalMarinas)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 rounded bg-blue-500" />
                        <span className="font-medium">Wet Slips</span>
                      </div>
                      <span className="text-xl font-bold">{formatNumber(stateData.marketStats.totalWetSlips)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-5 rounded bg-amber-500" />
                        <span className="font-medium">Dry Racks</span>
                      </div>
                      <span className="text-xl font-bold">{formatNumber(stateData.marketStats.totalDryRacks)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pricing Metrics</CardTitle>
                  <CardDescription>Average and median transaction values</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Avg Sale Price</p>
                        <p className="text-lg font-bold">{formatCurrency(stateData.marketStats.avgSalePrice)}</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Median Sale Price</p>
                        <p className="text-lg font-bold">{formatCurrency(stateData.marketStats.medianSalePrice)}</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Avg $/Slip</p>
                        <p className="text-lg font-bold">{formatCurrency(stateData.marketStats.avgPricePerSlip)}</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Median $/Slip</p>
                        <p className="text-lg font-bold">{formatCurrency(stateData.marketStats.medianPricePerSlip)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Price Growth Trends</CardTitle>
                <CardDescription>Historical price per slip appreciation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">1-Year Growth</p>
                    <div className="flex items-center justify-center gap-2">
                      <TrendIndicator value={stateData.marketStats.priceGrowth1Yr} />
                      <span className={`text-2xl font-bold ${(stateData.marketStats.priceGrowth1Yr || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {stateData.marketStats.priceGrowth1Yr !== null ? `${stateData.marketStats.priceGrowth1Yr.toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">3-Year Growth</p>
                    <div className="flex items-center justify-center gap-2">
                      <TrendIndicator value={stateData.marketStats.priceGrowth3Yr} />
                      <span className={`text-2xl font-bold ${(stateData.marketStats.priceGrowth3Yr || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {stateData.marketStats.priceGrowth3Yr !== null ? `${stateData.marketStats.priceGrowth3Yr.toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">5-Year Growth</p>
                    <div className="flex items-center justify-center gap-2">
                      <TrendIndicator value={stateData.marketStats.priceGrowth5Yr} />
                      <span className={`text-2xl font-bold ${(stateData.marketStats.priceGrowth5Yr || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {stateData.marketStats.priceGrowth5Yr !== null ? `${stateData.marketStats.priceGrowth5Yr.toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {stateData.marketStats.yearlyStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Yearly Transaction Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium">Year</th>
                          <th className="text-right py-2 px-3 font-medium">Transactions</th>
                          <th className="text-right py-2 px-3 font-medium">Avg Price</th>
                          <th className="text-right py-2 px-3 font-medium">Avg $/Slip</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stateData.marketStats.yearlyStats.slice(0, 10).map((stat) => (
                          <tr key={stat.year} className="border-b border-muted">
                            <td className="py-2 px-3 font-medium">{stat.year}</td>
                            <td className="text-right py-2 px-3">{stat.txCount}</td>
                            <td className="text-right py-2 px-3">{formatCurrency(stat.avgPrice)}</td>
                            <td className="text-right py-2 px-3">{formatCurrency(stat.avgPricePerSlip)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
