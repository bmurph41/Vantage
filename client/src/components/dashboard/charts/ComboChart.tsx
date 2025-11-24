import { 
  ComposedChart, 
  Line, 
  Bar, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';

export type ComboChartSeriesType = 'line' | 'bar' | 'area';

export interface ComboChartSeries {
  key: string;
  type: ComboChartSeriesType;
  color: string;
  label?: string;
  yAxisId?: string;
}

export interface ComboChartDataPoint {
  name: string;
  [key: string]: string | number;
}

interface ComboChartProps {
  data: ComboChartDataPoint[];
  series: ComboChartSeries[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  formatValue?: (value: number) => string;
}

export function ComboChart({
  data,
  series,
  height = 250,
  showGrid = true,
  showLegend = true,
  formatValue = (value) => value.toLocaleString(),
}: ComboChartProps) {
  const hasSecondaryAxis = series.some(s => s.yAxisId === 'right');

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />}
        <XAxis 
          dataKey="name" 
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
        />
        <YAxis 
          yAxisId="left"
          tick={{ fontSize: 12 }}
          stroke="#9ca3af"
          tickFormatter={formatValue}
        />
        {hasSecondaryAxis && (
          <YAxis 
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            tickFormatter={formatValue}
          />
        )}
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
        {series.map((item) => {
          const commonProps = {
            key: item.key,
            dataKey: item.key,
            stroke: item.color,
            fill: item.color,
            name: item.label || item.key,
            yAxisId: item.yAxisId || 'left',
          };

          if (item.type === 'line') {
            return (
              <Line 
                {...commonProps}
                type="monotone"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            );
          } else if (item.type === 'area') {
            return (
              <Area 
                {...commonProps}
                type="monotone"
                fillOpacity={0.6}
              />
            );
          } else {
            return (
              <Bar 
                {...commonProps}
                radius={[4, 4, 0, 0]}
              />
            );
          }
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
