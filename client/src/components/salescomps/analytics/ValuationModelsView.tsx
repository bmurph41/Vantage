import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, AlertCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface RegressionModel {
  data: Array<{ x: number; predicted: number; actual: number; label?: string }>;
  r2: number;
  rmse?: number;
  mae?: number;
}

interface ValuationModels {
  pricePerSlipModel: RegressionModel;
  capRateModel: RegressionModel;
}

interface ValuationModelsViewProps {
  valuationModels: ValuationModels | null;
  isLoading?: boolean;
}

export default function ValuationModelsView({ valuationModels, isLoading }: ValuationModelsViewProps) {
  if (isLoading) {
    return (
      <Card className="p-6 text-center border-dashed">
        <Calculator className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">Loading valuation models...</p>
      </Card>
    );
  }

  if (!valuationModels) {
    return (
      <Card className="p-6 text-center border-dashed">
        <Calculator className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
        <p className="text-sm text-muted-foreground">Apply filters to view valuation models</p>
      </Card>
    );
  }

  const { pricePerSlipModel, capRateModel } = valuationModels;

  // Check if models have sufficient data
  const hasPricePerSlipData = pricePerSlipModel.data.length >= 3;
  const hasCapRateData = capRateModel.data.length >= 3;

  const valuationBenchmarks = [
    { metric: "Price per Wet Slip", value: "$15,000 - $18,000", note: "National Average" },
    { metric: "Price per Dry Rack", value: "$5,000 - $8,000", note: "National Average" },
    { metric: "Target Cap Rate", value: "6.5% - 8.5%", note: "Institutional Grade" },
    { metric: "Price to NOI Multiple", value: "12x - 15x", note: "Typical Range" },
    { metric: "Occupancy Threshold", value: ">85%", note: "Investment Grade" },
  ];

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="py-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">Valuation Models & Predictive Analytics</p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                These models use regression analysis on your filtered dataset to predict pricing and returns. Actual performance may vary.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Price Per Slip Model */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4" />
              Price Per Slip Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasPricePerSlipData ? (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={pricePerSlipModel.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="x" 
                      fontSize={11}
                      tickFormatter={(value) => `${value} slips`}
                    />
                    <YAxis 
                      fontSize={11}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: any) => [`$${value.toLocaleString()}`, '']}
                      labelFormatter={(value) => `${value} slips`}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="predicted" stroke="#3b82f6" name="Predicted" strokeWidth={2} />
                    <Line type="monotone" dataKey="actual" stroke="#10b981" name="Actual" strokeWidth={2} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-xs text-muted-foreground mt-2">
                  Model R²: {pricePerSlipModel.r2.toFixed(3)}
                  {pricePerSlipModel.rmse && ` | RMSE: $${pricePerSlipModel.rmse.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                </p>
              </>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
                Insufficient data for price per slip regression (minimum 5 properties required)
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cap Rate Trend Model */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Cap Rate Trend Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasCapRateData ? (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={capRateModel.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" fontSize={11} />
                    <YAxis 
                      fontSize={11}
                      tickFormatter={(value) => `${value.toFixed(1)}%`}
                    />
                    <Tooltip
                      formatter={(value: any) => [`${value.toFixed(2)}%`, '']}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="predicted" stroke="#f59e0b" name="Predicted" strokeWidth={2} />
                    <Line type="monotone" dataKey="actual" stroke="#ef4444" name="Actual" strokeWidth={2} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-xs text-muted-foreground mt-2">
                  Model R²: {capRateModel.r2.toFixed(3)}
                  {capRateModel.mae && ` | MAE: ${capRateModel.mae.toFixed(2)}%`}
                </p>
              </>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
                Insufficient data for cap rate regression (minimum 3 years required)
              </div>
            )}
          </CardContent>
        </Card>

        {/* Valuation Benchmarks Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4" />
              Industry Valuation Benchmarks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead>Benchmark Range</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {valuationBenchmarks.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{item.metric}</TableCell>
                    <TableCell>{item.value}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{item.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
