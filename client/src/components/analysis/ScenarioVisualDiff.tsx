import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUp, ArrowDown, Minus, GitCompare, AlertTriangle, TrendingUp
} from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";

export interface ScenarioData {
  name: string;
  noi: number;
  revenue: number;
  expenses: number;
  capRate: number;
  irr: number;
  equityMultiple: number;
  cashOnCash: number;
  purchasePrice?: number;
  exitPrice?: number;
  debtService?: number;
  dscr?: number;
  occupancy?: number;
  noiMargin?: number;
}

interface MetricDiff {
  label: string;
  leftValue: number;
  rightValue: number;
  delta: number;
  deltaPercent: number;
  format: "currency" | "percent" | "multiple" | "number";
  higherIsBetter: boolean;
}

interface ScenarioVisualDiffProps {
  scenarioA: ScenarioData;
  scenarioB: ScenarioData;
}

function formatValue(value: number, format: string): string {
  switch (format) {
    case "currency":
      if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
      if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
      return formatCurrency(value);
    case "percent":
      return `${value.toFixed(2)}%`;
    case "multiple":
      return `${value.toFixed(2)}x`;
    case "number":
      return value.toFixed(2);
    default:
      return String(value);
  }
}

function formatDelta(delta: number, format: string): string {
  const sign = delta > 0 ? "+" : "";
  switch (format) {
    case "currency":
      if (Math.abs(delta) >= 1_000_000) return `${sign}$${(delta / 1_000_000).toFixed(2)}M`;
      if (Math.abs(delta) >= 1_000) return `${sign}$${(delta / 1_000).toFixed(0)}K`;
      return `${sign}${formatCurrency(delta)}`;
    case "percent":
      return `${sign}${delta.toFixed(2)}%`;
    case "multiple":
      return `${sign}${delta.toFixed(2)}x`;
    case "number":
      return `${sign}${delta.toFixed(2)}`;
    default:
      return `${sign}${delta}`;
  }
}

function DeltaBar({ deltaPercent, higherIsBetter }: { deltaPercent: number; higherIsBetter: boolean }) {
  const isPositive = deltaPercent > 0;
  const isBetter = higherIsBetter ? isPositive : !isPositive;
  const absPercent = Math.min(Math.abs(deltaPercent), 100);
  const barColor = deltaPercent === 0
    ? "bg-gray-300"
    : isBetter
      ? "bg-green-500"
      : "bg-red-500";

  return (
    <div className="flex items-center gap-1 w-24">
      {/* Left side (negative) */}
      <div className="flex-1 flex justify-end">
        {deltaPercent < 0 && (
          <div
            className={`h-2 rounded-l ${barColor}`}
            style={{ width: `${absPercent}%` }}
          />
        )}
      </div>
      {/* Center line */}
      <div className="w-px h-4 bg-gray-400 flex-shrink-0" />
      {/* Right side (positive) */}
      <div className="flex-1">
        {deltaPercent > 0 && (
          <div
            className={`h-2 rounded-r ${barColor}`}
            style={{ width: `${absPercent}%` }}
          />
        )}
      </div>
    </div>
  );
}

function DeltaIndicator({ delta, deltaPercent, higherIsBetter }: {
  delta: number;
  deltaPercent: number;
  higherIsBetter: boolean;
}) {
  if (Math.abs(delta) < 0.001) {
    return (
      <div className="flex items-center gap-1 text-gray-500">
        <Minus className="h-3 w-3" />
        <span className="text-xs">No change</span>
      </div>
    );
  }

  const isPositive = delta > 0;
  const isBetter = higherIsBetter ? isPositive : !isPositive;
  const color = isBetter ? "text-green-600" : "text-red-600";
  const Icon = isPositive ? ArrowUp : ArrowDown;

  return (
    <div className={`flex items-center gap-1 ${color}`}>
      <Icon className="h-3 w-3" />
      <span className="text-xs font-semibold">
        {deltaPercent > 0 ? "+" : ""}{deltaPercent.toFixed(1)}%
      </span>
    </div>
  );
}

