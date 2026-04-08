import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, TrendingUp, TrendingDown, Minus, Calendar, DollarSign, BarChart3 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { STORAGE_TYPE_LABELS, RATE_PERIOD_LABELS, RATE_UNIT_LABELS, formatRateDisplay } from "@shared/ratecomps-utils";
import type { RateTier, RateComp } from "@shared/schema";

interface RateHistoryViewProps {
  rateCompId: string;
  marinaName: string;
}

interface RateTierWithComp extends RateTier {
  rateComp?: RateComp;
}

export default function RateHistoryView({ rateCompId, marinaName }: RateHistoryViewProps) {
  const [selectedStorageType, setSelectedStorageType] = useState<string>("all");
  const [chartView, setChartView] = useState<"line" | "bar">("line");

  const { data: tiers, isLoading } = useQuery<RateTier[]>({
    queryKey: [`/api/rate-comps/${rateCompId}/tiers`],
  });

  const historicalData = useMemo(() => {
    if (!tiers) return { byYear: [], byStorageType: {}, summary: null };

    const filtered = selectedStorageType === "all" 
      ? tiers 
      : tiers.filter(t => t.storageType === selectedStorageType);

    const byYear: Record<number, { avgRate: number; count: number; rates: number[] }> = {};
    const byStorageType: Record<string, { years: number[]; rates: number[]; avgByYear: Record<number, number> }> = {};

    filtered.forEach(tier => {
      const year = tier.rateYear || new Date().getFullYear();
      const rate = tier.amountCents ? tier.amountCents / 100 : 0;
      const storageType = tier.storageType || 'unknown';

      if (!byYear[year]) {
        byYear[year] = { avgRate: 0, count: 0, rates: [] };
      }
      byYear[year].rates.push(rate);
      byYear[year].count++;

      if (!byStorageType[storageType]) {
        byStorageType[storageType] = { years: [], rates: [], avgByYear: {} };
      }
      if (!byStorageType[storageType].avgByYear[year]) {
        byStorageType[storageType].avgByYear[year] = 0;
      }
      byStorageType[storageType].years.push(year);
      byStorageType[storageType].rates.push(rate);
    });

    Object.keys(byYear).forEach(year => {
      const y = parseInt(year);
      byYear[y].avgRate = byYear[y].rates.reduce((a, b) => a + b, 0) / byYear[y].rates.length;
    });

    Object.keys(byStorageType).forEach(type => {
      const avgByYear = byStorageType[type].avgByYear;
      const years = [...new Set(byStorageType[type].years)];
      years.forEach(year => {
        const ratesForYear = byStorageType[type].rates.filter((_, i) => byStorageType[type].years[i] === year);
        avgByYear[year] = ratesForYear.reduce((a, b) => a + b, 0) / ratesForYear.length;
      });
    });

    const sortedYears = Object.keys(byYear).map(Number).sort((a, b) => a - b);
    const chartData = sortedYears.map(year => ({
      year,
      avgRate: byYear[year].avgRate,
      count: byYear[year].count,
    }));

    let summary = null;
    if (sortedYears.length >= 2) {
      const firstYear = sortedYears[0];
      const lastYear = sortedYears[sortedYears.length - 1];
      const firstRate = byYear[firstYear].avgRate;
      const lastRate = byYear[lastYear].avgRate;
      const totalChange = lastRate - firstRate;
      const percentChange = firstRate > 0 ? ((lastRate - firstRate) / firstRate) * 100 : 0;
      const cagr = sortedYears.length > 1 && firstRate > 0
        ? (Math.pow(lastRate / firstRate, 1 / (lastYear - firstYear)) - 1) * 100
        : 0;
      summary = {
        firstYear,
        lastYear,
        firstRate,
        lastRate,
        totalChange,
        percentChange,
        cagr,
        yearSpan: lastYear - firstYear,
      };
    }

    return { byYear: chartData, byStorageType, summary };
  }, [tiers, selectedStorageType]);

  const storageTypes = useMemo(() => {
    if (!tiers) return [];
    const types = [...new Set(tiers.map(t => t.storageType).filter(Boolean))];
    return types;
  }, [tiers]);

  const yearlyChanges = useMemo(() => {
    if (historicalData.byYear.length < 2) return [];
    return historicalData.byYear.slice(1).map((item, index) => {
      const prev = historicalData.byYear[index];
      const change = item.avgRate - prev.avgRate;
      const percentChange = prev.avgRate > 0 ? (change / prev.avgRate) * 100 : 0;
      return {
        year: item.year,
        change,
        percentChange,
        prevRate: prev.avgRate,
        currentRate: item.avgRate,
      };
    });
  }, [historicalData.byYear]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tiers || tiers.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No rate tiers available for historical analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="rate-history-view">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Rate History Analysis
          </h3>
          <p className="text-sm text-muted-foreground">
            Historical rate changes for {marinaName}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedStorageType} onValueChange={setSelectedStorageType}>
            <SelectTrigger className="w-40" data-testid="select-storage-type-filter">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {storageTypes.map(type => (
                <SelectItem key={type} value={type!}>
                  {STORAGE_TYPE_LABELS[type!] || type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={chartView} onValueChange={(v: "line" | "bar") => setChartView(v)}>
            <SelectTrigger className="w-24" data-testid="select-chart-view">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="line">Line</SelectItem>
              <SelectItem value="bar">Bar</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {historicalData.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card data-testid="card-first-rate">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{historicalData.summary.firstYear} Rate</p>
              <p className="text-xl font-bold">${historicalData.summary.firstRate.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card data-testid="card-last-rate">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">{historicalData.summary.lastYear} Rate</p>
              <p className="text-xl font-bold">${historicalData.summary.lastRate.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card data-testid="card-total-change">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total Change</p>
              <div className="flex items-center gap-1">
                {historicalData.summary.totalChange > 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : historicalData.summary.totalChange < 0 ? (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )}
                <p className={`text-xl font-bold ${
                  historicalData.summary.totalChange > 0 ? 'text-green-600' : 
                  historicalData.summary.totalChange < 0 ? 'text-red-600' : ''
                }`}>
                  {historicalData.summary.totalChange > 0 ? '+' : ''}
                  ${historicalData.summary.totalChange.toFixed(2)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                ({historicalData.summary.percentChange > 0 ? '+' : ''}{historicalData.summary.percentChange.toFixed(1)}%)
              </p>
            </CardContent>
          </Card>
          <Card data-testid="card-cagr">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">CAGR ({historicalData.summary.yearSpan} yrs)</p>
              <p className={`text-xl font-bold ${
                historicalData.summary.cagr > 0 ? 'text-green-600' : 
                historicalData.summary.cagr < 0 ? 'text-red-600' : ''
              }`}>
                {historicalData.summary.cagr > 0 ? '+' : ''}{historicalData.summary.cagr.toFixed(2)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card data-testid="card-rate-chart">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Average Rate by Year
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {chartView === "line" ? (
              <LineChart data={historicalData.byYear}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="year" className="text-xs" stroke="currentColor" />
                <YAxis className="text-xs" stroke="currentColor" tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  formatter={(value: any) => [`$${value.toFixed(2)}`, 'Avg Rate']}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avgRate"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  name="Avg Rate"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            ) : (
              <BarChart data={historicalData.byYear}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="year" className="text-xs" stroke="currentColor" />
                <YAxis className="text-xs" stroke="currentColor" tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  formatter={(value: any) => [`$${value.toFixed(2)}`, 'Avg Rate']}
                />
                <Legend />
                <Bar dataKey="avgRate" fill="hsl(var(--primary))" name="Avg Rate" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {yearlyChanges.length > 0 && (
        <Card data-testid="card-yearly-changes">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Year-over-Year Changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead>Previous Rate</TableHead>
                  <TableHead>New Rate</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>% Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearlyChanges.map(change => (
                  <TableRow key={change.year} data-testid={`row-change-${change.year}`}>
                    <TableCell className="font-medium">{change.year}</TableCell>
                    <TableCell>${change.prevRate.toFixed(2)}</TableCell>
                    <TableCell>${change.currentRate.toFixed(2)}</TableCell>
                    <TableCell>
                      <span className={change.change > 0 ? 'text-green-600' : change.change < 0 ? 'text-red-600' : ''}>
                        {change.change > 0 ? '+' : ''}${change.change.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={change.percentChange > 0 ? 'default' : change.percentChange < 0 ? 'destructive' : 'secondary'}>
                        {change.percentChange > 0 ? '+' : ''}{change.percentChange.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
