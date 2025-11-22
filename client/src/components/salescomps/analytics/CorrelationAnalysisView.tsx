import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ScatterChart as ScatterIcon, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CorrelationData {
  priceVsCapRate: {
    data: Array<{ x: number; y: number; name: string; id: string }>;
    correlation: number;
    sampleSize: number;
  };
  priceVsCapacity: {
    data: Array<{ x: number; y: number; name: string; id: string }>;
    correlation: number;
    sampleSize: number;
  };
  pricePerSlipVsCapacity: {
    data: Array<{ x: number; y: number; name: string; id: string }>;
    correlation: number;
    sampleSize: number;
  };
}

interface CorrelationAnalysisViewProps {
  correlationData: CorrelationData | null;
  isLoading?: boolean;
}

function getCorrelationStrength(r: number): { label: string; color: string } {
  const absR = Math.abs(r);
  if (absR >= 0.9) return { label: 'Very Strong', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' };
  if (absR >= 0.7) return { label: 'Strong', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' };
  if (absR >= 0.5) return { label: 'Moderate', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' };
  if (absR >= 0.3) return { label: 'Weak', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100' };
  return { label: 'Very Weak', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100' };
}

export default function CorrelationAnalysisView({ correlationData, isLoading }: CorrelationAnalysisViewProps) {
  if (isLoading) {
    return (
      <Card className="p-6 text-center border-dashed">
        <ScatterIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">Loading correlation analysis...</p>
      </Card>
    );
  }

  if (!correlationData) {
    return (
      <Card className="p-6 text-center border-dashed">
        <ScatterIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">Apply filters to view correlation analysis</p>
      </Card>
    );
  }

  const { priceVsCapRate, priceVsCapacity, pricePerSlipVsCapacity } = correlationData;

  // Transform data for charts
  const priceCapRateChartData = priceVsCapRate.data.map(d => ({
    price: d.x,
    capRate: d.y,
    name: d.name,
  }));

  const priceCapacityChartData = priceVsCapacity.data.map(d => ({
    price: d.x,
    capacity: d.y,
    name: d.name,
  }));

  const pricePerSlipCapacityChartData = pricePerSlipVsCapacity.data.map(d => ({
    capacity: d.x,
    pricePerSlip: d.y,
    name: d.name,
  }));

  const priceCapRateStrength = getCorrelationStrength(priceVsCapRate.correlation);
  const priceCapacityStrength = getCorrelationStrength(priceVsCapacity.correlation);
  const pricePerSlipCapacityStrength = getCorrelationStrength(pricePerSlipVsCapacity.correlation);

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">Correlation Analysis</p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Analyzes relationships between key variables in your filtered dataset using Pearson correlation coefficients. Positive values indicate variables move together; negative values indicate inverse relationships.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Price vs Cap Rate */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ScatterIcon className="h-4 w-4" />
                Price vs Cap Rate
              </CardTitle>
              <Badge className={priceCapRateStrength.color}>
                {priceCapRateStrength.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="price" 
                  name="Sale Price"
                  tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                  fontSize={11}
                />
                <YAxis 
                  dataKey="capRate" 
                  name="Cap Rate"
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                  fontSize={11}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  formatter={(value: any, name: string) => {
                    if (name === "Sale Price") return [`$${(value / 1000000).toFixed(2)}M`, name];
                    if (name === "Cap Rate") return [`${value.toFixed(2)}%`, name];
                    return [value, name];
                  }}
                />
                <Scatter name="Properties" data={priceCapRateChartData} fill="#3b82f6" />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              r = {priceVsCapRate.correlation.toFixed(3)} | n = {priceVsCapRate.sampleSize}
            </p>
          </CardContent>
        </Card>

        {/* Price vs Capacity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ScatterIcon className="h-4 w-4" />
                Price vs Capacity
              </CardTitle>
              <Badge className={priceCapacityStrength.color}>
                {priceCapacityStrength.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="price" 
                  name="Sale Price"
                  tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                  fontSize={11}
                />
                <YAxis 
                  dataKey="capacity" 
                  name="Capacity"
                  tickFormatter={(value) => `${value} slips`}
                  fontSize={11}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  formatter={(value: any, name: string) => {
                    if (name === "Sale Price") return [`$${(value / 1000000).toFixed(2)}M`, name];
                    if (name === "Capacity") return [`${value} slips`, name];
                    return [value, name];
                  }}
                />
                <Scatter name="Properties" data={priceCapacityChartData} fill="#10b981" />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              r = {priceVsCapacity.correlation.toFixed(3)} | n = {priceVsCapacity.sampleSize}
            </p>
          </CardContent>
        </Card>

        {/* Price Per Slip vs Capacity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ScatterIcon className="h-4 w-4" />
                Price Per Slip vs Capacity
              </CardTitle>
              <Badge className={pricePerSlipCapacityStrength.color}>
                {pricePerSlipCapacityStrength.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="capacity" 
                  name="Capacity"
                  tickFormatter={(value) => `${value} slips`}
                  fontSize={11}
                />
                <YAxis 
                  dataKey="pricePerSlip" 
                  name="Price Per Slip"
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  fontSize={11}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  formatter={(value: any, name: string) => {
                    if (name === "Price Per Slip") return [`$${value.toLocaleString()}`, name];
                    if (name === "Capacity") return [`${value} slips`, name];
                    return [value, name];
                  }}
                />
                <Scatter name="Properties" data={pricePerSlipCapacityChartData} fill="#f59e0b" />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              r = {pricePerSlipVsCapacity.correlation.toFixed(3)} | n = {pricePerSlipVsCapacity.sampleSize}
              {pricePerSlipVsCapacity.correlation < -0.3 && <span className="ml-2">• Economies of scale evident</span>}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
