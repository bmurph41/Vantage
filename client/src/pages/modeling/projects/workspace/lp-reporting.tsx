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
  Download,
  Printer,
  TrendingUp,
  DollarSign,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Calendar,
  FileText,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { cn, formatCurrency } from '@/lib/utils';

interface FundSummary {
  tvpi: number;
  dpi: number;
  rvpi: number;
  netIRR: number;
  totalCommitted: number;
  totalCalled: number;
  totalDistributed: number;
  totalNAV: number;
  vintage: number;
  fundLife: string;
}

interface CapitalAccountEntry {
  quarter: string;
  beginningBalance: number;
  contributions: number;
  distributions: number;
  gainsLosses: number;
  endingBalance: number;
}

interface DistributionEntry {
  quarter: string;
  returnOfCapital: number;
  capitalGains: number;
  incomeDistributions: number;
  total: number;
}

interface NAVBridgeItem {
  label: string;
  value: number;
  type: 'start' | 'add' | 'subtract' | 'end';
}

interface InvestmentSummary {
  property: string;
  vintage: number;
  investedCapital: number;
  currentValue: number;
  moic: number;
  irr: number;
  status: 'active' | 'realized' | 'partially-realized';
}

interface LPReportingResponse {
  fundSummary: FundSummary;
  capitalAccount: CapitalAccountEntry[];
  distributionHistory: DistributionEntry[];
  navBridge: NAVBridgeItem[];
  investments: InvestmentSummary[];
  reportDate: string;
  fundName: string;
}

interface LPReportingProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

const DEFAULT_FUND_SUMMARY: FundSummary = {
  tvpi: 1.65,
  dpi: 0.42,
  rvpi: 1.23,
  netIRR: 18.4,
  totalCommitted: 150000000,
  totalCalled: 112500000,
  totalDistributed: 47250000,
  totalNAV: 138375000,
  vintage: 2021,
  fundLife: '5 of 10 years',
};

const DEFAULT_CAPITAL_ACCOUNT: CapitalAccountEntry[] = [
  { quarter: 'Q1 2025', beginningBalance: 125400000, contributions: 5600000, distributions: -3200000, gainsLosses: 4800000, endingBalance: 132600000 },
  { quarter: 'Q2 2025', beginningBalance: 132600000, contributions: 3200000, distributions: -5100000, gainsLosses: 3600000, endingBalance: 134300000 },
  { quarter: 'Q3 2025', beginningBalance: 134300000, contributions: 2800000, distributions: -4500000, gainsLosses: 2900000, endingBalance: 135500000 },
  { quarter: 'Q4 2025', beginningBalance: 135500000, contributions: 1400000, distributions: -6200000, gainsLosses: 7675000, endingBalance: 138375000 },
];

const DEFAULT_DISTRIBUTIONS: DistributionEntry[] = [
  { quarter: 'Q1 2024', returnOfCapital: 1200000, capitalGains: 800000, incomeDistributions: 1500000, total: 3500000 },
  { quarter: 'Q2 2024', returnOfCapital: 1000000, capitalGains: 1200000, incomeDistributions: 1600000, total: 3800000 },
  { quarter: 'Q3 2024', returnOfCapital: 800000, capitalGains: 1500000, incomeDistributions: 1400000, total: 3700000 },
  { quarter: 'Q4 2024', returnOfCapital: 2000000, capitalGains: 3500000, incomeDistributions: 1800000, total: 7300000 },
  { quarter: 'Q1 2025', returnOfCapital: 900000, capitalGains: 1000000, incomeDistributions: 1300000, total: 3200000 },
  { quarter: 'Q2 2025', returnOfCapital: 1400000, capitalGains: 2200000, incomeDistributions: 1500000, total: 5100000 },
  { quarter: 'Q3 2025', returnOfCapital: 1200000, capitalGains: 1800000, incomeDistributions: 1500000, total: 4500000 },
  { quarter: 'Q4 2025', returnOfCapital: 1800000, capitalGains: 2500000, incomeDistributions: 1900000, total: 6200000 },
];

const DEFAULT_NAV_BRIDGE: NAVBridgeItem[] = [
  { label: 'Beginning NAV', value: 125400000, type: 'start' },
  { label: 'Capital Calls', value: 13000000, type: 'add' },
  { label: 'Distributions', value: -19000000, type: 'subtract' },
  { label: 'Unrealized Gains', value: 15200000, type: 'add' },
  { label: 'Realized Gains', value: 5500000, type: 'add' },
  { label: 'Fees & Expenses', value: -1725000, type: 'subtract' },
  { label: 'Ending NAV', value: 138375000, type: 'end' },
];

