import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3 } from "lucide-react";
import type { LtvDistribution } from "@/types/customer-analytics";

interface Props {
  data: LtvDistribution[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function LtvDistributionChart({ data, isLoading, error }: Props) {
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            LTV Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" data-testid="alert-ltv-distribution-error">
            <AlertDescription>
              Failed to load LTV distribution: {error.message}
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
            <BarChart3 className="h-5 w-5" />
            LTV Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-ltv-distribution">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          LTV Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 || data.every(d => d.customerCount === 0) ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No customer data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="bucket" 
                className="text-xs"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar 
                dataKey="customerCount" 
                fill="hsl(var(--primary))" 
                name="Customers"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
