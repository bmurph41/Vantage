import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FuelTypeChartProps {
  data: Array<{
    fuelType: string;
    gallons: string;
    revenue: string;
  }>;
  onViewDetails?: () => void;
}

const fuelTypeColors: Record<string, string> = {
  'Regular Gas': 'hsl(var(--primary))',
  'Premium Gas': 'hsl(var(--accent))',
  'Diesel': 'hsl(39, 85%, 59%)',
  'Ethanol': 'hsl(280, 65%, 60%)',
};

export function FuelTypeChart({ data, onViewDetails }: FuelTypeChartProps) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle data-testid="chart-title-fuel-type">Fuel Type Sales</CardTitle>
        {onViewDetails && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onViewDetails}
            className="text-primary hover:text-primary/80"
            data-testid="button-fuel-type-details"
          >
            View Details
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4" data-testid="fuel-type-breakdown">
          {data.map((fuel, index) => {
            const color = fuelTypeColors[fuel.fuelType] || 'hsl(var(--muted-foreground))';
            
            return (
              <div key={fuel.fuelType} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: color }}
                    data-testid={`fuel-color-${index}`}
                  />
                  <span className="text-foreground font-medium" data-testid={`fuel-name-${index}`}>
                    {fuel.fuelType}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-muted-foreground text-sm" data-testid={`fuel-gallons-${index}`}>
                    {parseFloat(fuel.gallons).toLocaleString()} gal
                  </span>
                  <span className="text-foreground font-medium" data-testid={`fuel-revenue-${index}`}>
                    ${parseFloat(fuel.revenue).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
