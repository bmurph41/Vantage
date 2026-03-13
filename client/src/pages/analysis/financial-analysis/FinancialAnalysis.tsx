import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExportPdfButton } from "@/components/ui/export-pdf-button";
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Activity,
  DollarSign,
  Calendar,
  Download,
  RefreshCw,
  Building2,
  Anchor,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import {
  DrillDownBarChart,
  TimeSeriesDrillDown,
  HierarchicalPieChart,
  WaterfallChart,
  CHART_COLORS,
} from '@/components/analytics/InteractiveCharts';
import { formatCurrency, formatPercent } from '@/lib/utils';

// ─── Reusable KPI card ────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  icon: React.ElementType;
  accent: string;
  accentText: string;
  isLoading?: boolean;
}

function KpiCard({ label, value, sub, trend, trendLabel, icon: Icon, accent, accentText, isLoading }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
        <div className={`w-8 h-8 rounded-lg ${accent} ${accentText} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      {isLoading ? (
        <Skeleton className="h-7 w-24 mt-1" />
      ) : (
        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
      )}
      <div className="flex items-center gap-1.5 mt-2">
        {trend === 'up' && <ArrowUpRight className="w-3 h-3 text-emerald-500" />}
        {trend === 'down' && <ArrowDownRight className="w-3 h-3 text-red-400" />}
        {trend === 'flat' && <Minus className="w-3 h-3 text-slate-400" />}
        {trendLabel && (
          <span className={`text-[11px] font-medium ${
            trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-slate-400'
          }`}>{trendLabel}</span>
        )}
        {sub && !trendLabel && <span className="text-[11px] text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, description, children, action }: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-[13px] font-semibold text-slate-800">{title}</h3>
          {description && <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Summary row (label + value) ─────────────────────────────────────────────

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0 ${highlight ? 'bg-slate-50 -mx-5 px-5 rounded' : ''}`}>
      <span className="text-[12px] text-slate-500">{label}</span>
      <span className={`text-[13px] font-semibold tabular-nums ${highlight ? 'text-slate-900' : 'text-slate-700'}`}>{value}</span>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-[13px] font-semibold text-slate-600">{title}</p>
      <p className="text-[12px] text-slate-400 mt-1 max-w-xs">{sub}</p>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function FinancialAnalysisDashboard() {
  const reportRef = useRef<HTMLDivElement>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('12m');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('overview');

  const { data: analyticsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/analytics/financial', selectedTimeframe, selectedProject],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('timeframe', selectedTimeframe);
      if (selectedProject !== 'all') params.set('projectId', selectedProject);
      const response = await fetch(`/api/analytics/financial?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch financial analytics');
      return response.json();
    },
  });

  const projectsList = useMemo(() => analyticsData?.projects || [], [analyticsData]);

  const revenueByCategory = useMemo(() => {
    if (!analyticsData?.revenueBreakdown?.length) return [{ name: 'No financial data yet', value: 0 }];
    return analyticsData.revenueBreakdown;
  }, [analyticsData]);

  const yearlyTrends = useMemo(() => analyticsData?.yearlyTrends || [], [analyticsData]);

  const yearlyBreakdown: Record<string, any[]> = useMemo(() => {
    const bd: Record<string, any[]> = {};
    yearlyTrends.forEach((y: any) => {
      bd[y.period] = [
        { category: 'Revenue', amount: y.revenue, percentage: 100 },
        { category: 'Expenses', amount: y.expenses, percentage: y.revenue > 0 ? (y.expenses / y.revenue) * 100 : 0 },
        { category: 'NOI', amount: y.noi, percentage: y.revenue > 0 ? (y.noi / y.revenue) * 100 : 0 },
      ];
    });
    return bd;
  }, [yearlyTrends]);

  const expenseWaterfall = useMemo(() => {
    if (!analyticsData?.expenseWaterfall?.length) return [{ name: 'No expense data yet', value: 0, isTotal: true }];
    return analyticsData.expenseWaterfall;
  }, [analyticsData]);

  const expenseBreakdownData = useMemo(() => {
    if (!analyticsData?.expenseWaterfall) return [];
    return analyticsData.expenseWaterfall
      .filter((e: any) => !e.isTotal && e.value !== 0)
      .map((e: any) => ({ category: e.name, amount: Math.abs(e.value) }));
  }, [analyticsData]);

  const drillDownLevels = useMemo(() => {
    const revenueData = revenueByCategory.filter((r: any) => r.value > 0).map((r: any) => ({
      category: r.name, amount: r.value,
    }));
    return [{ label: 'By Revenue Category', data: revenueData.length > 0 ? revenueData : [{ category: 'No data', amount: 0 }], dataKey: 'amount', nameKey: 'category' }];
  }, [revenueByCategory]);

  const summary = analyticsData?.summary || {};
  const kpis: KpiCardProps[] = useMemo(() => [
    {
      label: 'Total Revenue',
      value: formatCurrency(summary.totalRevenue || 0),
      sub: 'across all projects',
      icon: DollarSign,
      accent: 'bg-emerald-50',
      accentText: 'text-emerald-600',
      isLoading,
    },
    {
      label: 'Net Operating Income',
      value: formatCurrency(summary.totalNoi || 0),
      sub: 'after all expenses',
      trend: (summary.totalNoi || 0) > 0 ? 'up' : (summary.totalNoi || 0) < 0 ? 'down' : 'flat',
      trendLabel: (summary.totalNoi || 0) > 0 ? 'Positive' : (summary.totalNoi || 0) < 0 ? 'Negative' : 'Break-even',
      icon: TrendingUp,
      accent: 'bg-blue-50',
      accentText: 'text-blue-600',
      isLoading,
    },
    {
      label: 'NOI Margin',
      value: formatPercent(summary.noiMargin || 0),
      sub: 'revenue-to-NOI ratio',
      icon: Activity,
      accent: 'bg-purple-50',
      accentText: 'text-purple-600',
      isLoading,
    },
    {
      label: 'Active Projects',
      value: String(analyticsData?.projectCount || 0),
      sub: `${projectsList.length} with financials`,
      icon: Building2,
      accent: 'bg-orange-50',
      accentText: 'text-orange-600',
      isLoading,
    },
  ], [analyticsData, isLoading, projectsList, summary]);

  const tabItems = [
    { value: 'overview', label: 'Overview', icon: BarChart3 },
    { value: 'projects', label: 'Projects', icon: Building2 },
    { value: 'revenue', label: 'Revenue', icon: PieChart },
    { value: 'expenses', label: 'Expenses', icon: Activity },
    { value: 'trends', label: 'Trends', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-slate-50" ref={reportRef}>
      {/* ── Header bar ──────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden border-b border-slate-200 px-6 py-7"
        style={{ background: 'linear-gradient(135deg, hsl(221,83%,18%) 0%, hsl(221,83%,30%) 60%, hsl(221,60%,40%) 100%)' }}
      >
        <div className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'linear-gradient(hsl(0,0%,100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0,0%,100%) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

        <div className="relative flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-5 h-5 rounded-md bg-white/15 flex items-center justify-center">
                <BarChart3 className="w-3 h-3 text-white" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Financial Analysis</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Portfolio Financials</h1>
            <p className="text-blue-200 text-[12px] mt-1">Revenue, expense, and NOI trends across your modeling projects</p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap self-start mt-1">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="h-8 w-[180px] text-xs bg-white/10 border-white/20 text-white">
                <Building2 className="h-3 w-3 mr-1.5 opacity-70" />
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects ({projectsList.length})</SelectItem>
                {projectsList.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.marinaName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
              <SelectTrigger className="h-8 w-[130px] text-xs bg-white/10 border-white/20 text-white">
                <Calendar className="h-3 w-3 mr-1.5 opacity-70" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3m">Last 3 Months</SelectItem>
                <SelectItem value="6m">Last 6 Months</SelectItem>
                <SelectItem value="12m">Last 12 Months</SelectItem>
                <SelectItem value="ytd">Year to Date</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost" size="sm"
              className="h-8 w-8 p-0 bg-white/10 border border-white/20 text-white hover:bg-white/20"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <ExportPdfButton contentRef={reportRef} filename="financial-analysis" title="Financial Analysis"
              className="h-8 text-xs bg-white/10 border border-white/20 text-white hover:bg-white/20"
            />
          </div>
        </div>

        {/* KPI row inside hero */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
        </div>
      </div>

      {/* ── Tab nav ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-auto bg-transparent p-0 gap-0">
            {tabItems.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={`
                  relative h-11 px-4 text-[12px] font-medium rounded-none border-b-2 transition-all
                  data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 data-[state=active]:bg-transparent
                  data-[state=inactive]:border-transparent data-[state=inactive]:text-slate-500
                  hover:text-slate-700 hover:bg-slate-50
                `}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </div>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Tab content ─────────────────────────────────────────────────── */}
          <div className="px-0 py-6 space-y-5">

            {/* OVERVIEW */}
            <TabsContent value="overview" className="mt-0 space-y-5">
              {projectsList.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  <EmptyState icon={BarChart3} title="No Modeling Projects Yet"
                    sub="Create a modeling project in the Financial Model to start seeing financial analytics." />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <Section title="Revenue by Category" description="Click bars to drill down into sub-categories">
                      <DrillDownBarChart title="" description="" levels={drillDownLevels} height={300} />
                    </Section>
                    <Section title="Income Distribution" description="Click segments to explore revenue breakdown">
                      <HierarchicalPieChart title="" description="" data={revenueByCategory} height={300} />
                    </Section>
                  </div>
                  <Section title="Revenue → NOI Waterfall" description="Click expense items to see detailed breakdowns">
                    <WaterfallChart title="" description="" data={expenseWaterfall} height={320} />
                  </Section>
                </>
              )}
            </TabsContent>

            {/* PROJECTS */}
            <TabsContent value="projects" className="mt-0">
              <Section
                title={`Financial Model Projects (${projectsList.length})`}
                description="All modeling projects with key financial metrics"
              >
                {projectsList.length === 0 ? (
                  <EmptyState icon={Anchor} title="No modeling projects found"
                    sub="Create a new project in the Financial Model to get started." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          {['Marina Name', 'State', 'Purchase Price', 'Revenue', 'NOI', 'Cap Rate', 'Units', 'Status'].map((h, i) => (
                            <th key={h} className={`py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 ${i > 1 ? 'text-right' : i === 7 ? 'text-center' : 'text-left'}`}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {projectsList.map((p: any) => (
                          <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-3 text-[13px] font-semibold text-slate-800">{p.marinaName}</td>
                            <td className="py-3 px-3 text-[12px] text-slate-500">{p.state || '—'}</td>
                            <td className="py-3 px-3 text-right text-[12px] tabular-nums text-slate-700">{p.purchasePrice ? formatCurrency(p.purchasePrice) : '—'}</td>
                            <td className="py-3 px-3 text-right text-[12px] tabular-nums text-slate-700">{p.latestRevenue ? formatCurrency(p.latestRevenue) : '—'}</td>
                            <td className="py-3 px-3 text-right text-[12px] tabular-nums font-semibold">
                              <span className={p.latestNoi > 0 ? 'text-emerald-600' : p.latestNoi < 0 ? 'text-red-500' : 'text-slate-500'}>
                                {p.latestNoi ? formatCurrency(p.latestNoi) : '—'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right text-[12px] tabular-nums text-slate-700">{p.capRate ? `${(p.capRate * 100).toFixed(2)}%` : '—'}</td>
                            <td className="py-3 px-3 text-right text-[12px] tabular-nums text-slate-700">{p.totalUnits || '—'}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                                p.dealOutcome === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {p.dealOutcome}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </TabsContent>

            {/* REVENUE */}
            <TabsContent value="revenue" className="mt-0 space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Section title="Revenue Breakdown" description="Hierarchical view — click to drill into categories">
                  <HierarchicalPieChart title="" description="" data={revenueByCategory} height={360} />
                </Section>
                <Section title="Revenue KPIs" description="Key revenue metrics from modeling projects">
                  {revenueByCategory.filter((r: any) => r.value > 0).length === 0 ? (
                    <EmptyState icon={DollarSign} title="No revenue data available"
                      sub="Add financial periods to your modeling projects to see revenue metrics." />
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {revenueByCategory.filter((r: any) => r.value > 0).slice(0, 6).map((m: any, i: number) => (
                        <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <p className="text-[11px] text-slate-400 truncate">{m.name}</p>
                          <p className="text-[16px] font-bold text-slate-800 mt-0.5">{formatCurrency(m.value)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </div>
              <Section title="Revenue Deep Dive" description="Multi-level drill-down from category to individual line items">
                <DrillDownBarChart title="" description="" levels={drillDownLevels} height={360} />
              </Section>
            </TabsContent>

            {/* EXPENSES */}
            <TabsContent value="expenses" className="mt-0 space-y-5">
              <Section title="Gross Revenue → NOI Waterfall" description="Visual walkthrough of all expense categories — click for details">
                <WaterfallChart title="" description="" data={expenseWaterfall} height={360} />
              </Section>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Section title="Operating Expenses by Category" description="Expense breakdown from modeling projects">
                  <DrillDownBarChart title="" description=""
                    levels={[{ label: 'By Category', data: expenseBreakdownData.length > 0 ? expenseBreakdownData : [{ category: 'No data', amount: 0 }], dataKey: 'amount', nameKey: 'category' }]}
                    height={280}
                  />
                </Section>
                <Section title="Expense Distribution" description="Click to explore expense categories">
                  <HierarchicalPieChart title="" description=""
                    data={expenseBreakdownData.length > 0 ? expenseBreakdownData.map((e: any) => ({ name: e.category, value: e.amount })) : [{ name: 'No data', value: 0 }]}
                    height={280}
                  />
                </Section>
              </div>
            </TabsContent>

            {/* TRENDS */}
            <TabsContent value="trends" className="mt-0 space-y-5">
              {yearlyTrends.length > 0 ? (
                <Section title="Yearly Revenue, Expenses & NOI" description="Click on any data point to see detailed breakdown for that year">
                  <TimeSeriesDrillDown title="" description=""
                    data={yearlyTrends}
                    metrics={[
                      { key: 'revenue', label: 'Revenue', color: CHART_COLORS[0] },
                      { key: 'expenses', label: 'Expenses', color: CHART_COLORS[4] },
                      { key: 'noi', label: 'NOI', color: CHART_COLORS[1] },
                    ]}
                    height={360}
                    drillDownData={yearlyBreakdown}
                  />
                </Section>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                  <EmptyState icon={TrendingUp} title="No historical trend data yet"
                    sub="Add financial periods to your modeling projects to see trends." />
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Section title="Financial Summary" description="Aggregate across all projects">
                  {analyticsData?.summary ? (
                    <div>
                      <SummaryRow label="Total Revenue" value={formatCurrency(analyticsData.summary.totalRevenue)} />
                      <SummaryRow label="Total Expenses" value={formatCurrency(analyticsData.summary.totalExpenses)} />
                      <SummaryRow label="Net Operating Income" value={formatCurrency(analyticsData.summary.totalNoi)} highlight />
                      <SummaryRow label="NOI Margin" value={formatPercent(analyticsData.summary.noiMargin)} />
                    </div>
                  ) : (
                    <p className="text-[12px] text-slate-400">No summary data available</p>
                  )}
                </Section>
                <Section title="Portfolio Overview" description="Key metrics across modeling projects">
                  <SummaryRow label="Total Projects" value={String(analyticsData?.projectCount || 0)} />
                  <SummaryRow label="Total Storage Units" value={String(analyticsData?.summary?.totalUnits || 0)} />
                  {analyticsData?.summary?.avgCapRate && (
                    <SummaryRow label="Average Cap Rate" value={`${(analyticsData.summary.avgCapRate * 100).toFixed(2)}%`} highlight />
                  )}
                  {analyticsData?.summary?.avgOccupancy && (
                    <SummaryRow label="Average Occupancy" value={`${analyticsData.summary.avgOccupancy.toFixed(1)}%`} />
                  )}
                </Section>
              </div>
            </TabsContent>

          </div>
        </Tabs>
      </div>
    </div>
  );
}
