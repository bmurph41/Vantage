import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  BarChart3,
  Download,
  SlidersHorizontal,
  Maximize2,
  Layers,
  AlertCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { useDisplayMode } from '@/stores/display-mode-store';

interface SimplifiedWorkspaceProps {
  projectId: string;
}

interface ProjectData {
  id: string;
  marinaName: string;
  city: string | null;
  state: string | null;
  assetClass: string | null;
  purchasePrice: string | number | null;
  totalStorageUnits: number | null;
  customMetrics: Record<string, any> | null;
  yearBuilt?: number | null;
  [key: string]: any;
}

const fmt = (val: number | string | null | undefined): string => {
  return formatCurrency(val, { dash: true });
};

const fmtPct = (val: number | string | null | undefined): string => {
  return formatPercent(val, { dash: true });
};

function MetricCard({
  label,
  value,
  subtitle,
  trend,
}: {
  label: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
        <p
          className={`text-xl font-bold ${
            trend === 'up'
              ? 'text-green-600'
              : trend === 'down'
              ? 'text-red-600'
              : 'text-foreground'
          }`}
        >
          {value}
        </p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-24 w-full" />
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}

export default function SimplifiedWorkspace({ projectId }: SimplifiedWorkspaceProps) {
  const { toggleSimplifiedMode } = useDisplayMode();

  const { data: project, isLoading: projectLoading } = useQuery<ProjectData>({
    queryKey: ['/api/modeling/projects', projectId],
    enabled: !!projectId,
  });

  const { data: pricingRaw } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'deal-pricing', 'inputs'],
    enabled: !!projectId,
  });

  const { data: proFormaRaw } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'pro-forma'],
    enabled: !!projectId,
  });

  const { data: capitalStackRaw } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'capital-stacks'],
    enabled: !!projectId,
  });

  const { data: scenariosRaw } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'scenarios'],
    enabled: !!projectId,
  });

  if (projectLoading) return <LoadingSkeleton />;

  if (!project) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
          <p className="text-muted-foreground">Unable to load project data.</p>
        </Card>
      </div>
    );
  }

  // Extract pricing data from various possible shapes
  const pricing = pricingRaw?.dealPricingResults ?? pricingRaw?.dealPricing ?? pricingRaw ?? {};

  // Extract financials from pro forma
  const s0 = proFormaRaw?.scenarios?.[0];
  const metrics = s0?.metrics ?? {};
  const totalRevenue = metrics.totalRevenue ?? proFormaRaw?.revenue?.totals?.[0] ?? proFormaRaw?.totalRevenue ?? 0;
  const totalExpenses = metrics.totalExpenses ?? proFormaRaw?.expenses?.totals?.[0] ?? proFormaRaw?.totalExpenses ?? 0;
  const noi = metrics.noi ?? metrics.stabilizedNoi ?? (Array.isArray(proFormaRaw?.noi) ? proFormaRaw.noi[0] : proFormaRaw?.noi) ?? (totalRevenue - totalExpenses);
  const vacancyRate = metrics.vacancyRate ?? proFormaRaw?.vacancyRate ?? 0;
  const effectiveRevenue = totalRevenue * (1 - (vacancyRate || 0));
  const debtService = metrics.debtService ?? capitalStackRaw?.annualDebtService ?? 0;
  const cashFlow = noi - debtService;

  const capRate = metrics.capRate ?? pricing.capRate ?? 0;
  const irr = metrics.irr ?? pricing.irr ?? project.irr ?? 0;
  const cashOnCash = metrics.cashOnCash ?? pricing.cashOnCash ?? 0;
  const equityMultiple = metrics.equityMultiple ?? pricing.equityMultiple ?? 0;
  const moic = pricing.moic ?? equityMultiple ?? 0;
  const purchasePrice = project.purchasePrice
    ? typeof project.purchasePrice === 'string'
      ? parseFloat(project.purchasePrice)
      : project.purchasePrice
    : 0;

  // Capital stack data — plural endpoint returns an array; take the first entry
  const cs = (Array.isArray(capitalStackRaw) ? capitalStackRaw[0] : capitalStackRaw) ?? {};
  const equityAmount = cs.equityAmount ?? cs.totalEquity ?? (purchasePrice - (cs.loanAmount ?? 0));
  const loanAmount = cs.loanAmount ?? cs.totalDebt ?? 0;
  const ltv = purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0;
  const interestRate = cs.interestRate ?? cs.rate ?? 0;
  const holdPeriod = cs.holdPeriod ?? pricing.holdPeriod ?? project.customMetrics?.holdPeriod ?? 5;

  // Scenario comparison chart data
  const scenarioChartData = (() => {
    const scenarios = scenariosRaw?.scenarios ?? proFormaRaw?.scenarios ?? [];
    if (scenarios.length === 0) {
      // Build a single base-case bar
      return [
        {
          metric: 'NOI',
          Base: noi,
        },
        {
          metric: 'IRR',
          Base: irr * 100,
        },
        {
          metric: 'Cash-on-Cash',
          Base: cashOnCash * 100,
        },
      ];
    }
    const labelMap: Record<string, string> = {
      base: 'Base',
      aggressive: 'Aggressive',
      conservative: 'Conservative',
      upside: 'Aggressive',
      downside: 'Conservative',
    };
    const noiRow: any = { metric: 'NOI' };
    const irrRow: any = { metric: 'IRR' };
    const cocRow: any = { metric: 'Cash-on-Cash' };
    scenarios.forEach((sc: any) => {
      const name = labelMap[sc.name?.toLowerCase?.()] ?? sc.name ?? 'Scenario';
      const m = sc.metrics ?? {};
      noiRow[name] = m.noi ?? 0;
      irrRow[name] = (m.irr ?? 0) * 100;
      cocRow[name] = (m.cashOnCash ?? 0) * 100;
    });
    return [noiRow, irrRow, cocRow];
  })();

  const scenarioKeys = Object.keys(scenarioChartData[0] || {}).filter((k) => k !== 'metric');
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="p-6 space-y-6">
      {/* Row 1: Property Info */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">{project.marinaName}</CardTitle>
                <CardDescription className="flex items-center gap-3 mt-0.5">
                  {(project.city || project.state) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {[project.city, project.state].filter(Boolean).join(', ')}
                    </span>
                  )}
                  {project.assetClass && (
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {project.assetClass.replace(/_/g, ' ')}
                    </Badge>
                  )}
                  {project.totalStorageUnits && (
                    <span className="text-xs">{project.totalStorageUnits} units</span>
                  )}
                  {(project as any).yearBuilt && (
                    <span className="flex items-center gap-1 text-xs">
                      <Calendar className="h-3 w-3" />
                      Built {(project as any).yearBuilt}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => toggleSimplifiedMode()}>
              <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
              View Full Model
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Row 2: Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetricCard label="Purchase Price" value={fmt(purchasePrice || null)} />
        <MetricCard label="NOI" value={fmt(noi || null)} trend={noi > 0 ? 'up' : noi < 0 ? 'down' : 'neutral'} />
        <MetricCard label="Cap Rate" value={capRate ? fmtPct(capRate) : '-'} />
        <MetricCard label="Cash-on-Cash" value={cashOnCash ? fmtPct(cashOnCash) : '-'} trend={cashOnCash > 0.08 ? 'up' : 'neutral'} />
        <MetricCard label="IRR" value={irr ? fmtPct(irr) : '-'} trend={irr > 0 ? 'up' : irr < 0 ? 'down' : 'neutral'} />
        <MetricCard label="MOIC" value={moic ? `${(typeof moic === 'number' ? moic : parseFloat(moic)).toFixed(2)}x` : '-'} />
        <MetricCard label="Equity Multiple" value={equityMultiple ? `${(typeof equityMultiple === 'number' ? equityMultiple : parseFloat(equityMultiple)).toFixed(2)}x` : '-'} />
      </div>

      {/* Row 3: P&L + Scenario Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Simple P&L */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Profit & Loss Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: 'Gross Revenue', value: totalRevenue, bold: false },
                { label: 'Vacancy Loss', value: vacancyRate ? -(totalRevenue * vacancyRate) : 0, bold: false },
                { label: 'Effective Revenue', value: effectiveRevenue, bold: true },
                { label: 'Operating Expenses', value: -Math.abs(totalExpenses), bold: false },
                { label: 'Net Operating Income', value: noi, bold: true },
                { label: 'Debt Service', value: debtService ? -Math.abs(debtService) : 0, bold: false },
                { label: 'Cash Flow', value: cashFlow, bold: true },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between py-1.5 ${
                    item.bold ? 'border-t border-border font-semibold' : ''
                  }`}
                >
                  <span className={`text-sm ${item.bold ? 'font-semibold' : 'text-muted-foreground'}`}>
                    {item.label}
                  </span>
                  <span
                    className={`text-sm tabular-nums ${
                      item.value < 0
                        ? 'text-red-600'
                        : item.bold
                        ? 'text-foreground font-semibold'
                        : 'text-foreground'
                    }`}
                  >
                    {fmt(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right: Scenario Comparison Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              Scenario Comparison
            </CardTitle>
            <CardDescription>
              {scenarioKeys.length > 1
                ? 'Comparing across scenarios'
                : 'Base case metrics'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scenarioKeys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Layers className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No scenario data available yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Complete your model inputs to see comparisons.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={scenarioChartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const row = scenarioChartData.find(
                        (d) => d.metric === 'NOI' && d[name] === value
                      );
                      if (row) return [fmt(value), name];
                      return [`${value.toFixed(1)}%`, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {scenarioKeys.map((key, i) => (
                    <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Capital Stack Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            Capital Stack
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Equity</p>
              <p className="text-sm font-semibold">{fmt(equityAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Loan Amount</p>
              <p className="text-sm font-semibold">{fmt(loanAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">LTV</p>
              <p className="text-sm font-semibold">{ltv > 0 ? `${ltv.toFixed(1)}%` : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Interest Rate</p>
              <p className="text-sm font-semibold">{interestRate ? fmtPct(interestRate) : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Hold Period</p>
              <p className="text-sm font-semibold">{holdPeriod} years</p>
            </div>
          </div>
          {/* Visual bar */}
          {purchasePrice > 0 && (
            <div className="mt-4">
              <div className="flex h-4 rounded-full overflow-hidden bg-muted">
                {equityAmount > 0 && (
                  <div
                    className="bg-blue-500 flex items-center justify-center text-[9px] font-medium text-white"
                    style={{ width: `${Math.max((equityAmount / purchasePrice) * 100, 5)}%` }}
                  >
                    Equity
                  </div>
                )}
                {loanAmount > 0 && (
                  <div
                    className="bg-indigo-400 flex items-center justify-center text-[9px] font-medium text-white"
                    style={{ width: `${Math.max((loanAmount / purchasePrice) * 100, 5)}%` }}
                  >
                    Debt
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 5: Quick Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="default" size="sm" onClick={() => toggleSimplifiedMode()}>
              <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
              View Full Model
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'export' }));
                toggleSimplifiedMode();
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export Summary
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'cases' }));
                toggleSimplifiedMode();
              }}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
              Run Scenarios
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
