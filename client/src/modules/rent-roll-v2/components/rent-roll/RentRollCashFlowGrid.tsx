import { useState, KeyboardEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { getMonthlySummary, upsertPnlRackRevenue, regenerateCashFlows } from "../lib/rentRollApi";
import { useToast } from "@/hooks/use-toast";
import { format, subMonths, startOfYear, endOfYear } from "date-fns";
import { RefreshCw } from "lucide-react";

interface RentRollCashFlowGridProps {
  limit?: number;
  locationId?: string | null;
}

export default function RentRollCashFlowGrid({ limit, locationId }: RentRollCashFlowGridProps) {
  const { toast } = useToast();
  const [timeframe, setTimeframe] = useState("this-year");
  const [editingCell, setEditingCell] = useState<{ period: string; value: string } | null>(null);
  
  // Mutation for updating P&L revenue
  const updatePnlMutation = useMutation({
    mutationFn: upsertPnlRackRevenue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/monthly-summary"] });
      toast({
        title: "P&L revenue updated",
        description: "Monthly P&L rack revenue has been saved",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update P&L revenue",
        variant: "destructive",
      });
    },
  });

  // Mutation for regenerating cash flows
  const regenerateMutation = useMutation({
    mutationFn: () => {
      if (!locationId) throw new Error("No project selected");
      return regenerateCashFlows(locationId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/monthly-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/leases"] });
      toast({
        title: "Cash flows regenerated",
        description: `Successfully processed ${result.generatedCount} of ${result.processedCount} leases`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to regenerate cash flows",
        variant: "destructive",
      });
    },
  });
  
  // Calculate date range based on timeframe
  const getDateRange = () => {
    const now = new Date();
    switch (timeframe) {
      case "this-year":
        return {
          from: format(startOfYear(now), "yyyy-MM"),
          to: format(endOfYear(now), "yyyy-MM"),
        };
      case "last-12-months":
        return {
          from: format(subMonths(now, 12), "yyyy-MM"),
          to: format(now, "yyyy-MM"),
        };
      default:
        return {
          from: "2024-01",
          to: "2026-12",
        };
    }
  };

  const dateRange = getDateRange();
  const { data: periods = [], isLoading } = useQuery({
    queryKey: ["/api/rent-roll/monthly-summary", dateRange.from, dateRange.to, locationId],
    queryFn: () => getMonthlySummary({ ...dateRange, locationId: locationId || undefined }),
  });
  const rows = [
    { label: "Total Contracted Revenue", key: "totalContractedRevenue", format: "currency", testId: "row-contracted-revenue" },
    { label: "Monthly P&L Rack Revenue", key: "pnlRackRevenue", format: "currency", editable: true, testId: "row-pnl-revenue" },
    { label: "Delta", key: "delta", format: "currency", conditional: true, testId: "row-delta" },
    { label: "Monthly Rent Roll Count", key: "rentRollCount", format: "number", testId: "row-rent-roll-count" },
    { label: "Move-Ins", key: "moveIns", format: "number", testId: "row-move-ins" },
    { label: "Move-Outs", key: "moveOuts", format: "number", testId: "row-move-outs" },
    { label: "Net Moves", key: "netMoves", format: "number", testId: "row-net-moves" },
    { label: "Rent Roll Count by Net Moves", key: "rentRollCountByNetMoves", format: "number", testId: "row-count-by-net-moves" },
    { label: "Discrepancy", key: "discrepancy", format: "number", highlight: true, testId: "row-discrepancy" },
  ];

  const formatValue = (value: any, format: string) => {
    if (value === null || value === undefined) return "-";
    
    if (format === "currency") {
      const num = typeof value === "string" ? parseFloat(value) : value;
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num);
    }
    
    return value.toString();
  };

  const getConditionalClass = (value: any, conditional?: boolean) => {
    if (!conditional) return "";
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (num > 0) return "text-green-600";
    if (num < 0) return "text-red-600";
    return "";
  };

  const handleCellClick = (periodDate: string, currentValue: any) => {
    const valueStr = currentValue?.toString() || "";
    setEditingCell({ period: periodDate, value: valueStr });
  };

  const handleCellBlur = () => {
    if (editingCell && editingCell.value !== "") {
      const amount = parseFloat(editingCell.value);
      if (!isNaN(amount)) {
        updatePnlMutation.mutate([{
          periodDate: editingCell.period,
          amount: amount,
        }]);
      }
    }
    setEditingCell(null);
  };

  const handleCellKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="cash-flow-grid">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0 pb-4">
        <CardTitle className="text-lg font-medium">Monthly Cash Flows</CardTitle>
        <div className="flex items-center gap-2">
          {locationId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              data-testid="button-regenerate-cashflows"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
              {regenerateMutation.isPending ? "Regenerating..." : "Regenerate Cash Flows"}
            </Button>
          )}
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-40" data-testid="select-timeframe">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-year">This Year</SelectItem>
              <SelectItem value="last-12-months">Last 12 Months</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {periods.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No cash flow data available</p>
            <p className="text-xs mt-1">Add leases to generate monthly cash flows</p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-always-visible">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="sticky left-0 bg-muted px-3 py-2 text-left font-semibold uppercase tracking-wide text-foreground w-48 min-w-48 z-10 border-r border-border">
                    Metric
                  </th>
                  {(limit ? periods.slice(0, limit) : periods).map((period: any, idx: number) => (
                    <th
                      key={idx}
                      className="px-2 py-2 text-center font-semibold uppercase tracking-wide text-foreground w-20 min-w-20"
                      data-testid={`header-period-${idx}`}
                    >
                      {period.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr
                    key={row.key}
                    className={`border-b ${rowIdx % 2 === 0 ? "bg-background" : "bg-muted/30"} hover-elevate`}
                    data-testid={row.testId}
                  >
                    <td className={`sticky left-0 ${rowIdx % 2 === 0 ? "bg-background" : "bg-muted"} px-3 py-2 font-medium text-foreground z-10 border-r border-border`}>
                      <span className="whitespace-nowrap">{row.label}</span>
                      {row.editable && (
                        <span className="ml-1 text-xs text-muted-foreground">(editable)</span>
                      )}
                    </td>
                    {(limit ? periods.slice(0, limit) : periods).map((period: any, colIdx: number) => {
                      const isEditing = row.editable && editingCell?.period === period.periodDate;
                      return (
                        <td
                          key={colIdx}
                          className={`px-2 py-2 text-center tabular-nums ${
                            row.conditional ? getConditionalClass(period[row.key], true) : ""
                          } ${row.highlight && period[row.key] !== 0 ? "font-semibold bg-yellow-50 dark:bg-yellow-950/20" : ""} ${
                            row.editable ? "cursor-pointer hover:bg-accent/50" : ""
                          }`}
                          onClick={() => row.editable && handleCellClick(period.periodDate, period[row.key])}
                          data-testid={`${row.testId}-${colIdx}`}
                        >
                          {isEditing && editingCell ? (
                            <Input
                              type="number"
                              value={editingCell.value}
                              onChange={(e) => setEditingCell({ period: editingCell.period, value: e.target.value })}
                              onBlur={handleCellBlur}
                              onKeyDown={handleCellKeyDown}
                              className="h-7 w-20 mx-auto text-center"
                              autoFocus
                              data-testid={`input-pnl-${colIdx}`}
                            />
                          ) : (
                            <span className={row.editable ? "border-b border-dashed border-muted-foreground/30" : ""}>
                              {formatValue(period[row.key], row.format || "number")}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
