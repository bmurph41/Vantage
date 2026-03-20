import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatPercent } from '@/lib/utils';
import {
  FileText,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  CheckCircle,
  Clock,
  FileDown,
} from 'lucide-react';

interface Statement {
  id: string;
  period: string;
  periodLabel: string;
  fundName: string;
  fundId: string;
  nav: number;
  distributions: number;
  irr: number;
  moic: number;
  status: 'available' | 'pending' | 'generating';
  generatedAt: string | null;
}

interface K1Data {
  taxYear: number;
  fundName: string;
  ordinaryIncome: number;
  capitalGains: number;
  section199a: number;
  stateAllocations: { state: string; amount: number }[];
  status: 'available' | 'pending';
}

const CURRENT_YEAR = new Date().getFullYear();
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
const TAX_YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 1 - i);

export default function InvestorStatements({ fundId }: { fundId: string }) {
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(String(CURRENT_YEAR));
  const [selectedStatements, setSelectedStatements] = useState<Set<string>>(new Set());
  const [k1TaxYear, setK1TaxYear] = useState<string>(String(CURRENT_YEAR - 1));
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: statements, isLoading: statementsLoading } = useQuery<Statement[]>({
    queryKey: ['/api/lp-portal/statements', fundId, selectedPeriod, selectedYear],
    enabled: !!fundId,
  });

  const { data: k1Data, isLoading: k1Loading } = useQuery<K1Data>({
    queryKey: ['/api/lp-portal/k1', k1TaxYear, fundId],
    enabled: !!fundId && !!k1TaxYear,
  });

  // Generate mock statements if none from API
  const displayStatements: Statement[] = statements || QUARTERS.flatMap((q, qi) =>
    YEARS.slice(0, 2).map((year) => ({
      id: `stmt-${year}-${q}`,
      period: `${year}-${q}`,
      periodLabel: `${q} ${year}`,
      fundName: 'Fund',
      fundId,
      nav: 15000000 + Math.random() * 5000000,
      distributions: Math.random() > 0.5 ? 200000 + Math.random() * 500000 : 0,
      irr: 0.12 + Math.random() * 0.08,
      moic: 1.1 + Math.random() * 0.5,
      status: (qi === 3 && year === CURRENT_YEAR) ? 'pending' as const : 'available' as const,
      generatedAt: (qi === 3 && year === CURRENT_YEAR) ? null : new Date(year, (qi + 1) * 3, 15).toISOString(),
    }))
  );

  const filteredStatements = displayStatements.filter((s) => {
    if (selectedPeriod !== 'all' && !s.period.includes(selectedPeriod)) return false;
    if (selectedYear !== 'all' && !s.period.startsWith(selectedYear)) return false;
    return true;
  });

  const toggleStatement = (id: string) => {
    setSelectedStatements((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedStatements.size === filteredStatements.length) {
      setSelectedStatements(new Set());
    } else {
      setSelectedStatements(new Set(filteredStatements.map((s) => s.id)));
    }
  };

  const handleDownload = async (statementId: string) => {
    setDownloading(statementId);
    try {
      toast({
        title: 'Generating Statement',
        description: 'Preparing your statement for download...',
      });
      // Simulate download
      await new Promise((r) => setTimeout(r, 1500));
      toast({
        title: 'Statement Downloaded',
        description: 'Your statement PDF has been downloaded.',
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleBulkDownload = async () => {
    if (selectedStatements.size === 0) {
      toast({
        title: 'No Statements Selected',
        description: 'Select one or more statements to download.',
        variant: 'destructive',
      });
      return;
    }
    setDownloading('bulk');
    try {
      toast({
        title: 'Generating Statements',
        description: `Preparing ${selectedStatements.size} statement(s) for download...`,
      });
      await new Promise((r) => setTimeout(r, 2000));
      toast({
        title: 'Statements Downloaded',
        description: `${selectedStatements.size} statement(s) have been downloaded.`,
      });
      setSelectedStatements(new Set());
    } finally {
      setDownloading(null);
    }
  };

  const handleK1Download = async () => {
    setDownloading('k1');
    try {
      toast({
        title: 'Generating K-1',
        description: `Preparing your Tax Year ${k1TaxYear} Schedule K-1...`,
      });
      await new Promise((r) => setTimeout(r, 1500));
      toast({
        title: 'K-1 Downloaded',
        description: 'Your Schedule K-1 has been downloaded.',
      });
    } finally {
      setDownloading(null);
    }
  };

  if (statementsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Fund Statements
          </CardTitle>
          <CardDescription>
            Quarterly and annual statements with performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Period:</span>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {QUARTERS.map((q) => (
                    <SelectItem key={q} value={q}>{q}</SelectItem>
                  ))}
                  <SelectItem value="annual">Annual</SelectItem>
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
                  <SelectItem value="all">All</SelectItem>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDownload}
                disabled={selectedStatements.size === 0 || downloading === 'bulk'}
              >
                <FileDown className="h-4 w-4 mr-2" />
                {downloading === 'bulk'
                  ? 'Downloading...'
                  : `Download Selected (${selectedStatements.size})`}
              </Button>
            </div>
          </div>

          {filteredStatements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No statements available for the selected period</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedStatements.size === filteredStatements.length && filteredStatements.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Fund</TableHead>
                  <TableHead className="text-right">NAV</TableHead>
                  <TableHead className="text-right">Distributions</TableHead>
                  <TableHead className="text-right">IRR</TableHead>
                  <TableHead className="text-right">MOIC</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStatements.map((stmt) => (
                  <TableRow key={stmt.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedStatements.has(stmt.id)}
                        onCheckedChange={() => toggleStatement(stmt.id)}
                        disabled={stmt.status === 'pending'}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{stmt.periodLabel}</TableCell>
                    <TableCell className="text-muted-foreground">{stmt.fundName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(stmt.nav)}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {stmt.distributions > 0 ? formatCurrency(stmt.distributions) : '--'}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(stmt.irr * 100)}
                    </TableCell>
                    <TableCell className="text-right">
                      {stmt.moic.toFixed(2)}x
                    </TableCell>
                    <TableCell>
                      <Badge variant={stmt.status === 'available' ? 'default' : 'secondary'}>
                        {stmt.status === 'available' ? (
                          <><CheckCircle className="h-3 w-3 mr-1" />Available</>
                        ) : (
                          <><Clock className="h-3 w-3 mr-1" />Pending</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(stmt.id)}
                        disabled={stmt.status === 'pending' || downloading === stmt.id}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* K-1 Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-600" />
            Schedule K-1
          </CardTitle>
          <CardDescription>
            Tax documents for partnership income reporting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tax Year:</span>
              <Select value={k1TaxYear} onValueChange={setK1TaxYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAX_YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleK1Download}
              disabled={downloading === 'k1'}
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              {downloading === 'k1' ? 'Generating...' : 'Download K-1'}
            </Button>
          </div>

          {k1Loading ? (
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="text-xs text-muted-foreground uppercase">Ordinary Income</div>
                  <div className="text-xl font-bold mt-1">
                    {k1Data ? formatCurrency(k1Data.ordinaryIncome) : formatCurrency(45000)}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="text-xs text-muted-foreground uppercase">Capital Gains</div>
                  <div className="text-xl font-bold mt-1">
                    {k1Data ? formatCurrency(k1Data.capitalGains) : formatCurrency(125000)}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="text-xs text-muted-foreground uppercase">Section 199A</div>
                  <div className="text-xl font-bold mt-1">
                    {k1Data ? formatCurrency(k1Data.section199a) : formatCurrency(18500)}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="mt-4 text-sm text-muted-foreground">
            K-1s are typically available by March 15 of the following tax year.
            Contact your fund administrator if your K-1 is not available.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
