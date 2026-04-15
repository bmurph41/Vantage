import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign, TrendingUp, BarChart3, Building2, Layers, Activity,
  RefreshCw,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ASSET_CLASSES } from "@shared/crm-constants";

interface PortfolioSummary {
  dealCount: number;
  activeCount: number;
  closedCount: number;
  totalAum: number;
  aggregateNoi: number;
  avgCapRate: number;
  totalEquity: number;
  totalDebt: number;
  avgLtv: number;
  avgDscr: number;
  avgLeveredIrr: number;
  byAssetClass: { assetClass: string; count: number; totalValue: number; totalNoi: number }[];
  noiTrend: { month: string; dealCount: number; totalNoi: number; totalAum: number }[];
  generatedAt: string;
  _fallback?: boolean;
}

const ASSET_CLASS_COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444",
  "#06b6d4", "#84cc16", "#ec4899",
];

function getAssetClassLabel(value: string) {
  return ASSET_CLASSES.find((a) => a.value === value)?.label || value;
}

function pct(n: number) {
  if (!n) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

function KpiCard({
  label, value, sub, icon: Icon, color = "text-blue-600",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-gray-50`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.dataKey === "totalNoi" ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function PortfolioModelingDashboard() {
  const { data, isLoading } = useQuery<PortfolioSummary>({
    queryKey: ["/api/portfolio/summary"],
  });

  const formattedTrend = (data?.noiTrend || []).map((r) => ({
    ...r,
    label: format(new Date(r.month + "-01"), "MMM yy"),
  }));

  const donutData = (data?.byAssetClass || []).map((r) => ({
    name: getAssetClassLabel(r.assetClass),
    value: r.count,
    totalValue: r.totalValue,
    totalNoi: r.totalNoi,
  }));

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portfolio Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Aggregated KPIs across all modeling projects
          </p>
        </div>
        {data?.generatedAt && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Updated {format(new Date(data.generatedAt), "MMM d, h:mm a")}</span>
          </div>
        )}
      </div>

      {/* ── KPI Cards ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total AUM"
            value={formatCurrency(data?.totalAum || 0)}
            sub={`${data?.dealCount || 0} projects`}
            icon={DollarSign}
            color="text-green-600"
          />
          <KpiCard
            label="Equity Deployed"
            value={formatCurrency(data?.totalEquity || 0)}
            sub={`${pct(data?.avgLtv || 0)} avg LTV`}
            icon={Layers}
            color="text-blue-600"
          />
          <KpiCard
            label="Aggregate NOI"
            value={formatCurrency(data?.aggregateNoi || 0)}
            sub={`${pct(data?.avgCapRate || 0)} avg cap rate`}
            icon={TrendingUp}
            color="text-purple-600"
          />
          <KpiCard
            label="Avg DSCR"
            value={(data?.avgDscr || 0) > 0 ? (data?.avgDscr || 0).toFixed(2) + "x" : "—"}
            sub="Debt service coverage"
            icon={BarChart3}
            color="text-orange-600"
          />
          <KpiCard
            label="Avg Levered IRR"
            value={(data?.avgLeveredIrr || 0) > 0 ? pct(data?.avgLeveredIrr || 0) : "—"}
            sub="Across active stacks"
            icon={Activity}
            color="text-emerald-600"
          />
          <KpiCard
            label="Total Debt"
            value={formatCurrency(data?.totalDebt || 0)}
            sub={`Across ${data?.activeCount || 0} active deals`}
            icon={Building2}
            color="text-indigo-600"
          />
          <KpiCard
            label="Active Projects"
            value={String(data?.activeCount || 0)}
            sub={`${data?.closedCount || 0} closed`}
            icon={Activity}
            color="text-cyan-600"
          />
          <KpiCard
            label="Asset Classes"
            value={String(data?.byAssetClass?.length || 0)}
            sub="Distinct categories"
            icon={Building2}
            color="text-rose-600"
          />
        </div>
      )}

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* NOI Trend Line Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Portfolio NOI Trend — Trailing 12 Months
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : formattedTrend.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-sm text-gray-400">
                No modeling project data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={formattedTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    allowDecimals={false}
                    width={30}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="totalNoi"
                    name="Aggregate NOI"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    yAxisId="left"
                  />
                  <Line
                    type="monotone"
                    dataKey="dealCount"
                    name="Projects Added"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    yAxisId="right"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Asset Class Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">
              Deal Count by Asset Class
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : donutData.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-sm text-gray-400">
                No data yet
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {donutData.map((_, i) => (
                        <Cell key={i} fill={ASSET_CLASS_COLORS[i % ASSET_CLASS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any, name: any, props: any) => [
                        `${v} deals — ${formatCurrency(props.payload.totalValue)}`,
                        props.payload.name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1.5">
                  {donutData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: ASSET_CLASS_COLORS[i % ASSET_CLASS_COLORS.length] }}
                        />
                        <span className="text-gray-700 truncate">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">{d.value}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Asset class breakdown table ── */}
      {!isLoading && donutData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700">Asset Class Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">Asset Class</th>
                    <th className="text-right text-xs font-medium text-gray-500 pb-2">Deals</th>
                    <th className="text-right text-xs font-medium text-gray-500 pb-2">Total Value</th>
                    <th className="text-right text-xs font-medium text-gray-500 pb-2">Aggregate NOI</th>
                    <th className="text-right text-xs font-medium text-gray-500 pb-2">NOI Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(data?.byAssetClass || []).map((r, i) => (
                    <tr key={r.assetClass} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: ASSET_CLASS_COLORS[i % ASSET_CLASS_COLORS.length] }}
                          />
                          <span className="font-medium text-gray-800">{getAssetClassLabel(r.assetClass)}</span>
                        </div>
                      </td>
                      <td className="py-2 text-right text-gray-700">{r.count}</td>
                      <td className="py-2 text-right text-gray-700">{formatCurrency(r.totalValue)}</td>
                      <td className="py-2 text-right text-gray-700">{formatCurrency(r.totalNoi)}</td>
                      <td className="py-2 text-right text-gray-500">
                        {r.totalValue > 0 ? `${((r.totalNoi / r.totalValue) * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
