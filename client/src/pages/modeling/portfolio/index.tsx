import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
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
  Cell
} from 'recharts';
import { 
  Building2, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent, 
  MapPin, 
  Calendar,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChartIcon
} from 'lucide-react';
import { Link } from 'wouter';
import SyncAllAssetsButton from '@/components/operations/SyncAllAssetsButton';

interface PortfolioSummary {
  totalProjects: number;
  totalValue: number;
  totalUnits: number;
  totalAcres: number;
  averageCapRate: number;
  totalNetIncome: number;
  totalRevenue: number;
  totalExpenses: number;
  averageOccupancy: number;
  totalDebt: number;
  totalEquity: number;
  weightedLTV: number;
  irr: {
    base: number;
    aggressive: number;
    conservative: number;
  };
}

interface ProjectRollup {
  id: string;
  name: string;
  marinaName: string;
  state: string;
  region: string;
  acquisitionDate: string | Date | null;
  totalUnits: number;
  estimatedValue: number;
  noi: number;
  capRate: number;
  occupancy: number;
  status: string;
  scenarioStatus: {
    base: string;
    aggressive: string;
    conservative: string;
  };
}

function formatDate(date: string | Date | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

interface BreakdownItem {
  region?: string;
  state?: string;
  status?: string;
  year?: number;
  projectCount: number;
  totalValue: number;
  averageNOI?: number;
  averageCapRate?: number;
  acquisitions?: number;
  dispositions?: number;
}

interface PortfolioBreakdown {
  byRegion: BreakdownItem[];
  byState: BreakdownItem[];
  byStatus: BreakdownItem[];
  byYear: BreakdownItem[];
}

interface ProjectionScenario {
  revenue: number;
  expenses: number;
  noi: number;
  value: number;
}

interface PortfolioProjection {
  year: number;
  scenarios: {
    base: ProjectionScenario;
    aggressive: ProjectionScenario;
    conservative: ProjectionScenario;
  };
}

interface PerformerProject {
  id: string;
  marinaName: string;
  state: string;
  noi: number;
  noiGrowth: number;
  capRate: number;
  occupancy: number;
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  trendValue 
}: { 
  title: string; 
  value: string; 
  subtitle?: string; 
  icon: any;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}) {
  return (
    <Card data-testid={`card-metric-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(subtitle || trendValue) && (
          <div className="flex items-center gap-2 mt-1">
            {trendValue && trend && (
              <span className={`flex items-center text-xs font-medium ${
                trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
              }`}>
                {trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : trend === 'down' ? <ArrowDownRight className="h-3 w-3" /> : null}
                {trendValue}
              </span>
            )}
            {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummarySection({ summary, isLoading }: { summary: PortfolioSummary | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-20 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Portfolio Value"
          value={formatCurrency(summary.totalValue)}
          subtitle={`${summary.totalProjects} projects`}
          icon={DollarSign}
        />
        <MetricCard
          title="Total NOI"
          value={formatCurrency(summary.totalNetIncome)}
          subtitle={`Revenue: ${formatCurrency(summary.totalRevenue)}`}
          icon={TrendingUp}
        />
        <MetricCard
          title="Average Cap Rate"
          value={formatPercent(summary.averageCapRate)}
          subtitle="Weighted by value"
          icon={Percent}
        />
        <MetricCard
          title="Total Units"
          value={formatNumber(summary.totalUnits)}
          subtitle={`${(summary.totalAcres ?? 0).toFixed(1)} acres`}
          icon={Building2}
        />
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Average Occupancy"
          value={formatPercent(summary.averageOccupancy)}
          icon={Building2}
        />
        <MetricCard
          title="Total Debt"
          value={formatCurrency(summary.totalDebt)}
          subtitle={`LTV: ${formatPercent(summary.weightedLTV)}`}
          icon={DollarSign}
        />
        <MetricCard
          title="Total Equity"
          value={formatCurrency(summary.totalEquity)}
          icon={DollarSign}
        />
        <Card data-testid="card-metric-irr-by-scenario">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">IRR by Scenario</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-blue-600">Base:</span>
                <span className="font-medium">{formatPercent(summary.irr.base)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Aggressive:</span>
                <span className="font-medium">{formatPercent(summary.irr.aggressive)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-amber-600">Conservative:</span>
                <span className="font-medium">{formatPercent(summary.irr.conservative)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BreakdownSection({ breakdown, isLoading }: { breakdown: PortfolioBreakdown | undefined; isLoading: boolean }) {
  const [breakdownType, setBreakdownType] = useState<'region' | 'state' | 'status' | 'year'>('region');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!breakdown) return null;

  const getChartData = () => {
    switch (breakdownType) {
      case 'region':
        return breakdown.byRegion.map(item => ({
          name: item.region || 'Unknown',
          value: item.totalValue,
          projects: item.projectCount,
          noi: item.averageNOI || 0,
          capRate: item.averageCapRate || 0
        }));
      case 'state':
        return breakdown.byState.map(item => ({
          name: item.state || 'Unknown',
          value: item.totalValue,
          projects: item.projectCount,
          noi: item.averageNOI || 0,
          capRate: item.averageCapRate || 0
        }));
      case 'status':
        return breakdown.byStatus.map(item => ({
          name: item.status || 'Unknown',
          value: item.totalValue,
          projects: item.projectCount
        }));
      case 'year':
        return breakdown.byYear.map(item => ({
          name: item.year?.toString() || 'Unknown',
          value: item.totalValue,
          projects: item.projectCount,
          acquisitions: item.acquisitions || 0,
          dispositions: item.dispositions || 0
        }));
      default:
        return [];
    }
  };

  const chartData = getChartData();

  return (
    <Card data-testid="card-portfolio-breakdown">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Portfolio Breakdown</CardTitle>
            <CardDescription>Analyze your portfolio by different dimensions</CardDescription>
          </div>
          <Select value={breakdownType} onValueChange={(value: any) => setBreakdownType(value)}>
            <SelectTrigger className="w-40" data-testid="select-breakdown-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="region" data-testid="option-breakdown-region">By Region</SelectItem>
              <SelectItem value="state" data-testid="option-breakdown-state">By State</SelectItem>
              <SelectItem value="status" data-testid="option-breakdown-status">By Status</SelectItem>
              <SelectItem value="year" data-testid="option-breakdown-year">By Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `${breakdownType === 'year' ? 'Year' : breakdownType.charAt(0).toUpperCase() + breakdownType.slice(1)}: ${label}`}
                />
                <Bar dataKey="value" fill="#3b82f6" name="Total Value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>{breakdownType === 'year' ? 'Year' : breakdownType.charAt(0).toUpperCase() + breakdownType.slice(1)}</TableHead>
              <TableHead className="text-right">Projects</TableHead>
              <TableHead className="text-right">Total Value</TableHead>
              {(breakdownType === 'region' || breakdownType === 'state') && (
                <>
                  <TableHead className="text-right">Avg NOI</TableHead>
                  <TableHead className="text-right">Avg Cap Rate</TableHead>
                </>
              )}
              {breakdownType === 'year' && (
                <>
                  <TableHead className="text-right">Acquisitions</TableHead>
                  <TableHead className="text-right">Dispositions</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {chartData.map((item, idx) => (
              <TableRow key={idx} data-testid={`row-breakdown-${item.name}`}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-right">{item.projects}</TableCell>
                <TableCell className="text-right">{formatCurrency(item.value)}</TableCell>
                {(breakdownType === 'region' || breakdownType === 'state') && (
                  <>
                    <TableCell className="text-right">{formatCurrency(item.noi || 0)}</TableCell>
                    <TableCell className="text-right">{formatPercent(item.capRate || 0)}</TableCell>
                  </>
                )}
                {breakdownType === 'year' && (
                  <>
                    <TableCell className="text-right">{item.acquisitions || 0}</TableCell>
                    <TableCell className="text-right">{item.dispositions || 0}</TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ProjectionsSection({ projections, isLoading }: { projections: PortfolioProjection[] | undefined; isLoading: boolean }) {
  const [metric, setMetric] = useState<'noi' | 'revenue' | 'value'>('noi');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!projections || projections.length === 0) {
    return (
      <Card data-testid="card-portfolio-projections">
        <CardHeader>
          <CardTitle>Multi-Year Projections</CardTitle>
          <CardDescription>No projection data available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Add scenario data to see projections
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = projections.map(p => ({
    year: p.year,
    base: p.scenarios.base[metric],
    aggressive: p.scenarios.aggressive[metric],
    conservative: p.scenarios.conservative[metric]
  }));

  return (
    <Card data-testid="card-portfolio-projections">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Multi-Year Projections</CardTitle>
            <CardDescription>Compare scenario outcomes over time</CardDescription>
          </div>
          <Select value={metric} onValueChange={(value: any) => setMetric(value)}>
            <SelectTrigger className="w-40" data-testid="select-projection-metric">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="noi" data-testid="option-metric-noi">Net Operating Income</SelectItem>
              <SelectItem value="revenue" data-testid="option-metric-revenue">Revenue</SelectItem>
              <SelectItem value="value" data-testid="option-metric-value">Portfolio Value</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => `Year ${label}`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="base" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Base Scenario"
                dot={{ fill: '#3b82f6' }}
              />
              <Line 
                type="monotone" 
                dataKey="aggressive" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Aggressive Scenario"
                dot={{ fill: '#10b981' }}
              />
              <Line 
                type="monotone" 
                dataKey="conservative" 
                stroke="#f59e0b" 
                strokeWidth={2}
                name="Conservative Scenario"
                dot={{ fill: '#f59e0b' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function PerformersSection({ 
  topPerformers, 
  underperformers, 
  isLoading 
}: { 
  topPerformers: PerformerProject[] | undefined;
  underperformers: PerformerProject[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map(i => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[200px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const PerformerTable = ({ 
    data, 
    title, 
    description, 
    isTop 
  }: { 
    data: PerformerProject[] | undefined; 
    title: string; 
    description: string;
    isTop: boolean;
  }) => (
    <Card data-testid={`card-${isTop ? 'top' : 'under'}-performers`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isTop ? (
            <TrendingUp className="h-5 w-5 text-green-600" />
          ) : (
            <TrendingDown className="h-5 w-5 text-amber-600" />
          )}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No data available
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marina</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">NOI</TableHead>
                <TableHead className="text-right">Growth</TableHead>
                <TableHead className="text-right">Cap Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((project) => (
                <TableRow 
                  key={project.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  data-testid={`row-performer-${project.id}`}
                >
                  <TableCell className="font-medium">
                    <Link href={`/modeling/projects/${project.id}`}>
                      {project.marinaName}
                    </Link>
                  </TableCell>
                  <TableCell>{project.state || '-'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(project.noi)}</TableCell>
                  <TableCell className="text-right">
                    <span className={project.noiGrowth >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {project.noiGrowth >= 0 ? '+' : ''}{formatPercent(project.noiGrowth)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{formatPercent(project.capRate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <PerformerTable 
        data={topPerformers} 
        title="Top Performers" 
        description="Highest NOI growth projects"
        isTop={true}
      />
      <PerformerTable 
        data={underperformers} 
        title="Underperformers" 
        description="Projects requiring attention"
        isTop={false}
      />
    </div>
  );
}

function ProjectsRollupSection({ rollups, isLoading }: { rollups: ProjectRollup[] | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!rollups || rollups.length === 0) {
    return (
      <Card data-testid="card-projects-rollup">
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
          <CardDescription>No projects in portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
            <p>Create modeling projects to see portfolio data</p>
            <Link href="/modeling/projects">
              <Button className="mt-4" data-testid="button-go-to-projects">
                Go to Projects
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    };
    return colors[status] || colors.draft;
  };

  return (
    <Card data-testid="card-projects-rollup">
      <CardHeader>
        <CardTitle>All Projects</CardTitle>
        <CardDescription>Complete portfolio with scenario status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marina</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">NOI</TableHead>
                <TableHead className="text-right">Cap Rate</TableHead>
                <TableHead className="text-right">Occupancy</TableHead>
                <TableHead>Scenarios</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rollups.map((project) => (
                <TableRow 
                  key={project.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  data-testid={`row-rollup-${project.id}`}
                >
                  <TableCell className="font-medium">
                    <Link href={`/modeling/projects/${project.id}`}>
                      {project.marinaName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {project.state || '-'}, {project.region || '-'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(project.totalUnits)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(project.estimatedValue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(project.noi)}</TableCell>
                  <TableCell className="text-right">{formatPercent(project.capRate)}</TableCell>
                  <TableCell className="text-right">{formatPercent(project.occupancy)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Badge className={`text-xs ${getStatusBadge(project.scenarioStatus.base)}`}>
                        B: {project.scenarioStatus.base}
                      </Badge>
                      <Badge className={`text-xs ${getStatusBadge(project.scenarioStatus.aggressive)}`}>
                        A: {project.scenarioStatus.aggressive}
                      </Badge>
                      <Badge className={`text-xs ${getStatusBadge(project.scenarioStatus.conservative)}`}>
                        C: {project.scenarioStatus.conservative}
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PortfolioAnalytics() {
  const { data: summary, isLoading: summaryLoading } = useQuery<PortfolioSummary>({
    queryKey: ['/api/portfolio/summary']
  });

  const { data: rollups, isLoading: rollupsLoading } = useQuery<ProjectRollup[]>({
    queryKey: ['/api/portfolio/projects']
  });

  const { data: breakdown, isLoading: breakdownLoading } = useQuery<PortfolioBreakdown>({
    queryKey: ['/api/portfolio/breakdown']
  });

  const { data: projections, isLoading: projectionsLoading } = useQuery<PortfolioProjection[]>({
    queryKey: ['/api/portfolio/projections']
  });

  const { data: topPerformers, isLoading: topPerformersLoading } = useQuery<PerformerProject[]>({
    queryKey: ['/api/portfolio/top-performers']
  });

  const { data: underperformers, isLoading: underperformersLoading } = useQuery<PerformerProject[]>({
    queryKey: ['/api/portfolio/underperformers']
  });

  const handleExport = async () => {
    window.open('/api/portfolio/export', '_blank');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Portfolio Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Aggregate insights across all modeling projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SyncAllAssetsButton />
          <Link href="/modeling/projects">
            <Button variant="outline" data-testid="button-back-to-projects">
              <Building2 className="h-4 w-4 mr-2" />
              Projects
            </Button>
          </Link>
          <Button onClick={handleExport} data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs defaultValue="summary" className="space-y-6">
        <TabsList>
          <TabsTrigger value="summary" data-testid="tab-summary">
            <BarChart3 className="h-4 w-4 mr-2" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="breakdown" data-testid="tab-breakdown">
            <PieChartIcon className="h-4 w-4 mr-2" />
            Breakdown
          </TabsTrigger>
          <TabsTrigger value="projections" data-testid="tab-projections">
            <TrendingUp className="h-4 w-4 mr-2" />
            Projections
          </TabsTrigger>
          <TabsTrigger value="performers" data-testid="tab-performers">
            <TrendingUp className="h-4 w-4 mr-2" />
            Performers
          </TabsTrigger>
          <TabsTrigger value="projects" data-testid="tab-all-projects">
            <Building2 className="h-4 w-4 mr-2" />
            All Projects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <SummarySection summary={summary} isLoading={summaryLoading} />
        </TabsContent>

        <TabsContent value="breakdown">
          <BreakdownSection breakdown={breakdown} isLoading={breakdownLoading} />
        </TabsContent>

        <TabsContent value="projections">
          <ProjectionsSection projections={projections} isLoading={projectionsLoading} />
        </TabsContent>

        <TabsContent value="performers">
          <PerformersSection 
            topPerformers={topPerformers}
            underperformers={underperformers}
            isLoading={topPerformersLoading || underperformersLoading}
          />
        </TabsContent>

        <TabsContent value="projects">
          <ProjectsRollupSection rollups={rollups} isLoading={rollupsLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
