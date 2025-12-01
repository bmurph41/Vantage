import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Map } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Slip } from "@shared/schema";

interface InventoryStats {
  wetSlips: { total: number; occupied: number; available: number; occupancyRate: number };
  dryStorage: { total: number; occupied: number; available: number; occupancyRate: number };
  trailerStorage: { total: number; occupied: number; available: number; occupancyRate: number };
}

export default function InventoryOverview() {
  const { data: slips = [], isLoading } = useQuery<Slip[]>({
    queryKey: ['/api/slips'],
  });

  // Calculate inventory stats
  const inventoryStats: InventoryStats = {
    wetSlips: { total: 0, occupied: 0, available: 0, occupancyRate: 0 },
    dryStorage: { total: 0, occupied: 0, available: 0, occupancyRate: 0 },
    trailerStorage: { total: 0, occupied: 0, available: 0, occupancyRate: 0 },
  };

  slips.forEach(slip => {
    if (slip.type === 'wet') {
      inventoryStats.wetSlips.total++;
      if (slip.isOccupied) inventoryStats.wetSlips.occupied++;
    } else if (slip.type === 'dry_stack') {
      inventoryStats.dryStorage.total++;
      if (slip.isOccupied) inventoryStats.dryStorage.occupied++;
    } else if (slip.type === 'trailer') {
      inventoryStats.trailerStorage.total++;
      if (slip.isOccupied) inventoryStats.trailerStorage.occupied++;
    }
  });

  // Calculate availability and occupancy rates
  Object.values(inventoryStats).forEach(stats => {
    stats.available = stats.total - stats.occupied;
    stats.occupancyRate = stats.total > 0 ? (stats.occupied / stats.total) * 100 : 0;
  });

  const inventoryItems = [
    {
      name: 'Wet Slips',
      stats: inventoryStats.wetSlips,
      color: 'bg-chart-1',
      testId: 'wet-slips',
    },
    {
      name: 'Dry Storage Racks',
      stats: inventoryStats.dryStorage,
      color: 'bg-chart-2',
      testId: 'dry-storage',
    },
    {
      name: 'Trailer Storage',
      stats: inventoryStats.trailerStorage,
      color: 'bg-chart-3',
      testId: 'trailer-storage',
    },
  ];

  if (isLoading) {
    return (
      <Card data-testid="inventory-overview">
        <CardHeader>
          <h3 className="text-lg font-semibold">Marina Inventory</h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-4 bg-muted rounded w-24" />
                  <div className="h-4 bg-muted rounded w-16" />
                </div>
                <div className="w-full bg-muted rounded-full h-2 mb-1" />
                <div className="flex justify-between">
                  <div className="h-3 bg-muted rounded w-20" />
                  <div className="h-3 bg-muted rounded w-16" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="inventory-overview">
      <CardHeader>
        <h3 className="text-lg font-semibold">Marina Inventory</h3>
      </CardHeader>

      <CardContent>
        <div className="space-y-6">
          {inventoryItems.map((item) => (
            <div key={item.name} data-testid={item.testId}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">{item.name}</span>
                <span className="text-sm text-muted-foreground">
                  {item.stats.occupied}/{item.stats.total}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`${item.color} h-2 rounded-full`}
                  style={{ width: `${item.stats.occupancyRate}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{Math.round(item.stats.occupancyRate)}% occupied</span>
                <span>{item.stats.available} available</span>
              </div>
            </div>
          ))}

          <div className="pt-4 border-t border-border">
            <Button variant="outline" className="w-full" data-testid="button-view-marina-map">
              <Map size={16} className="mr-2" />
              View Marina Map
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
