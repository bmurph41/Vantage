import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  Legend,
  Cell,
} from 'recharts';
import { DollarSign, TrendingUp, Percent, BarChart3 } from 'lucide-react';

interface FundReturnsMetrics {
  irr: number | null;
  moic: number | null;
  roi: number | null;
  cumulativeOperatingCF: number | null;
  endingMarketValue: number | null;
  endingEquityValue: number | null;
}

interface Attribution {
  operatingCFContribution: number;
  capexDrag: number;
  feesDrag: number;
  appreciation: number;
  debtPaydownBenefit: number;
  refiProceeds: number;
}

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface DealReturn {
  modelId: string;
  propertyId: string;
  metrics: {
    irr: number | null;
    moic: number | null;
    roi: number | null;
  };
}

interface FundReturnsData {
  aggregate: {
    metrics: FundReturnsMetrics;
    attribution: Attribution;
    cumulativeSeries: {
      cashIn: TimeSeriesPoint[];
      cashOut: TimeSeriesPoint[];
      netPosition: TimeSeriesPoint[];
    };
    valueSeries: {
      marketValue: TimeSeriesPoint[];
      equityValue: TimeSeriesPoint[];
      loanBalance: TimeSeriesPoint[];
    };
    cashflowsByBucket: Record<string, number>;
    ledgerEntries: any[];
  };
  byDeal: DealReturn[];
}

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtPct = (v: number | null) => v == null ? '-' : `${(v * 100).toFixed(2)}%`;
const fmtMultiple = (v: number | null) => v == null ? '-' : `${v.toFixed(2)}x`;
const fmtCurrency = (v: number | null) => v == null ? '-' : fmt.format(v);

const CHART_COLORS = {
  cashIn: '#10b981',
  cashOut: '#ef4444',
  netPosition: '#3b82f6',
  marketValue: '#8b5cf6',
  equityValue: '#10b981',
  loanBalance: '#f59e0b',
};

function KpiCard({ title, value, icon: Icon }: { title: string; value: string; icon: any }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-32" /></CardContent>
          </Card>
        ))}
      </div>
      <Card><CardContent className="pt-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
      <Card><CardContent className="pt-6"><Skeleton className="h-[300px] w-full" /></CardContent></Card>
    </div>
  );
}

