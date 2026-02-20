import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';
import { RefreshCw, Loader2, TrendingDown, TrendingUp, Clock } from 'lucide-react';

interface Props { projectId: string; loanId: string; loanName?: string; }

export default function RefiComparisonPanel({ projectId, loanId, loanName }: Props) {
  const [triggerMonth, setTriggerMonth] = useState('36');
  const [newRate, setNewRate] = useState('5.50');
  const [newTerm, setNewTerm] = useState('120');
  const [newAmort, setNewAmort] = useState('300');
  const [newIO, setNewIO] = useState('0');
  const [newAmount, setNewAmount] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const body: any = { loanId, triggerMonthIndex: parseInt(triggerMonth),
        newLoanTerms: { rateType: 'fixed', fixedRate: parseFloat(newRate)/100, termMonths: parseInt(newTerm), amortMonths: parseInt(newAmort), interestOnlyMonths: parseInt(newIO) },
        cashOutAllowed: !!newAmount };
      if (newAmount) body.newLoanTerms.loanAmount = parseFloat(newAmount);
      const res = await apiRequest('POST', `/api/modeling/projects/${projectId}/debt-refi`, body);
      return res.json();
    },
  });
  const plan = mutation.data?.plan;
  const comp = mutation.data?.comparison;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2"><RefreshCw className="h-4 w-4" />Refi Analysis{loanName ? `: ${loanName}` : ''}</CardTitle>
        <CardDescription className="text-xs">Rate-and-term or cash-out refinance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div><Label className="text-xs">Refi Month</Label><Input type="number" value={triggerMonth} onChange={e => setTriggerMonth(e.target.value)} className="h-8 text-xs" /></div>
          <div><Label className="text-xs">New Rate %</Label><Input type="number" step="0.25" value={newRate} onChange={e => setNewRate(e.target.value)} className="h-8 text-xs" /></div>
          <div><Label className="text-xs">New Term (mo)</Label><Input type="number" value={newTerm} onChange={e => setNewTerm(e.target.value)} className="h-8 text-xs" /></div>
          <div><Label className="text-xs">New Amort (mo)</Label><Input type="number" value={newAmort} onChange={e => setNewAmort(e.target.value)} className="h-8 text-xs" /></div>
          <div><Label className="text-xs">New IO (mo)</Label><Input type="number" value={newIO} onChange={e => setNewIO(e.target.value)} className="h-8 text-xs" /></div>
          <div><Label className="text-xs">Amount (opt)</Label><Input type="number" placeholder="Auto" value={newAmount} onChange={e => setNewAmount(e.target.value)} className="h-8 text-xs" /></div>
        </div>
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full">
          {mutation.isPending ? <><Loader2 className="h-3 w-3 mr-2 animate-spin" />Analyzing...</> : 'Analyze Refi'}
        </Button>
        {plan && comp && (<div className="space-y-3 pt-2">
          <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-xs">
            <p className="font-medium">Payoff: {formatCurrency(plan.existingLoanPayoff.totalPayoff)}</p>
            <p>New Loan: {formatCurrency(plan.newLoan.loanAmount)} @ {(plan.newLoan.effectiveRate*100).toFixed(2)}%</p>
            {plan.refiCashflow.netCashOut !== 0 && <p className="font-medium text-blue-600">Net Cash {plan.refiCashflow.netCashOut > 0 ? 'Out' : 'In'}: {formatCurrency(Math.abs(plan.refiCashflow.netCashOut))}</p>}
          </div>
          <Separator />
          <div className="grid grid-cols-3 gap-1 text-xs">
            <span></span><span className="text-center font-medium">Hold</span><span className="text-center font-medium">Refi</span>
            <span className="text-muted-foreground">Interest</span><span className="text-center font-mono">{formatCurrency(comp.holdToMaturity.totalInterest)}</span><span className="text-center font-mono">{formatCurrency(comp.withRefi.totalInterest)}</span>
            <span className="text-muted-foreground">DS</span><span className="text-center font-mono">{formatCurrency(comp.holdToMaturity.totalDebtService)}</span><span className="text-center font-mono">{formatCurrency(comp.withRefi.totalDebtService)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={comp.savings.interestSaved > 0 ? 'default' : 'destructive'} className="text-xs">
              {comp.savings.interestSaved > 0 ? <TrendingDown className="h-3 w-3 mr-1" /> : <TrendingUp className="h-3 w-3 mr-1" />}
              {formatCurrency(Math.abs(comp.savings.interestSaved))} {comp.savings.interestSaved > 0 ? 'saved' : 'more'}
            </Badge>
            {comp.savings.breakEvenMonths != null && <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />{comp.savings.breakEvenMonths}mo break-even</Badge>}
          </div>
          {plan.warnings.length > 0 && <div className="text-xs text-amber-600 space-y-0.5">{plan.warnings.map((w: string, i: number) => <div key={i}>⚠ {w}</div>)}</div>}
        </div>)}
      </CardContent>
    </Card>
  );
}
