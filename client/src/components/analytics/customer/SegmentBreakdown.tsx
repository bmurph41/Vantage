import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Users } from "lucide-react";
import type { CustomerSegment } from "@/types/customer-analytics";

interface Props {
  data: CustomerSegment[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

const SEGMENT_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function SegmentBreakdown({ data, isLoading, error }: Props) {
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Customer Segments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" data-testid="alert-segments-error">
            <AlertDescription>
              Failed to load customer segments: {error.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Customer Segments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const chartData = data.map(segment => ({
    name: segment.segment.charAt(0).toUpperCase() + segment.segment.slice(1),
    value: segment.customerCount,
    revenue: segment.totalRevenue,
    avgRevenue: segment.avgRevenue,
  }));

  return (
    <Card data-testid="card-customer-segments">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Customer Segments
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 || data.every(d => d.customerCount === 0) ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No customer data available
          </div>
        ) : (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="hsl(var(--primary))"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={SEGMENT_COLORS[index % SEGMENT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="space-y-2">
              {data.map((segment, index) => (
                <div 
                  key={segment.segment}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  data-testid={`segment-${segment.segment}`}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
                    />
                    <div>
                      <div className="font-medium">
                        {segment.segment.charAt(0).toUpperCase() + segment.segment.slice(1)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {segment.customerCount} customers ({segment.percentage.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(segment.totalRevenue)}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(segment.avgRevenue)} avg
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
