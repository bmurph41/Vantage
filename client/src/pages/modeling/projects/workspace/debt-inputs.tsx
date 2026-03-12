import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { useDisplayPreferences } from '@/hooks/use-display-preferences';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, ResponsiveContainer } from 'recharts';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Landmark,
  DollarSign,
  Percent,
  Loader2,
  Building2,
  Calendar,
  Calculator,
  CheckCircle2,
} from 'lucide-react';

interface DebtInputsProps {
  projectId: string;
  purchasePrice?: number;
}

interface Loan {
  id: string;
  projectId: string;
  loanType: string;
  structure: string;
  loanAmount: number;
  fixedRate: number;
  amortizationYears: number;
  termYears: number;
  interestOnlyMonths: number;
  startDate: string;
  originationFeePct: number;
  underwritingFee: number;
  legalFee: number;
  appraisalFee: number;
  otherClosingCosts: number;
  capitalizeOriginationFees: boolean;
  exitFeePct: number;
  prepayType: string;
}

interface ScheduleRow {
  year: number;
  interest: number;
  principal: number;
  totalDebtService: number;
  endingBalance: number;
}


interface DebtSummary {
  hasDebt: boolean;
  totalUses: number;
  totalDebt: number;
  totalEquity: number;
  debtPct: number;
  equityPct: number;
  ltv: number;
  dscr: number | null;
  debtYield: number | null;
  monthlyDebtService: number;
  annualDebtService: number;
  year1EndingBalance: number;
  blendedRate: number;
  noiSource: string | null;
  dscrTimeline: Array<{
    year: number;
    noi: number;
    debtService: number;
    dscr: number | null;
    debtYield: number | null;
    endingBalance: number;
  }>;
}
const LOAN_TYPES = [
  { value: 'acquisition', label: 'Acquisition' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'permanent', label: 'Permanent' },
];

const STRUCTURES = [
  { value: 'senior', label: 'Senior' },
  { value: 'mezzanine', label: 'Mezzanine' },
];

const PREPAY_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'stepdown', label: 'Step-Down' },
  { value: 'yield_maint', label: 'Yield Maintenance' },
  { value: 'defeasance', label: 'Defeasance' },
];

function parseCurrencyInput(val: string): number {
  return parseFloat(val.replace(/[^0-9.-]/g, '')) || 0;
}

function formatCurrencyInput(val: number): string {
  if (!val) return '';
  return new Intl.NumberFormat('en-US').format(val);
}

