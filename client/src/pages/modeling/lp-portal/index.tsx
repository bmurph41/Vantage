import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { PackGate } from '@/contexts/PackContext';
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Users,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  FileText,
  Download,
  BarChart3,
  Clock,
  Wallet,
  Receipt,
  Target,
  Activity
} from 'lucide-react';
import type { Fund, FundInvestor, FundDealAllocation, FundCapitalMovement, FundCashFlow } from '@shared/schema';

interface FundWithMetrics extends Fund {
  netIrr?: number;
  tvpi?: number;
  dpi?: number;
  rvpi?: number;
  deployedCapital?: number;
  dryPowder?: number;
  calledCapital?: number;
  distributedCapital?: number;
  nav?: number;
}

function LPPortalContent() {
  const [selectedFundId, setSelectedFundId] = useState<string | null>(null);

  const { data: funds, isLoading: fundsLoading } = useQuery<FundWithMetrics[]>({
    queryKey: ['/api/funds'],
  });

  const { data: investors, isLoading: investorsLoading } = useQuery<FundInvestor[]>({
    queryKey: ['/api/funds', selectedFundId, 'investors'],
    enabled: !!selectedFundId,
  });

  const { data: allocations } = useQuery<FundDealAllocation[]>({
    queryKey: ['/api/funds', selectedFundId, 'allocations'],
    enabled: !!selectedFundId,
  });

  const { data: movements } = useQuery<FundCapitalMovement[]>({
    queryKey: ['/api/funds', selectedFundId, 'capital-movements'],
    enabled: !!selectedFundId,
  });

  const { data: fundMetrics } = useQuery<{
    netIrr: number;
    grossIrr: number;
    tvpi: number;
    dpi: number;
    rvpi: number;
    calledCapital: number;
    distributedCapital: number;
    nav: number;
    deployedCapital: number;
    dryPowder: number;
    committedCapital: number;
    managementFees: number;
    carriedInterest: number;
  }>({
    queryKey: ['/api/funds', selectedFundId, 'metrics'],
    enabled: !!selectedFundId,
  });

  const selectedFund = funds?.find(f => f.id === selectedFundId);

  if (fundsLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!funds || funds.length === 0) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Funds Available</h3>
          <p className="text-muted-foreground mb-4">
            Create a fund in Fund Management to view investor portal information
          </p>
          <Button onClick={() => window.location.href = '/modeling/funds'}>
            Go to Fund Management
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            LP Portal
          </h1>
          <p className="text-muted-foreground">
            Investor capital accounts, performance tracking, and fund statements
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select onValueChange={setSelectedFundId} value={selectedFundId || ''}>
            <SelectTrigger className="w-[250px]" data-testid="select-fund">
              <SelectValue placeholder="Select a fund..." />
            </SelectTrigger>
            <SelectContent>
              {funds.map((fund) => (
                <SelectItem key={fund.id} value={fund.id}>
                  <div className="flex items-center gap-2">
                    <span>{fund.name}</span>
                    {fund.vintage && (
                      <Badge variant="secondary" className="text-xs">
                        {fund.vintage}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedFundId ? (
        <Card className="p-8 text-center">
          <PieChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Select a Fund</h3>
          <p className="text-muted-foreground">
            Choose a fund from the dropdown to view LP information
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Net IRR</div>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </div>
                <div className="text-2xl font-bold mt-1">
                  {fundMetrics ? formatPercent(fundMetrics.netIrr * 100) : '--'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Gross: {fundMetrics ? formatPercent(fundMetrics.grossIrr * 100) : '--'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">TVPI</div>
                  <Target className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold mt-1">
                  {fundMetrics ? `${fundMetrics.tvpi.toFixed(2)}x` : '--'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  DPI: {fundMetrics ? `${fundMetrics.dpi.toFixed(2)}x` : '--'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Called Capital</div>
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
                <div className="text-2xl font-bold mt-1">
                  {fundMetrics ? formatCurrency(fundMetrics.calledCapital) : '--'}
                </div>
                <Progress 
                  value={fundMetrics && selectedFund ? 
                    (fundMetrics.calledCapital / parseFloat(selectedFund.committedCapital?.toString() || '1')) * 100 : 0
                  } 
                  className="mt-2 h-1" 
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Distributions</div>
                  <DollarSign className="h-4 w-4 text-green-500" />
                </div>
                <div className="text-2xl font-bold mt-1">
                  {fundMetrics ? formatCurrency(fundMetrics.distributedCapital) : '--'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Return of Capital + Gains
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">NAV</div>
                  <Building2 className="h-4 w-4 text-orange-500" />
                </div>
                <div className="text-2xl font-bold mt-1">
                  {fundMetrics ? formatCurrency(fundMetrics.nav) : '--'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Unrealized Value
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="capital-account" className="space-y-4">
            <TabsList>
              <TabsTrigger value="capital-account" className="gap-2">
                <Wallet className="h-4 w-4" />
                Capital Account
              </TabsTrigger>
              <TabsTrigger value="investors" className="gap-2">
                <Users className="h-4 w-4" />
                Investors
              </TabsTrigger>
              <TabsTrigger value="transactions" className="gap-2">
                <Receipt className="h-4 w-4" />
                Transactions
              </TabsTrigger>
              <TabsTrigger value="portfolio" className="gap-2">
                <Building2 className="h-4 w-4" />
                Portfolio
              </TabsTrigger>
              <TabsTrigger value="statements" className="gap-2">
                <FileText className="h-4 w-4" />
                Statements
              </TabsTrigger>
            </TabsList>

            <TabsContent value="capital-account">
              <Card>
                <CardHeader>
                  <CardTitle>Capital Account Summary</CardTitle>
                  <CardDescription>
                    Committed capital, contributions, distributions, and current balance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm uppercase text-muted-foreground">Commitments</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Committed</span>
                          <span className="font-medium">
                            {formatCurrency(parseFloat(selectedFund?.committedCapital?.toString() || '0'))}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Called Capital</span>
                          <span className="font-medium">
                            {fundMetrics ? formatCurrency(fundMetrics.calledCapital) : '--'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Unfunded Commitment</span>
                          <span className="font-medium text-orange-600">
                            {fundMetrics && selectedFund ? 
                              formatCurrency(parseFloat(selectedFund.committedCapital?.toString() || '0') - fundMetrics.calledCapital) : '--'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm uppercase text-muted-foreground">Distributions</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Distributed</span>
                          <span className="font-medium text-green-600">
                            {fundMetrics ? formatCurrency(fundMetrics.distributedCapital) : '--'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Return of Capital</span>
                          <span className="font-medium">--</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Gain Distributions</span>
                          <span className="font-medium text-green-600">--</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm uppercase text-muted-foreground">Current Position</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">NAV (Unrealized)</span>
                          <span className="font-medium">
                            {fundMetrics ? formatCurrency(fundMetrics.nav) : '--'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Value</span>
                          <span className="font-medium">
                            {fundMetrics ? formatCurrency(fundMetrics.distributedCapital + fundMetrics.nav) : '--'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Net Gain/(Loss)</span>
                          <span className={`font-medium ${fundMetrics && fundMetrics.distributedCapital + fundMetrics.nav - fundMetrics.calledCapital >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {fundMetrics ? 
                              formatCurrency(fundMetrics.distributedCapital + fundMetrics.nav - fundMetrics.calledCapital) : '--'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Separator className="my-6" />
                  <div className="grid grid-cols-4 gap-4">
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="text-xs text-muted-foreground uppercase">TVPI</div>
                        <div className="text-xl font-bold mt-1">
                          {fundMetrics ? `${fundMetrics.tvpi.toFixed(2)}x` : '--'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Total Value / Paid-In
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="text-xs text-muted-foreground uppercase">DPI</div>
                        <div className="text-xl font-bold mt-1">
                          {fundMetrics ? `${fundMetrics.dpi.toFixed(2)}x` : '--'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Distributions / Paid-In
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="text-xs text-muted-foreground uppercase">RVPI</div>
                        <div className="text-xl font-bold mt-1">
                          {fundMetrics ? `${fundMetrics.rvpi.toFixed(2)}x` : '--'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Residual Value / Paid-In
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="text-xs text-muted-foreground uppercase">Net IRR</div>
                        <div className="text-xl font-bold mt-1">
                          {fundMetrics ? formatPercent(fundMetrics.netIrr * 100) : '--'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Net of fees & carry
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="investors">
              <Card>
                <CardHeader>
                  <CardTitle>Fund Investors</CardTitle>
                  <CardDescription>
                    LP and GP commitments, contributions, and distributions by investor
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {investorsLoading ? (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12" />
                      ))}
                    </div>
                  ) : !investors || investors.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No investors found for this fund
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Investor</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Commitment</TableHead>
                          <TableHead className="text-right">Called</TableHead>
                          <TableHead className="text-right">Distributed</TableHead>
                          <TableHead className="text-right">Unfunded</TableHead>
                          <TableHead className="text-right">Ownership %</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {investors.map((investor) => (
                          <TableRow key={investor.id} data-testid={`investor-row-${investor.id}`}>
                            <TableCell className="font-medium">{investor.investorName}</TableCell>
                            <TableCell>
                              <Badge variant={investor.investorType === 'gp' ? 'default' : 'secondary'}>
                                {investor.investorType?.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(parseFloat(investor.commitmentAmount?.toString() || '0'))}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(parseFloat(investor.calledCapital?.toString() || '0'))}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {formatCurrency(parseFloat(investor.distributedCapital?.toString() || '0'))}
                            </TableCell>
                            <TableCell className="text-right text-orange-600">
                              {formatCurrency(parseFloat(investor.unfundedCommitment?.toString() || '0'))}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPercent(parseFloat(investor.commitmentPct?.toString() || '0') * 100)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions">
              <Card>
                <CardHeader>
                  <CardTitle>Capital Activity</CardTitle>
                  <CardDescription>
                    Capital calls, contributions, and distributions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!movements || movements.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No capital movements recorded yet
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movements.slice(0, 10).map((movement) => (
                          <TableRow key={movement.id} data-testid={`movement-row-${movement.id}`}>
                            <TableCell>
                              {movement.movementDate ? new Date(movement.movementDate).toLocaleDateString() : '--'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                movement.movementType === 'distribution' ? 'default' :
                                movement.movementType === 'capital_call' ? 'secondary' :
                                'outline'
                              }>
                                {movement.movementType?.replace(/_/g, ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {movement.description || movement.callPurpose || '--'}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${
                              movement.movementType === 'distribution' ? 'text-green-600' : ''
                            }`}>
                              {movement.movementType === 'distribution' ? '+' : ''}
                              {formatCurrency(parseFloat(movement.amount?.toString() || '0'))}
                            </TableCell>
                            <TableCell>
                              <Badge variant={movement.status === 'completed' ? 'default' : 'secondary'}>
                                {movement.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="portfolio">
              <Card>
                <CardHeader>
                  <CardTitle>Portfolio Companies</CardTitle>
                  <CardDescription>
                    Fund investments and current valuations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!allocations || allocations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No portfolio investments yet
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Investment</TableHead>
                          <TableHead>Investment Date</TableHead>
                          <TableHead className="text-right">Cost Basis</TableHead>
                          <TableHead className="text-right">Current Value</TableHead>
                          <TableHead className="text-right">Gain/(Loss)</TableHead>
                          <TableHead className="text-right">Deal IRR</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allocations.map((allocation) => {
                          const costBasis = parseFloat(allocation.costBasis?.toString() || '0');
                          const currentValue = parseFloat(allocation.currentValue?.toString() || '0');
                          const unrealizedGain = parseFloat(allocation.unrealizedGain?.toString() || '0');
                          const dealIrr = parseFloat(allocation.dealIrr?.toString() || '0');
                          
                          return (
                            <TableRow key={allocation.id} data-testid={`allocation-row-${allocation.id}`}>
                              <TableCell className="font-medium">
                                Deal #{allocation.modelingProjectId.slice(0, 8)}
                              </TableCell>
                              <TableCell>
                                {allocation.investmentDate ? 
                                  new Date(allocation.investmentDate).toLocaleDateString() : '--'}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(costBasis)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(currentValue)}
                              </TableCell>
                              <TableCell className={`text-right ${unrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(unrealizedGain)}
                              </TableCell>
                              <TableCell className="text-right">
                                {dealIrr ? formatPercent(dealIrr * 100) : '--'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  allocation.exitStatus === 'exited' ? 'default' :
                                  allocation.exitStatus === 'active' ? 'secondary' :
                                  'destructive'
                                }>
                                  {allocation.exitStatus}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="statements">
              <Card>
                <CardHeader>
                  <CardTitle>Fund Statements</CardTitle>
                  <CardDescription>
                    Quarterly reports, K-1s, and capital account statements
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
                      <CardContent className="pt-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">Capital Account Statement</div>
                          <div className="text-sm text-muted-foreground">Q4 2024</div>
                        </div>
                        <Download className="h-4 w-4 ml-auto text-muted-foreground" />
                      </CardContent>
                    </Card>
                    <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
                      <CardContent className="pt-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <FileText className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                          <div className="font-medium">Schedule K-1</div>
                          <div className="text-sm text-muted-foreground">Tax Year 2024</div>
                        </div>
                        <Download className="h-4 w-4 ml-auto text-muted-foreground" />
                      </CardContent>
                    </Card>
                    <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
                      <CardContent className="pt-4 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <BarChart3 className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <div className="font-medium">Quarterly Report</div>
                          <div className="text-sm text-muted-foreground">Q4 2024</div>
                        </div>
                        <Download className="h-4 w-4 ml-auto text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </div>
                  <div className="mt-6 text-center text-sm text-muted-foreground">
                    Statement generation and downloads coming soon
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

export default function LPPortal() {
  return (
    <PackGate 
      pack={['fund_management', 'lp_portal']}
      upgradeMessage="LP Portal is a premium add-on that provides a dedicated investor portal with capital account statements, distribution tracking, and K-1 access. Requires Fund Management pack."
    >
      <LPPortalContent />
    </PackGate>
  );
}
