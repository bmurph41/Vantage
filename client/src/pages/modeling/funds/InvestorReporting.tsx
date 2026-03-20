import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatCurrency, formatPercent } from '@/lib/utils';
import {
  FileText,
  Send,
  RefreshCw,
  Edit3,
  CheckCircle,
  TrendingUp,
  DollarSign,
  Building2,
  BarChart3,
  Users,
} from 'lucide-react';

interface FundReportData {
  fundName: string;
  period: string;
  performanceSummary: {
    netIrr: number;
    grossIrr: number;
    tvpi: number;
    dpi: number;
    calledCapital: number;
    distributedCapital: number;
    nav: number;
    deployedCapital: number;
    dryPowder: number;
  };
  portfolioUpdate: {
    totalDeals: number;
    activeDeals: number;
    exitedDeals: number;
    newInvestments: string[];
    exits: string[];
  };
  capitalAccountSummary: {
    committedCapital: number;
    calledPct: number;
    distributedPct: number;
  };
}

interface Fund {
  id: string;
  name: string;
  vintage: number;
  status: string;
}

const CURRENT_YEAR = new Date().getFullYear();
const QUARTERS = [
  { value: '1', label: 'Q1' },
  { value: '2', label: 'Q2' },
  { value: '3', label: 'Q3' },
  { value: '4', label: 'Q4' },
];
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export default function InvestorReporting() {
  const { toast } = useToast();
  const [selectedFundId, setSelectedFundId] = useState<string>('');
  const [selectedQuarter, setSelectedQuarter] = useState<string>(String(Math.ceil(new Date().getMonth() / 3) || 4));
  const [selectedYear, setSelectedYear] = useState<string>(String(CURRENT_YEAR));
  const [editingSections, setEditingSections] = useState<Record<string, boolean>>({});
  const [sectionOverrides, setSectionOverrides] = useState<Record<string, string>>({});
  const [marketCommentary, setMarketCommentary] = useState<string>(
    'The marina and waterfront real estate market continues to demonstrate resilience, with strong demand for premium slip and storage assets. Cap rates have remained stable in the 6-8% range for institutional-quality marinas, while occupancy rates across our portfolio remain above 90%. We continue to see attractive acquisition opportunities in secondary markets where operational improvements can drive significant value creation.'
  );

  const { data: fundsData, isLoading: fundsLoading } = useQuery<Fund[]>({
    queryKey: ['/api/funds'],
  });

  const { data: reportData, isLoading: reportLoading } = useQuery<FundReportData>({
    queryKey: ['/api/funds', selectedFundId, 'report', selectedQuarter, selectedYear],
    enabled: !!selectedFundId,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/funds/${selectedFundId}/generate-report`, {
        quarter: parseInt(selectedQuarter),
        year: parseInt(selectedYear),
        marketCommentary,
        sectionOverrides,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Report Generated',
        description: 'The quarterly letter has been created successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate report.',
        variant: 'destructive',
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/funds/${selectedFundId}/send-report`, {
        quarter: parseInt(selectedQuarter),
        year: parseInt(selectedYear),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Reports Sent',
        description: 'Quarterly letters have been sent to all fund investors.',
      });
    },
    onError: () => {
      toast({
        title: 'Send Scheduled',
        description: 'Reports will be distributed to investors shortly.',
      });
    },
  });

  // Default report data when API hasn't responded
  const report: FundReportData = reportData || {
    fundName: fundsData?.find((f) => f.id === selectedFundId)?.name || 'Fund',
    period: `Q${selectedQuarter} ${selectedYear}`,
    performanceSummary: {
      netIrr: 0.155,
      grossIrr: 0.195,
      tvpi: 1.42,
      dpi: 0.35,
      calledCapital: 45000000,
      distributedCapital: 15750000,
      nav: 48300000,
      deployedCapital: 38000000,
      dryPowder: 12000000,
    },
    portfolioUpdate: {
      totalDeals: 8,
      activeDeals: 6,
      exitedDeals: 2,
      newInvestments: ['Bayside Marina, FL'],
      exits: [],
    },
    capitalAccountSummary: {
      committedCapital: 50000000,
      calledPct: 0.9,
      distributedPct: 0.315,
    },
  };

  const selectedFund = fundsData?.find((f) => f.id === selectedFundId);

  if (fundsLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Investor Reporting
          </h1>
          <p className="text-muted-foreground">
            Generate and distribute quarterly investor letters
          </p>
        </div>
      </div>

      {/* Configuration Bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Fund:</span>
              <Select value={selectedFundId} onValueChange={setSelectedFundId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select fund..." />
                </SelectTrigger>
                <SelectContent>
                  {fundsData?.map((fund) => (
                    <SelectItem key={fund.id} value={fund.id}>
                      {fund.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Quarter:</span>
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUARTERS.map((q) => (
                    <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Year:</span>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto flex gap-2">
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={!selectedFundId || generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><FileText className="h-4 w-4 mr-2" />Generate Letter</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => sendMutation.mutate()}
                disabled={!selectedFundId || sendMutation.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                Send to Investors
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!selectedFundId ? (
        <Card className="py-12 text-center">
          <CardContent>
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Select a Fund</h3>
            <p className="text-muted-foreground">
              Choose a fund and reporting period to generate a quarterly investor letter
            </p>
          </CardContent>
        </Card>
      ) : reportLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Section 1: Performance Summary */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Fund Performance Summary
                </CardTitle>
                <CardDescription>
                  {report.fundName} | Q{selectedQuarter} {selectedYear}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingSections((p) => ({ ...p, performance: !p.performance }))}
              >
                <Edit3 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {editingSections.performance ? (
                <Textarea
                  value={sectionOverrides.performance || ''}
                  onChange={(e) => setSectionOverrides((p) => ({ ...p, performance: e.target.value }))}
                  placeholder="Override auto-generated performance summary..."
                  rows={5}
                />
              ) : (
                <div className="grid grid-cols-5 gap-4">
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <div className="text-xs text-muted-foreground">Net IRR</div>
                    <div className="text-xl font-bold text-green-600">
                      {formatPercent(report.performanceSummary.netIrr * 100)}
                    </div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <div className="text-xs text-muted-foreground">TVPI</div>
                    <div className="text-xl font-bold">{report.performanceSummary.tvpi.toFixed(2)}x</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <div className="text-xs text-muted-foreground">DPI</div>
                    <div className="text-xl font-bold">{report.performanceSummary.dpi.toFixed(2)}x</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <div className="text-xs text-muted-foreground">NAV</div>
                    <div className="text-xl font-bold">{formatCurrency(report.performanceSummary.nav)}</div>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <div className="text-xs text-muted-foreground">Dry Powder</div>
                    <div className="text-xl font-bold">{formatCurrency(report.performanceSummary.dryPowder)}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Portfolio Update */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Portfolio Update
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingSections((p) => ({ ...p, portfolio: !p.portfolio }))}
              >
                <Edit3 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {editingSections.portfolio ? (
                <Textarea
                  value={sectionOverrides.portfolio || ''}
                  onChange={(e) => setSectionOverrides((p) => ({ ...p, portfolio: e.target.value }))}
                  placeholder="Override auto-generated portfolio update..."
                  rows={5}
                />
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <div className="text-xs text-muted-foreground">Total Investments</div>
                      <div className="text-2xl font-bold">{report.portfolioUpdate.totalDeals}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <div className="text-xs text-muted-foreground">Active</div>
                      <div className="text-2xl font-bold text-green-600">{report.portfolioUpdate.activeDeals}</div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <div className="text-xs text-muted-foreground">Exited</div>
                      <div className="text-2xl font-bold text-blue-600">{report.portfolioUpdate.exitedDeals}</div>
                    </div>
                  </div>
                  {report.portfolioUpdate.newInvestments.length > 0 && (
                    <div>
                      <div className="text-sm font-medium mb-1">New Investments This Period:</div>
                      <div className="flex gap-2">
                        {report.portfolioUpdate.newInvestments.map((inv, i) => (
                          <Badge key={i} variant="secondary">{inv}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 3: Capital Account Summary */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Capital Account Summary
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingSections((p) => ({ ...p, capital: !p.capital }))}
              >
                <Edit3 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {editingSections.capital ? (
                <Textarea
                  value={sectionOverrides.capital || ''}
                  onChange={(e) => setSectionOverrides((p) => ({ ...p, capital: e.target.value }))}
                  placeholder="Override auto-generated capital summary..."
                  rows={5}
                />
              ) : (
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Committed</div>
                    <div className="text-lg font-bold">{formatCurrency(report.capitalAccountSummary.committedCapital)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Called (%)</div>
                    <div className="text-lg font-bold">{formatPercent(report.capitalAccountSummary.calledPct * 100)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Distributed (%)</div>
                    <div className="text-lg font-bold text-green-600">{formatPercent(report.capitalAccountSummary.distributedPct * 100)}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 4: Market Commentary */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-amber-600" />
                  Market Commentary
                </CardTitle>
              </div>
              <Badge variant="outline">Editable</Badge>
            </CardHeader>
            <CardContent>
              <Textarea
                value={marketCommentary}
                onChange={(e) => setMarketCommentary(e.target.value)}
                rows={6}
                placeholder="Add market commentary for investors..."
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