function formatRateDisplay(decimal: number): string {
  if (!decimal) return '';
  return (decimal * 100).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

export default function DebtInputs({ projectId, purchasePrice }: DebtInputsProps) {
  const { toast } = useToast();
  useDisplayPreferences(); // Sync global rounding settings
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loanAmountMode, setLoanAmountMode] = useState<"dollar" | "ltv">("dollar");
  const [closingDaysOut, setClosingDaysOut] = useState("90");
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const { data: loans, isLoading: loansLoading } = useQuery<Loan[]>({
    queryKey: ['/api/modeling/projects', projectId, 'loans'],
  });

  const loan = loans?.[0] ?? null;

  const { data: scheduleResponse, isLoading: scheduleLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'loans', loan?.id, 'schedule'],
    enabled: !!loan?.id && (loan?.loanAmount ?? 0) > 0,
  });
  const schedule: ScheduleRow[] | undefined = scheduleResponse?.annualDebtService?.map((yr: any) => ({
    year: yr.year,
    interest: yr.interest,
    principal: yr.principal,
    totalDebtService: yr.totalDebtService,
    endingBalance: yr.endingBalance,
  }));

  // Debt Summary (lightweight capital stack from canonical engine)
  const { data: debtSummary, isLoading: summaryLoading } = useQuery<DebtSummary>({
    queryKey: ["/api/modeling/projects", projectId, "debt-summary"],
    enabled: !!loan?.id,
  });

  const createLoan = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/modeling/projects/${projectId}/loans`, {
        loanType: 'acquisition',
        structure: 'senior',
        loanAmount: 0,
        fixedRate: 0.065,
        amortizationYears: 25,
        termYears: 10,
        interestOnlyMonths: 0,
        startDate: new Date().toISOString().split('T')[0],
        originationFeePct: 0.01,
        underwritingFee: 0,
        legalFee: 0,
        appraisalFee: 0,
        otherClosingCosts: 0,
        capitalizeOriginationFees: false,
        exitFeePct: 0,
        prepayType: 'none',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'loans'] });
      toast({ title: 'Loan created' });
    },
    onError: () => {
      toast({ title: 'Failed to create loan', variant: 'destructive' });
    },
  });

  const updateLoan = useMutation({
    mutationFn: async (data: Partial<Loan>) => {
      if (!loan) return;
      await apiRequest('PATCH', `/api/modeling/projects/${projectId}/loans/${loan.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'debt-summary'] });
      if (loan?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'loans', loan.id, 'schedule'] });
      }
    },
    onError: () => {
      toast({ title: 'Failed to save changes', variant: 'destructive' });
    },
  });

  const deleteLoan = useMutation({
    mutationFn: async () => {
      if (!loan) return;
      await apiRequest('DELETE', `/api/modeling/projects/${projectId}/loans/${loan.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'loans'] });
      toast({ title: 'Loan removed' });
    },
    onError: () => {
      toast({ title: 'Failed to delete loan', variant: 'destructive' });
    },
  });

  const debouncedUpdate = useCallback((field: string, value: any) => {
    if (debounceTimers.current[field]) {
      clearTimeout(debounceTimers.current[field]);
    }
    debounceTimers.current[field] = setTimeout(() => {
      updateLoan.mutate({ [field]: value });
    }, 600);
  }, [updateLoan]);

  const handleCurrencyChange = (field: keyof Loan, rawValue: string) => {
    const num = parseCurrencyInput(rawValue);
    debouncedUpdate(field, num);
  };

  const handleRateChange = (field: keyof Loan, rawValue: string) => {
    const pct = parseFloat(rawValue) || 0;
    const decimal = pct / 100;
    debouncedUpdate(field, decimal);
  };

  const handleNumberChange = (field: keyof Loan, rawValue: string) => {
    const num = parseInt(rawValue) || 0;
    debouncedUpdate(field, num);
  };

  const handleSelectChange = (field: keyof Loan, value: string) => {
    updateLoan.mutate({ [field]: value });
  };

  const handleSwitchChange = (field: keyof Loan, value: boolean) => {
    updateLoan.mutate({ [field]: value });
  };

  const computeProjectedClosing = useCallback((days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }, []);

  const handleLtvInput = useCallback((pctStr: string) => {
    const pct = parseFloat(pctStr) || 0;
    if (purchasePrice && purchasePrice > 0) {
      const amount = Math.round(purchasePrice * (pct / 100));
      debouncedUpdate("loanAmount", amount);
    }
  }, [purchasePrice, debouncedUpdate]);

  if (loansLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!loan) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Landmark className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Debt Structure</h3>
          <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
            Add a loan to model debt service, capital stack allocation, and coverage ratios.
          </p>
          <Button onClick={() => createLoan.mutate()} disabled={createLoan.isPending}>
            {createLoan.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Add Acquisition Loan
          </Button>
        </CardContent>
      </Card>
    );
  }

  const loanAmount = loan.loanAmount || 0;
  const totalFees =
    loanAmount * (loan.originationFeePct || 0) +
    (loan.underwritingFee || 0) +
    (loan.legalFee || 0) +
    (loan.appraisalFee || 0) +
    (loan.otherClosingCosts || 0);
  const totalBasis = (purchasePrice || 0) + totalFees;
  const equityRequired = totalBasis - loanAmount;
  const debtPct = totalBasis > 0 ? (loanAmount / totalBasis) * 100 : 0;
  const equityPct = totalBasis > 0 ? (equityRequired / totalBasis) * 100 : 0;

  const firstYearDS = schedule?.[0]?.totalDebtService || 0;
  const ltvValue = purchasePrice && purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Debt Structure</h3>
          <Badge variant="outline" className="text-xs">{loan.loanType}</Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => deleteLoan.mutate()}
          disabled={deleteLoan.isPending}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Remove
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Loan Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Loan Type</Label>
                  <Select
                    value={loan.loanType}
                    onValueChange={(v) => handleSelectChange('loanType', v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOAN_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Structure</Label>
                  <Select
                    value={loan.structure}
                    onValueChange={(v) => handleSelectChange('structure', v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STRUCTURES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Loan Amount
                    <div className="ml-auto flex items-center gap-0.5 bg-muted rounded-md p-0.5">
                      <button
                        type="button"
                        className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${loanAmountMode === 'dollar' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => setLoanAmountMode('dollar')}
                      >$</button>
                      <button
                        type="button"
                        className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${loanAmountMode === 'ltv' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => setLoanAmountMode('ltv')}
                      >% LTV</button>
                    </div>
                  </Label>
                  {loanAmountMode === 'dollar' ? (
                    <Input
                      className="h-9"
                      defaultValue={formatCurrencyInput(loan.loanAmount)}
                      onBlur={(e) => handleCurrencyChange('loanAmount', e.target.value)}
                      placeholder="0"
                    />
                  ) : (
                    <div className="flex gap-2 items-center">
                      <Input
                        className="h-9 w-24"
                        defaultValue={purchasePrice && purchasePrice > 0 && loan.loanAmount ? ((loan.loanAmount / purchasePrice) * 100).toFixed(1) : ''}
                        onBlur={(e) => handleLtvInput(e.target.value)}
                        placeholder="75"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        = {purchasePrice && purchasePrice > 0 && loan.loanAmount ? formatCurrency(loan.loanAmount) : '—'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Percent className="h-3 w-3" />
                    Interest Rate (%)
                  </Label>
                  <Input
                    className="h-9"
                    defaultValue={formatRateDisplay(loan.fixedRate)}
                    onBlur={(e) => handleRateChange('fixedRate', e.target.value)}
                    placeholder="6.50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Amort. (Yrs)</Label>
                  <Input
                    className="h-9"
                    type="number"
                    defaultValue={loan.amortizationYears || ''}
                    onBlur={(e) => handleNumberChange('amortizationYears', e.target.value)}
                    placeholder="25"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Term (Yrs)</Label>
                  <Input
                    className="h-9"
                    type="number"
                    defaultValue={loan.termYears || ''}
                    onBlur={(e) => handleNumberChange('termYears', e.target.value)}
                    placeholder="10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">IO Months</Label>
                  <Input
                    className="h-9"
                    type="number"
                    defaultValue={loan.interestOnlyMonths || ''}
                    onBlur={(e) => handleNumberChange('interestOnlyMonths', e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Start Date
                  </Label>
                  <Input
                    className="h-9"
                    type="date"
                    defaultValue={loan.startDate || ''}
                    onBlur={(e) => {
                      if (e.target.value) updateLoan.mutate({ startDate: e.target.value });
                    }}
                  />
                  <div className="flex items-center gap-1.5 pt-1">
                    <Input
                      className="h-7 w-14 text-xs text-center px-1"
                      type="number"
                      value={closingDaysOut}
                      onChange={(e) => setClosingDaysOut(e.target.value)}
                      min="1"
                    />
                    <Button
                      type="button"
                      variant={loan.startDate === computeProjectedClosing(parseInt(closingDaysOut) || 90) ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[10px] px-2"
                      onClick={() => {
                        const date = computeProjectedClosing(parseInt(closingDaysOut) || 90);
                        updateLoan.mutate({ startDate: date });
                        toast({ title: `Closing set to ${date}` });
                      }}
                    >
                      Projected Closing ({closingDaysOut}d)
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Fees & Costs
                    </span>
                    {advancedOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Origination Fee (%)</Label>
                      <Input
                        className="h-9"
                        defaultValue={formatRateDisplay(loan.originationFeePct)}
                        onBlur={(e) => handleRateChange('originationFeePct', e.target.value)}
                        placeholder="1.00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Underwriting Fee</Label>
                      <Input
                        className="h-9"
                        defaultValue={formatCurrencyInput(loan.underwritingFee)}
                        onBlur={(e) => handleCurrencyChange('underwritingFee', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Legal</Label>
                      <Input
                        className="h-9"
                        defaultValue={formatCurrencyInput(loan.legalFee)}
                        onBlur={(e) => handleCurrencyChange('legalFee', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Appraisal</Label>
                      <Input
                        className="h-9"
                        defaultValue={formatCurrencyInput(loan.appraisalFee)}
                        onBlur={(e) => handleCurrencyChange('appraisalFee', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Other Costs</Label>
                      <Input
                        className="h-9"
                        defaultValue={formatCurrencyInput(loan.otherClosingCosts)}
                        onBlur={(e) => handleCurrencyChange('otherClosingCosts', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Exit Fee (%)</Label>
                      <Input
                        className="h-9"
                        defaultValue={formatRateDisplay(loan.exitFeePct)}
                        onBlur={(e) => handleRateChange('exitFeePct', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={loan.capitalizeOriginationFees}
                        onCheckedChange={(v) => handleSwitchChange('capitalizeOriginationFees', v)}
                      />
                      <Label className="text-xs">Capitalize fees into loan balance</Label>
                    </div>
                    <div className="space-y-1.5 w-40">
                      <Label className="text-xs">Prepay Type</Label>
                      <Select
                        value={loan.prepayType || 'none'}
                        onValueChange={(v) => handleSelectChange('prepayType', v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PREPAY_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {totalFees > 0 && (
                    <div className="text-xs text-muted-foreground pt-1">
                      Total Closing Costs: {formatCurrency(totalFees)}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {loan.loanAmount > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calculator className="h-3.5 w-3.5 text-primary" />
                  Amortization Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                {schedule && schedule.length > 0 && (
                  <div className="mb-5">
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={schedule.map((row) => ({
                        yr: `Yr ${row.year + 1}`,
                        interest: Math.round(row.interest || 0),
                        principal: Math.round(row.principal || 0),
                      }))} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                        <XAxis dataKey="yr" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={(v) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : `${(v/1e3).toFixed(0)}K`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={60} />
                        <RechartTooltip formatter={(v, n) => [`${Number(v).toLocaleString()}`, n === 'interest' ? 'Interest' : 'Principal']} contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid hsl(var(--border))' }} />
                        <Bar dataKey="interest" stackId="a" fill="#ef4444" opacity={0.7} name="Interest" />
                        <Bar dataKey="principal" stackId="a" fill="#3b82f6" opacity={0.85} radius={[3,3,0,0]} name="Principal" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-3 gap-3 mt-2 text-xs">
                      {[
                        { label: 'Total Interest', val: schedule.reduce((s,r)=>s+(r.interest||0),0), color: 'text-red-600' },
                        { label: 'Total Principal', val: schedule.reduce((s,r)=>s+(r.principal||0),0), color: 'text-blue-600' },
                        { label: 'Total Debt Service', val: schedule.reduce((s,r)=>s+(r.totalDebtService||0),0), color: 'text-foreground' },
                      ].map(m => (
                        <div key={m.label} className="p-2 rounded border bg-muted/30">
                          <p className="text-muted-foreground">{m.label}</p>
                          <p className={`font-semibold tabular-nums ${m.color}`}>{new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(m.val)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
              <CardHeader className="pb-1 pt-2 px-6">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Year-by-Year Detail</CardTitle>
              </CardHeader>
              <CardContent>
                {scheduleLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : schedule && schedule.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs py-2 px-3 h-auto">Year</TableHead>
                          <TableHead className="text-xs py-2 px-3 h-auto text-right">Beg. Balance</TableHead>
                          <TableHead className="text-xs py-2 px-3 h-auto text-right">Interest</TableHead>
                          <TableHead className="text-xs py-2 px-3 h-auto text-right">Principal</TableHead>
                          <TableHead className="text-xs py-2 px-3 h-auto text-right">Debt Service</TableHead>
                          <TableHead className="text-xs py-2 px-3 h-auto text-right">End. Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {schedule.map((row, i) => {
                          const begBal = i === 0 ? loan.loanAmount : (schedule[i - 1]?.endingBalance || 0);
                          return (
                            <TableRow key={row.year}>
                              <TableCell className="text-xs py-1.5 px-3 font-medium">{row.year + 1}</TableCell>
                              <TableCell className="text-xs py-1.5 px-3 text-right">{formatCurrency(begBal)}</TableCell>
                              <TableCell className="text-xs py-1.5 px-3 text-right">{formatCurrency(row.interest, { context: 'debt' })}</TableCell>
                              <TableCell className="text-xs py-1.5 px-3 text-right">{formatCurrency(row.principal, { context: 'debt' })}</TableCell>
                              <TableCell className="text-xs py-1.5 px-3 text-right font-medium">{formatCurrency(row.totalDebtService, { context: 'debt' })}</TableCell>
                              <TableCell className="text-xs py-1.5 px-3 text-right">{formatCurrency(row.endingBalance)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                      {schedule.length > 0 && (
                        <tfoot>
                          <TableRow className="border-t-2 bg-muted/50">
                            <TableCell className="text-xs py-2 px-3 font-semibold">Total</TableCell>
                            <TableCell className="text-xs py-2 px-3 text-right" />
                            <TableCell className="text-xs py-2 px-3 text-right font-semibold">
                              {formatCurrency(schedule.reduce((s, r) => s + (r.interest || 0), 0), { context: 'debt' })}
                            </TableCell>
                            <TableCell className="text-xs py-2 px-3 text-right font-semibold">
                              {formatCurrency(schedule.reduce((s, r) => s + (r.principal || 0), 0), { context: 'debt' })}
                            </TableCell>
                            <TableCell className="text-xs py-2 px-3 text-right font-bold">
                              {formatCurrency(schedule.reduce((s, r) => s + (r.totalDebtService || 0), 0), { context: 'debt' })}
                            </TableCell>
                            <TableCell className="text-xs py-2 px-3 text-right" />
                          </TableRow>
                        </tfoot>
                      )}
                    </Table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No schedule data available.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span>Capital Stack</span>
                {debtSummary && !summaryLoading && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-normal">
                    <CheckCircle2 className="h-3 w-3" />
                    Synced
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summaryLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-2.5 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-2.5 w-full" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Senior Debt</span>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(debtSummary?.totalDebt ?? loanAmount)}</p>
                        <p className="text-xs text-muted-foreground">{debtSummary ? (debtSummary.debtPct * 100).toFixed(1) : debtPct.toFixed(1)}%</p>
                      </div>
                    </div>

                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(debtSummary ? debtSummary.debtPct * 100 : debtPct, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Equity Required</span>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(debtSummary?.totalEquity ?? Math.max(equityRequired, 0))}</p>
                        <p className="text-xs text-muted-foreground">{debtSummary ? (debtSummary.equityPct * 100).toFixed(1) : equityPct.toFixed(1)}%</p>
                      </div>
                    </div>

                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all"
                        style={{ width: `${Math.min(Math.max(debtSummary ? debtSummary.equityPct * 100 : equityPct, 0), 100)}%` }}
                      />
                    </div>
                  </div>

                  {purchasePrice && purchasePrice > 0 && (
                    <div className="flex items-center justify-between pt-1 border-t">
                      <span className="text-xs text-muted-foreground">Purchase Price</span>
                      <span className="text-xs font-medium">{formatCurrency(purchasePrice)}</span>
                    </div>
                  )}

                  {debtSummary?.annualDebtService != null && debtSummary.annualDebtService > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Annual Debt Service</span>
                      <span className="text-xs font-medium">{formatCurrency(debtSummary.annualDebtService)}</span>
                    </div>
                  )}

                  {debtSummary?.blendedRate != null && debtSummary.blendedRate > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Blended Rate</span>
                      <span className="text-xs font-medium">{(debtSummary.blendedRate * 100).toFixed(2)}%</span>
                    </div>
                  )}

                  <div className="border-t pt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">LTV</span>
                      <Badge variant={(debtSummary?.ltv ?? ltvValue / 100) > 0.75 ? "destructive" : "secondary"} className="text-xs">
                        {debtSummary ? (debtSummary.ltv * 100).toFixed(1) : ltvValue.toFixed(1)}%
                      </Badge>
                    </div>

                    {/* DSCR Timeline */}
                    {debtSummary?.dscrTimeline && debtSummary.dscrTimeline.length > 0 ? (
                      <div className="space-y-1.5 pt-1 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">DSCR Coverage</span>
                          <Badge variant="outline" className="text-[10px]">
                            {debtSummary.noiSource === "pro_forma" ? "From Pro Forma" : "Manual"}
                          </Badge>
                        </div>
                        <div className="space-y-0.5">
                          {debtSummary.dscrTimeline.slice(0, 10).map((yr) => (
                            <div key={yr.year} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground w-10">Yr {yr.year}</span>
                              <span className="text-muted-foreground font-mono text-[10px] flex-1 text-right mr-2">
                                {yr.noi > 0 ? formatCurrency(yr.noi) : "\u2014"}
                              </span>
                              {yr.dscr != null ? (
                                <Badge
                                  variant={yr.dscr < 1.0 ? "destructive" : yr.dscr < 1.2 ? "default" : "secondary"}
                                  className="text-[10px] w-14 justify-center"
                                >
                                  {yr.dscr.toFixed(2)}x
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-[10px] w-14 text-center">\u2014</span>
                              )}
                            </div>
                          ))}
                        </div>
                        {debtSummary.debtYield != null && (
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs text-muted-foreground">Debt Yield (Yr 1)</span>
                            <Badge variant="secondary" className="text-xs">
                              {(debtSummary.debtYield * 100).toFixed(2)}%
                            </Badge>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">DSCR</span>
                        {debtSummary?.dscr != null ? (
                          <Badge
                            variant={debtSummary.dscr < 1.0 ? "destructive" : debtSummary.dscr < 1.2 ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {debtSummary.dscr.toFixed(2)}x
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Needs NOI
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
