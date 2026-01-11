import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { DataQualitySummary, DataQualitySeverity } from "../lib/rentRollApi";

interface RentRollDataQualityPanelProps {
  data: DataQualitySummary | undefined;
  isLoading: boolean;
  isError: boolean;
}

export default function RentRollDataQualityPanel({ data, isLoading, isError }: RentRollDataQualityPanelProps) {
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
      case "ERROR":
        return <AlertCircle className="w-4 h-4" />;
      case "WARNING":
        return <AlertTriangle className="w-4 h-4" />;
      case "INFO":
        return <Info className="w-4 h-4" />;
    }
  };

  const getSeverityVariant = (severity: DataQualitySeverity): "default" | "secondary" | "destructive" => {
    switch (severity) {
      case "ERROR":
        return "destructive";
      case "WARNING":
        return "default";
      case "INFO":
        return "secondary";
    }
  };

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
            <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No data quality issues detected</p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-96 rounded-md border">
              <div className="p-4 space-y-3">
                {topIssues.map((issue) => (
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
                  </div>
                ))}
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
