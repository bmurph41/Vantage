import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  GitCompare,
  RefreshCw,
  Download,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import { formatCurrency, formatPercent } from '@/lib/utils';

interface ScenarioComparisonChartsProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

const SCENARIO_COLORS: Record<string, string> = {
  base: '#3b82f6',
  upside: '#10b981',
  downside: '#ef4444',
  custom: '#8b5cf6',
};

export default function ScenarioComparisonCharts({ projectId, onTabChange }: ScenarioComparisonChartsProps) {
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>(['base', 'upside', 'downside']);
  const [activeTab, setActiveTab] = useState('overview');

  const { data: comparisonData, isLoading, refetch } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'scenario-comparison', selectedScenarios.join(',')],
    queryFn: async () => {
      const response = await fetch(`/api/modeling/projects/${projectId}/scenario-comparison`);
      if (!response.ok) {
        return generateSimulatedData();
      }
      return response.json();
    },
  });

  const generateSimulatedData = () => {
    const scenarios = [
      {
        id: 'base',
        name: 'Base Case',
        description: 'Conservative assumptions based on historical performance',
        color: '#3b82f6',
        metrics: {
          purchasePrice: 15000000,
          noi: 975000,
          capRate: 6.5,
          irr: 18.5,
          equityMultiple: 2.1,
          cashOnCash: 8.2,
          exitValue: 18500000,
          totalRevenue: 2200000,
          totalExpenses: 1225000,
          noiMargin: 44.3,
        },
        yearlyData: Array.from({ length: 5 }, (_, i) => ({
          year: i + 1,
          revenue: Math.round(2200000 * Math.pow(1.03, i + 1)),
          noi: Math.round(975000 * Math.pow(1.02, i + 1)),
          occupancy: 92 + i * 0.5,
        })),
        revenueBreakdown: [
          { name: 'Slip Rentals', value: 1210000 },
          { name: 'Dry Storage', value: 440000 },
          { name: 'Fuel Sales', value: 330000 },
          { name: 'Other', value: 220000 },
        ]
      },
      {
        id: 'upside',
        name: 'Upside Case',
        description: 'Optimistic scenario with value-add initiatives',
        color: '#10b981',
        metrics: {
          purchasePrice: 15000000,
          noi: 1150000,
          capRate: 6.5,
          irr: 24.2,
          equityMultiple: 2.65,
          cashOnCash: 9.8,
          exitValue: 22000000,
          totalRevenue: 2600000,
          totalExpenses: 1450000,
          noiMargin: 44.2,
        },
        yearlyData: Array.from({ length: 5 }, (_, i) => ({
          year: i + 1,
          revenue: Math.round(2600000 * Math.pow(1.05, i + 1)),
          noi: Math.round(1150000 * Math.pow(1.04, i + 1)),
          occupancy: 94 + i * 0.5,
        })),
        revenueBreakdown: [
          { name: 'Slip Rentals', value: 1430000 },
          { name: 'Dry Storage', value: 520000 },
          { name: 'Fuel Sales', value: 390000 },
          { name: 'Other', value: 260000 },
        ]
      },
      {
        id: 'downside',
        name: 'Downside Case',
        description: 'Stress test with adverse market conditions',
        color: '#ef4444',
        metrics: {
          purchasePrice: 15000000,
          noi: 820000,
          capRate: 6.5,
          irr: 12.8,
          equityMultiple: 1.75,
          cashOnCash: 6.5,
          exitValue: 14500000,
          totalRevenue: 1900000,
          totalExpenses: 1080000,
          noiMargin: 43.2,
        },
        yearlyData: Array.from({ length: 5 }, (_, i) => ({
          year: i + 1,
          revenue: Math.round(1900000 * Math.pow(1.015, i + 1)),
          noi: Math.round(820000 * Math.pow(1.01, i + 1)),
          occupancy: 88 + i * 0.3,
        })),
        revenueBreakdown: [
          { name: 'Slip Rentals', value: 1045000 },
          { name: 'Dry Storage', value: 380000 },
          { name: 'Fuel Sales', value: 285000 },
          { name: 'Other', value: 190000 },
        ]
      }
    ];
    
    const comparisonMetrics = [
      { id: 'purchasePrice', name: 'Purchase Price', unit: 'currency', scenarios: scenarios.map(s => ({ id: s.id, value: s.metrics.purchasePrice, variance: 0 })) },
      { id: 'noi', name: 'Exit Year NOI', unit: 'currency', scenarios: scenarios.map(s => ({ id: s.id, value: s.metrics.noi, variance: ((s.metrics.noi - 975000) / 975000) * 100 })) },
      { id: 'capRate', name: 'Entry Cap Rate', unit: 'percent', scenarios: scenarios.map(s => ({ id: s.id, value: s.metrics.capRate, variance: 0 })) },
      { id: 'irr', name: 'IRR', unit: 'percent', scenarios: scenarios.map(s => ({ id: s.id, value: s.metrics.irr, variance: s.metrics.irr - 18.5 })) },
      { id: 'equityMultiple', name: 'Equity Multiple', unit: 'multiple', scenarios: scenarios.map(s => ({ id: s.id, value: s.metrics.equityMultiple, variance: ((s.metrics.equityMultiple - 2.1) / 2.1) * 100 })) },
      { id: 'cashOnCash', name: 'Cash-on-Cash', unit: 'percent', scenarios: scenarios.map(s => ({ id: s.id, value: s.metrics.cashOnCash, variance: s.metrics.cashOnCash - 8.2 })) },
      { id: 'exitValue', name: 'Exit Value', unit: 'currency', scenarios: scenarios.map(s => ({ id: s.id, value: s.metrics.exitValue, variance: ((s.metrics.exitValue - 18500000) / 18500000) * 100 })) },
    ];
    
    return { projectId, scenarios, comparisonMetrics };
  };

  const scenarios = comparisonData?.scenarios || [];
  const baseScenario = scenarios.find((s: any) => s.id === 'base');

  const toggleScenario = (scenarioId: string) => {
    setSelectedScenarios(prev => {
      if (prev.includes(scenarioId)) {
        if (prev.length === 1) return prev;
        return prev.filter(s => s !== scenarioId);
      }
      return [...prev, scenarioId];
    });
  };

  const metricsComparisonData = useMemo(() => {
    if (!comparisonData?.comparisonMetrics) return [];
    return comparisonData.comparisonMetrics;
  }, [comparisonData]);

  const yearlyComparisonData = useMemo(() => {
    if (!scenarios.length) return [];
    
    const years = scenarios[0]?.yearlyData?.map((d: any) => d.year) || [];
    return years.map((year: number) => {
      const dataPoint: any = { year };
      scenarios.forEach((scenario: any) => {
        const yearData = scenario.yearlyData.find((d: any) => d.year === year);
        if (yearData) {
          dataPoint[`${scenario.id}_revenue`] = yearData.revenue;
          dataPoint[`${scenario.id}_noi`] = yearData.noi;
          dataPoint[`${scenario.id}_occupancy`] = yearData.occupancy;
        }
      });
      return dataPoint;
    });
  }, [scenarios]);

  const radarData = useMemo(() => {
    if (!scenarios.length) return [];
    
    const metrics = [
      { key: 'revenue', label: 'Revenue', max: 10000000 },
      { key: 'noi', label: 'NOI', max: 6000000 },
      { key: 'noiMargin', label: 'NOI Margin', max: 70 },
      { key: 'irr', label: 'IRR', max: 25 },
      { key: 'equityMultiple', label: 'Equity Multiple', max: 3 },
    ];

    return metrics.map(metric => {
      const dataPoint: any = { metric: metric.label };
      scenarios.forEach((scenario: any) => {
        const value = metric.key === 'revenue' ? scenario.metrics.totalRevenue :
                     metric.key === 'noi' ? scenario.metrics.noi :
                     metric.key === 'noiMargin' ? scenario.metrics.noiMargin :
                     metric.key === 'irr' ? scenario.metrics.irr :
                     scenario.metrics.equityMultiple;
        dataPoint[scenario.id] = (value / metric.max) * 100;
      });
      return dataPoint;
    });
  }, [scenarios]);

  const revenueComparisonData = useMemo(() => {
    if (!scenarios.length) return [];
    
    const categories = scenarios[0]?.revenueBreakdown?.map((r: any) => r.name) || [];
    return categories.map((category: string) => {
      const dataPoint: any = { category };
      scenarios.forEach((scenario: any) => {
        const item = scenario.revenueBreakdown.find((r: any) => r.name === category);
        dataPoint[scenario.id] = item?.value || 0;
      });
      return dataPoint;
    });
  }, [scenarios]);

  const getVariance = (scenarioValue: number, baseValue: number) => {
    if (!baseValue) return 0;
    return ((scenarioValue - baseValue) / baseValue) * 100;
  };

  const formatMetricValue = (value: number, unit: string) => {
    if (unit === 'currency') return formatCurrency(value);
    if (unit === 'percent') return `${value.toFixed(1)}%`;
    return value.toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-32" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <GitCompare className="h-6 w-6 text-primary" />
            Scenario Comparison
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Side-by-side analysis of different investment scenarios
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {['base', 'upside', 'downside'].map(scenarioId => {
          const scenario = scenarios.find((s: any) => s.id === scenarioId);
          const isSelected = selectedScenarios.includes(scenarioId);
          
          return (
            <div
              key={scenarioId}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg border cursor-pointer transition-all ${
                isSelected ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
              }`}
              onClick={() => toggleScenario(scenarioId)}
            >
              <Checkbox checked={isSelected} />
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: SCENARIO_COLORS[scenarioId] }}
              />
              <div>
                <p className="font-medium">{scenario?.name || scenarioId}</p>
                <p className="text-xs text-muted-foreground">{scenario?.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Mix</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance Radar</CardTitle>
                <CardDescription>Normalized comparison across key metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    {scenarios.map((scenario: any) => (
                      <Radar
                        key={scenario.id}
                        name={scenario.name}
                        dataKey={scenario.id}
                        stroke={SCENARIO_COLORS[scenario.id]}
                        fill={SCENARIO_COLORS[scenario.id]}
                        fillOpacity={0.2}
                      />
                    ))}
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Key Metrics Comparison</CardTitle>
                <CardDescription>Side-by-side scenario metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metricsComparisonData.slice(0, 5).map((metric: any) => {
                    const baseValue = metric.scenarios.find((s: any) => s.id === 'base')?.value || 0;
                    
                    return (
                      <div key={metric.metric} className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">{metric.metric}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {scenarios.map((scenario: any) => {
                            const value = metric.scenarios.find((s: any) => s.id === scenario.id)?.value || 0;
                            const variance = scenario.id !== 'base' ? getVariance(value, baseValue) : 0;
                            
                            return (
                              <div 
                                key={scenario.id}
                                className="p-3 rounded-lg border"
                                style={{ borderColor: SCENARIO_COLORS[scenario.id] + '40' }}
                              >
                                <p className="text-xs text-muted-foreground">{scenario.name}</p>
                                <p className="font-bold">{formatMetricValue(value, metric.unit)}</p>
                                {scenario.id !== 'base' && (
                                  <p className={`text-xs flex items-center gap-1 ${
                                    variance >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {variance >= 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                    {Math.abs(variance).toFixed(1)}%
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">NOI Trend Comparison</CardTitle>
              <CardDescription>Year-over-year NOI by scenario</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={yearlyComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Year ${label}`}
                  />
                  <Legend />
                  {scenarios.map((scenario: any) => (
                    <Line
                      key={scenario.id}
                      type="monotone"
                      dataKey={`${scenario.id}_noi`}
                      name={`${scenario.name} NOI`}
                      stroke={SCENARIO_COLORS[scenario.id]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detailed Metrics Comparison</CardTitle>
              <CardDescription>All key performance indicators across scenarios</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    {scenarios.map((scenario: any) => (
                      <TableHead key={scenario.id} className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: SCENARIO_COLORS[scenario.id] }}
                          />
                          {scenario.name}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center">Variance (vs Base)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metricsComparisonData.map((metric: any) => {
                    const baseValue = metric.scenarios.find((s: any) => s.id === 'base')?.value || 0;
                    
                    return (
                      <TableRow key={metric.metric}>
                        <TableCell className="font-medium">{metric.metric}</TableCell>
                        {scenarios.map((scenario: any) => {
                          const value = metric.scenarios.find((s: any) => s.id === scenario.id)?.value || 0;
                          return (
                            <TableCell key={scenario.id} className="text-center font-mono">
                              {formatMetricValue(value, metric.unit)}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-4">
                            {scenarios.filter((s: any) => s.id !== 'base').map((scenario: any) => {
                              const value = metric.scenarios.find((s: any) => s.id === scenario.id)?.value || 0;
                              const variance = getVariance(value, baseValue);
                              
                              return (
                                <Badge 
                                  key={scenario.id}
                                  variant={variance >= 0 ? 'default' : 'destructive'}
                                  className="min-w-[60px]"
                                >
                                  {variance >= 0 ? '+' : ''}{variance.toFixed(1)}%
                                </Badge>
                              );
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            {scenarios.map((scenario: any) => (
              <Card key={scenario.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: SCENARIO_COLORS[scenario.id] }}
                    />
                    <CardTitle className="text-lg">{scenario.name}</CardTitle>
                  </div>
                  <CardDescription>{scenario.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <span className="text-sm">Revenue Growth</span>
                      <span className="font-bold">{(scenario.assumptions?.revenueGrowth ?? 0).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <span className="text-sm">Expense Growth</span>
                      <span className="font-bold">{(scenario.assumptions?.expenseGrowth ?? 0).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <span className="text-sm">Starting Occupancy</span>
                      <span className="font-bold">{(scenario.assumptions?.occupancyStart ?? 0).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <span className="text-sm">Exit Cap Rate</span>
                      <span className="font-bold">{(scenario.assumptions?.exitCapRate ?? 0).toFixed(1)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Revenue Trend</CardTitle>
                <CardDescription>Annual revenue projection by scenario</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={yearlyComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    {scenarios.map((scenario: any) => (
                      <Bar
                        key={scenario.id}
                        dataKey={`${scenario.id}_revenue`}
                        name={scenario.name}
                        fill={SCENARIO_COLORS[scenario.id]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Occupancy Trend</CardTitle>
                <CardDescription>Occupancy rate projection by scenario</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={yearlyComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="year" />
                    <YAxis domain={[70, 100]} tickFormatter={(val) => `${val}%`} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    <Legend />
                    {scenarios.map((scenario: any) => (
                      <Line
                        key={scenario.id}
                        type="monotone"
                        dataKey={`${scenario.id}_occupancy`}
                        name={scenario.name}
                        stroke={SCENARIO_COLORS[scenario.id]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">NOI Comparison Over Time</CardTitle>
              <CardDescription>Net Operating Income trajectory across scenarios</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={yearlyComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(val) => `$${(val / 1000000).toFixed(2)}M`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  {scenarios.map((scenario: any) => (
                    <Bar
                      key={scenario.id}
                      dataKey={`${scenario.id}_noi`}
                      name={`${scenario.name} NOI`}
                      fill={SCENARIO_COLORS[scenario.id]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Revenue Mix by Scenario</CardTitle>
              <CardDescription>Revenue breakdown comparison across scenarios</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={revenueComparisonData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" tickFormatter={(val) => `$${(val / 1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="category" width={100} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  {scenarios.map((scenario: any) => (
                    <Bar
                      key={scenario.id}
                      dataKey={scenario.id}
                      name={scenario.name}
                      fill={SCENARIO_COLORS[scenario.id]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            {scenarios.map((scenario: any) => (
              <Card key={scenario.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: SCENARIO_COLORS[scenario.id] }}
                    />
                    <CardTitle className="text-lg">{scenario.name}</CardTitle>
                  </div>
                  <CardDescription>Revenue breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {scenario.revenueBreakdown.map((item: any) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-sm">{item.name}</span>
                        </div>
                        <span className="font-medium">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t flex justify-between">
                      <span className="font-medium">Total</span>
                      <span className="font-bold">
                        {formatCurrency(scenario.revenueBreakdown.reduce((sum: number, r: any) => sum + r.value, 0))}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
