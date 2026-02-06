/**
 * LeaseKpiCards
 * =============
 * KPI summary cards shared between Operations and Valuator.
 * Reads stats from the unified hook, layout adapts to context.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";
import { useUnifiedLeaseStats } from "@/hooks/use-unified-leases";
import { useLeaseContext } from "./LeaseContextProvider";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export function LeaseKpiCards() {
  const { stats, loading } = useUnifiedLeaseStats();
  const { features } = useLeaseContext();

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-7 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      label: "Total Tenants",
      value: String(stats.totalLeases),
      subLabel: `${stats.activeLeases} active`,
      icon: Building2,
      show: true,
    },
    {
      label: "Total SF",
      value: stats.totalSf.toLocaleString(),
      subLabel: undefined,
      icon: FileSpreadsheet,
      show: true,
    },
    {
      label: "Monthly Base Rent",
      value: formatCurrency(stats.totalMonthlyBaseRent),
      subLabel: `Annual: ${formatCurrency(stats.totalMonthlyBaseRent * 12)}`,
      icon: DollarSign,
      show: true,
    },
    {
      label: "Avg Rent/SF",
      value: `$${stats.avgRentPerSf.toFixed(2)}`,
      subLabel: "per SF/year",
      icon: TrendingUp,
      show: true,
    },
    {
      label: features.leaseAlerts ? "Expiring 90d" : "Expiring 12mo",
      value: String(
        features.leaseAlerts
          ? stats.expiringWithin90Days
          : stats.expiringWithin12Months
      ),
      subLabel: features.leaseAlerts
        ? `${stats.expiringWithin12Months} within 12mo`
        : undefined,
      icon: AlertTriangle,
      iconColor:
        (features.leaseAlerts
          ? stats.expiringWithin90Days
          : stats.expiringWithin12Months) > 0
          ? "text-orange-500"
          : "text-muted-foreground",
      valueColor:
        (features.leaseAlerts
          ? stats.expiringWithin90Days
          : stats.expiringWithin12Months) > 0
          ? "text-orange-600"
          : undefined,
      show: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards
        .filter((c) => c.show)
        .map((card, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <card.icon
                  className={`h-4 w-4 ${(card as any).iconColor || "text-muted-foreground"}`}
                />
                <span className="text-sm text-muted-foreground">
                  {card.label}
                </span>
              </div>
              <div
                className={`text-2xl font-bold ${(card as any).valueColor || ""}`}
              >
                {card.value}
              </div>
              {card.subLabel && (
                <div className="text-xs text-muted-foreground">
                  {card.subLabel}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
