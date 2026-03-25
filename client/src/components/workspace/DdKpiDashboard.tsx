import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Clock, AlertTriangle, CheckCircle, Target } from "lucide-react";

interface Props { workspaceId: string; }

export default function DdKpiDashboard({ workspaceId }: Props) {
  const { data: kpi, isLoading } = useQuery<any>({
    queryKey: ["/api/dd-enhanced/kpi", workspaceId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/dd-enhanced/kpi/${workspaceId}`);
      return res.json();
    },
  });

  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;
  if (!kpi?.hasChecklist && kpi?.hasChecklist === false) return <p className="text-sm text-muted-foreground text-center py-4">No DD checklist for this workspace.</p>;

  const health = kpi?.healthScore || { score: 0, label: "—", color: "gray" };
  const healthBg = health.color === "green" ? "bg-green-50 border-green-200" : health.color === "yellow" ? "bg-yellow-50 border-yellow-200" : health.color === "orange" ? "bg-orange-50 border-orange-200" : "bg-red-50 border-red-200";

  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2"><BarChart3 className="h-5 w-5" />DD Health Dashboard</h3>

      {/* Health Score */}
      <Card className={`${healthBg} border`}>
        <CardContent className="pt-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">DD Health Score</p>
            <p className="text-3xl font-bold">{health.score}/100</p>
            <p className="text-sm">{health.label}</p>
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center gap-1 text-sm"><CheckCircle className="h-4 w-4 text-green-600" />{kpi?.completionPct || 0}% complete</div>
            <div className="flex items-center gap-1 text-sm"><Target className="h-4 w-4 text-blue-600" />{kpi?.provisionPct || 0}% provided</div>
            <div className="flex items-center gap-1 text-sm"><AlertTriangle className="h-4 w-4 text-red-600" />{kpi?.overduePct || 0}% overdue</div>
          </div>
        </CardContent>
      </Card>

      {/* Core metrics */}
      <div className="grid grid-cols-5 gap-2">
        <div className="text-center p-2 bg-muted rounded"><p className="text-lg font-bold">{kpi?.totalItems || 0}</p><p className="text-[10px]">Total</p></div>
        <div className="text-center p-2 bg-green-50 rounded"><p className="text-lg font-bold text-green-600">{kpi?.completedItems || 0}</p><p className="text-[10px]">Complete</p></div>
        <div className="text-center p-2 bg-blue-50 rounded"><p className="text-lg font-bold text-blue-600">{kpi?.providedItems || 0}</p><p className="text-[10px]">Provided</p></div>
        <div className="text-center p-2 bg-red-50 rounded"><p className="text-lg font-bold text-red-600">{kpi?.overdueItems || 0}</p><p className="text-[10px]">Overdue</p></div>
        <div className="text-center p-2 bg-orange-50 rounded"><p className="text-lg font-bold text-orange-600">{kpi?.blockedItems || 0}</p><p className="text-[10px]">Blocked</p></div>
      </div>

      {/* Avg response time */}
      {kpi?.avgDaysToProvide !== null && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
          <Clock className="h-4 w-4" />
          Avg time to provide: <strong>{kpi.avgDaysToProvide} days</strong>
        </div>
      )}

      {/* Category heatmap */}
      {kpi?.categoryHeatmap && (kpi.categoryHeatmap as any[]).length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Category Completion</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(kpi.categoryHeatmap as any[]).map((cat: any) => (
              <div key={cat.category} className="flex items-center gap-2">
                <span className="text-xs w-24 truncate">{cat.category}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                  <div className="h-2.5 rounded-full bg-green-500" style={{ width: `${cat.completionPct}%` }} />
                </div>
                <span className="text-xs w-10 text-right">{cat.completionPct}%</span>
                {cat.overdue > 0 && <Badge variant="destructive" className="text-[10px] px-1">{cat.overdue} late</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming deadlines */}
      {kpi?.upcomingDeadlines && (kpi.upcomingDeadlines as any[]).length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Upcoming Deadlines (7 days)</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {(kpi.upcomingDeadlines as any[]).map((d: any) => (
              <div key={d.id} className="flex items-center justify-between text-sm p-1.5 rounded hover:bg-muted">
                <span className="truncate flex-1">{d.title}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={d.daysUntilDue <= 2 ? "destructive" : "outline"} className="text-xs">
                    {d.daysUntilDue}d
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Findings integration */}
      {kpi?.findings && (kpi.findings.totalFindings > 0 || kpi.findings.criticalFindings > 0) && (
        <div className="flex items-center gap-3 p-2 bg-amber-50 rounded text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span>{kpi.findings.totalFindings} findings ({kpi.findings.criticalFindings} critical, {kpi.findings.openFindings} open)</span>
          {parseFloat(kpi.findings.totalImpact) > 0 && (
            <span className="text-amber-600 font-medium">${Number(kpi.findings.totalImpact).toLocaleString()} exposure</span>
          )}
        </div>
      )}
    </div>
  );
}
