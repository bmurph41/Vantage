import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { getRevenueByStorageType } from "@/lib/rentRollApi";
import type { TimePeriodFilter } from "@shared/timePeriodUtils";
import { calculateDateRange } from "@shared/timePeriodUtils";
import TimePeriodSelector from "./TimePeriodSelector";
import StorageTypeDetailDialog from "./StorageTypeDetailDialog";
import {
  DollarSign,
  Anchor,
  Warehouse,
  Ship,
  Box,
} from "lucide-react";

const STORAGE_TYPE_ICONS: Record<string, typeof DollarSign> = {
  "Wet Slip": Anchor,
  "Lift Slip": Anchor,
  "Dry Rack Indoor": Warehouse,
  "Dry Rack Outdoor": Box,
  "Mooring": Ship,
  "Jet Ski": Ship,
  "Land Storage": Box,
  "Winter Storage": Warehouse,
  "Other": DollarSign,
};

interface RevenueByStorageTypeProps {
  locationId?: string | null;
}

export default function RevenueByStorageType({ locationId }: RevenueByStorageTypeProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [timePeriod, setTimePeriod] = useState<TimePeriodFilter>({
    type: "Year",
    year: currentYear,
  });

  const [selectedStorageType, setSelectedStorageType] = useState<string | null>(null);

  const dateRange = calculateDateRange(timePeriod);

  const { data: revenueData, isLoading, isError, error } = useQuery({
    queryKey: ["/api/rent-roll/revenue-by-storage-type", { startDate: dateRange.startDate, endDate: dateRange.endDate, locationId }],
    queryFn: () => getRevenueByStorageType({ 
      startDate: dateRange.startDate, 
      endDate: dateRange.endDate,
      locationId: locationId || undefined 
    }),
  });

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const totalRevenue = Array.isArray(revenueData) 
    ? revenueData.reduce((sum, item) => sum + parseFloat(item.totalRevenue), 0) 
    : 0;

  if (isError) {
    return (
      <div className="space-y-6" data-testid="revenue-by-storage-type-error">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} locationId={locationId} />
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-medium text-destructive">Error Loading Revenue Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : "Failed to load revenue by storage type"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Please try selecting a different time period or refreshing the page.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} locationId={locationId} />
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="border rounded-md p-4 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="revenue-by-storage-type">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} locationId={locationId} />
        
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-medium">Revenue by Storage Type</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{dateRange.label}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Total Revenue</div>
                  <div className="text-2xl font-bold tabular-nums" data-testid="total-revenue">
                    {formatCurrency(totalRevenue.toString())}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!Array.isArray(revenueData) || revenueData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="empty-state-revenue">
                  <p className="text-sm">No revenue data for this period</p>
                  <p className="text-xs mt-1">Try selecting a different time period</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {revenueData.map((item) => {
                    const Icon = STORAGE_TYPE_ICONS[item.storageType] || DollarSign;
                    const percentage = totalRevenue > 0 ? (parseFloat(item.totalRevenue) / totalRevenue) * 100 : 0;
                    
                    return (
                      <div
                        key={item.storageType}
                        className="border rounded-md p-4 hover-elevate cursor-pointer active-elevate-2 transition-shadow"
                        onClick={() => setSelectedStorageType(item.storageType)}
                        data-testid={`storage-card-${item.storageType.replace(/\s+/g, "-").toLowerCase()}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-muted-foreground truncate">
                              {item.storageType}
                            </p>
                          </div>
                          <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-2xl font-bold tabular-nums" data-testid={`revenue-${item.storageType.replace(/\s+/g, "-").toLowerCase()}`}>
                            {formatCurrency(item.totalRevenue)}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{item.leaseCount} leases</span>
                            <span>•</span>
                            <span>{percentage.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <StorageTypeDetailDialog
        storageType={selectedStorageType}
        onClose={() => setSelectedStorageType(null)}
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        periodLabel={dateRange.label}
      />
    </div>
  );
}
