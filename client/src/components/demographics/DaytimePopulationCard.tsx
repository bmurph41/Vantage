import { useMemo } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Sun } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface DemographicData {
  totalPopulation?: number;
  medianHouseholdIncome?: number;
  medianHomeValue?: number;
  perCapitaIncome?: number;
  populationDensity?: number;
  educationLevels?: Record<string, number>;
  employmentStats?: Record<string, number>;
  householdSize?: number;
}

interface DaytimePopulationCardProps {
  demographics: DemographicData | null;
  locationLabel?: string;
}

export default function DaytimePopulationCard({ demographics, locationLabel }: DaytimePopulationCardProps) {
  const { residential, daytime, ratio, workers, description } = useMemo(() => {
    if (!demographics || !demographics.totalPopulation) {
      return { residential: 0, daytime: 0, ratio: 0, workers: 0, description: '' };
    }

    const res = demographics.totalPopulation;
    const employed = demographics.employmentStats?.employed
      || demographics.employmentStats?.civilian_employed
      || 0;

    const commuterInflow = Math.round(employed * 0.15);
    const day = res + commuterInflow;
    const r = day / res;

    let desc = '';
    if (r > 1.1) {
      desc = 'This area sees significant daytime population growth, suggesting a strong commercial/employment hub. Higher foot traffic during business hours benefits marina-related retail and services.';
    } else if (r > 1.02) {
      desc = 'Daytime population is moderately higher than residential, indicating some commuter inflow. This supports consistent demand for daytime marina services.';
    } else {
      desc = 'Daytime and residential populations are similar, typical of residential or balanced suburban areas. Marina demand is likely driven by local residents.';
    }

    return { residential: res, daytime: day, ratio: r, workers: employed, description: desc };
  }, [demographics]);

  if (!demographics) {
    return (
      <Card data-testid="card-daytime-pop-empty">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4" />
            <h3 className="text-base font-semibold text-foreground">Daytime Population</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Sun className="mx-auto h-12 w-12 mb-4" />
            <p className="text-sm">Select a location to view daytime population estimate</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxVal = Math.max(residential, daytime);
  const residentialWidth = maxVal > 0 ? (residential / maxVal) * 100 : 0;
  const daytimeWidth = maxVal > 0 ? (daytime / maxVal) * 100 : 0;

  return (
    <Card data-testid="card-daytime-pop">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4" />
            <h3 className="text-base font-semibold text-foreground">Daytime Population</h3>
          </div>
          {locationLabel && (
            <span className="text-xs text-muted-foreground">{locationLabel}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-muted/50 rounded-lg" data-testid="stat-residential-pop">
            <p className="text-xs text-muted-foreground">Residential Pop.</p>
            <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              {formatNumber(residential)}
            </p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg" data-testid="stat-daytime-pop">
            <p className="text-xs text-muted-foreground">Est. Daytime Pop.</p>
            <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">
              {formatNumber(daytime)}
            </p>
          </div>
        </div>

        <div className="space-y-2" data-testid="pop-comparison-bars">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Residential</span>
              <span className="font-medium">{formatNumber(residential)}</span>
            </div>
            <div className="h-4 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${residentialWidth}%` }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Estimated Daytime</span>
              <span className="font-medium">{formatNumber(daytime)}</span>
            </div>
            <div className="h-4 bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${daytimeWidth}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg" data-testid="stat-ratio">
          <div>
            <p className="text-xs text-muted-foreground">Daytime/Residential Ratio</p>
            <p className="text-lg font-semibold">{ratio.toFixed(2)}x</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Workers (Employed)</p>
            <p className="text-sm font-medium">{formatNumber(workers)}</p>
          </div>
        </div>

        <div className="p-3 bg-accent/10 rounded-lg" data-testid="pop-description">
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