const DEFAULT_INVESTMENTS: InvestmentSummary[] = [
  { property: 'Marina Bay Resort', vintage: 2021, investedCapital: 28000000, currentValue: 42500000, moic: 1.52, irr: 19.2, status: 'active' },
  { property: 'Harbor Point Marina', vintage: 2022, investedCapital: 22000000, currentValue: 31200000, moic: 1.42, irr: 17.8, status: 'active' },
  { property: 'Sunset Docks Complex', vintage: 2022, investedCapital: 18000000, currentValue: 27800000, moic: 1.54, irr: 21.3, status: 'active' },
  { property: 'Coastal Landing', vintage: 2023, investedCapital: 25000000, currentValue: 29500000, moic: 1.18, irr: 14.5, status: 'active' },
  { property: 'Tidewater Basin', vintage: 2023, investedCapital: 12000000, currentValue: 15800000, moic: 1.32, irr: 16.7, status: 'active' },
  { property: 'Bayshore Marina (Realized)', vintage: 2021, investedCapital: 15000000, currentValue: 25600000, moic: 1.71, irr: 22.4, status: 'realized' },
];

function fmtM(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
  if (abs >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' {
  switch (status) {
    case 'active': return 'default';
    case 'realized': return 'secondary';
    case 'partially-realized': return 'secondary';
    default: return 'default';
  }
}

function LPReporting({ projectId, onTabChange }: LPReportingProps) {
  const [activeSection, setActiveSection] = useState<'summary' | 'capital' | 'distributions' | 'investments'>('summary');

  const { data, isLoading } = useQuery<LPReportingResponse>({
    queryKey: ['/api/modeling/projects', projectId, 'lp-reporting'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/modeling/projects/${projectId}/lp-reporting`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const fundSummary = data?.fundSummary ?? DEFAULT_FUND_SUMMARY;
  const capitalAccount = data?.capitalAccount ?? DEFAULT_CAPITAL_ACCOUNT;
  const distributionHistory = data?.distributionHistory ?? DEFAULT_DISTRIBUTIONS;
  const navBridge = data?.navBridge ?? DEFAULT_NAV_BRIDGE;
  const investments = data?.investments ?? DEFAULT_INVESTMENTS;
  const fundName = data?.fundName ?? 'Marina Infrastructure Fund I';
  const reportDate = data?.reportDate ?? '2025-12-31';

  const navBridgeChart = useMemo(() => {
    let running = 0;
    return navBridge.map((item, idx) => {
      if (item.type === 'start') {
        running = item.value;
        return { name: item.label, base: 0, value: item.value, fill: '#3b82f6', total: item.value };
      }
      if (item.type === 'end') {
        return { name: item.label, base: 0, value: item.value, fill: '#3b82f6', total: item.value };
      }
      const prev = running;
      running += item.value;
      if (item.value >= 0) {
        return { name: item.label, base: prev, value: item.value, fill: '#10b981', total: running };
      }
      return { name: item.label, base: running, value: Math.abs(item.value), fill: '#ef4444', total: running };
    });
  }, [navBridge]);

  const totalInvested = investments.reduce((s, i) => s + i.investedCapital, 0);
  const totalCurrentValue = investments.reduce((s, i) => s + i.currentValue, 0);

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
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-xl font-semibold">{fundName}</h2>
          <p className="text-sm text-muted-foreground">LP Report as of {reportDate} | Vintage {fundSummary.vintage} | {fundSummary.fundLife}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" /> Export PDF
          </Button>
        </div>
      </div>

      {/* Fund-Level KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">TVPI</div>
              <TrendingUp className="h-4 w-4 text-emerald-500 print:hidden" />
            </div>
            <div className="text-2xl font-bold mt-1">{fundSummary.tvpi.toFixed(2)}x</div>
            <div className="text-xs text-muted-foreground mt-1">Total Value to Paid-In</div>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">DPI</div>
              <DollarSign className="h-4 w-4 text-blue-500 print:hidden" />
            </div>
            <div className="text-2xl font-bold mt-1">{fundSummary.dpi.toFixed(2)}x</div>
            <div className="text-xs text-muted-foreground mt-1">Distributions to Paid-In</div>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">RVPI</div>
              <PieChart className="h-4 w-4 text-purple-500 print:hidden" />
            </div>
            <div className="text-2xl font-bold mt-1">{fundSummary.rvpi.toFixed(2)}x</div>
            <div className="text-xs text-muted-foreground mt-1">Residual Value to Paid-In</div>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Net IRR</div>
              <ArrowUpRight className="h-4 w-4 text-emerald-500 print:hidden" />
            </div>
            <div className="text-2xl font-bold mt-1">{fundSummary.netIRR.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground mt-1">Net of fees and carry</div>
          </CardContent>
        </Card>
      </div>

      {/* Fund Capital Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Committed:</span>
              <div className="font-semibold text-base">{fmtM(fundSummary.totalCommitted)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Total Called:</span>
              <div className="font-semibold text-base">{fmtM(fundSummary.totalCalled)}</div>
              <div className="text-xs text-muted-foreground">{((fundSummary.totalCalled / fundSummary.totalCommitted) * 100).toFixed(0)}% drawn</div>
            </div>
            <div>
              <span className="text-muted-foreground">Total Distributed:</span>
              <div className="font-semibold text-base">{fmtM(fundSummary.totalDistributed)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Current NAV:</span>
              <div className="font-semibold text-base">{fmtM(fundSummary.totalNAV)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section Navigation */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant={activeSection === 'summary' ? 'default' : 'outline'} size="sm" onClick={() => setActiveSection('summary')}>
          <FileText className="h-4 w-4 mr-1" /> NAV Bridge
        </Button>
        <Button variant={activeSection === 'capital' ? 'default' : 'outline'} size="sm" onClick={() => setActiveSection('capital')}>
          <Calendar className="h-4 w-4 mr-1" /> Capital Account
        </Button>
        <Button variant={activeSection === 'distributions' ? 'default' : 'outline'} size="sm" onClick={() => setActiveSection('distributions')}>
          <DollarSign className="h-4 w-4 mr-1" /> Distributions
        </Button>
        <Button variant={activeSection === 'investments' ? 'default' : 'outline'} size="sm" onClick={() => setActiveSection('investments')}>
          <Building2 className="h-4 w-4 mr-1" /> Investments
        </Button>
      </div>

      {/* NAV Bridge Waterfall */}
      {activeSection === 'summary' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">NAV Bridge</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={navBridgeChart} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={60} />
                  <YAxis tickFormatter={(v) => fmtM(v)} />
                  <RechartTooltip
                    formatter={(value: number, name: string) => {
                      if (name === 'base') return [null, null];
                      return [fmtM(value), 'Amount'];
                    }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Bar dataKey="base" stackId="stack" fill="transparent" />
                  <Bar dataKey="value" stackId="stack" radius={[4, 4, 0, 0]}>
                    {navBridgeChart.map((entry, index) => (
                      <Cell key={`nav-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Capital Account Statement */}
      {activeSection === 'capital' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Capital Account Statement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quarter</TableHead>
                  <TableHead className="text-right">Beginning Balance</TableHead>
                  <TableHead className="text-right">Contributions</TableHead>
                  <TableHead className="text-right">Distributions</TableHead>
                  <TableHead className="text-right">Gains / Losses</TableHead>
                  <TableHead className="text-right font-semibold">Ending Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {capitalAccount.map((row) => (
                  <TableRow key={row.quarter}>
                    <TableCell className="font-medium">{row.quarter}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtM(row.beginningBalance)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-emerald-600">+{fmtM(row.contributions)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-red-600">{fmtM(row.distributions)}</TableCell>
                    <TableCell className={cn('text-right font-mono text-sm', row.gainsLosses >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {row.gainsLosses >= 0 ? '+' : ''}{fmtM(row.gainsLosses)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">{fmtM(row.endingBalance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribution History */}
      {activeSection === 'distributions' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribution History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionHistory} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => fmtM(v)} />
                  <RechartTooltip formatter={(value: number) => [fmtM(value), '']} />
                  <Legend />
                  <Bar dataKey="returnOfCapital" name="Return of Capital" stackId="dist" fill="#94a3b8" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="capitalGains" name="Capital Gains" stackId="dist" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="incomeDistributions" name="Income" stackId="dist" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quarter</TableHead>
                  <TableHead className="text-right">Return of Capital</TableHead>
                  <TableHead className="text-right">Capital Gains</TableHead>
                  <TableHead className="text-right">Income</TableHead>
                  <TableHead className="text-right font-semibold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distributionHistory.map((row) => (
                  <TableRow key={row.quarter}>
                    <TableCell className="font-medium">{row.quarter}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtM(row.returnOfCapital)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtM(row.capitalGains)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtM(row.incomeDistributions)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">{fmtM(row.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmtM(distributionHistory.reduce((s, r) => s + r.returnOfCapital, 0))}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmtM(distributionHistory.reduce((s, r) => s + r.capitalGains, 0))}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmtM(distributionHistory.reduce((s, r) => s + r.incomeDistributions, 0))}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmtM(distributionHistory.reduce((s, r) => s + r.total, 0))}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Investment Summary */}
      {activeSection === 'investments' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Individual Investment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-center">Vintage</TableHead>
                  <TableHead className="text-right">Invested Capital</TableHead>
                  <TableHead className="text-right">Current Value</TableHead>
                  <TableHead className="text-right">MOIC</TableHead>
                  <TableHead className="text-right">IRR</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {investments.map((row) => (
                  <TableRow key={row.property}>
                    <TableCell className="font-medium">{row.property}</TableCell>
                    <TableCell className="text-center">{row.vintage}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtM(row.investedCapital)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtM(row.currentValue)}</TableCell>
                    <TableCell className={cn('text-right font-semibold', row.moic >= 1.5 ? 'text-emerald-600' : row.moic >= 1.0 ? 'text-amber-600' : 'text-red-600')}>
                      {row.moic.toFixed(2)}x
                    </TableCell>
                    <TableCell className={cn('text-right font-semibold', row.irr >= 15 ? 'text-emerald-600' : row.irr >= 8 ? 'text-amber-600' : 'text-red-600')}>
                      {row.irr.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={getStatusVariant(row.status)}>
                        {row.status === 'partially-realized' ? 'Partial' : row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>Portfolio Total</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono text-sm">{fmtM(totalInvested)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{fmtM(totalCurrentValue)}</TableCell>
                  <TableCell className="text-right">{(totalCurrentValue / totalInvested).toFixed(2)}x</TableCell>
                  <TableCell className="text-right">{fundSummary.netIRR.toFixed(1)}%</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default LPReporting;
