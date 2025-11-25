import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Building, DollarSign, TrendingUp, Users } from "lucide-react";

type OwnedAsset = {
  id: string;
  orgId: string;
  propertyId: string;
  acquisitionPrice: number | null;
  currentValuation: number | null;
  status: string;
  keyMetrics: {
    occupancyRate?: number;
    monthlyRevenue?: number;
    totalUnits?: number;
  } | null;
};

type KPIMetric = {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
};

export default function PortfolioKPIStrip() {
  const { data: assets, isLoading } = useQuery<OwnedAsset[]>({
    queryKey: ['/api/owned-assets'],
  });

  const activeAssets = assets?.filter(a => a.status === 'active') || [];
  
  const totalAUM = activeAssets.reduce((sum, asset) => {
    return sum + (asset.currentValuation || asset.acquisitionPrice || 0);
  }, 0);

  const avgOccupancy = activeAssets.length > 0
    ? activeAssets.reduce((sum, asset) => {
        return sum + (asset.keyMetrics?.occupancyRate || 0);
      }, 0) / activeAssets.length
    : 0;

  const totalUnits = activeAssets.reduce((sum, asset) => {
    return sum + (asset.keyMetrics?.totalUnits || 0);
  }, 0);

  const metrics: KPIMetric[] = [
    {
      label: 'Total Assets',
      value: activeAssets.length.toString(),
      icon: Building,
    },
    {
      label: 'Total AUM',
      value: `$${(totalAUM / 1000000).toFixed(1)}M`,
      icon: DollarSign,
    },
    {
      label: 'Avg Occupancy',
      value: `${avgOccupancy.toFixed(2)}%`,
      icon: TrendingUp,
    },
    {
      label: 'Total Units',
      value: totalUnits.toString(),
      icon: Users,
    },
  ];

  if (isLoading) {
    return (
      <Card data-testid="widget-portfolio-kpi">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-100 rounded animate-pulse w-20" />
                <div className="h-8 bg-gray-100 rounded animate-pulse w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="widget-portfolio-kpi">
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div key={index} className="space-y-1" data-testid={`kpi-${metric.label.toLowerCase().replace(/ /g, '-')}`}>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-gray-500" />
                  <span className="text-xs text-gray-500">{metric.label}</span>
                </div>
                <div className="text-2xl font-bold">{metric.value}</div>
                {metric.trend && (
                  <div className="text-xs text-green-600 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {metric.trend}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
