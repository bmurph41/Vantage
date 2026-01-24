import { useQuery } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import {
  BarChart3, Fuel, ShoppingCart, DollarSign,
  TrendingUp, ArrowUpRight, ArrowDownRight, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";

interface ValuatorOperationsSummaryProps {
  projectId: string;
  projectName?: string;
}

interface OperationsSummary {
  fuel: {
    totalGallons: number;
    totalRevenue: number;
    totalCogs: number;
    grossMargin: number;
    transactionCount: number;
  };
  shipStore: {
    totalRevenue: number;
    totalCogs: number;
    grossMargin: number;
    transactionCount: number;
  };
  combined: {
    totalRevenue: number;
    totalCogs: number;
    grossMargin: number;
    marginPercent: string;
  };
}

export default function ValuatorOperationsSummary({ projectId, projectName }: ValuatorOperationsSummaryProps) {
  const dateRange = {
    startDate: format(subMonths(new Date(), 12), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  };

  const { data: summary, isLoading } = useQuery<OperationsSummary>({
    queryKey: ["/api/operations-context/projects", projectId, "ops/summary", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const res = await fetch(`/api/operations-context/projects/${projectId}/ops/summary?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch summary");
      const data = await res.json();
      return data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const hasData = (summary?.combined?.totalRevenue || 0) > 0;
  const fuelShare = hasData && summary
    ? (summary.fuel.totalRevenue / summary.combined.totalRevenue) * 100
    : 0;
  const storeShare = hasData && summary
    ? (summary.shipStore.totalRevenue / summary.combined.totalRevenue) * 100
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Operations Summary
          </h3>
          <p className="text-sm text-muted-foreground">
            Combined fuel and ship store performance for {projectName || "this project"}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(summary?.combined?.totalRevenue || 0)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total COGS</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(summary?.combined?.totalCogs || 0)}
                </p>
              </div>
              <ArrowDownRight className="h-8 w-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gross Margin</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary?.combined?.grossMargin || 0)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Margin %</p>
                <p className="text-2xl font-bold">
                  {summary?.combined?.marginPercent || 0}%
                </p>
              </div>
              <ArrowUpRight className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fuel className="h-5 w-5" />
              Fuel Sales
            </CardTitle>
            <CardDescription>
              {summary?.fuel?.transactionCount || 0} transactions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-xl font-semibold">
                  {formatCurrency(summary?.fuel?.totalRevenue || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gross Margin</p>
                <p className="text-xl font-semibold text-green-600">
                  {formatCurrency(summary?.fuel?.grossMargin || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Gallons</p>
                <p className="text-xl font-semibold">
                  {(summary?.fuel?.totalGallons || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">COGS</p>
                <p className="text-xl font-semibold">
                  {formatCurrency(summary?.fuel?.totalCogs || 0)}
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Revenue Share</span>
                <span>{fuelShare.toFixed(1)}%</span>
              </div>
              <Progress value={fuelShare} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Ship Store
            </CardTitle>
            <CardDescription>
              {summary?.shipStore?.transactionCount || 0} transactions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-xl font-semibold">
                  {formatCurrency(summary?.shipStore?.totalRevenue || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gross Margin</p>
                <p className="text-xl font-semibold text-green-600">
                  {formatCurrency(summary?.shipStore?.grossMargin || 0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Transaction</p>
                <p className="text-xl font-semibold">
                  {summary?.shipStore?.transactionCount 
                    ? formatCurrency((summary.shipStore.totalRevenue || 0) / summary.shipStore.transactionCount)
                    : "$0.00"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">COGS</p>
                <p className="text-xl font-semibold">
                  {formatCurrency(summary?.shipStore?.totalCogs || 0)}
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Revenue Share</span>
                <span>{storeShare.toFixed(1)}%</span>
              </div>
              <Progress value={storeShare} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {!hasData && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h4 className="font-semibold mb-2">No Operations Data Yet</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Add fuel sales and ship store transactions to see your operations summary
            </p>
            <div className="flex justify-center gap-4">
              <Badge variant="outline" className="text-sm py-1 px-3">
                <Fuel className="h-4 w-4 mr-1" />
                Add Fuel Sales
              </Badge>
              <Badge variant="outline" className="text-sm py-1 px-3">
                <ShoppingCart className="h-4 w-4 mr-1" />
                Add Ship Store Sales
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
