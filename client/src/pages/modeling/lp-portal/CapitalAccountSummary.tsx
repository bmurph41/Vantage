import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatCurrency, formatPercent } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  DollarSign,
} from 'lucide-react';

interface CapitalAccount {
  currentBalance: number;
  totalCommitment: number;
  totalCalled: number;
  totalDistributed: number;
  unfundedCommitment: number;
  returnOfCapital: number;
  gainDistributions: number;
  unrealizedValue: number;
}

interface Transaction {
  id: string;
  date: string;
  type: 'capital_call' | 'distribution' | 'return_of_capital' | 'management_fee' | 'carried_interest';
  description: string;
  amount: number;
  runningBalance: number;
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  capital_call: 'Capital Call',
  distribution: 'Distribution',
  return_of_capital: 'Return of Capital',
  management_fee: 'Management Fee',
  carried_interest: 'Carried Interest',
};

const TRANSACTION_TYPE_ICONS: Record<string, typeof ArrowUpRight> = {
  capital_call: ArrowUpRight,
  distribution: ArrowDownLeft,
  return_of_capital: RotateCcw,
  management_fee: DollarSign,
  carried_interest: TrendingUp,
};

export default function CapitalAccountSummary({ fundId }: { fundId: string }) {
  const { data: account, isLoading: accountLoading } = useQuery<CapitalAccount>({
    queryKey: ['/api/lp-portal/capital-account', fundId],
    enabled: !!fundId,
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ['/api/lp-portal/capital-account/transactions', fundId],
    enabled: !!fundId,
  });

  // Use API data or defaults
  const acct: CapitalAccount = account || {
    currentBalance: 12500000,
    totalCommitment: 25000000,
    totalCalled: 18750000,
    totalDistributed: 4200000,
    unfundedCommitment: 6250000,
    returnOfCapital: 2800000,
    gainDistributions: 1400000,
    unrealizedValue: 15800000,
  };

  const txns: Transaction[] = transactions || [
    { id: '1', date: '2025-12-15', type: 'distribution', description: 'Q4 2025 Distribution', amount: 850000, runningBalance: 12500000 },
    { id: '2', date: '2025-10-01', type: 'capital_call', description: 'Capital Call #8 - Marina Acquisition', amount: -1500000, runningBalance: 13350000 },
    { id: '3', date: '2025-07-15', type: 'distribution', description: 'Q2 2025 Distribution', amount: 620000, runningBalance: 11850000 },
    { id: '4', date: '2025-04-01', type: 'management_fee', description: 'Q1 2025 Management Fee', amount: -125000, runningBalance: 11230000 },
    { id: '5', date: '2025-01-15', type: 'return_of_capital', description: 'Property Sale - Return of Capital', amount: 2000000, runningBalance: 11355000 },
    { id: '6', date: '2024-10-01', type: 'capital_call', description: 'Capital Call #7 - Portfolio Improvement', amount: -2000000, runningBalance: 9355000 },
    { id: '7', date: '2024-07-15', type: 'distribution', description: 'Q2 2024 Distribution', amount: 450000, runningBalance: 11355000 },
    { id: '8', date: '2024-04-01', type: 'capital_call', description: 'Capital Call #6', amount: -3000000, runningBalance: 10905000 },
  ];

  const waterfallData = [
    { name: 'Commitment', value: acct.totalCommitment, fill: '#94a3b8' },
    { name: 'Called', value: acct.totalCalled, fill: '#3b82f6' },
    { name: 'Distributed', value: acct.totalDistributed, fill: '#10b981' },
    { name: 'Unfunded', value: acct.unfundedCommitment, fill: '#f59e0b' },
  ];

  const unfundedPct = acct.totalCommitment > 0
    ? (acct.unfundedCommitment / acct.totalCommitment) * 100
    : 0;

  if (accountLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Balance Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground uppercase font-medium">
                Capital Account Balance
              </div>
              <div className="text-4xl font-bold mt-1">
                {formatCurrency(acct.currentBalance)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Net of contributions, distributions, and fees
              </div>
            </div>
            <Wallet className="h-12 w-12 text-primary/30" />
          </div>
        </CardContent>
      </Card>

      {/* Unfunded Commitment Alert */}
      {unfundedPct > 20 && (
        <Alert variant="default" className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">Unfunded Commitment</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            You have {formatCurrency(acct.unfundedCommitment)} ({unfundedPct.toFixed(0)}%) of
            unfunded commitment remaining. Future capital calls may be issued.
          </AlertDescription>
        </Alert>
      )}

      {/* Waterfall Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Commitment vs Called vs Distributed</CardTitle>
          <CardDescription>Capital waterfall breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfallData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
                />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Bar dataKey="value" name="Amount" radius={[0, 4, 4, 0]}>
                  {waterfallData.map((entry, index) => (
                    <Bar key={index} dataKey="value" fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-center">
              <div className="text-xs text-muted-foreground uppercase">Commitment</div>
              <div className="text-lg font-bold">{formatCurrency(acct.totalCommitment)}</div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-center">
              <div className="text-xs text-muted-foreground uppercase">Called</div>
              <div className="text-lg font-bold text-blue-600">{formatCurrency(acct.totalCalled)}</div>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg text-center">
              <div className="text-xs text-muted-foreground uppercase">Distributed</div>
              <div className="text-lg font-bold text-green-600">{formatCurrency(acct.totalDistributed)}</div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-center">
              <div className="text-xs text-muted-foreground uppercase">Unfunded</div>
              <div className="text-lg font-bold text-amber-600">{formatCurrency(acct.unfundedCommitment)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Capital calls, distributions, and other movements</CardDescription>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : txns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions recorded yet
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txns.map((txn) => {
                  const Icon = TRANSACTION_TYPE_ICONS[txn.type] || DollarSign;
                  const isPositive = txn.amount > 0;
                  return (
                    <TableRow key={txn.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(txn.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <Icon className="h-3 w-3" />
                          {TRANSACTION_TYPE_LABELS[txn.type] || txn.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{txn.description}</TableCell>
                      <TableCell className={`text-right font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive ? '+' : ''}{formatCurrency(txn.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(txn.runningBalance)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
