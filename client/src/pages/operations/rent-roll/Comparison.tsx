import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, BarChart3, Building2, Calendar, Filter, ArrowRight, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from "recharts";

type RentRoll = {
  id: string;
  name: string;
  propertyId: string;
  effectiveDate: string;
  context: string;
};

type TimeSeriesPoint = {
  period: string;
  month: number;
  year: number;
  grossPotentialRent: number;
  occupiedRevenue: number;
  vacancyLoss: number;
  occupancyRate: number;
  unitCount: number;
  occupiedUnits: number;
};

type PortfolioAggregation = {
  totalGrossPotential: number;
  totalOccupiedRevenue: number;
  totalVacancyLoss: number;
  averageOccupancy: number;
  totalUnits: number;
  totalOccupiedUnits: number;
  marinaCount: number;
  byMarina: {
    marinaId: string;
    marinaName: string;
    grossPotential: number;
    occupiedRevenue: number;
    vacancyLoss: number;
    occupancyRate: number;
    unitCount: number;
  }[];
  byCategory: {
    category: string;
    grossPotential: number;
    occupiedRevenue: number;
    vacancyLoss: number;
  }[];
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function ChangeIndicator({ value, isPercent = false }: { value: number; isPercent?: boolean }) {
  if (value === 0) {
    return <span className="text-muted-foreground flex items-center gap-1"><Minus className="h-3 w-3" /> 0%</span>;
  }
  const isPositive = value > 0;
  const Icon = isPositive ? ArrowUp : ArrowDown;
  const colorClass = isPositive ? "text-green-600" : "text-red-600";
  return (
    <span className={`flex items-center gap-1 ${colorClass}`} data-testid="change-indicator">
      <Icon className="h-3 w-3" />
      {isPercent ? formatPercent(Math.abs(value)) : `${Math.abs(value).toFixed(1)}%`}
    </span>
  );
}

function TimeSeriesChart({ data }: { data: TimeSeriesPoint[] }) {
  const chartData = useMemo(() => {
    return data.map(point => ({
      name: `${point.month}/${point.year}`,
      grossPotential: point.grossPotentialRent / 1000,
      occupiedRevenue: point.occupiedRevenue / 1000,
      occupancy: (point.occupancyRate * 100),
    }));
  }, [data]);

  return (
    <Card data-testid="card-time-series-chart">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Revenue Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis 
                yAxisId="left" 
                tick={{ fontSize: 12 }} 
                tickFormatter={(v) => `$${v}K`}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                tick={{ fontSize: 12 }} 
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
              />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  if (name === 'occupancy') return [`${value.toFixed(1)}%`, 'Occupancy'];
                  return [`$${value.toFixed(1)}K`, name === 'grossPotential' ? 'Gross Potential' : 'Occupied Revenue'];
                }}
              />
              <Legend />
              <Line 
                yAxisId="left" 
                type="monotone" 
                dataKey="grossPotential" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Gross Potential ($K)"
              />
              <Line 
                yAxisId="left" 
                type="monotone" 
                dataKey="occupiedRevenue" 
                stroke="#22c55e" 
                strokeWidth={2}
                name="Occupied Revenue ($K)"
              />
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="occupancy" 
                stroke="#f59e0b" 
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Occupancy %"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function PortfolioSummaryCards({ aggregation }: { aggregation: PortfolioAggregation }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="portfolio-summary-cards">
      <Card data-testid="card-total-gross-potential">
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground mb-1">Total Gross Potential</div>
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(aggregation.totalGrossPotential)}</div>
          <div className="text-xs text-muted-foreground mt-1">{aggregation.totalUnits} units across {aggregation.marinaCount} marinas</div>
        </CardContent>
      </Card>
      <Card data-testid="card-total-occupied-revenue">
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground mb-1">Occupied Revenue</div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(aggregation.totalOccupiedRevenue)}</div>
          <div className="text-xs text-muted-foreground mt-1">{aggregation.totalOccupiedUnits} units occupied</div>
        </CardContent>
      </Card>
      <Card data-testid="card-vacancy-loss">
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground mb-1">Vacancy Loss</div>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(aggregation.totalVacancyLoss)}</div>
          <div className="text-xs text-muted-foreground mt-1">{aggregation.totalUnits - aggregation.totalOccupiedUnits} vacant units</div>
        </CardContent>
      </Card>
      <Card data-testid="card-avg-occupancy">
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground mb-1">Avg Occupancy</div>
          <div className="text-2xl font-bold">{formatPercent(aggregation.averageOccupancy)}</div>
          <div className="text-xs text-muted-foreground mt-1">Portfolio-wide</div>
        </CardContent>
      </Card>
    </div>
  );
}

