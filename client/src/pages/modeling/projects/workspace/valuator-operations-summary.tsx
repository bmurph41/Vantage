import { useRef } from 'react';
import { useQuery } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import {
  BarChart3, Fuel, ShoppingCart, DollarSign,
  TrendingUp, ArrowUpRight, ArrowDownRight, Download,
  Anchor, Building2, Wrench, Ship, Sailboat
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";
import { ExportPdfButton } from '@/components/ui/export-pdf-button';
import type { ProjectConfig } from "@/types/modeling";

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

const PROFIT_CENTER_META: Record<string, { label: string; icon: any; description: string }> = {
  "__storageMix": { label: "Storage Leases", icon: Anchor, description: "Wet slips, dry storage & other marina storage" },
  "commercialTenants": { label: "Commercial Leases", icon: Building2, description: "Leasable commercial space" },
  "fuelSales": { label: "Fuel Sales", icon: Fuel, description: "Fuel dock operations" },
  "shipStore": { label: "Ship Store", icon: ShoppingCart, description: "Retail merchandise" },
  "serviceDepartment": { label: "Service Dept", icon: Wrench, description: "Boat repairs & maintenance" },
  "boatRentals": { label: "Boat Rentals", icon: Ship, description: "Charter & rental operations" },
  "boatClub": { label: "Boat Club", icon: Sailboat, description: "Membership-based boat access" },
  "boatSales": { label: "Boat Sales", icon: DollarSign, description: "New & used boat sales" },
};

function getEnabledCenterKeys(config: ProjectConfig | undefined): string[] {
  if (!config) return [];
  const keys: string[] = [];

  if (config.storageMix?.items && config.storageMix.items.length > 0) {
    keys.push("__storageMix");
  }

  const pc = config.profitCenters;
  if (pc && !Array.isArray(pc)) {
    for (const [key, val] of Object.entries(pc)) {
      if (val?.isEnabled || val?.enabled) keys.push(key);
    }
  } else if (Array.isArray(pc)) {
    for (const item of pc) {
      if (item.isEnabled || item.enabled) keys.push(item.id);
    }
  }

  return keys;
}

export default function ValuatorOperationsSummary({ projectId, projectName }: ValuatorOperationsSummaryProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const dateRange = {
    startDate: format(subMonths(new Date(), 12), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
  };

  const { data: config } = useQuery<ProjectConfig>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
  });

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

  const enabledKeys = getEnabledCenterKeys(config);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (enabledKeys.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Operations Summary
            </h3>
            <p className="text-sm text-muted-foreground">
              Overview of enabled profit centers for {projectName || "this project"}
            </p>
          </div>
        </div>
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h4 className="font-semibold mb-2">No Profit Centers Configured</h4>
            <p className="text-sm text-muted-foreground">
              Enable profit centers in the project setup wizard to see your operations summary.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasFuelData = enabledKeys.includes("fuelSales");
  const hasStoreData = enabledKeys.includes("shipStore");
  const hasOpsData = (summary?.combined?.totalRevenue || 0) > 0;

  return (
    <div ref={pdfRef} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Operations Summary
          </h3>
          <p className="text-sm text-muted-foreground">
            Active profit centers for {projectName || "this project"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <ExportPdfButton contentRef={pdfRef} filename="operations-summary" title="Operations Summary" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {enabledKeys.map((key) => {
          const meta = PROFIT_CENTER_META[key];
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <Card key={key}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="mt-3">Active</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(hasFuelData || hasStoreData) && hasOpsData && (
        <>
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
            {hasFuelData && (
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
                </CardContent>
              </Card>
            )}

            {hasStoreData && (
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
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {!hasOpsData && !(hasFuelData || hasStoreData) && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h4 className="font-semibold mb-2">Profit Centers Active</h4>
            <p className="text-sm text-muted-foreground">
              Navigate to individual profit center tabs above to manage data for each revenue stream.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
