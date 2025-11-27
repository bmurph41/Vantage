import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Layers } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";

interface StorageTypeData {
  storageType: string;
  avgRatePerFt: number;
  medianRatePerFt: number;
  count: number;
  avgMonthlyRate: number;
}

interface RcStorageTypeViewProps {
  data?: StorageTypeData[];
  isLoading?: boolean;
}

const STORAGE_TYPE_LABELS: Record<string, string> = {
  'wet_slip': 'Wet Slip',
  'dry_rack': 'Dry Rack',
  'mooring': 'Mooring',
  'trailer': 'Trailer',
  'rack_storage': 'Rack Storage',
  'lift_storage': 'Lift Storage',
  'kayak_sup': 'Kayak/SUP',
  'jet_ski': 'Jet Ski',
  'rv_space': 'RV Space',
};

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

function formatRatePerFt(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'N/A';
  }
  return `$${Number(value).toFixed(2)}/ft`;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'N/A';
  }
  return `$${Math.round(Number(value)).toLocaleString('en-US')}`;
}

export default function RcStorageTypeView({ data, isLoading }: RcStorageTypeViewProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Storage Type Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading storage type data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Layers className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Storage Type Data</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Apply filters to see rate analysis by storage type.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map(item => ({
    ...item,
    label: STORAGE_TYPE_LABELS[item.storageType] || item.storageType,
  })).sort((a, b) => b.avgRatePerFt - a.avgRatePerFt);

  const pieData = data.map((item, index) => ({
    name: STORAGE_TYPE_LABELS[item.storageType] || item.storageType,
    value: item.count,
    fill: COLORS[index % COLORS.length],
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Rate by Storage Type ($/ft/month)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis 
                  type="number" 
                  tickFormatter={(value) => `$${value}`}
                  domain={[0, 'auto']}
                />
                <YAxis 
                  type="category" 
                  dataKey="label" 
                  width={80}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    formatRatePerFt(value),
                    name === 'avgRatePerFt' ? 'Avg Rate' : 'Median Rate'
                  ]}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Bar dataKey="avgRatePerFt" name="avgRatePerFt" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Rate Distribution by Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  formatter={(value: number) => [`${value} rates`, 'Count']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Storage Type Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Storage Type</th>
                  <th className="text-right py-2 px-3 font-medium">Avg Rate/Ft</th>
                  <th className="text-right py-2 px-3 font-medium">Median Rate/Ft</th>
                  <th className="text-right py-2 px-3 font-medium">Avg Monthly</th>
                  <th className="text-right py-2 px-3 font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((item, index) => (
                  <tr key={item.storageType} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        {item.label}
                      </div>
                    </td>
                    <td className="text-right py-2 px-3 font-medium text-primary">
                      {formatRatePerFt(item.avgRatePerFt)}
                    </td>
                    <td className="text-right py-2 px-3">
                      {formatRatePerFt(item.medianRatePerFt)}
                    </td>
                    <td className="text-right py-2 px-3">
                      {formatCurrency(item.avgMonthlyRate)}
                    </td>
                    <td className="text-right py-2 px-3 text-muted-foreground">
                      {item.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
