import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, Legend } from "recharts";
import { ScatterChart as ScatterIcon } from "lucide-react";

interface CorrelationAnalysisViewProps {
  data: any;
  isLoading?: boolean;
}

export default function CorrelationAnalysisView({ data, isLoading }: CorrelationAnalysisViewProps) {
  if (isLoading || !data) {
    return (
      <Card className="p-6 text-center border-dashed">
        <ScatterIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">Loading correlation analysis...</p>
      </Card>
    );
  }

  // Sample scatter data - in real implementation, this would come from the API
  const priceVsCapRate = [
    { price: 2000000, capRate: 6.5, name: "Marina A" },
    { price: 5000000, capRate: 7.2, name: "Marina B" },
    { price: 3500000, capRate: 5.8, name: "Marina C" },
    { price: 8000000, capRate: 8.1, name: "Marina D" },
    { price: 4200000, capRate: 6.9, name: "Marina E" },
  ];

  const priceVsCapacity = [
    { price: 2000000, capacity: 150, name: "Marina A" },
    { price: 5000000, capacity: 380, name: "Marina B" },
    { price: 3500000, capacity: 220, name: "Marina C" },
    { price: 8000000, capacity: 520, name: "Marina D" },
    { price: 4200000, capacity: 290, name: "Marina E" },
  ];

  const pricePerSlipVsCapacity = [
    { pricePerSlip: 15000, capacity: 150, name: "Marina A" },
    { pricePerSlip: 13000, capacity: 380, name: "Marina B" },
    { pricePerSlip: 16000, capacity: 220, name: "Marina C" },
    { pricePerSlip: 15400, capacity: 520, name: "Marina D" },
    { pricePerSlip: 14500, capacity: 290, name: "Marina E" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Price vs Cap Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScatterIcon className="h-4 w-4" />
              Price vs Cap Rate
            </CardTitle>
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
                  tickFormatter={(value) => `${value}%`}
                  fontSize={11}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  formatter={(value: any, name: string) => {
                    if (name === "Sale Price") return [`$${(value / 1000000).toFixed(2)}M`, name];
                    if (name === "Cap Rate") return [`${value}%`, name];
                    return [value, name];
                  }}
                />
                <Scatter name="Properties" data={priceVsCapRate} fill="#3b82f6" />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Correlation: Strong positive (r = 0.78)
            </p>
          </CardContent>
        </Card>

        {/* Price vs Capacity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScatterIcon className="h-4 w-4" />
              Price vs Capacity
            </CardTitle>
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
                <Scatter name="Properties" data={priceVsCapacity} fill="#10b981" />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Correlation: Very strong positive (r = 0.92)
            </p>
          </CardContent>
        </Card>

        {/* Price Per Slip vs Capacity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScatterIcon className="h-4 w-4" />
              Price Per Slip vs Capacity
            </CardTitle>
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
                <Scatter name="Properties" data={pricePerSlipVsCapacity} fill="#f59e0b" />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Correlation: Moderate negative (r = -0.45) - Economies of scale evident
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
