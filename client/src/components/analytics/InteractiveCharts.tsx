import { useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
  Treemap,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronDown, ZoomIn, Download, Filter, Maximize2 } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/utils';

const CHART_COLORS = [
  '#0d7377', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316'
];

export interface DrillDownLevel {
  label: string;
  data: any[];
  dataKey: string;
  nameKey: string;
  parentKey?: string;
}

export interface DrillDownChartProps {
  title: string;
  description?: string;
  levels: DrillDownLevel[];
  height?: number;
  formatValue?: (value: number) => string;
  onDrillDown?: (item: any, level: number) => void;
}

export function DrillDownBarChart({
  title,
  description,
  levels,
  height = 350,
  formatValue = formatCurrency,
  onDrillDown,
}: DrillDownChartProps) {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [drillPath, setDrillPath] = useState<{ level: number; filter: any }[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const level = levels[currentLevel];
  const filteredData = drillPath.length > 0 
    ? level.data.filter(d => d[level.parentKey || 'parent'] === drillPath[drillPath.length - 1].filter)
    : level.data;

  const handleBarClick = useCallback((data: any) => {
    if (currentLevel < levels.length - 1) {
      setDrillPath([...drillPath, { level: currentLevel, filter: data[level.nameKey] }]);
      setCurrentLevel(currentLevel + 1);
      onDrillDown?.(data, currentLevel + 1);
    } else {
      setSelectedItem(data);
      setShowDetails(true);
    }
  }, [currentLevel, drillPath, level, levels.length, onDrillDown]);

  const handleBack = useCallback(() => {
    if (drillPath.length > 0) {
      setDrillPath(drillPath.slice(0, -1));
      setCurrentLevel(currentLevel - 1);
    }
  }, [currentLevel, drillPath]);

  const handleReset = useCallback(() => {
    setDrillPath([]);
    setCurrentLevel(0);
  }, []);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border rounded-lg shadow-lg p-3">
          <p className="font-medium text-sm">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatValue(entry.value)}
            </p>
          ))}
          {currentLevel < levels.length - 1 && (
            <p className="text-xs text-blue-500 mt-2 flex items-center gap-1">
              <ZoomIn className="h-3 w-3" /> Click to drill down
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const chartContent = (
    <ResponsiveContainer width="100%" height={isExpanded ? 500 : height}>
      <BarChart
        data={filteredData}
        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        onClick={(data) => data?.activePayload?.[0] && handleBarClick(data.activePayload[0].payload)}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey={level.nameKey} 
          angle={-45} 
          textAnchor="end" 
          height={80} 
          tick={{ fontSize: 11 }} 
        />
        <YAxis tickFormatter={(val) => formatValue(val)} tick={{ fontSize: 11 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar 
          dataKey={level.dataKey} 
          fill={CHART_COLORS[currentLevel % CHART_COLORS.length]} 
          radius={[4, 4, 0, 0]}
          cursor="pointer"
        />
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            <div className="flex items-center gap-2">
              {drillPath.length > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={handleBack}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    Reset
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {levels.map((l, i) => (
              <Badge 
                key={i} 
                variant={i === currentLevel ? 'default' : 'outline'}
                className={i < currentLevel ? 'opacity-50' : ''}
              >
                {l.label}
              </Badge>
            ))}
          </div>
          {drillPath.length > 0 && (
            <div className="text-sm text-muted-foreground mt-1">
              Filtering by: {drillPath.map(p => p.filter).join(' > ')}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-4">
          {chartContent}
        </CardContent>
      </Card>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Details: {selectedItem?.[level.nameKey]}</DialogTitle>
            <DialogDescription>Detailed breakdown of this item</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(selectedItem).map(([key, value]) => (
                  <div key={key} className="border rounded-lg p-3">
                    <div className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</div>
                    <div className="text-sm font-medium mt-1">
                      {typeof value === 'number' ? formatValue(value) : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export interface TimeSeriesDrillDownProps {
  title: string;
  description?: string;
  data: any[];
  metrics: { key: string; label: string; color: string }[];
  height?: number;
  drillDownData?: Record<string, any[]>;
  onPointClick?: (item: any, metric: string) => void;
}

export function TimeSeriesDrillDown({
  title,
  description,
  data,
  metrics,
  height = 350,
  drillDownData,
  onPointClick,
}: TimeSeriesDrillDownProps) {
  const [selectedPoint, setSelectedPoint] = useState<{ period: string; metric: string } | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const handleClick = useCallback((data: any, metric: string) => {
    if (drillDownData && data.period) {
      setSelectedPoint({ period: data.period, metric });
      setShowBreakdown(true);
      onPointClick?.(data, metric);
    }
  }, [drillDownData, onPointClick]);

  const breakdownData = selectedPoint && drillDownData 
    ? drillDownData[selectedPoint.period] || [] 
    : [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border rounded-lg shadow-lg p-3">
          <p className="font-medium text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-sm">
              <span style={{ color: entry.color }}>{entry.name}:</span>
              <span className="font-medium">{formatCurrency(entry.value)}</span>
            </div>
          ))}
          {drillDownData && (
            <p className="text-xs text-blue-500 mt-2 flex items-center gap-1">
              <ZoomIn className="h-3 w-3" /> Click to see breakdown
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={height}>
            <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {metrics.map((metric, index) => (
                index === 0 ? (
                  <Area
                    key={metric.key}
                    type="monotone"
                    dataKey={metric.key}
                    name={metric.label}
                    fill={metric.color}
                    stroke={metric.color}
                    fillOpacity={0.3}
                    onClick={(data) => handleClick(data, metric.key)}
                    cursor="pointer"
                  />
                ) : (
                  <Line
                    key={metric.key}
                    type="monotone"
                    dataKey={metric.key}
                    name={metric.label}
                    stroke={metric.color}
                    strokeWidth={2}
                    dot={{ r: 4, cursor: 'pointer' }}
                    activeDot={{ r: 6, onClick: (e, data) => handleClick(data.payload, metric.key) }}
                  />
                )
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Dialog open={showBreakdown} onOpenChange={setShowBreakdown}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedPoint?.metric.replace(/_/g, ' ')} Breakdown - {selectedPoint?.period}
            </DialogTitle>
            <DialogDescription>Detailed breakdown by category</DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdownData.map((item: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.category}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                    <TableCell className="text-right">{formatPercent(item.percentage / 100)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export interface HierarchicalPieChartProps {
  title: string;
  description?: string;
  data: Array<{
    name: string;
    value: number;
    children?: Array<{ name: string; value: number }>;
  }>;
  height?: number;
}

export function HierarchicalPieChart({
  title,
  description,
  data,
  height = 350,
}: HierarchicalPieChartProps) {
  const [selectedSegment, setSelectedSegment] = useState<any>(null);
  const [currentData, setCurrentData] = useState(data);
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);

  const handleClick = useCallback((entry: any) => {
    if (entry.children && entry.children.length > 0) {
      setCurrentData(entry.children);
      setBreadcrumb([...breadcrumb, entry.name]);
      setSelectedSegment(null);
    } else {
      setSelectedSegment(entry);
    }
  }, [breadcrumb]);

  const handleBack = useCallback(() => {
    if (breadcrumb.length > 0) {
      const newBreadcrumb = breadcrumb.slice(0, -1);
      setBreadcrumb(newBreadcrumb);
      let newData = data;
      for (const crumb of newBreadcrumb) {
        const found = newData.find(d => d.name === crumb);
        if (found?.children) {
          newData = found.children as any;
        }
      }
      setCurrentData(newData);
      setSelectedSegment(null);
    }
  }, [breadcrumb, data]);

  const handleReset = useCallback(() => {
    setBreadcrumb([]);
    setCurrentData(data);
    setSelectedSegment(null);
  }, [data]);

  const total = currentData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white border rounded-lg shadow-lg p-3">
          <p className="font-medium text-sm">{item.name}</p>
          <p className="text-sm">{formatCurrency(item.value)}</p>
          <p className="text-sm text-muted-foreground">{formatPercent(item.value / total)}</p>
          {item.children && (
            <p className="text-xs text-blue-500 mt-2 flex items-center gap-1">
              <ZoomIn className="h-3 w-3" /> Click to drill down
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {breadcrumb.length > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Reset
              </Button>
            </div>
          )}
        </div>
        {breadcrumb.length > 0 && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
            <span onClick={handleReset} className="cursor-pointer hover:text-foreground">Root</span>
            {breadcrumb.map((crumb, i) => (
              <span key={i}>
                <ChevronDown className="h-3 w-3 inline rotate-[-90deg]" />
                <span className={i === breadcrumb.length - 1 ? 'text-foreground' : ''}>{crumb}</span>
              </span>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex">
          <ResponsiveContainer width="60%" height={height}>
            <PieChart>
              <Pie
                data={currentData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                onClick={(entry) => handleClick(entry)}
                cursor="pointer"
              >
                {currentData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                    stroke={selectedSegment?.name === entry.name ? '#000' : 'none'}
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="w-[40%] pl-4 space-y-2 max-h-[350px] overflow-y-auto">
            {currentData.map((item, index) => (
              <div 
                key={item.name}
                className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-muted ${
                  selectedSegment?.name === item.name ? 'bg-muted ring-1 ring-primary' : ''
                }`}
                onClick={() => handleClick(item)}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  <span className="text-sm">{item.name}</span>
                  {(item as any).children && (
                    <Badge variant="outline" className="text-xs">
                      <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
                    </Badge>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{formatCurrency(item.value)}</div>
                  <div className="text-xs text-muted-foreground">{formatPercent(item.value / total)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export interface WaterfallChartProps {
  title: string;
  description?: string;
  data: Array<{
    name: string;
    value: number;
    isTotal?: boolean;
    details?: Array<{ label: string; value: number }>;
  }>;
  height?: number;
}

export function WaterfallChart({
  title,
  description,
  data,
  height = 350,
}: WaterfallChartProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const processedData = data.map((item, index) => {
    if (item.isTotal) {
      return { ...item, start: 0, end: item.value, fill: '#3b82f6' };
    }
    const prevEnd = index === 0 ? 0 : (processedData[index - 1] as any)?.end || 0;
    const fill = item.value >= 0 ? '#10b981' : '#ef4444';
    return {
      ...item,
      start: prevEnd,
      end: prevEnd + item.value,
      fill,
    };
  });

  const handleClick = (item: any) => {
    if (item.details) {
      setSelectedItem(item);
      setShowDetails(true);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={80} 
                tick={{ fontSize: 11 }} 
              />
              <YAxis tickFormatter={(val) => formatCurrency(val)} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) => [formatCurrency(Math.abs(value)), 'Amount']}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-white border rounded-lg shadow-lg p-3">
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-sm">{formatCurrency(item.value)}</p>
                        {item.details && (
                          <p className="text-xs text-blue-500 mt-2 flex items-center gap-1">
                            <ZoomIn className="h-3 w-3" /> Click for breakdown
                          </p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
                onClick={(data) => handleClick(data)}
                cursor="pointer"
              >
                {processedData.map((entry: any, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedItem?.name} Breakdown</DialogTitle>
            <DialogDescription>Detailed components of {selectedItem?.name}</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedItem?.details?.map((detail: any, index: number) => (
                <TableRow key={index}>
                  <TableCell>{detail.label}</TableCell>
                  <TableCell className="text-right">{formatCurrency(detail.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { CHART_COLORS };
