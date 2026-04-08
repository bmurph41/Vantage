import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip } from "recharts";
import { formatPercent, formatNumber } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface DemographicData {
  totalPopulation?: number;
  medianHouseholdIncome?: number;
  medianHomeValue?: number;
  populationDensity?: number;
}

interface TrendDataPoint {
  year: number;
  population: number;
  medianIncome: number;
  medianHomeValue: number;
  unemploymentRate: number;
}

interface MarketTrendAnalysisProps {
  demographics: DemographicData | null;
  locationLabel?: string;
  fipsState?: string;
  fipsCounty?: string;
  latitude?: number;
  longitude?: number;
}

function calculateCAGR(startValue: number, endValue: number, years: number): number {
  if (startValue <= 0 || years <= 0) return 0;
  return Math.pow(endValue / startValue, 1 / years) - 1;
}

export default function MarketTrendAnalysis({ demographics, locationLabel, fipsState, fipsCounty, latitude, longitude }: MarketTrendAnalysisProps) {
  const [trendType, setTrendType] = useState("5-year");

  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['/api/demographics/historical-trends', latitude, longitude],
    queryFn: async () => {
      const res = await apiRequest('POST', '/api/demographics/historical-trends', { latitude, longitude });
      return res.json();
    },
    enabled: !!latitude && !!longitude,
  });

  const hasRealData = !!(trendsData?.trends && trendsData.trends.length >= 2);
  const isEstimated = !hasRealData;

  const trendData = useMemo(() => {
    if (!demographics) return [];

    const currentYear = new Date().getFullYear();

    if (hasRealData) {
      const trends: TrendDataPoint[] = trendsData.trends;
      const sorted = [...trends].sort((a, b) => a.year - b.year);

      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const years = last.year - first.year;

      const popCAGR = calculateCAGR(first.population, last.population, years);
      const incomeCAGR = calculateCAGR(first.medianIncome, last.medianIncome, years);
      const homeCAGR = calculateCAGR(first.medianHomeValue, last.medianHomeValue, years);

      const data: any[] = sorted.map(t => ({
        year: t.year.toString(),
        population: t.population,
        income: t.medianIncome,
        homeValue: t.medianHomeValue,
        isProjection: false
      }));

      for (let i = 1; i <= 3; i++) {
        const projYear = last.year + i;
        data.push({
          year: projYear.toString(),
          population: Math.round(last.population * Math.pow(1 + popCAGR, i)),
          income: Math.round(last.medianIncome * Math.pow(1 + incomeCAGR, i)),
          homeValue: Math.round(last.medianHomeValue * Math.pow(1 + homeCAGR, i)),
          isProjection: true
        });
      }

      return data;
    }

    const basePopulation = demographics.totalPopulation || 42000;
    const baseIncome = demographics.medianHouseholdIncome || 65000;
    const baseHomeValue = demographics.medianHomeValue || 450000;

    const populationGrowthRate = 0.012;
    const incomeGrowthRate = 0.025;
    const homeValueGrowthRate = 0.035;

    const historicalYears = trendType === "10-year" ? 10 : 5;

    const data = [];

    for (let i = -historicalYears; i <= 5; i++) {
      const year = currentYear + i;
      const isProjection = i > 0;

      data.push({
        year: year.toString(),
        population: Math.round(basePopulation * Math.pow(1 + populationGrowthRate, i)),
        income: Math.round(baseIncome * Math.pow(1 + incomeGrowthRate, i)),
        homeValue: Math.round(baseHomeValue * Math.pow(1 + homeValueGrowthRate, i)),
        isProjection
      });
    }

    return data;
  }, [demographics, trendType, hasRealData, trendsData]);

  const growthStats = useMemo(() => {
    if (hasRealData && trendsData?.trends?.length >= 2) {
      const sorted = [...trendsData.trends].sort((a: TrendDataPoint, b: TrendDataPoint) => a.year - b.year);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      return {
        population: ((last.population - first.population) / first.population * 100),
        income: ((last.medianIncome - first.medianIncome) / first.medianIncome * 100),
        homeValue: ((last.medianHomeValue - first.medianHomeValue) / first.medianHomeValue * 100)
      };
    }

    const currentYear = new Date().getFullYear();
    const currentData = trendData.find(d => d.year === currentYear.toString());
    const years = trendType === "10-year" ? 10 : 5;
    const pastData = trendData.find(d => d.year === (currentYear - years).toString());

    if (!currentData || !pastData) return { population: 0, income: 0, homeValue: 0 };

    return {
      population: ((currentData.population - pastData.population) / pastData.population * 100),
      income: ((currentData.income - pastData.income) / pastData.income * 100),
      homeValue: ((currentData.homeValue - pastData.homeValue) / pastData.homeValue * 100)
    };
  }, [trendData, trendType, hasRealData, trendsData]);

  const getChartData = () => {
    switch (trendType) {
      case "population-growth":
        return {
          data: trendData,
          dataKey: "population",
          color: "#3b82f6",
          label: "Population",
          formatValue: (value: number) => value.toLocaleString()
        };
      case "income-growth":
        return {
          data: trendData,
          dataKey: "income",
          color: "#10b981",
          label: "Median Income",
          formatValue: (value: number) => `$${(value / 1000).toFixed(0)}k`
        };
      default:
        return {
          data: trendData,
          dataKey: "homeValue",
          color: "#f59e0b",
          label: "Home Value",
          formatValue: (value: number) => `$${(value / 1000).toFixed(0)}k`
        };
    }
  };

  const chartData = getChartData();
  const currentYear = new Date().getFullYear();

  if (!demographics) {
    return (
      <Card data-testid="card-market-trends-empty">
        <CardHeader>
          <h3 className="text-base font-semibold text-foreground">Market Trend Analysis</h3>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <TrendingUp className="mx-auto h-12 w-12 mb-4" />
            <p>Select a location to view market trend analysis</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-market-trends">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">
                Market Trend Analysis
              </h3>
              {trendsData?.geographicLevel && trendsData.geographicLevel !== 'unknown' && (
                <Badge variant="outline" className="text-[10px] capitalize">
                  {trendsData.geographicLevel === 'tract' ? 'Census Tract' : trendsData.geographicLevel}
                </Badge>
              )}
              {isEstimated && (
                <Badge variant="secondary" className="text-[10px]">Estimated</Badge>
              )}
            </div>
            {locationLabel && (
              <p className="text-xs text-muted-foreground mt-0.5">{locationLabel}</p>
            )}
          </div>
          <Select value={trendType} onValueChange={setTrendType} data-testid="select-trend-type">
            <SelectTrigger className="w-36 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {hasRealData ? (
                <>
                  <SelectItem value="5-year">Census Trends</SelectItem>
                  <SelectItem value="population-growth">Population</SelectItem>
                  <SelectItem value="income-growth">Income</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="5-year">5 Year Trend</SelectItem>
                  <SelectItem value="10-year">10 Year Trend</SelectItem>
                  <SelectItem value="population-growth">Population</SelectItem>
                  <SelectItem value="income-growth">Income</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* CAGR summary cards */}
        {trendsData?.cagr && (trendsData.cagr.population !== 0 || trendsData.cagr.income !== 0 || trendsData.cagr.homeValue !== 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {[
              { label: "Population CAGR", value: trendsData.cagr.population, color: "text-blue-600" },
              { label: "Income CAGR", value: trendsData.cagr.income, color: "text-green-600" },
              { label: "Home Value CAGR", value: trendsData.cagr.homeValue, color: "text-amber-600" },
            ].map((item) => (
              <div key={item.label} className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{item.label}</div>
                <div className={`text-lg font-bold ${item.value > 0 ? item.color : item.value < 0 ? 'text-red-600' : 'text-muted-foreground'} flex items-center justify-center gap-1`}>
                  {item.value > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : item.value < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                  {item.value > 0 ? '+' : ''}{item.value.toFixed(1)}%
                </div>
                <div className="text-[10px] text-muted-foreground">5-Year</div>
              </div>
            ))}
          </div>
        )}

        <div className="h-64 mb-4" data-testid="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData.data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <XAxis
                dataKey="year"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickFormatter={chartData.formatValue}
                width={60}
              />
              <Tooltip
                formatter={(value: number) => [chartData.formatValue(value), chartData.label]}
                labelFormatter={(label) => `Year: ${label}`}
                contentStyle={{
                  backgroundColor: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '12px'
                }}
              />
              <ReferenceLine
                x={currentYear.toString()}
                stroke="#ef4444"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <Line
                type="monotone"
                dataKey={chartData.dataKey}
                stroke={chartData.color}
                strokeWidth={2}
                dot={(props: any) => {
                  const dataPoint = chartData.data[props.index];
                  const isProjection = dataPoint?.isProjection;
                  return (
                    <circle
                      key={props.index}
                      cx={props.cx}
                      cy={props.cy}
                      r={isProjection ? 3 : 4}
                      fill={isProjection ? "transparent" : chartData.color}
                      stroke={chartData.color}
                      strokeWidth={2}
                      strokeDasharray={isProjection ? "2 2" : "0"}
                    />
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <div className="w-4 h-0.5" style={{ backgroundColor: chartData.color }}></div>
            <span>Historical</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-0.5 border-t-2 border-dashed" style={{ borderColor: chartData.color }}></div>
            <span>Projected</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-0.5 border-t border-dashed border-red-500"></div>
            <span>Today</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="text-center p-3 bg-muted/50 rounded-lg" data-testid="stat-population-growth">
            <p className="text-xs text-muted-foreground">
              {hasRealData ? "" : (trendType === "10-year" ? "10" : "5") + "-Yr "}Pop. Growth
            </p>
            <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              +{formatPercent(growthStats.population)}
            </p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg" data-testid="stat-income-growth">
            <p className="text-xs text-muted-foreground">Income Growth</p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
              +{formatPercent(growthStats.income)}
            </p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg" data-testid="stat-home-value-appreciation">
            <p className="text-xs text-muted-foreground">Home Appreciation</p>
            <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">
              +{formatPercent(growthStats.homeValue)}
            </p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-accent/10 rounded-lg">
          <h4 className="font-medium text-xs mb-2">Projections & Insights</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Population density: {demographics.populationDensity ? formatNumber(demographics.populationDensity) : 'N/A'} per sq mi</p>
            <p>• Historical trends show {growthStats.income > 15 ? "strong" : "steady"} income growth</p>
            <p>• Projections based on {hasRealData ? "real historical" : (trendType === "10-year" ? "10" : "5") + "-year"} CAGR</p>
            {isEstimated && (
              <p className="text-xs italic text-muted-foreground/70">Note: Using estimated data. Add coordinates for real Census trends.</p>
            )}
            <p className="text-xs italic text-muted-foreground/70">Note: Dashed lines indicate estimates</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
