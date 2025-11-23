import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export type ChartType = 'line' | 'area' | 'bar';

export interface ChartDataPoint {
  name: string;
  [key: string]: string | number;
}

interface TrendChartProps {
  data: ChartDataPoint[];
  type?: ChartType;
  dataKeys: { key: string; color: string; label?: string }[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  formatValue?: (value: number) => string;
}

const defaultColors = {
  primary: '#3b82f6',
  secondary: '#10b981',
  tertiary: '#f59e0b',
  quaternary: '#ef4444',
};

export function TrendChart({
  data,
  type = 'line',
  dataKeys,
  height = 200,
  showGrid = true,
  showLegend = false,
  formatValue = (value) => value.toLocaleString(),
}: TrendChartProps) {
  const ChartComponent = 
    type === 'line' ? LineChart :
    type === 'area' ? AreaChart :
    BarChart;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ChartComponent data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
        <XAxis 
          dataKey="name" 
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
        />
        <YAxis 
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
          tickFormatter={formatValue}
        />
        <Tooltip 
          formatter={formatValue}
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '12px',
          }}
        />
        {showLegend && <Legend />}
        {dataKeys.map((item, index) => {
          const props = {
            key: item.key,
            dataKey: item.key,
            stroke: item.color,
            fill: item.color,
            name: item.label || item.key,
            strokeWidth: 2,
          };

          if (type === 'line') {
            return (
              <Line 
                {...props}
                type="monotone"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            );
          } else if (type === 'area') {
            return (
              <Area 
                {...props}
                type="monotone"
                fillOpacity={0.6}
              />
            );
          } else {
            return (
              <Bar 
                {...props}
                radius={[4, 4, 0, 0]}
              />
            );
          }
        })}
      </ChartComponent>
    </ResponsiveContainer>
  );
}
