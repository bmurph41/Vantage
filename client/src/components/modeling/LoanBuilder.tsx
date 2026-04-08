import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatCurrency, formatPercent } from '@/lib/formatUtils';
import {
  Plus,
  Trash2,
  Edit,
  Building2,
  DollarSign,
  Percent,
  Layers,
  TrendingUp,
  Calculator,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  BarChart3,
  Copy,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  FileSpreadsheet,
  Calendar,
  Clock,
  Scale,
  Briefcase
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart
} from 'recharts';

interface LoanBuilderProps {
  projectId: string;
  purchasePrice: number;
  noi: number;
  onUpdate?: () => void;
}

interface LoanInput {
  id: string;
  name: string;
  principal: number;
  interestRate: number;
  termMonths: number;
  amortizationMonths: number;
  interestOnlyMonths: number;
  loanPurpose: string;
  lenderName: string;
  ltvAtOrigination: number;
  exitFeePct: number;
  prepaymentPenaltyType: string;
  prepaymentSchedule: { yearStart: number; yearEnd: number; penaltyPct: number }[];
  dscrMinimum: number;
  dscrTestFrequency: string;
  dscrTestStartMonth: number;
}

interface BlendedMetrics {
  totalDebtAmount: number;
  blendedInterestRate: number;
  blendedTermMonths: number;
  combinedLtv: number;
  totalAnnualDebtService: number;
  totalMonthlyDebtService: number;
  weightedAvgAmortization: number;
  debtYield: number;
  blendedDscr: number;
  loans: {
    id: string;
    name: string;
    principal: number;
    rate: number;
    weight: number;
    annualDebtService: number;
    monthlyPayment: number;
  }[];
}

interface LoanComparison {
  loanId: string;
  loanName: string;
  totalInterestPaid: number;
  totalPayments: number;
  effectiveRate: number;
  monthlyPayment: number;
  breakEvenMonth: number | null;
  totalCostOfDebt: number;
  annualDebtService: number;
  endingBalance: number;
  averageDscr: number;
}

interface AmortizationPeriod {
  periodMonth: number;
  periodYear: number;
  periodDate: string;
  beginningBalance: number;
  endingBalance: number;
  scheduledPayment: number;
  principalPayment: number;
  interestPayment: number;
  interestRate: number;
  isInterestOnly: boolean;
  cumulativePrincipal: number;
  cumulativeInterest: number;
  dscr?: number;
  dscrPassFail?: boolean;
}

interface DscrTest {
  testDate: string;
  testPeriod: string;
  trailingNoi: number;
  annualDebtService: number;
  requiredDscr: number;
  result: {
    passed: boolean;
    calculatedDscr: number;
    cushionAmount: number;
    cushionPct: number;
  };
}

const LOAN_PURPOSE_OPTIONS = [
  { value: 'acquisition', label: 'Acquisition', icon: Building2 },
  { value: 'construction', label: 'Construction', icon: Briefcase },
  { value: 'bridge', label: 'Bridge', icon: ArrowRightLeft },
  { value: 'permanent', label: 'Permanent', icon: CheckCircle2 },
  { value: 'refinancing', label: 'Refinancing', icon: RefreshCw },
  { value: 'mezzanine', label: 'Mezzanine', icon: Layers },
  { value: 'preferred_equity', label: 'Preferred Equity', icon: Scale },
  { value: 'line_of_credit', label: 'Line of Credit', icon: DollarSign },
];

const PREPAYMENT_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'declining_balance', label: 'Declining Balance (5-4-3-2-1)' },
  { value: 'yield_maintenance', label: 'Yield Maintenance' },
  { value: 'defeasance', label: 'Defeasance' },
  { value: 'step_down', label: 'Step Down (Custom)' },
  { value: 'lockout', label: 'Lockout Period' },
];

const DSCR_TEST_FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi_annual', label: 'Semi-Annual' },
  { value: 'annual', label: 'Annual' },
  { value: 'at_closing', label: 'At Closing Only' },
  { value: 'at_maturity', label: 'At Maturity Only' },
];

