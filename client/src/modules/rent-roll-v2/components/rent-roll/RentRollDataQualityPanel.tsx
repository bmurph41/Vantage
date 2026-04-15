import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, AlertTriangle, Info, Wrench, CheckCircle2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DataQualitySummary, DataQualitySeverity, DataQualityIssue } from "../../lib/rentRollApi";

interface RentRollDataQualityPanelProps {
  data: DataQualitySummary | undefined;
  isLoading: boolean;
  isError: boolean;
  projectId?: string;
  completenessScore?: number;
}

export default function RentRollDataQualityPanel({
  data,
  isLoading,
  isError,
  projectId,
  completenessScore,
}: RentRollDataQualityPanelProps) {
  const { toast } = useToast();
  const [fixingIds, setFixingIds] = useState<Set<string>>(new Set());

  const bulkFixMutation = useMutation({
    mutationFn: (fixes: { leaseId: string; fixType: string; value?: string }[]) =>
      apiRequest("POST", "/api/rent-roll/leases/bulk-fix", { fixes }),
    onSuccess: (_, vars) => {
      const ids = vars.map(f => f.leaseId);
      setFixingIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
      toast({ title: "Fixes applied", description: `${vars.length} issue(s) resolved.` });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll"] });
    },
    onError: () => {
      toast({ title: "Fix failed", description: "Could not apply fixes. Try again.", variant: "destructive" });
    },
  });

  const handleAutoFix = (issue: DataQualityIssue) => {
    const leaseId = issue.metadata?.leaseId;
    if (!leaseId) return;

    let fixType = "set_status";
    let value = "Active";
    if (issue.category === "missing_end_date" || issue.message?.includes("end date")) {
      fixType = "set_end_date";
      value = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    } else if (issue.category === "missing_rate" || issue.message?.includes("rate")) {
      fixType = "set_rate";
      value = "0";
    }

    setFixingIds(prev => new Set(prev).add(leaseId));
    bulkFixMutation.mutate([{ leaseId, fixType, value }]);
  };

  const score = completenessScore ?? (data ? Math.max(0, 100 - (data.countsBySeverity.ERROR * 10 + data.countsBySeverity.WARNING * 3)) : null);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>Failed to load data quality summary</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getSeverityIcon = (severity: DataQualitySeverity) => {
    switch (severity) {
      case "ERROR": return <AlertCircle className="w-4 h-4" />;
      case "WARNING": return <AlertTriangle className="w-4 h-4" />;
      case "INFO": return <Info className="w-4 h-4" />;
    }
  };

  const getSeverityVariant = (severity: DataQualitySeverity): "default" | "secondary" | "destructive" => {
    switch (severity) {
      case "ERROR": return "destructive";
      case "WARNING": return "default";
      case "INFO": return "secondary";
    }
  };

  const scoreColor = score === null ? "text-muted-foreground"
    : score >= 90 ? "text-green-600" : score >= 70 ? "text-yellow-600" : "text-red-600";

  const totalIssues = data.issues.length;
  const topIssues = data.issues.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Data Quality
          {totalIssues === 0 && (
            <Badge variant="secondary" className="ml-auto" data-testid="badge-all-clear">
              All Clear
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Institutional-grade validation checks for lease and tenant data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Completeness Ring */}
        {score !== null && (
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/40 border">
            <div className="relative flex items-center justify-center">
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="30" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted" />
                <circle
                  cx="36" cy="36" r="30"
                  fill="none"
                  strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 30}`}
                  strokeDashoffset={`${2 * Math.PI * 30 * (1 - score / 100)}`}
                  className={scoreColor}
                  strokeLinecap="round"
                  transform="rotate(-90 36 36)"
                />
              </svg>
              <span className={`absolute text-base font-bold ${scoreColor}`}>{score}%</span>
            </div>
            <div>
              <p className="text-sm font-medium">Completeness Score</p>
              <p className="text-xs text-muted-foreground">
                {score >= 90 ? "Excellent data quality" : score >= 70 ? "Some improvements needed" : "Critical issues require attention"}
              </p>
              <Progress value={score} className="h-2 mt-2 w-32" />
            </div>
          </div>
        )}

        {/* Summary Chips */}
        <div className="flex gap-2 flex-wrap">
          <Badge variant="destructive" className="gap-1" data-testid="badge-errors">
            <AlertCircle className="w-3 h-3" />
            {data.countsBySeverity.ERROR} Errors
          </Badge>
          <Badge variant="default" className="gap-1" data-testid="badge-warnings">
            <AlertTriangle className="w-3 h-3" />
            {data.countsBySeverity.WARNING} Warnings
          </Badge>
          <Badge variant="secondary" className="gap-1" data-testid="badge-info">
            <Info className="w-3 h-3" />
            {data.countsBySeverity.INFO} Info
          </Badge>
        </div>

        {/* Issues List */}
        {totalIssues === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50 text-green-500" />
            <p className="text-sm">No data quality issues detected</p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-96 rounded-md border">
              <div className="p-4 space-y-3">
                {topIssues.map((issue) => {
                  const leaseId = issue.metadata?.leaseId;
                  const isFixing = leaseId && fixingIds.has(leaseId);
                  const canAutoFix = leaseId && (
                    issue.category?.includes("missing") ||
                    issue.message?.includes("missing") ||
                    issue.severity === "ERROR"
                  );

                  return (
                    <div
                      key={issue.id}
                      className="flex items-start gap-3 p-3 rounded-md border bg-card hover-elevate"
                      data-testid={`issue-${issue.id}`}
                    >
                      <div className="mt-0.5">
                        {getSeverityIcon(issue.severity)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant={getSeverityVariant(issue.severity)} className="text-xs" data-testid={`badge-severity-${issue.id}`}>
                            {issue.severity}
                          </Badge>
                          <Badge variant="outline" className="text-xs" data-testid={`badge-category-${issue.id}`}>
                            {issue.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed" data-testid={`message-${issue.id}`}>
                          {issue.message}
                        </p>
                        {issue.metadata && Object.keys(issue.metadata).length > 0 && (
                          <div className="mt-2 flex gap-2 flex-wrap">
                            {Object.entries(issue.metadata).slice(0, 3).map(([key, value]) => (
                              <span key={key} className="text-xs text-muted-foreground">
                                {key}: {String(value)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {canAutoFix && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 h-7 text-xs gap-1"
                          onClick={() => handleAutoFix(issue)}
                          disabled={isFixing || bulkFixMutation.isPending}
                        >
                          <Wrench className="w-3 h-3" />
                          {isFixing ? "Fixing..." : "Fix"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            {totalIssues > 10 && (
              <p className="text-sm text-muted-foreground text-center" data-testid="text-more-issues">
                Showing 10 of {totalIssues} issues
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
