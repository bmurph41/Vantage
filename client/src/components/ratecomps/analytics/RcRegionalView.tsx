import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface RegionalData {
  state: string;
  avgRatePerFt: number;
  medianRatePerFt: number;
  count: number;
}

interface RcRegionalViewProps {
  data?: RegionalData[];
  isLoading?: boolean;
}

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

function formatRatePerFt(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'N/A';
  }
  return `$${Number(value).toFixed(2)}`;
}

export default function RcRegionalView({ data, isLoading }: RcRegionalViewProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Regional Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading regional data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MapPin className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Regional Data</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Apply filters to see rate comparisons across different states.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sortedData = [...data].sort((a, b) => b.avgRatePerFt - a.avgRatePerFt).slice(0, 15);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Average Rate by State ($/ft/month)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sortedData} layout="vertical" margin={{ left: 40, right: 20, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis 
                type="number" 
                tickFormatter={(value) => `$${value}`}
                domain={[0, 'auto']}
              />
              <YAxis 
                type="category" 
                dataKey="state" 
                width={40}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  formatRatePerFt(value),
                  name === 'avgRatePerFt' ? 'Avg Rate/Ft' : 'Median Rate/Ft'
                ]}
                labelFormatter={(label) => `${label}`}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
              />
              <Bar dataKey="avgRatePerFt" name="avgRatePerFt" radius={[0, 4, 4, 0]}>
                {sortedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {sortedData.slice(0, 5).map((item, index) => (
            <div key={item.state} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="font-medium">{item.state}:</span>
              <span className="text-muted-foreground">{item.count} rates</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