const createEmptyLoan = (purchasePrice: number): LoanInput => ({
  id: crypto.randomUUID(),
  name: 'Senior Debt',
  principal: purchasePrice * 0.65,
  interestRate: 0.065,
  termMonths: 120,
  amortizationMonths: 300,
  interestOnlyMonths: 0,
  loanPurpose: 'acquisition',
  lenderName: '',
  ltvAtOrigination: 65,
  exitFeePct: 0,
  prepaymentPenaltyType: 'none',
  prepaymentSchedule: [],
  dscrMinimum: 1.20,
  dscrTestFrequency: 'quarterly',
  dscrTestStartMonth: 1,
});

export default function LoanBuilder({ projectId, purchasePrice, noi, onUpdate }: LoanBuilderProps) {
  const { toast } = useToast();
  const [loans, setLoans] = useState<LoanInput[]>([createEmptyLoan(purchasePrice)]);
  const [activeTab, setActiveTab] = useState('builder');
  const [showComparison, setShowComparison] = useState(false);
  const [selectedLoanForSchedule, setSelectedLoanForSchedule] = useState<string | null>(null);
  const [holdPeriodMonths, setHoldPeriodMonths] = useState(60);
  const [noiGrowthRate, setNoiGrowthRate] = useState(0.02);

  const { data: templates } = useQuery<any[]>({
    queryKey: ['/api/debt/loan-structure-templates'],
  });

  const blendedMetricsMutation = useMutation({
    mutationFn: async (loanData: LoanInput[]) => {
      const res = await apiRequest('POST', '/api/debt/blended-metrics', {
        loans: loanData.map(l => ({
          ...l,
          interestRate: l.interestRate,
        })),
        purchasePrice,
        noi,
      });
      return res.json();
    },
  });

  const comparisonMutation = useMutation({
    mutationFn: async (loanData: LoanInput[]) => {
      const res = await apiRequest('POST', '/api/debt/compare-loans', {
        loans: loanData,
        noi,
        holdPeriodMonths,
      });
      return res.json();
    },
  });

  const amortizationMutation = useMutation({
    mutationFn: async (loan: LoanInput) => {
      const res = await apiRequest('POST', '/api/debt/amortization-schedule', {
        loan,
        holdPeriodMonths,
        annualNoi: noi,
      });
      return res.json();
    },
  });

  const dscrTestsMutation = useMutation({
    mutationFn: async (loan: LoanInput) => {
      const res = await apiRequest('POST', '/api/debt/dscr-tests', {
        loan,
        holdPeriodMonths,
        annualNoi: noi,
        noiGrowthRate,
      });
      return res.json();
    },
  });

  const cashFlowMutation = useMutation({
    mutationFn: async (loanData: LoanInput[]) => {
      const res = await apiRequest('POST', '/api/debt/cash-flow', {
        loans: loanData,
        annualNoi: noi,
        noiGrowthRate,
        holdPeriodYears: Math.ceil(holdPeriodMonths / 12),
      });
      return res.json();
    },
  });

  useEffect(() => {
    if (loans.length > 0) {
      blendedMetricsMutation.mutate(loans);
    }
  }, [loans, purchasePrice, noi]);

  const addLoan = () => {
    const newLoan = createEmptyLoan(purchasePrice);
    newLoan.name = `Loan ${loans.length + 1}`;
    newLoan.principal = purchasePrice * 0.15;
    newLoan.ltvAtOrigination = 15;
    setLoans([...loans, newLoan]);
  };

  const removeLoan = (id: string) => {
    if (loans.length > 1) {
      setLoans(loans.filter(l => l.id !== id));
    }
  };

  const updateLoan = (id: string, updates: Partial<LoanInput>) => {
    setLoans(loans.map(l => l.id === id ? { ...l, ...updates } : l));
  };

  const applyTemplate = (templateId: string) => {
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      const newLoans: LoanInput[] = template.loans.map((t: any, idx: number) => ({
        id: crypto.randomUUID(),
        name: t.name,
        principal: purchasePrice * (t.ltv / 100),
        interestRate: t.interestRate,
        termMonths: t.termMonths,
        amortizationMonths: t.amortizationMonths || t.termMonths,
        interestOnlyMonths: t.interestOnlyMonths || 0,
        loanPurpose: t.loanPurpose,
        lenderName: '',
        ltvAtOrigination: t.ltv,
        exitFeePct: 0,
        prepaymentPenaltyType: t.prepaymentPenaltyType || 'none',
        prepaymentSchedule: [],
        dscrMinimum: 1.20,
        dscrTestFrequency: 'quarterly',
        dscrTestStartMonth: 1,
      }));
      setLoans(newLoans);
      toast({ title: 'Template Applied', description: `Applied "${template.name}" template` });
    }
  };

  const blendedMetrics = blendedMetricsMutation.data as BlendedMetrics | undefined;
  const comparisonResults = comparisonMutation.data as LoanComparison[] | undefined;
  const amortizationData = amortizationMutation.data as { schedule: AmortizationPeriod[]; summary: any } | undefined;
  const dscrTestData = dscrTestsMutation.data as { tests: DscrTest[]; summary: any } | undefined;
  const cashFlowData = cashFlowMutation.data as { yearlyData: any[]; totals: any } | undefined;

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="builder">Loan Builder</TabsTrigger>
          <TabsTrigger value="blended">Blended View</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
          <TabsTrigger value="schedule">Amortization</TabsTrigger>
          <TabsTrigger value="dscr">DSCR Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold">Loan Structure</h3>
              <Select onValueChange={applyTemplate}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Apply Template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addLoan} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Loan
            </Button>
          </div>

          <div className="space-y-4">
            {loans.map((loan, idx) => (
              <Card key={loan.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant={loan.loanPurpose === 'senior' || loan.loanPurpose === 'acquisition' ? 'default' : 'secondary'}>
                        {LOAN_PURPOSE_OPTIONS.find(o => o.value === loan.loanPurpose)?.label || loan.loanPurpose}
                      </Badge>
                      <Input
                        value={loan.name}
                        onChange={(e) => updateLoan(loan.id, { name: e.target.value })}
                        className="w-48 h-8"
                      />
                    </div>
                    {loans.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeLoan(loan.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible defaultValue="basic">
                    <AccordionItem value="basic">
                      <AccordionTrigger>Basic Terms</AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label>Principal ($)</Label>
                            <Input
                              type="number"
                              value={loan.principal}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                updateLoan(loan.id, {
                                  principal: val,
                                  ltvAtOrigination: purchasePrice > 0 ? (val / purchasePrice) * 100 : 0
                                });
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>LTV (%)</Label>
                            <Input
                              type="number"
                              value={loan.ltvAtOrigination.toFixed(1)}
                              onChange={(e) => {
                                const ltv = parseFloat(e.target.value) || 0;
                                updateLoan(loan.id, {
                                  ltvAtOrigination: ltv,
                                  principal: purchasePrice * (ltv / 100)
                                });
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Interest Rate (%)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={(loan.interestRate * 100).toFixed(2)}
                              onChange={(e) => updateLoan(loan.id, { interestRate: (parseFloat(e.target.value) || 0) / 100 })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Loan Purpose</Label>
                            <Select
                              value={loan.loanPurpose}
                              onValueChange={(val) => updateLoan(loan.id, { loanPurpose: val })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {LOAN_PURPOSE_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Term (Months)</Label>
                            <Input
                              type="number"
                              value={loan.termMonths}
                              onChange={(e) => updateLoan(loan.id, { termMonths: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Amortization (Months)</Label>
                            <Input
                              type="number"
                              value={loan.amortizationMonths}
                              onChange={(e) => updateLoan(loan.id, { amortizationMonths: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>I/O Period (Months)</Label>
                            <Input
                              type="number"
                              value={loan.interestOnlyMonths}
                              onChange={(e) => updateLoan(loan.id, { interestOnlyMonths: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Lender</Label>
                            <Input
                              value={loan.lenderName}
                              onChange={(e) => updateLoan(loan.id, { lenderName: e.target.value })}
                              placeholder="Lender name"
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="fees">
                      <AccordionTrigger>Fees & Prepayment</AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Exit Fee (%)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={(loan.exitFeePct * 100).toFixed(2)}
                              onChange={(e) => updateLoan(loan.id, { exitFeePct: (parseFloat(e.target.value) || 0) / 100 })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Prepayment Type</Label>
                            <Select
                              value={loan.prepaymentPenaltyType}
                              onValueChange={(val) => updateLoan(loan.id, { prepaymentPenaltyType: val })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PREPAYMENT_TYPES.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="dscr">
                      <AccordionTrigger>DSCR Covenants</AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Minimum DSCR</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={loan.dscrMinimum.toFixed(2)}
                              onChange={(e) => updateLoan(loan.id, { dscrMinimum: parseFloat(e.target.value) || 1.0 })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Test Frequency</Label>
                            <Select
                              value={loan.dscrTestFrequency}
                              onValueChange={(val) => updateLoan(loan.id, { dscrTestFrequency: val })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DSCR_TEST_FREQUENCY_OPTIONS.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Test Start Month</Label>
                            <Input
                              type="number"
                              value={loan.dscrTestStartMonth}
                              onChange={(e) => updateLoan(loan.id, { dscrTestStartMonth: parseInt(e.target.value) || 1 })}
                            />
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="blended" className="space-y-4">
          {blendedMetricsMutation.isPending ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : blendedMetrics ? (
            <>
              <div className="grid grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Total Debt</div>
                    <div className="text-2xl font-bold">{formatCurrency(blendedMetrics.totalDebtAmount)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Blended Rate</div>
                    <div className="text-2xl font-bold">{(blendedMetrics.blendedInterestRate * 100).toFixed(2)}%</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Combined LTV</div>
                    <div className="text-2xl font-bold">{blendedMetrics.combinedLtv.toFixed(1)}%</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Annual Debt Service</div>
                    <div className="text-2xl font-bold">{formatCurrency(blendedMetrics.totalAnnualDebtService)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Blended DSCR</div>
                    <div className={`text-2xl font-bold ${blendedMetrics.blendedDscr >= 1.20 ? 'text-green-600' : blendedMetrics.blendedDscr >= 1.0 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {blendedMetrics.blendedDscr.toFixed(2)}x
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Loan Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Weight</TableHead>
                        <TableHead className="text-right">Monthly Payment</TableHead>
                        <TableHead className="text-right">Annual Debt Service</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blendedMetrics.loans.map((loan) => (
                        <TableRow key={loan.id}>
                          <TableCell className="font-medium">{loan.name}</TableCell>
                          <TableCell className="text-right">{formatCurrency(loan.principal)}</TableCell>
                          <TableCell className="text-right">{(loan.rate * 100).toFixed(2)}%</TableCell>
                          <TableCell className="text-right">{(loan.weight * 100).toFixed(1)}%</TableCell>
                          <TableCell className="text-right">{formatCurrency(loan.monthlyPayment)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(loan.annualDebtService)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted/50">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{formatCurrency(blendedMetrics.totalDebtAmount)}</TableCell>
                        <TableCell className="text-right">{(blendedMetrics.blendedInterestRate * 100).toFixed(2)}%</TableCell>
                        <TableCell className="text-right">100%</TableCell>
                        <TableCell className="text-right">{formatCurrency(blendedMetrics.totalMonthlyDebtService)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(blendedMetrics.totalAnnualDebtService)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Debt Stack Visualization</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={blendedMetrics.loans}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
                        <YAxis type="category" dataKey="name" width={100} />
                        <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                        <Bar dataKey="principal" fill="#3b82f6" name="Principal" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Add loans to see blended metrics</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Loan Comparison</h3>
            <Button onClick={() => comparisonMutation.mutate(loans)}>
              <Calculator className="w-4 h-4 mr-2" />
              Compare Loans
            </Button>
          </div>

          {comparisonMutation.isPending ? (
            <Skeleton className="h-64 w-full" />
          ) : comparisonResults && comparisonResults.length > 0 ? (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      {comparisonResults.map((r) => (
                        <TableHead key={r.loanId} className="text-right">{r.loanName}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Monthly Payment</TableCell>
                      {comparisonResults.map((r) => (
                        <TableCell key={r.loanId} className="text-right">{formatCurrency(r.monthlyPayment)}</TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Annual Debt Service</TableCell>
                      {comparisonResults.map((r) => (
                        <TableCell key={r.loanId} className="text-right">{formatCurrency(r.annualDebtService)}</TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Total Interest Paid</TableCell>
                      {comparisonResults.map((r) => (
                        <TableCell key={r.loanId} className="text-right">{formatCurrency(r.totalInterestPaid)}</TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Total Cost of Debt</TableCell>
                      {comparisonResults.map((r) => (
                        <TableCell key={r.loanId} className="text-right">{formatCurrency(r.totalCostOfDebt)}</TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Effective Rate</TableCell>
                      {comparisonResults.map((r) => (
                        <TableCell key={r.loanId} className="text-right">{(r.effectiveRate * 100).toFixed(2)}%</TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Average DSCR</TableCell>
                      {comparisonResults.map((r) => (
                        <TableCell key={r.loanId} className="text-right">
                          <span className={r.averageDscr >= 1.20 ? 'text-green-600' : r.averageDscr >= 1.0 ? 'text-yellow-600' : 'text-red-600'}>
                            {r.averageDscr.toFixed(2)}x
                          </span>
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Ending Balance</TableCell>
                      {comparisonResults.map((r) => (
                        <TableCell key={r.loanId} className="text-right">{formatCurrency(r.endingBalance)}</TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Click "Compare Loans" to see side-by-side comparison</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <Label>Select Loan</Label>
              <Select
                value={selectedLoanForSchedule || ''}
                onValueChange={(val) => {
                  setSelectedLoanForSchedule(val);
                  const loan = loans.find(l => l.id === val);
                  if (loan) amortizationMutation.mutate(loan);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select loan..." />
                </SelectTrigger>
                <SelectContent>
                  {loans.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hold Period (Months)</Label>
              <Input
                type="number"
                value={holdPeriodMonths}
                onChange={(e) => setHoldPeriodMonths(parseInt(e.target.value) || 60)}
                className="w-32"
              />
            </div>
          </div>

          {amortizationMutation.isPending ? (
            <Skeleton className="h-96 w-full" />
          ) : amortizationData ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Total Payments</div>
                    <div className="text-xl font-bold">{formatCurrency(amortizationData.summary.totalPayments)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Total Interest</div>
                    <div className="text-xl font-bold">{formatCurrency(amortizationData.summary.totalInterest)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Total Principal</div>
                    <div className="text-xl font-bold">{formatCurrency(amortizationData.summary.totalPrincipal)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Ending Balance</div>
                    <div className="text-xl font-bold">{formatCurrency(amortizationData.summary.endingBalance)}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Outstanding Balance Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={amortizationData.schedule}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="periodMonth" 
                          tickFormatter={(v) => `Mo ${v}`}
                        />
                        <YAxis tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
                        <RechartsTooltip formatter={(v: number) => formatCurrency(v)} />
                        <Area type="monotone" dataKey="endingBalance" fill="#3b82f6" stroke="#2563eb" name="Balance" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Amortization Schedule</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Beginning Balance</TableHead>
                          <TableHead className="text-right">Payment</TableHead>
                          <TableHead className="text-right">Principal</TableHead>
                          <TableHead className="text-right">Interest</TableHead>
                          <TableHead className="text-right">Ending Balance</TableHead>
                          <TableHead className="text-right">DSCR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {amortizationData.schedule.slice(0, 60).map((p) => (
                          <TableRow key={p.periodMonth} className={p.isInterestOnly ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}>
                            <TableCell>
                              {p.periodDate}
                              {p.isInterestOnly && <Badge variant="outline" className="ml-2 text-xs">I/O</Badge>}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(p.beginningBalance)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(p.scheduledPayment)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(p.principalPayment)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(p.interestPayment)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(p.endingBalance)}</TableCell>
                            <TableCell className="text-right">
                              {p.dscr !== undefined && (
                                <span className={p.dscrPassFail ? 'text-green-600' : 'text-red-600'}>
                                  {p.dscr.toFixed(2)}x
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Select a loan to view its amortization schedule</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="dscr" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="space-y-2">
              <Label>Select Loan</Label>
              <Select
                value={selectedLoanForSchedule || ''}
                onValueChange={(val) => {
                  setSelectedLoanForSchedule(val);
                  const loan = loans.find(l => l.id === val);
                  if (loan) dscrTestsMutation.mutate(loan);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select loan..." />
                </SelectTrigger>
                <SelectContent>
                  {loans.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>NOI Growth Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={(noiGrowthRate * 100).toFixed(1)}
                onChange={(e) => setNoiGrowthRate((parseFloat(e.target.value) || 0) / 100)}
                className="w-24"
              />
            </div>
          </div>

          {dscrTestsMutation.isPending ? (
            <Skeleton className="h-64 w-full" />
          ) : dscrTestData ? (
            <>
              <div className="grid grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Total Tests</div>
                    <div className="text-xl font-bold">{dscrTestData.summary.totalTests}</div>
                  </CardContent>
                </Card>
                <Card className="border-green-200 bg-green-50 dark:bg-green-900/10">
                  <CardContent className="pt-6">
                    <div className="text-sm text-green-600">Passed</div>
                    <div className="text-xl font-bold text-green-600">{dscrTestData.summary.passed}</div>
                  </CardContent>
                </Card>
                <Card className={dscrTestData.summary.failed > 0 ? 'border-red-200 bg-red-50 dark:bg-red-900/10' : ''}>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Failed</div>
                    <div className={`text-xl font-bold ${dscrTestData.summary.failed > 0 ? 'text-red-600' : ''}`}>
                      {dscrTestData.summary.failed}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Min DSCR</div>
                    <div className={`text-xl font-bold ${dscrTestData.summary.minDscr >= 1.20 ? 'text-green-600' : dscrTestData.summary.minDscr >= 1.0 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {dscrTestData.summary.minDscr.toFixed(2)}x
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Avg DSCR</div>
                    <div className="text-xl font-bold">{dscrTestData.summary.avgDscr.toFixed(2)}x</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>DSCR Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={dscrTestData.tests}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="testPeriod" />
                        <YAxis domain={[0, 'auto']} />
                        <RechartsTooltip />
                        <Bar dataKey="result.calculatedDscr" fill="#3b82f6" name="DSCR" />
                        <Line 
                          type="monotone" 
                          dataKey="requiredDscr" 
                          stroke="#ef4444" 
                          strokeWidth={2} 
                          strokeDasharray="5 5" 
                          name="Minimum Required" 
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>DSCR Test Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Trailing NOI</TableHead>
                        <TableHead className="text-right">Debt Service</TableHead>
                        <TableHead className="text-right">Required</TableHead>
                        <TableHead className="text-right">Actual</TableHead>
                        <TableHead className="text-right">Cushion</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dscrTestData.tests.map((test, idx) => (
                        <TableRow key={idx} className={!test.result.passed ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                          <TableCell>{test.testPeriod}</TableCell>
                          <TableCell className="text-right">{formatCurrency(test.trailingNoi)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(test.annualDebtService)}</TableCell>
                          <TableCell className="text-right">{test.requiredDscr.toFixed(2)}x</TableCell>
                          <TableCell className="text-right font-medium">
                            {test.result.calculatedDscr.toFixed(2)}x
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={test.result.cushionPct >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {test.result.cushionPct >= 0 ? '+' : ''}{test.result.cushionPct.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            {test.result.passed ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Pass
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <XCircle className="w-3 h-3 mr-1" />
                                Fail
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Select a loan to run DSCR covenant tests</AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