function MarinaComparisonTable({ data }: { data: PortfolioAggregation['byMarina'] }) {
  return (
    <Card data-testid="card-marina-comparison">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Marina Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marina</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead className="text-right">Gross Potential</TableHead>
              <TableHead className="text-right">Occupied Revenue</TableHead>
              <TableHead className="text-right">Vacancy Loss</TableHead>
              <TableHead className="text-right">Occupancy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((marina) => (
              <TableRow key={marina.marinaId} data-testid={`row-marina-${marina.marinaId}`}>
                <TableCell className="font-medium">{marina.marinaName}</TableCell>
                <TableCell className="text-right">{marina.unitCount}</TableCell>
                <TableCell className="text-right text-blue-600">{formatCurrency(marina.grossPotential)}</TableCell>
                <TableCell className="text-right text-green-600">{formatCurrency(marina.occupiedRevenue)}</TableCell>
                <TableCell className="text-right text-red-600">{formatCurrency(marina.vacancyLoss)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant={marina.occupancyRate >= 0.9 ? "default" : marina.occupancyRate >= 0.7 ? "secondary" : "destructive"}>
                    {formatPercent(marina.occupancyRate)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CategoryBreakdownChart({ data }: { data: PortfolioAggregation['byCategory'] }) {
  const chartData = useMemo(() => {
    return data.map(cat => ({
      name: cat.category,
      grossPotential: cat.grossPotential / 1000,
      occupiedRevenue: cat.occupiedRevenue / 1000,
    }));
  }, [data]);

  return (
    <Card data-testid="card-category-breakdown">
      <CardHeader>
        <CardTitle>Revenue by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => `$${v}K`} tick={{ fontSize: 12 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
              <Tooltip formatter={(value: number) => `$${value.toFixed(1)}K`} />
              <Legend />
              <Bar dataKey="grossPotential" fill="#3b82f6" name="Gross Potential" />
              <Bar dataKey="occupiedRevenue" fill="#22c55e" name="Occupied Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function SingleRentRollView({ rentRollId }: { rentRollId: string }) {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  
  const { data: timeSeries, isLoading } = useQuery<TimeSeriesPoint[]>({
    queryKey: ["/api/operations/rent-rolls", rentRollId, "time-series", {
      startYear: startDate.getFullYear(),
      startMonth: startDate.getMonth() + 1,
      endYear: now.getFullYear(),
      endMonth: now.getMonth() + 1,
    }],
    queryFn: async () => {
      const params = new URLSearchParams({
        startYear: startDate.getFullYear().toString(),
        startMonth: (startDate.getMonth() + 1).toString(),
        endYear: now.getFullYear().toString(),
        endMonth: (now.getMonth() + 1).toString(),
      });
      const res = await fetch(`/api/operations/rent-rolls/${rentRollId}/time-series?${params}`);
      if (!res.ok) throw new Error("Failed to fetch time series");
      return res.json();
    },
  });

  if (isLoading) {
    return <Skeleton className="h-[400px]" />;
  }

  if (!timeSeries || timeSeries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No time series data available for this rent roll</p>
        </CardContent>
      </Card>
    );
  }

  return <TimeSeriesChart data={timeSeries} />;
}

function PortfolioView() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [sameStoreOnly, setSameStoreOnly] = useState(false);

  const years = [now.getFullYear() - 1, now.getFullYear()];
  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const { data: aggregation, isLoading } = useQuery<PortfolioAggregation>({
    queryKey: ["/api/operations/rent-roll-snapshots/portfolio", { year: selectedYear, month: selectedMonth }],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: selectedYear.toString(),
        month: selectedMonth.toString(),
      });
      const res = await fetch(`/api/operations/rent-roll-snapshots/portfolio?${params}`);
      if (!res.ok) throw new Error("Failed to fetch portfolio aggregation");
      return res.json();
    },
  });

  const { data: prevAggregation } = useQuery<PortfolioAggregation>({
    queryKey: ["/api/operations/rent-roll-snapshots/portfolio", { 
      year: selectedMonth === 1 ? selectedYear - 1 : selectedYear, 
      month: selectedMonth === 1 ? 12 : selectedMonth - 1 
    }],
    queryFn: async () => {
      const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
      const params = new URLSearchParams({
        year: prevYear.toString(),
        month: prevMonth.toString(),
      });
      const res = await fetch(`/api/operations/rent-roll-snapshots/portfolio?${params}`);
      if (!res.ok) throw new Error("Failed to fetch previous period");
      return res.json();
    },
  });

  const filteredByMarina = useMemo(() => {
    if (!aggregation?.byMarina) return [];
    if (!sameStoreOnly || !prevAggregation?.byMarina) return aggregation.byMarina;
    const prevMarinaIds = new Set(prevAggregation.byMarina.map(m => m.marinaId));
    return aggregation.byMarina.filter(m => prevMarinaIds.has(m.marinaId));
  }, [aggregation?.byMarina, prevAggregation?.byMarina, sameStoreOnly]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if (!aggregation) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No rent roll data available for the selected period</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-[130px]" data-testid="select-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]" data-testid="select-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="same-store"
              checked={sameStoreOnly}
              onCheckedChange={setSameStoreOnly}
              data-testid="switch-same-store"
            />
            <Label htmlFor="same-store" className="text-sm">Same-Store Only</Label>
          </div>
        </div>
      </div>

      <PortfolioSummaryCards aggregation={aggregation} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MarinaComparisonTable data={filteredByMarina} />
        {aggregation.byCategory && aggregation.byCategory.length > 0 && (
          <CategoryBreakdownChart data={aggregation.byCategory} />
        )}
      </div>
    </div>
  );
}

export default function RentRollComparison() {
  const [viewMode, setViewMode] = useState<"portfolio" | "single">("portfolio");
  const [selectedRentRollId, setSelectedRentRollId] = useState<string>("");

  const { data: rentRolls } = useQuery<RentRoll[]>({
    queryKey: ["/api/operations/rent-rolls"],
  });

  const operationalRentRolls = useMemo(() => {
    return rentRolls?.filter(r => r.context === 'operational') || [];
  }, [rentRolls]);

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-rent-roll-comparison">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="heading-rent-roll-comparison">
            Rent Roll Comparison
          </h1>
          <p className="text-muted-foreground">
            Analyze rent roll performance with time-series trends and portfolio aggregation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "portfolio" ? "default" : "outline"}
            onClick={() => setViewMode("portfolio")}
            data-testid="btn-view-portfolio"
          >
            <Building2 className="h-4 w-4 mr-1" />
            Portfolio
          </Button>
          <Button
            variant={viewMode === "single" ? "default" : "outline"}
            onClick={() => setViewMode("single")}
            data-testid="btn-view-single"
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            Single Rent Roll
          </Button>
        </div>
      </div>

      {viewMode === "single" && (
        <div className="flex items-center gap-4">
          <Label>Select Rent Roll</Label>
          <Select value={selectedRentRollId} onValueChange={setSelectedRentRollId}>
            <SelectTrigger className="w-[300px]" data-testid="select-rent-roll">
              <SelectValue placeholder="Choose a rent roll..." />
            </SelectTrigger>
            <SelectContent>
              {operationalRentRolls.map((rr) => (
                <SelectItem key={rr.id} value={rr.id}>
                  {rr.name} ({new Date(rr.effectiveDate).toLocaleDateString()})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {viewMode === "portfolio" ? (
        <PortfolioView />
      ) : selectedRentRollId ? (
        <SingleRentRollView rentRollId={selectedRentRollId} />
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Select a rent roll to view its time-series data</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
