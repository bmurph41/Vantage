import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as PieChartIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface DistributionData {
  rateRanges: Array<{ range: string; count: number; avgRate: number }>;
  loaRanges: Array<{ range: string; count: number; avgRate: number }>;
  seasonalityBreakdown: Array<{ seasonality: string; count: number; avgRate: number }>;
}

interface RcDistributionViewProps {
  data?: DistributionData;
  isLoading?: boolean;
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

const SEASONALITY_LABELS: Record<string, string> = {
  'annual': 'Year-Round',
  'peak': 'Peak Season',
  'off_peak': 'Off-Peak',
  'shoulder': 'Shoulder',
  'seasonal': 'Seasonal',
};

export default function RcDistributionView({ data, isLoading }: RcDistributionViewProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PieChartIcon className="h-4 w-4" />
            Distribution Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading distribution data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <PieChartIcon className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Distribution Data</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Apply filters to see rate distribution analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Rate Range Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PieChartIcon className="h-4 w-4" />
            Rate Distribution ($/ft/month)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {data.rateRanges && data.rateRanges.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.rateRanges} margin={{ left: 10, right: 10, top: 10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="range" 
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: number) => [value, 'Count']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.rateRanges.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No rate range data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* LOA Range Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PieChartIcon className="h-4 w-4" />
            Boat Length Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {data.loaRanges && data.loaRanges.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.loaRanges} margin={{ left: 10, right: 10, top: 10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="range" 
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'count' ? value : `$${value.toFixed(2)}/ft`,
                      name === 'count' ? 'Count' : 'Avg Rate'
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No LOA range data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Seasonality Breakdown */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PieChartIcon className="h-4 w-4" />
            Seasonality Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {data.seasonalityBreakdown && data.seasonalityBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={data.seasonalityBreakdown.map(item => ({
                    ...item,
                    label: SEASONALITY_LABELS[item.seasonality] || item.seasonality,
                  }))} 
                  margin={{ left: 20, right: 20, top: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'count' ? value : `$${value.toFixed(2)}/ft`,
                      name === 'count' ? 'Rate Count' : 'Avg Rate'
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Bar yAxisId="left" dataKey="count" fill="#3b82f6" name="count" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="avgRate" fill="#10b981" name="avgRate" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No seasonality data available
              </div>
            )}
          </div>
          <div className="flex justify-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span>Rate Count</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span>Avg Rate ($/ft/mo)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
