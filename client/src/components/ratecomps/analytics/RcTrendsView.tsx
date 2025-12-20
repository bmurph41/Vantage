import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Calendar, Anchor } from "lucide-react";

interface YearlyRateData {
  year: number;
  avgRatePerFt: number;
  medianRatePerFt: number;
  count: number;
}

interface BoatSizeRateData {
  loaRange: string;
  minLoa: number;
  maxLoa: number;
  avgRatePerFt: number;
  medianRatePerFt: number;
  count: number;
}

interface RcTrendsViewProps {
  yearlyData?: YearlyRateData[];
  boatSizeData?: BoatSizeRateData[];
  isLoading?: boolean;
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

function formatRatePerFt(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'N/A';
  }
  return `$${Number(value).toFixed(2)}`;
}

function calculateCAGR(data: YearlyRateData[]): number | null {
  if (data.length < 2) return null;
  const sorted = [...data].sort((a, b) => a.year - b.year);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const years = last.year - first.year;
  if (years === 0 || first.avgRatePerFt <= 0) return null;
  return (Math.pow(last.avgRatePerFt / first.avgRatePerFt, 1 / years) - 1) * 100;
}

function calculateYoYChanges(data: YearlyRateData[]): Array<{ year: number; change: number; percentChange: number }> {
  const sorted = [...data].sort((a, b) => a.year - b.year);
  return sorted.slice(1).map((item, index) => {
    const prev = sorted[index];
    const change = item.avgRatePerFt - prev.avgRatePerFt;
    const percentChange = prev.avgRatePerFt > 0 ? (change / prev.avgRatePerFt) * 100 : 0;
    return { year: item.year, change, percentChange };
  });
}

export default function RcTrendsView({ yearlyData, boatSizeData, isLoading }: RcTrendsViewProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4">
        {[1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 bg-muted rounded w-48" />
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const hasYearlyData = yearlyData && yearlyData.length > 0;
  const hasBoatSizeData = boatSizeData && boatSizeData.length > 0;

  if (!hasYearlyData && !hasBoatSizeData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <TrendingUp className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Trend Data Available</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Apply filters to see rate trends over time and by boat size.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sortedYearlyData = hasYearlyData ? [...yearlyData!].sort((a, b) => a.year - b.year) : [];
  const cagr = calculateCAGR(sortedYearlyData);
  const yoyChanges = calculateYoYChanges(sortedYearlyData);

  const sortedBoatSizeData = hasBoatSizeData 
    ? [...boatSizeData!].sort((a, b) => a.minLoa - b.minLoa) 
    : [];

  return (
    <div className="space-y-4" data-testid="trends-view">
      {hasYearlyData && (
        <>
          <Card data-testid="card-rate-trends">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Rate Trends Over Time ($/ft/month)
                </CardTitle>
                {cagr !== null && (
                  <Badge 
                    variant={cagr >= 0 ? "default" : "destructive"} 
                    className="flex items-center gap-1"
                    data-testid="badge-cagr"
                  >
                    {cagr >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    CAGR: {cagr.toFixed(1)}%
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sortedYearlyData} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="year" 
                      className="text-xs"
                      stroke="currentColor"
                    />
                    <YAxis 
                      className="text-xs"
                      stroke="currentColor"
                      tickFormatter={(value) => `$${value.toFixed(0)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                      formatter={(value: any, name: string) => {
                        if (name === 'avgRatePerFt') return [formatRatePerFt(value), 'Avg Rate/Ft'];
                        if (name === 'medianRatePerFt') return [formatRatePerFt(value), 'Median Rate/Ft'];
                        return [value, 'Count'];
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="avgRatePerFt"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      name="Avg Rate/Ft"
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="medianRatePerFt"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Median Rate/Ft"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {yoyChanges.length > 0 && (
            <Card data-testid="card-yoy-changes">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Year-over-Year Rate Changes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yoyChanges} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="year" 
                        className="text-xs"
                        stroke="currentColor"
                      />
                      <YAxis 
                        className="text-xs"
                        stroke="currentColor"
                        tickFormatter={(value) => `${value.toFixed(0)}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                        }}
                        formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'YoY Change']}
                      />
                      <Bar dataKey="percentChange" name="YoY Change">
                        {yoyChanges.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.percentChange >= 0 ? '#10b981' : '#ef4444'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {hasBoatSizeData && (
        <Card data-testid="card-boat-size-rates">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Anchor className="h-4 w-4" />
              Rates by Boat Size (LOA)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sortedBoatSizeData} margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="loaRange" 
                    className="text-xs"
                    stroke="currentColor"
                  />
                  <YAxis 
                    className="text-xs"
                    stroke="currentColor"
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === 'avgRatePerFt') return [formatRatePerFt(value), 'Avg Rate/Ft'];
                      if (name === 'medianRatePerFt') return [formatRatePerFt(value), 'Median Rate/Ft'];
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="avgRatePerFt" 
                    fill="hsl(var(--primary))" 
                    name="Avg Rate/Ft" 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="medianRatePerFt" 
                    fill="hsl(var(--muted-foreground))" 
                    name="Median Rate/Ft" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              {sortedBoatSizeData.map((item, index) => (
                <div 
                  key={item.loaRange} 
                  className="p-2 bg-muted/50 rounded-lg text-center"
                  data-testid={`stat-size-${index}`}
                >
                  <div className="text-xs text-muted-foreground">{item.loaRange}</div>
                  <div className="text-sm font-semibold">{formatRatePerFt(item.avgRatePerFt)}/ft</div>
                  <div className="text-xs text-muted-foreground">{item.count} rates</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