export default function ScenarioVisualDiff({ scenarioA, scenarioB }: ScenarioVisualDiffProps) {
  const metrics: MetricDiff[] = useMemo(() => {
    const buildMetric = (
      label: string,
      key: keyof ScenarioData,
      format: MetricDiff["format"],
      higherIsBetter: boolean
    ): MetricDiff | null => {
      const left = scenarioA[key] as number | undefined;
      const right = scenarioB[key] as number | undefined;
      if (left == null && right == null) return null;
      const l = left ?? 0;
      const r = right ?? 0;
      const delta = r - l;
      const deltaPercent = l !== 0 ? (delta / Math.abs(l)) * 100 : (r !== 0 ? 100 : 0);
      return { label, leftValue: l, rightValue: r, delta, deltaPercent, format, higherIsBetter };
    };

    return [
      buildMetric("NOI", "noi", "currency", true),
      buildMetric("Revenue", "revenue", "currency", true),
      buildMetric("Expenses", "expenses", "currency", false),
      buildMetric("Cap Rate", "capRate", "percent", false),
      buildMetric("IRR", "irr", "percent", true),
      buildMetric("Equity Multiple", "equityMultiple", "multiple", true),
      buildMetric("Cash-on-Cash", "cashOnCash", "percent", true),
      buildMetric("Purchase Price", "purchasePrice", "currency", false),
      buildMetric("Exit Price", "exitPrice", "currency", true),
      buildMetric("Debt Service", "debtService", "currency", false),
      buildMetric("DSCR", "dscr", "number", true),
      buildMetric("Occupancy", "occupancy", "percent", true),
      buildMetric("NOI Margin", "noiMargin", "percent", true),
    ].filter((m): m is MetricDiff => m !== null);
  }, [scenarioA, scenarioB]);

  const THRESHOLD = 5;

  const keyDifferences = useMemo(() => {
    return [...metrics]
      .filter((m) => Math.abs(m.deltaPercent) > 0.01)
      .sort((a, b) => Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent))
      .slice(0, 5);
  }, [metrics]);

  const highlightedMetrics = useMemo(() => {
    return new Set(metrics.filter((m) => Math.abs(m.deltaPercent) > THRESHOLD).map((m) => m.label));
  }, [metrics]);

  if (metrics.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <GitCompare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="font-medium text-muted-foreground">No scenario data to compare</p>
          <p className="text-sm text-muted-foreground mt-1">
            Select two scenarios with financial metrics to see a side-by-side comparison.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            Scenario Comparison
          </CardTitle>
          <CardDescription>
            Side-by-side comparison between "{scenarioA.name}" and "{scenarioB.name}"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2.5 px-3 font-semibold w-[180px]">Metric</th>
                  <th className="text-right py-2.5 px-3 font-semibold">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                      {scenarioA.name}
                    </span>
                  </th>
                  <th className="text-right py-2.5 px-3 font-semibold">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-50 text-purple-700">
                      {scenarioB.name}
                    </span>
                  </th>
                  <th className="text-center py-2.5 px-3 font-semibold w-[100px]">Delta</th>
                  <th className="text-center py-2.5 px-3 font-semibold w-[120px]">Diff</th>
                  <th className="text-center py-2.5 px-3 font-semibold w-[100px]">Change</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => {
                  const isHighlighted = highlightedMetrics.has(metric.label);
                  return (
                    <tr
                      key={metric.label}
                      className={`border-b transition-colors ${
                        isHighlighted
                          ? "bg-amber-50/60 hover:bg-amber-50"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{metric.label}</span>
                          {isHighlighted && (
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                          )}
                        </div>
                      </td>
                      <td className="text-right py-2.5 px-3 font-mono text-sm">
                        {formatValue(metric.leftValue, metric.format)}
                      </td>
                      <td className="text-right py-2.5 px-3 font-mono text-sm">
                        {formatValue(metric.rightValue, metric.format)}
                      </td>
                      <td className="text-center py-2.5 px-3 font-mono text-xs">
                        <span
                          className={
                            Math.abs(metric.delta) < 0.001
                              ? "text-gray-500"
                              : (metric.higherIsBetter ? metric.delta > 0 : metric.delta < 0)
                                ? "text-green-600 font-semibold"
                                : "text-red-600 font-semibold"
                          }
                        >
                          {formatDelta(metric.delta, metric.format)}
                        </span>
                      </td>
                      <td className="text-center py-2.5 px-3">
                        <DeltaBar
                          deltaPercent={metric.deltaPercent}
                          higherIsBetter={metric.higherIsBetter}
                        />
                      </td>
                      <td className="text-center py-2.5 px-3">
                        <DeltaIndicator
                          delta={metric.delta}
                          deltaPercent={metric.deltaPercent}
                          higherIsBetter={metric.higherIsBetter}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Key Differences Summary */}
      {keyDifferences.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              Key Differences
            </CardTitle>
            <CardDescription>
              Top {keyDifferences.length} largest metric variations between scenarios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {keyDifferences.map((diff, idx) => {
                const isBetter = diff.higherIsBetter
                  ? diff.delta > 0
                  : diff.delta < 0;
                return (
                  <div
                    key={diff.label}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isBetter
                        ? "bg-green-50/50 border-green-200"
                        : "bg-red-50/50 border-red-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className={`h-6 w-6 flex items-center justify-center p-0 text-xs ${
                          isBetter ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {idx + 1}
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">{diff.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatValue(diff.leftValue, diff.format)} vs {formatValue(diff.rightValue, diff.format)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${isBetter ? "text-green-600" : "text-red-600"}`}>
                        {formatDelta(diff.delta, diff.format)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {diff.deltaPercent > 0 ? "+" : ""}{diff.deltaPercent.toFixed(1)}% change
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