export default function FundReturns({ fundId }: { fundId: string }) {
  const { data, isLoading, error } = useQuery<FundReturnsData>({
    queryKey: [`/api/returns/fund/${fundId}`],
    enabled: !!fundId,
  });

  if (isLoading) return <LoadingSkeleton />;

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            Failed to load fund returns data. {(error as Error).message}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            No returns data available for this fund. Add deal allocations and ledger entries to see returns.
          </div>
        </CardContent>
      </Card>
    );
  }

  const { aggregate, byDeal } = data;
  const { metrics, attribution, cumulativeSeries, valueSeries, cashflowsByBucket } = aggregate;

  // Build attribution chart data
  const attributionData = [
    { name: 'Operating CF', value: attribution.operatingCFContribution, fill: '#10b981' },
    { name: 'Appreciation', value: attribution.appreciation, fill: '#3b82f6' },
    { name: 'Debt Paydown', value: attribution.debtPaydownBenefit, fill: '#8b5cf6' },
    { name: 'Refi Proceeds', value: attribution.refiProceeds, fill: '#06b6d4' },
    { name: 'CapEx Drag', value: attribution.capexDrag, fill: '#ef4444' },
    { name: 'Fees Drag', value: attribution.feesDrag, fill: '#f59e0b' },
  ];

  // Build cumulative cash flow series
  const allDates = new Set<string>();
  cumulativeSeries.cashIn?.forEach(p => allDates.add(p.date));
  cumulativeSeries.cashOut?.forEach(p => allDates.add(p.date));
  cumulativeSeries.netPosition?.forEach(p => allDates.add(p.date));

  const cashInMap = new Map(cumulativeSeries.cashIn?.map(p => [p.date, p.value]) || []);
  const cashOutMap = new Map(cumulativeSeries.cashOut?.map(p => [p.date, p.value]) || []);
  const netPosMap = new Map(cumulativeSeries.netPosition?.map(p => [p.date, p.value]) || []);

  const cfSeriesData = Array.from(allDates).sort().map(date => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    cashIn: cashInMap.get(date) || 0,
    cashOut: cashOutMap.get(date) || 0,
    netPosition: netPosMap.get(date) || 0,
  }));

  // Build value series
  const valDates = new Set<string>();
  valueSeries.marketValue?.forEach(p => valDates.add(p.date));
  valueSeries.equityValue?.forEach(p => valDates.add(p.date));
  valueSeries.loanBalance?.forEach(p => valDates.add(p.date));

  const mvMap = new Map(valueSeries.marketValue?.map(p => [p.date, p.value]) || []);
  const evMap = new Map(valueSeries.equityValue?.map(p => [p.date, p.value]) || []);
  const lbMap = new Map(valueSeries.loanBalance?.map(p => [p.date, p.value]) || []);

  const valueSeriesData = Array.from(valDates).sort().map(date => ({
    date: new Date(date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    marketValue: mvMap.get(date) || 0,
    equityValue: evMap.get(date) || 0,
    loanBalance: lbMap.get(date) || 0,
  }));

  // Build cashflows by bucket
  const bucketEntries = Object.entries(cashflowsByBucket || {}).map(([bucket, amount]) => ({
    bucket: bucket.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    amount: amount as number,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="IRR" value={fmtPct(metrics.irr)} icon={Percent} />
        <KpiCard title="MOIC" value={fmtMultiple(metrics.moic)} icon={TrendingUp} />
        <KpiCard title="ROI" value={fmtPct(metrics.roi)} icon={BarChart3} />
        <KpiCard title="Ending Equity Value" value={fmtCurrency(metrics.endingEquityValue)} icon={DollarSign} />
      </div>

      {/* Attribution Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Return Attribution</CardTitle>
          <CardDescription>Contribution of each component to total returns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attributionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => fmt.format(v)} />
                <YAxis type="category" dataKey="name" width={120} />
                <Tooltip formatter={(value: number) => fmt.format(value)} />
                <Bar dataKey="value" name="Amount">
                  {attributionData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Cumulative Cash Flow Area Chart */}
      {cfSeriesData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cumulative Cash Flows</CardTitle>
            <CardDescription>Cash in, cash out, and net position over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cfSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(v) => fmt.format(v)} />
                  <Tooltip formatter={(value: number) => fmt.format(value)} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="cashIn"
                    stroke={CHART_COLORS.cashIn}
                    fill={CHART_COLORS.cashIn}
                    fillOpacity={0.2}
                    name="Cash In"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="cashOut"
                    stroke={CHART_COLORS.cashOut}
                    fill={CHART_COLORS.cashOut}
                    fillOpacity={0.2}
                    name="Cash Out"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="netPosition"
                    stroke={CHART_COLORS.netPosition}
                    fill={CHART_COLORS.netPosition}
                    fillOpacity={0.3}
                    name="Net Position"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Value Series Line Chart */}
      {valueSeriesData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Value Over Time</CardTitle>
            <CardDescription>Market value, equity value, and loan balance trajectory</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={valueSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(v) => fmt.format(v)} />
                  <Tooltip formatter={(value: number) => fmt.format(value)} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="marketValue"
                    stroke={CHART_COLORS.marketValue}
                    strokeWidth={2}
                    dot={{ fill: CHART_COLORS.marketValue }}
                    name="Market Value"
                  />
                  <Line
                    type="monotone"
                    dataKey="equityValue"
                    stroke={CHART_COLORS.equityValue}
                    strokeWidth={2}
                    dot={{ fill: CHART_COLORS.equityValue }}
                    name="Equity Value"
                  />
                  <Line
                    type="monotone"
                    dataKey="loanBalance"
                    stroke={CHART_COLORS.loanBalance}
                    strokeWidth={2}
                    dot={{ fill: CHART_COLORS.loanBalance }}
                    name="Loan Balance"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* By-Deal Table */}
      {byDeal && byDeal.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Returns by Deal</CardTitle>
            <CardDescription>Individual deal performance within the fund</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model ID</TableHead>
                  <TableHead>Property ID</TableHead>
                  <TableHead className="text-right">Deal IRR</TableHead>
                  <TableHead className="text-right">Deal MOIC</TableHead>
                  <TableHead className="text-right">Deal ROI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byDeal.map((deal, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-sm">{deal.modelId || '-'}</TableCell>
                    <TableCell className="font-mono text-sm">{deal.propertyId || '-'}</TableCell>
                    <TableCell className="text-right">{fmtPct(deal.metrics?.irr)}</TableCell>
                    <TableCell className="text-right">{fmtMultiple(deal.metrics?.moic)}</TableCell>
                    <TableCell className="text-right">{fmtPct(deal.metrics?.roi)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cashflows by Bucket */}
      {bucketEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cashflows by Bucket</CardTitle>
            <CardDescription>Total cash flows categorized by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bucket</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bucketEntries.map((entry, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{entry.bucket}</TableCell>
                    <TableCell className={`text-right ${entry.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {fmt.format(entry.amount)}
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
