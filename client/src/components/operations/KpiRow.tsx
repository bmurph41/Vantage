import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  previousValue?: string | number;
  format?: "currency" | "number" | "percent" | "gallons";
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  icon?: React.ReactNode;
}

function formatValue(value: string | number, format?: string): string {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return "-";
  
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(numValue);
    case "percent":
      return `${numValue.toFixed(1)}%`;
    case "gallons":
      return `${numValue.toLocaleString()} gal`;
    case "number":
    default:
      return numValue.toLocaleString();
  }
}

function calculateChange(current: string | number, previous: string | number): number {
  const curr = typeof current === "string" ? parseFloat(current) : current;
  const prev = typeof previous === "string" ? parseFloat(previous) : previous;
  
  if (isNaN(curr) || isNaN(prev) || prev === 0) return 0;
  
  return ((curr - prev) / prev) * 100;
}

export function KpiCard({
  label,
  value,
  previousValue,
  format,
  trend,
  trendLabel,
  icon,
}: KpiCardProps) {
  const displayValue = formatValue(value, format);
  const change = previousValue !== undefined ? calculateChange(value, previousValue) : null;
  const computedTrend = trend || (change !== null ? (change > 0 ? "up" : change < 0 ? "down" : "neutral") : "neutral");
  
  return (
    <Card className="flex-1 min-w-[150px]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{label}</span>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </div>
        <div className="text-2xl font-bold">{displayValue}</div>
        {(change !== null || trendLabel) && (
          <div className="flex items-center gap-1 mt-1">
            {computedTrend === "up" && (
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            )}
            {computedTrend === "down" && (
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            )}
            {computedTrend === "neutral" && (
              <Minus className="h-4 w-4 text-muted-foreground" />
            )}
            <span
              className={cn(
                "text-sm",
                computedTrend === "up" && "text-green-500",
                computedTrend === "down" && "text-red-500",
                computedTrend === "neutral" && "text-muted-foreground"
              )}
            >
              {trendLabel || (change !== null ? `${change > 0 ? "+" : ""}${change.toFixed(1)}%` : "")}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface KpiRowProps {
  kpis: KpiCardProps[];
  className?: string;
}

export function KpiRow({ kpis, className }: KpiRowProps) {
  return (
    <div className={cn("flex flex-wrap gap-4 mb-6", className)}>
      {kpis.map((kpi, index) => (
        <KpiCard key={index} {...kpi} />
      ))}
    </div>
  );
}

export default KpiRow;
