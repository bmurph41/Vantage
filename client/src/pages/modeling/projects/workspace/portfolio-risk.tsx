import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import {
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  MapPin,
  Layers,
  Target,
  Info,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';

interface CorrelationEntry {
  asset1: string;
  asset2: string;
  correlation: number;
}

interface ConcentrationRisk {
  category: string;
  allocation: number;
  count: number;
  maxAllocation: number;
}

interface RiskContributor {
  property: string;
  allocation: number;
  individualVaR: number;
  contributionToPortfolioVaR: number;
  marginalVaR: number;
  beta: number;
}

interface PortfolioRiskResponse {
  portfolioIRR: number;
  portfolioVaR: number;
  expectedShortfall: number;
  diversificationBenefit: number;
  concentrationIndex: number;
  correlationMatrix: CorrelationEntry[];
  assets: string[];
  geographicConcentration: ConcentrationRisk[];
  assetTypeConcentration: ConcentrationRisk[];
  topRiskContributors: RiskContributor[];
  undiversifiedVaR: number;
  diversifiedVaR: number;
}

interface PortfolioRiskProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

const HEATMAP_COLORS = {
  high: '#ef4444',
  medHigh: '#f97316',
  medium: '#f59e0b',
  medLow: '#84cc16',
  low: '#22c55e',
  negative: '#3b82f6',
};

function getCorrelationColor(value: number): string {
  if (value < 0) return HEATMAP_COLORS.negative;
  if (value < 0.2) return HEATMAP_COLORS.low;
  if (value < 0.4) return HEATMAP_COLORS.medLow;
  if (value < 0.6) return HEATMAP_COLORS.medium;
  if (value < 0.8) return HEATMAP_COLORS.medHigh;
  return HEATMAP_COLORS.high;
}

function getCorrelationOpacity(value: number): number {
  return 0.3 + Math.abs(value) * 0.7;
}

const DEFAULT_ASSETS = ['Marina Bay', 'Harbor Point', 'Sunset Docks', 'Coastal Landing', 'Tidewater Basin'];

const DEFAULT_CORRELATIONS: CorrelationEntry[] = (() => {
  const assets = DEFAULT_ASSETS;
  const matrix = [
    [1.0, 0.72, 0.45, 0.31, 0.58],
    [0.72, 1.0, 0.38, 0.25, 0.63],
    [0.45, 0.38, 1.0, 0.67, 0.29],
    [0.31, 0.25, 0.67, 1.0, 0.18],
    [0.58, 0.63, 0.29, 0.18, 1.0],
  ];
  const entries: CorrelationEntry[] = [];
  for (let i = 0; i < assets.length; i++) {
    for (let j = 0; j < assets.length; j++) {
      entries.push({ asset1: assets[i], asset2: assets[j], correlation: matrix[i][j] });
    }
  }
  return entries;
})();

const DEFAULT_GEO_CONCENTRATION: ConcentrationRisk[] = [
  { category: 'Southeast US', allocation: 42, count: 3, maxAllocation: 35 },
  { category: 'Northeast US', allocation: 28, count: 2, maxAllocation: 35 },
  { category: 'Gulf Coast', allocation: 18, count: 1, maxAllocation: 25 },
  { category: 'Pacific NW', allocation: 12, count: 1, maxAllocation: 25 },
];

const DEFAULT_ASSET_TYPE_CONCENTRATION: ConcentrationRisk[] = [
  { category: 'Full-Service Marina', allocation: 55, count: 3, maxAllocation: 50 },
  { category: 'Dry Storage', allocation: 25, count: 2, maxAllocation: 40 },
  { category: 'Mixed-Use Waterfront', allocation: 20, count: 2, maxAllocation: 40 },
];

const DEFAULT_RISK_CONTRIBUTORS: RiskContributor[] = [
  { property: 'Marina Bay', allocation: 30, individualVaR: 12.5, contributionToPortfolioVaR: 4.8, marginalVaR: 0.16, beta: 1.25 },
  { property: 'Harbor Point', allocation: 25, individualVaR: 11.2, contributionToPortfolioVaR: 3.6, marginalVaR: 0.14, beta: 1.12 },
  { property: 'Sunset Docks', allocation: 20, individualVaR: 9.8, contributionToPortfolioVaR: 2.1, marginalVaR: 0.11, beta: 0.88 },
  { property: 'Coastal Landing', allocation: 15, individualVaR: 14.3, contributionToPortfolioVaR: 2.5, marginalVaR: 0.17, beta: 1.35 },
  { property: 'Tidewater Basin', allocation: 10, individualVaR: 7.5, contributionToPortfolioVaR: 0.9, marginalVaR: 0.09, beta: 0.72 },
];

function PortfolioRisk({ projectId, onTabChange }: PortfolioRiskProps) {
  const [activeSection, setActiveSection] = useState<'correlation' | 'concentration' | 'contributors'>('correlation');

  const { data, isLoading } = useQuery<PortfolioRiskResponse>({
    queryKey: ['/api/modeling/projects', projectId, 'portfolio-risk'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/modeling/projects/${projectId}/portfolio-risk`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const portfolioIRR = data?.portfolioIRR ?? 15.8;
  const portfolioVaR = data?.portfolioVaR ?? 8.4;
  const diversificationBenefit = data?.diversificationBenefit ?? 32.5;
  const concentrationIndex = data?.concentrationIndex ?? 0.28;
  const expectedShortfall = data?.expectedShortfall ?? 12.1;
  const assets = data?.assets ?? DEFAULT_ASSETS;
  const correlations = data?.correlationMatrix ?? DEFAULT_CORRELATIONS;
  const geoConcentration = data?.geographicConcentration ?? DEFAULT_GEO_CONCENTRATION;
  const assetTypeConcentration = data?.assetTypeConcentration ?? DEFAULT_ASSET_TYPE_CONCENTRATION;
  const riskContributors = data?.topRiskContributors ?? DEFAULT_RISK_CONTRIBUTORS;
  const undiversifiedVaR = data?.undiversifiedVaR ?? 12.5;
  const diversifiedVaR = data?.diversifiedVaR ?? 8.4;

  const correlationMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {};
    for (const entry of correlations) {
      if (!matrix[entry.asset1]) matrix[entry.asset1] = {};
      matrix[entry.asset1][entry.asset2] = entry.correlation;
    }
    return matrix;
  }, [correlations]);

  const concentrationChartData = useMemo(() => {
    return geoConcentration.map((g) => ({
      name: g.category,
      allocation: g.allocation,
      limit: g.maxAllocation,
      breached: g.allocation > g.maxAllocation,
    }));
  }, [geoConcentration]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-6"><div className="h-24 bg-muted animate-pulse rounded" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Portfolio IRR</div>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold mt-1">{portfolioIRR.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground mt-1">Blended portfolio return</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Portfolio VaR (95%)</div>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold mt-1">{portfolioVaR.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground mt-1">Expected shortfall: {expectedShortfall.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Diversification Benefit</div>
              <Shield className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold mt-1">{diversificationBenefit.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground mt-1">Risk reduction from diversification</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Concentration Index</div>
              <Target className="h-4 w-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold mt-1">{concentrationIndex.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              HHI: {concentrationIndex < 0.25 ? 'Well diversified' : concentrationIndex < 0.5 ? 'Moderately concentrated' : 'Highly concentrated'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section Navigation */}
      <div className="flex items-center gap-2">
        <Button variant={activeSection === 'correlation' ? 'default' : 'outline'} size="sm" onClick={() => setActiveSection('correlation')}>
          <Activity className="h-4 w-4 mr-1" /> Correlation Matrix
        </Button>
        <Button variant={activeSection === 'concentration' ? 'default' : 'outline'} size="sm" onClick={() => setActiveSection('concentration')}>
          <MapPin className="h-4 w-4 mr-1" /> Concentration Risk
        </Button>
        <Button variant={activeSection === 'contributors' ? 'default' : 'outline'} size="sm" onClick={() => setActiveSection('contributors')}>
          <Layers className="h-4 w-4 mr-1" /> Risk Contributors
        </Button>
      </div>

      {/* Correlation Matrix Heatmap */}
      {activeSection === 'correlation' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Correlation Matrix Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="p-2 text-left font-medium text-muted-foreground" />
                    {assets.map((asset) => (
                      <th key={asset} className="p-2 text-center font-medium text-muted-foreground text-xs whitespace-nowrap">
                        {asset.length > 12 ? asset.slice(0, 12) + '...' : asset}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assets.map((rowAsset) => (
                    <tr key={rowAsset}>
                      <td className="p-2 font-medium text-sm whitespace-nowrap">{rowAsset}</td>
                      {assets.map((colAsset) => {
                        const val = correlationMatrix[rowAsset]?.[colAsset] ?? 0;
                        const isDiagonal = rowAsset === colAsset;
                        return (
                          <td
                            key={colAsset}
                            className="p-2 text-center text-xs font-mono"
                            style={{
                              backgroundColor: isDiagonal ? '#e2e8f0' : getCorrelationColor(val),
                              opacity: isDiagonal ? 1 : getCorrelationOpacity(val),
                              color: isDiagonal ? '#475569' : Math.abs(val) > 0.5 ? '#fff' : '#1e293b',
                            }}
                          >
                            {val.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ backgroundColor: HEATMAP_COLORS.negative }} /> Negative</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ backgroundColor: HEATMAP_COLORS.low }} /> Low</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ backgroundColor: HEATMAP_COLORS.medium }} /> Medium</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ backgroundColor: HEATMAP_COLORS.high }} /> High</div>
            </div>
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <Info className="h-4 w-4" /> Diversification Analysis
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Undiversified VaR:</span> <span className="font-semibold">{undiversifiedVaR.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Diversified VaR:</span> <span className="font-semibold">{diversifiedVaR.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Risk Reduction:</span> <span className="font-semibold text-emerald-600">{((1 - diversifiedVaR / undiversifiedVaR) * 100).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Correlation:</span>{' '}
                  <span className="font-semibold">
                    {(correlations.filter(c => c.asset1 !== c.asset2).reduce((s, c) => s + c.correlation, 0) / correlations.filter(c => c.asset1 !== c.asset2).length).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Concentration Risk */}
      {activeSection === 'concentration' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-500" /> Geographic Concentration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={concentrationChartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${v}%`} />
                    <RechartTooltip formatter={(value: number) => [`${value}%`, '']} />
                    <Legend />
                    <Bar dataKey="allocation" name="Current Allocation" radius={[4, 4, 0, 0]}>
                      {concentrationChartData.map((entry, index) => (
                        <Cell key={`geo-${index}`} fill={entry.breached ? '#ef4444' : '#3b82f6'} />
                      ))}
                    </Bar>
                    <Bar dataKey="limit" name="Max Limit" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {geoConcentration.filter(g => g.allocation > g.maxAllocation).length > 0 && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Geographic concentration limit breached
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-5 w-5 text-purple-500" /> Asset Type Concentration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset Type</TableHead>
                    <TableHead className="text-right">Allocation</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Max Limit</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assetTypeConcentration.map((row) => {
                    const breached = row.allocation > row.maxAllocation;
                    return (
                      <TableRow key={row.category}>
                        <TableCell className="font-medium">{row.category}</TableCell>
                        <TableCell className="text-right">{row.allocation}%</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                        <TableCell className="text-right">{row.maxAllocation}%</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={breached ? 'destructive' : 'default'}>
                            {breached ? 'Breached' : 'Within Limit'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Risk Contributors */}
      {activeSection === 'contributors' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Risk Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Allocation</TableHead>
                  <TableHead className="text-right">Individual VaR</TableHead>
                  <TableHead className="text-right">Contribution to Portfolio VaR</TableHead>
                  <TableHead className="text-right">Marginal VaR</TableHead>
                  <TableHead className="text-right">Beta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riskContributors.map((row) => (
                  <TableRow key={row.property}>
                    <TableCell className="font-medium">{row.property}</TableCell>
                    <TableCell className="text-right">{row.allocation}%</TableCell>
                    <TableCell className="text-right">{row.individualVaR.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-semibold">{row.contributionToPortfolioVaR.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{row.marginalVaR.toFixed(2)}%</TableCell>
                    <TableCell className="text-right">
                      <span className={cn(row.beta > 1 ? 'text-red-600' : 'text-emerald-600', 'font-semibold')}>
                        {row.beta.toFixed(2)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm">
              <div className="font-medium mb-1">Risk Budget Summary</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <span className="text-muted-foreground">Total VaR Budget:</span>{' '}
                  <span className="font-semibold">{portfolioVaR.toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Utilized:</span>{' '}
                  <span className="font-semibold">{riskContributors.reduce((s, r) => s + r.contributionToPortfolioVaR, 0).toFixed(1)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Largest Contributor:</span>{' '}
                  <span className="font-semibold">{riskContributors[0]?.property ?? 'N/A'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PortfolioRisk;
