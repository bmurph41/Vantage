import React from 'react';
import { OmBlock, OmDataResponse } from "@/lib/types";
import { fetchOmData } from "@/lib/om-data-api";
import { Loader2 } from "lucide-react";
import { 
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface ChartBlockProps {
  block: OmBlock;
  projectId?: string;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(210, 70%, 50%)',
  'hsl(180, 60%, 45%)',
  'hsl(150, 60%, 40%)',
  'hsl(45, 80%, 55%)',
];

export function ChartBlock({ block, projectId = "proj_1" }: ChartBlockProps) {
  const { content, style, dataBinding } = block;
  const [realData, setRealData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (dataBinding?.sourceType && dataBinding.sourceType !== 'manual' && dataBinding.bindingRole) {
      setLoading(true);
      fetchOmData(projectId, dataBinding.sourceType)
        .then((response: OmDataResponse) => {
          const [cat, key] = dataBinding.bindingRole!.split('.');
          if (cat === 'series') {
            setRealData(response.series.find(s => s.id === key));
          }
        })
        .finally(() => setLoading(false));
    } else {
      setRealData(null);
    }
  }, [dataBinding, projectId]);

  const chartData = realData 
    ? realData.data.map((d: any) => ({ name: d.x, value: d.y })) 
    : content.data || [];
  const chartTitle = realData ? realData.label : content.title;
  const chartType = content.chartType || 'bar';

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
            <YAxis tick={{fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(value) => value > 1000 ? `$${value/1000}k` : value} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            <Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{r: 4}} />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
            <YAxis tick={{fontSize: 12}} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
            <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.3} />
          </AreaChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill={CHART_COLORS[0]}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {chartData.map((_: any, index: number) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        );

      case 'bar':
      default:
        return (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
            <YAxis tick={{fontSize: 12}} axisLine={false} tickLine={false} tickFormatter={(value) => value > 1000 ? `$${value/1000}k` : value} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} cursor={{ fill: 'hsl(var(--muted))' }} />
            <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} barSize={40} />
          </BarChart>
        );
    }
  };

  return (
    <div 
      className="h-[300px] w-full relative" 
      style={style}
      data-testid={`chart-block-${block.id}`}
    >
      {loading && (
        <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}
      {chartTitle && <h3 className="text-sm font-semibold mb-4 text-center">{chartTitle}</h3>}
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}
