import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Clock, Award } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface VelocityStage {
  stage: string;
  deal_count: number;
  avg_days: number;
  total_value: number;
}

export function VelocityTabContent() {
  const { data, isLoading } = useQuery<{ stages: VelocityStage[] }>({
    queryKey: ["/api/crm/analytics/velocity"],
  });

  const stages = data?.stages || [];
  const maxAvgDays = Math.max(...stages.map(s => s.avg_days), 1);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  if (!stages.length) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p>No velocity data yet — move deals through stages to see metrics here.</p>
      </div>
    );
  }

  const bottlenecks = [...stages].sort((a, b) => b.avg_days - a.avg_days).slice(0, 3);
  const fastest = [...stages].sort((a, b) => a.avg_days - b.avg_days).slice(0, 3);

  const getBarColor = (avgDays: number) => {
    if (avgDays > 45) return "#ef4444";
    if (avgDays > 21) return "#f59e0b";
    return "#10b981";
  };

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-0 bg-gradient-to-br from-red-50 to-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium text-red-700">Biggest Bottleneck</span>
            </div>
            <p className="font-bold text-gray-900">{bottlenecks[0]?.stage || '—'}</p>
            <p className="text-sm text-red-600">{bottlenecks[0]?.avg_days?.toFixed(1)} avg days</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium text-green-700">Fastest Stage</span>
            </div>
            <p className="font-bold text-gray-900">{fastest[0]?.stage || '—'}</p>
            <p className="text-sm text-green-600">{fastest[0]?.avg_days?.toFixed(1)} avg days</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Award className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-blue-700">Total Tracked Deals</span>
            </div>
            <p className="font-bold text-gray-900">
              {stages.reduce((s, st) => s + st.deal_count, 0)}
            </p>
            <p className="text-sm text-blue-600">across {stages.length} stages</p>
          </CardContent>
        </Card>
      </div>

      {/* Velocity bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Average Days per Stage</CardTitle>
          <p className="text-xs text-gray-500">
            Green = fast (&lt;21d) · Yellow = moderate (21–45d) · Red = bottleneck (&gt;45d)
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stages} layout="vertical" margin={{ left: 100, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}d`} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={95} />
              <Tooltip
                formatter={(v: any) => [`${Number(v).toFixed(1)} days`, 'Avg Days']}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="avg_days" radius={[0, 4, 4, 0]}>
                {stages.map((s, i) => (
                  <Cell key={i} fill={getBarColor(s.avg_days)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Stage table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Stage Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-gray-500">
                <th className="text-left py-2">Stage</th>
                <th className="text-right py-2">Active Deals</th>
                <th className="text-right py-2">Avg Days</th>
                <th className="text-right py-2">Total Value</th>
                <th className="text-right py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s) => (
                <tr key={s.stage} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2 font-medium text-gray-900">{s.stage}</td>
                  <td className="py-2 text-right text-gray-600">{s.deal_count}</td>
                  <td className="py-2 text-right font-mono text-sm">
                    <span className={
                      s.avg_days > 45 ? 'text-red-600 font-semibold' :
                      s.avg_days > 21 ? 'text-amber-600' : 'text-green-600'
                    }>
                      {s.avg_days.toFixed(1)}d
                    </span>
                  </td>
                  <td className="py-2 text-right text-gray-600">{formatCurrency(s.total_value)}</td>
                  <td className="py-2 text-right">
                    <Badge className={`text-[10px] h-4 px-1.5 ${
                      s.avg_days > 45 ? 'bg-red-100 text-red-700' :
                      s.avg_days > 21 ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {s.avg_days > 45 ? 'Bottleneck' : s.avg_days > 21 ? 'Moderate' : 'Healthy'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
