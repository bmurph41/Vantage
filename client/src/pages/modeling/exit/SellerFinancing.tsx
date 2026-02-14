import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, HandCoins, ChevronRight, Download, DollarSign, Percent, Calculator, AlertTriangle, TrendingUp, Shield, FileText, Plus, Trash2, BarChart3, Clock, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ModelingProject } from "@shared/schema";
import { useExitStrategiesStore } from "@/stores/exitStrategiesStore";

interface SellerFinancingProps {
  projectId: string;
}

type PaymentStructure = 'pi_fully_amortizing' | 'interest_only' | 'io_with_balloon' | 'pi_with_balloon' | 'graduated' | 'hybrid_io_then_pi';

const PAYMENT_STRUCTURES: { value: PaymentStructure; label: string; description: string }[] = [
  { value: 'pi_fully_amortizing', label: 'Fully Amortizing P&I', description: 'Equal monthly payments of principal + interest until loan is fully paid off' },
  { value: 'interest_only', label: 'Interest Only', description: 'Pay only interest each month; full principal due at maturity' },
  { value: 'io_with_balloon', label: 'Interest Only + Balloon', description: 'Interest-only for a set period, then remaining balance due as balloon' },
  { value: 'pi_with_balloon', label: 'P&I with Balloon', description: 'Amortize on a longer schedule, but remaining balance due at balloon year' },
  { value: 'graduated', label: 'Graduated Payments', description: 'Payments start lower and step up annually by a fixed percentage' },
  { value: 'hybrid_io_then_pi', label: 'Hybrid (IO then P&I)', description: 'Interest-only period followed by fully amortizing P&I for the remainder' },
];

interface AmortizationRow {
  period: number;
  year: number;
  month: number;
  beginningBalance: number;
  payment: number;
  principal: number;
  interest: number;
  endingBalance: number;
  isBalloon: boolean;
  isInterestOnly: boolean;
}

interface AnnualSummaryRow {
  year: number;
  beginningBalance: number;
  totalPayment: number;
  totalPrincipal: number;
  totalInterest: number;
  endingBalance: number;
  taxableGainRecognized: number;
  taxDue: number;
  netCashFlow: number;
  isBalloon: boolean;
  isInterestOnly: boolean;
}

interface ComparisonScenario {
  id: string;
  label: string;
  structure: PaymentStructure;
  metrics: {
    monthlyPayment: number;
    totalInterest: number;
    totalPayments: number;
    balloonAmount: number;
    effectiveRate: number;
    npv: number;
  };
}

function buildMonthlySchedule(
  loanAmount: number,
  annualRate: number,
  structure: PaymentStructure,
  termYears: number,
  amortizationYears: number,
  balloonYear: number,
  interestOnlyYears: number,
  graduatedStepUpRate: number,
): AmortizationRow[] {
  const schedule: AmortizationRow[] = [];
  if (loanAmount <= 0 || annualRate < 0) return schedule;

  const monthlyRate = annualRate / 100 / 12;
  let balance = loanAmount;

  switch (structure) {
    case 'pi_fully_amortizing': {
      const effectiveTerm = Math.min(termYears, amortizationYears);
      const amortMonths = amortizationYears * 12;
      const termMonths = effectiveTerm * 12;
      const pmt = monthlyRate > 0
        ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, amortMonths)) / (Math.pow(1 + monthlyRate, amortMonths) - 1)
        : loanAmount / amortMonths;

      for (let m = 1; m <= termMonths && balance > 0.01; m++) {
        const interest = balance * monthlyRate;
        const isLast = m === termMonths && balance > pmt - interest + 0.01;
        const principal = isLast ? balance : Math.min(pmt - interest, balance);
        const newBalance = Math.max(0, balance - principal);
        schedule.push({
          period: m, year: Math.ceil(m / 12), month: ((m - 1) % 12) + 1,
          beginningBalance: balance, payment: interest + principal,
          principal, interest, endingBalance: newBalance,
          isBalloon: isLast && termYears < amortizationYears, isInterestOnly: false,
        });
        balance = newBalance;
      }
      break;
    }

    case 'interest_only': {
      const months = termYears * 12;
      for (let m = 1; m <= months; m++) {
        const interest = balance * monthlyRate;
        const isLast = m === months;
        const principal = isLast ? balance : 0;
        const payment = interest + principal;
        schedule.push({
          period: m, year: Math.ceil(m / 12), month: ((m - 1) % 12) + 1,
          beginningBalance: balance, payment, principal, interest,
          endingBalance: isLast ? 0 : balance,
          isBalloon: isLast, isInterestOnly: !isLast,
        });
        if (isLast) balance = 0;
      }
      break;
    }

    case 'io_with_balloon': {
      const effectiveBalloon = Math.max(1, balloonYear);
      const totalMonths = effectiveBalloon * 12;

      for (let m = 1; m <= totalMonths; m++) {
        const interest = balance * monthlyRate;
        const isLast = m === totalMonths;
        const principal = isLast ? balance : 0;
        const payment = interest + principal;
        schedule.push({
          period: m, year: Math.ceil(m / 12), month: ((m - 1) % 12) + 1,
          beginningBalance: balance, payment, principal, interest,
          endingBalance: isLast ? 0 : balance,
          isBalloon: isLast, isInterestOnly: !isLast,
        });
        if (isLast) balance = 0;
      }
      break;
    }

    case 'pi_with_balloon': {
      const amortMonths = amortizationYears * 12;
      const balloonMonth = balloonYear * 12;
      const pmt = monthlyRate > 0
        ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, amortMonths)) / (Math.pow(1 + monthlyRate, amortMonths) - 1)
        : loanAmount / amortMonths;

      for (let m = 1; m <= balloonMonth && balance > 0.01; m++) {
        const interest = balance * monthlyRate;
        const isLast = m === balloonMonth;
        let principal = Math.min(pmt - interest, balance);
        let payment = pmt;
        if (isLast) {
          principal = balance;
          payment = interest + balance;
        }
        const newBalance = Math.max(0, balance - principal);
        schedule.push({
          period: m, year: Math.ceil(m / 12), month: ((m - 1) % 12) + 1,
          beginningBalance: balance, payment, principal, interest,
          endingBalance: newBalance,
          isBalloon: isLast, isInterestOnly: false,
        });
        balance = newBalance;
      }
      break;
    }

    case 'graduated': {
      const months = amortizationYears * 12;
      const stepRate = graduatedStepUpRate / 100;
      let basePmt = monthlyRate > 0
        ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
        : loanAmount / months;
      basePmt *= 0.75;

      let currentPmt = basePmt;
      for (let m = 1; m <= months; m++) {
        if (m > 1 && (m - 1) % 12 === 0) {
          currentPmt *= (1 + stepRate);
        }
        const interest = balance * monthlyRate;
        let principal = currentPmt - interest;
        if (principal < 0) {
          balance += Math.abs(principal);
          principal = 0;
        } else {
          principal = Math.min(principal, balance);
        }
        const newBalance = Math.max(0, balance - principal);
        schedule.push({
          period: m, year: Math.ceil(m / 12), month: ((m - 1) % 12) + 1,
          beginningBalance: balance, payment: currentPmt, principal, interest,
          endingBalance: newBalance,
          isBalloon: false, isInterestOnly: principal === 0,
        });
        balance = newBalance;
        if (balance <= 0.01) break;
      }
      if (balance > 0.01) {
        const lastEntry = schedule[schedule.length - 1];
        if (lastEntry) {
          lastEntry.principal += balance;
          lastEntry.payment += balance;
          lastEntry.endingBalance = 0;
          lastEntry.isBalloon = true;
        }
      }
      break;
    }

    case 'hybrid_io_then_pi': {
      const clampedIO = Math.min(interestOnlyYears, termYears - 1);
      const ioMonths = Math.max(0, clampedIO) * 12;
      const remainingMonths = Math.max(12, (termYears - clampedIO) * 12);

      for (let m = 1; m <= ioMonths; m++) {
        const interest = balance * monthlyRate;
        schedule.push({
          period: m, year: Math.ceil(m / 12), month: ((m - 1) % 12) + 1,
          beginningBalance: balance, payment: interest, principal: 0, interest,
          endingBalance: balance, isBalloon: false, isInterestOnly: true,
        });
      }

      if (remainingMonths > 0 && balance > 0.01) {
        const pmt = monthlyRate > 0
          ? balance * (monthlyRate * Math.pow(1 + monthlyRate, remainingMonths)) / (Math.pow(1 + monthlyRate, remainingMonths) - 1)
          : balance / remainingMonths;

        for (let m = ioMonths + 1; m <= ioMonths + remainingMonths && balance > 0.01; m++) {
          const interest = balance * monthlyRate;
          const principal = Math.min(pmt - interest, balance);
          const newBalance = Math.max(0, balance - principal);
          schedule.push({
            period: m, year: Math.ceil(m / 12), month: ((m - 1) % 12) + 1,
            beginningBalance: balance, payment: principal + interest,
            principal, interest, endingBalance: newBalance,
            isBalloon: false, isInterestOnly: false,
          });
          balance = newBalance;
        }
      }
      break;
    }
  }

  return schedule;
}

function aggregateToAnnual(
  monthly: AmortizationRow[],
  grossProfitRatio: number,
  combinedCapGainsRate: number,
  ordinaryIncomeRate: number,
  useInstallmentMethod: boolean,
  totalGain: number,
  downPaymentAmount: number,
): AnnualSummaryRow[] {
  if (monthly.length === 0) return [];

  const years = new Map<number, AmortizationRow[]>();
  for (const row of monthly) {
    if (!years.has(row.year)) years.set(row.year, []);
    years.get(row.year)!.push(row);
  }

  const result: AnnualSummaryRow[] = [];

  const dpGain = downPaymentAmount * grossProfitRatio;
  const dpTax = useInstallmentMethod ? dpGain * combinedCapGainsRate : totalGain * combinedCapGainsRate;
  result.push({
    year: 0,
    beginningBalance: 0,
    totalPayment: downPaymentAmount,
    totalPrincipal: downPaymentAmount,
    totalInterest: 0,
    endingBalance: monthly[0]?.beginningBalance || 0,
    taxableGainRecognized: useInstallmentMethod ? dpGain : totalGain,
    taxDue: dpTax,
    netCashFlow: downPaymentAmount - dpTax,
    isBalloon: false,
    isInterestOnly: false,
  });

  for (const [year, rows] of years) {
    const totalPrincipal = rows.reduce((s, r) => s + r.principal, 0);
    const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
    const totalPayment = rows.reduce((s, r) => s + r.payment, 0);
    const gainRecognized = useInstallmentMethod ? totalPrincipal * grossProfitRatio : 0;
    const taxDue = (gainRecognized * combinedCapGainsRate) + (totalInterest * ordinaryIncomeRate / 100);

    result.push({
      year,
      beginningBalance: rows[0].beginningBalance,
      totalPayment,
      totalPrincipal,
      totalInterest,
      endingBalance: rows[rows.length - 1].endingBalance,
      taxableGainRecognized: gainRecognized,
      taxDue,
      netCashFlow: totalPayment - taxDue,
      isBalloon: rows.some(r => r.isBalloon),
      isInterestOnly: rows.every(r => r.isInterestOnly),
    });
  }

  return result;
}

export default function ExitSellerFinancing({ projectId }: SellerFinancingProps) {
  const [, setLocation] = useLocation();
  const { masterInputs, setMode, hydrateFromProject } = useExitStrategiesStore();

  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  useEffect(() => {
    if (project) {
      setMode({ type: 'project-linked', projectId });
      hydrateFromProject({
        purchasePrice: project.purchasePrice,
      }, projectId);
    }
  }, [project, projectId, setMode, hydrateFromProject]);

  const basePath = `/modeling/projects/${projectId}/exit`;

  const [paymentStructure, setPaymentStructure] = useState<PaymentStructure>('pi_fully_amortizing');
  const [scheduleView, setScheduleView] = useState<'annual' | 'monthly'>('annual');

  const [financingOnlyInputs, setFinancingOnlyInputs] = useState({
    downPayment: 20,
    interestRate: 6.5,
    termYears: 10,
    amortizationYears: 25,
    balloonYear: 10,
    interestOnlyYears: 3,
    graduatedStepUpRate: 5,
    useInstallmentMethod: true,
  });

  const inputs = {
    salePrice: masterInputs.salePrice || 10000000,
    adjustedBasis: (masterInputs.costBasis - masterInputs.depreciationTaken) || 6000000,
    ...financingOnlyInputs,
  };

  const setInputs = (updater: any) => {
    if (typeof updater === 'function') {
      const result = updater(inputs);
      const { salePrice, adjustedBasis, ...rest } = result;
      setFinancingOnlyInputs(rest);
    } else {
      const { salePrice, adjustedBasis, ...rest } = updater;
      setFinancingOnlyInputs(rest);
    }
  };

  const [taxRatesLocal, setTaxRatesLocal] = useState({
    niitRate: 3.8,
    ordinaryIncomeRate: 37,
  });

  const taxRates = {
    federalLongTermRate: masterInputs.federalTaxRate || 20,
    stateRate: masterInputs.stateTaxRate || 5,
    ...taxRatesLocal,
  };

  const setTaxRates = (updater: any) => {
    if (typeof updater === 'function') {
      const result = updater(taxRates);
      const { federalLongTermRate, stateRate, ...rest } = result;
      setTaxRatesLocal(rest);
    } else {
      const { federalLongTermRate, stateRate, ...rest } = updater;
      setTaxRatesLocal(rest);
    }
  };

  const [riskInputs, setRiskInputs] = useState({
    defaultProbability: 5,
    recoveryRate: 70,
    collateralType: 'first_lien' as 'first_lien' | 'second_lien' | 'unsecured',
    buyerCreditScore: 720,
    prepaymentProbability: 15,
  });

  const totalGain = inputs.salePrice - inputs.adjustedBasis;
  const grossProfitRatio = totalGain / inputs.salePrice;
  const combinedCapitalGainsRate = (taxRates.federalLongTermRate + taxRates.niitRate + taxRates.stateRate) / 100;

  const downPaymentAmount = inputs.salePrice * (inputs.downPayment / 100);
  const loanAmount = inputs.salePrice - downPaymentAmount;

  const monthlySchedule = useMemo(() => {
    return buildMonthlySchedule(
      loanAmount,
      inputs.interestRate,
      paymentStructure,
      inputs.termYears,
      inputs.amortizationYears,
      inputs.balloonYear,
      inputs.interestOnlyYears,
      inputs.graduatedStepUpRate,
    );
  }, [loanAmount, inputs.interestRate, paymentStructure, inputs.termYears, inputs.amortizationYears, inputs.balloonYear, inputs.interestOnlyYears, inputs.graduatedStepUpRate]);

  const annualSchedule = useMemo(() => {
    return aggregateToAnnual(
      monthlySchedule,
      grossProfitRatio,
      combinedCapitalGainsRate,
      taxRates.ordinaryIncomeRate,
      inputs.useInstallmentMethod,
      totalGain,
      downPaymentAmount,
    );
  }, [monthlySchedule, grossProfitRatio, combinedCapitalGainsRate, taxRates.ordinaryIncomeRate, inputs.useInstallmentMethod, totalGain, downPaymentAmount]);

  const monthlyPayment = monthlySchedule.length > 0
    ? monthlySchedule.find(r => !r.isBalloon)?.payment || monthlySchedule[0].payment
    : 0;
  const annualPayment = monthlyPayment * 12;
  const totalInterest = monthlySchedule.reduce((s, r) => s + r.interest, 0);
  const totalPrincipal = monthlySchedule.reduce((s, r) => s + r.principal, 0);
  const balloonBalance = monthlySchedule.find(r => r.isBalloon)?.principal || 0;
  const totalTaxPaid = annualSchedule.reduce((s, r) => s + r.taxDue, 0);

  const taxWithoutInstallment = totalGain * combinedCapitalGainsRate + totalInterest * (taxRates.ordinaryIncomeRate / 100);

  const npvOfNote = useMemo(() => {
    const discountRate = 0.08;
    let npv = downPaymentAmount;
    for (const row of annualSchedule) {
      if (row.year === 0) continue;
      npv += row.netCashFlow / Math.pow(1 + discountRate, row.year);
    }
    return npv;
  }, [annualSchedule, downPaymentAmount]);

  const expectedLoss = loanAmount * (riskInputs.defaultProbability / 100) * (1 - riskInputs.recoveryRate / 100);
  const riskAdjustedValue = npvOfNote - expectedLoss;

  const [comparisonScenarios, setComparisonScenarios] = useState<ComparisonScenario[]>([]);

  const addCurrentAsScenario = useCallback(() => {
    const structureLabel = PAYMENT_STRUCTURES.find(s => s.value === paymentStructure)?.label || paymentStructure;
    const totalPayments = monthlySchedule.reduce((s, r) => s + r.payment, 0) + downPaymentAmount;
    const effectiveRate = loanAmount > 0 ? (totalInterest / loanAmount) * 100 / (inputs.termYears || 1) : 0;

    const scenario: ComparisonScenario = {
      id: Date.now().toString(),
      label: structureLabel,
      structure: paymentStructure,
      metrics: {
        monthlyPayment,
        totalInterest,
        totalPayments,
        balloonAmount: balloonBalance,
        effectiveRate,
        npv: npvOfNote,
      },
    };
    setComparisonScenarios(prev => [...prev, scenario]);
  }, [paymentStructure, monthlyPayment, totalInterest, balloonBalance, npvOfNote, loanAmount, downPaymentAmount, monthlySchedule, inputs.termYears]);

  const removeScenario = (id: string) => {
    setComparisonScenarios(prev => prev.filter(s => s.id !== id));
  };

  const getCollateralBadge = () => {
    switch(riskInputs.collateralType) {
      case 'first_lien': return <Badge variant="outline" className="text-green-600 border-green-600">First Lien</Badge>;
      case 'second_lien': return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Second Lien</Badge>;
      case 'unsecured': return <Badge variant="outline" className="text-red-600 border-red-600">Unsecured</Badge>;
    }
  };

  const getCreditBadge = () => {
    if (riskInputs.buyerCreditScore >= 740) return <Badge variant="outline" className="text-green-600 border-green-600">Excellent</Badge>;
    if (riskInputs.buyerCreditScore >= 700) return <Badge variant="outline" className="text-blue-600 border-blue-600">Good</Badge>;
    if (riskInputs.buyerCreditScore >= 650) return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Fair</Badge>;
    return <Badge variant="outline" className="text-red-600 border-red-600">Poor</Badge>;
  };

  const structureInfo = PAYMENT_STRUCTURES.find(s => s.value === paymentStructure);

  const showAmortYears = ['pi_fully_amortizing', 'pi_with_balloon', 'graduated'].includes(paymentStructure);
  const showBalloonYear = ['io_with_balloon', 'pi_with_balloon'].includes(paymentStructure);
  const showIOYears = ['io_with_balloon', 'hybrid_io_then_pi'].includes(paymentStructure);
  const showGraduatedRate = paymentStructure === 'graduated';

  const hasNegativeAmort = paymentStructure === 'graduated' && monthlySchedule.some(r => r.payment < r.interest);

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <button onClick={() => setLocation(basePath)} className="hover:text-primary transition-colors">
                Exit Strategy Suite
              </button>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground font-medium">Seller Financing</span>
            </div>
            <h1 className="text-3xl font-bold" data-testid="seller-financing-title">Seller Financing</h1>
            <p className="text-muted-foreground mt-1">
              Flexible deal structuring with amortization, tax deferral, and risk analysis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={addCurrentAsScenario}>
              <Plus className="h-4 w-4 mr-2" />
              Save to Compare
            </Button>
            <Button variant="outline" onClick={() => setLocation(basePath)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Strategies
            </Button>
            <Button variant="outline" data-testid="btn-export-seller-financing">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <Label className="text-sm font-semibold mb-2 block">Payment Structure</Label>
                <Select value={paymentStructure} onValueChange={(v: PaymentStructure) => setPaymentStructure(v)}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STRUCTURES.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        <div className="flex flex-col">
                          <span>{s.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 pt-6">
                <p className="text-sm text-muted-foreground flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  {structureInfo?.description}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">Note Value</span>
              </div>
              <p className="text-2xl font-bold">${(loanAmount / 1000000).toFixed(2)}M</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Percent className="h-4 w-4" />
                <span className="text-sm">Monthly Pmt</span>
              </div>
              <p className="text-2xl font-bold">${monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">Total Interest</span>
              </div>
              <p className="text-2xl font-bold text-green-600">${(totalInterest / 1000).toFixed(0)}K</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calculator className="h-4 w-4" />
                <span className="text-sm">NPV of Note</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">${(npvOfNote / 1000000).toFixed(2)}M</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Shield className="h-4 w-4" />
                <span className="text-sm">Balloon Payment</span>
              </div>
              <p className="text-2xl font-bold">${balloonBalance > 0 ? (balloonBalance / 1000000).toFixed(2) + 'M' : 'None'}</p>
            </CardContent>
          </Card>
        </div>

        {hasNegativeAmort && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Graduated payments may cause negative amortization in early years if payments don't cover interest. Consider increasing the starting payment or reducing the step-up rate.</span>
          </div>
        )}

        <Tabs defaultValue="terms" className="space-y-4">
          <TabsList>
            <TabsTrigger value="terms" className="gap-2">
              <HandCoins className="h-4 w-4" />
              Deal Terms
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-2">
              <FileText className="h-4 w-4" />
              Amortization
            </TabsTrigger>
            <TabsTrigger value="tax" className="gap-2">
              <Calculator className="h-4 w-4" />
              Tax Analysis
            </TabsTrigger>
            <TabsTrigger value="risk" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Risk Analysis
            </TabsTrigger>
            {comparisonScenarios.length > 0 && (
              <TabsTrigger value="compare" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Compare ({comparisonScenarios.length})
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="terms">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HandCoins className="h-5 w-5" />
                    Financing Terms
                  </CardTitle>
                  <CardDescription>Configure seller financing parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="salePrice">Sale Price ($)</Label>
                      <Input
                        id="salePrice"
                        type="number"
                        value={inputs.salePrice}
                        onChange={(e) => setInputs({ ...inputs, salePrice: Number(e.target.value) })}
                        data-testid="input-sale-price"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="adjustedBasis">Adjusted Basis ($)</Label>
                      <Input
                        id="adjustedBasis"
                        type="number"
                        value={inputs.adjustedBasis}
                        onChange={(e) => setInputs({ ...inputs, adjustedBasis: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="downPayment">Down Payment (%)</Label>
                      <Input
                        id="downPayment"
                        type="number"
                        step="0.1"
                        value={inputs.downPayment}
                        onChange={(e) => setInputs({ ...inputs, downPayment: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="interestRate">Interest Rate (%)</Label>
                      <Input
                        id="interestRate"
                        type="number"
                        step="0.1"
                        value={inputs.interestRate}
                        onChange={(e) => setInputs({ ...inputs, interestRate: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="termYears">Loan Term (years)</Label>
                      <Input
                        id="termYears"
                        type="number"
                        value={inputs.termYears}
                        onChange={(e) => setInputs({ ...inputs, termYears: Number(e.target.value) })}
                      />
                    </div>

                    {showAmortYears && (
                      <div className="space-y-2">
                        <Label htmlFor="amortizationYears">Amortization (years)</Label>
                        <Input
                          id="amortizationYears"
                          type="number"
                          value={inputs.amortizationYears}
                          onChange={(e) => setInputs({ ...inputs, amortizationYears: Number(e.target.value) })}
                        />
                      </div>
                    )}

                    {showBalloonYear && (
                      <div className="space-y-2">
                        <Label htmlFor="balloonYear">Balloon Year</Label>
                        <Input
                          id="balloonYear"
                          type="number"
                          value={inputs.balloonYear}
                          onChange={(e) => setInputs({ ...inputs, balloonYear: Number(e.target.value) })}
                        />
                      </div>
                    )}

                    {showIOYears && (
                      <div className="space-y-2">
                        <Label htmlFor="interestOnlyYears">Interest-Only Period (years)</Label>
                        <Input
                          id="interestOnlyYears"
                          type="number"
                          value={inputs.interestOnlyYears}
                          onChange={(e) => setInputs({ ...inputs, interestOnlyYears: Number(e.target.value) })}
                        />
                      </div>
                    )}

                    {showGraduatedRate && (
                      <div className="space-y-2">
                        <Label htmlFor="graduatedStepUpRate">Annual Step-Up (%)</Label>
                        <Input
                          id="graduatedStepUpRate"
                          type="number"
                          step="0.5"
                          value={inputs.graduatedStepUpRate}
                          onChange={(e) => setInputs({ ...inputs, graduatedStepUpRate: Number(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>

                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="installmentMethod">Use Installment Sale Method</Label>
                      <p className="text-xs text-muted-foreground">Defer gain recognition as principal is received</p>
                    </div>
                    <Switch
                      id="installmentMethod"
                      checked={inputs.useInstallmentMethod}
                      onCheckedChange={(checked) => setInputs({ ...inputs, useInstallmentMethod: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Financing Summary</CardTitle>
                  <CardDescription>Key terms and payment analysis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sale Price</span>
                      <span className="font-medium">${inputs.salePrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Down Payment</span>
                      <span className="font-medium text-green-600">${downPaymentAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Note Amount</span>
                      <span className="font-medium">${loanAmount.toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Structure</span>
                      <Badge variant="secondary">{structureInfo?.label}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Gain</span>
                      <span className="font-medium">${totalGain.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gross Profit Ratio</span>
                      <span className="font-medium">{(grossProfitRatio * 100).toFixed(2)}%</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Payment</span>
                      <span className="font-medium" data-testid="text-monthly-payment">
                        ${monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        {paymentStructure === 'graduated' && <span className="text-xs text-muted-foreground ml-1">(starting)</span>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Annual Payment</span>
                      <span className="font-medium">
                        ${annualPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Interest</span>
                      <span className="font-medium text-green-600">
                        ${totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    {balloonBalance > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Balloon Payment</span>
                        <span className="font-medium text-amber-600">
                          ${balloonBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    )}
                  </div>

                  {paymentStructure === 'hybrid_io_then_pi' && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
                      <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">Hybrid Structure</p>
                      <p className="text-muted-foreground">
                        Years 1-{Math.min(inputs.interestOnlyYears, inputs.termYears - 1)}: Interest-only at ${(loanAmount * inputs.interestRate / 100 / 12).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                      </p>
                      <p className="text-muted-foreground">
                        Years {Math.min(inputs.interestOnlyYears, inputs.termYears - 1) + 1}-{inputs.termYears}: Fully amortizing P&I
                      </p>
                      {inputs.interestOnlyYears >= inputs.termYears && (
                        <p className="text-amber-600 mt-1">IO period capped to {inputs.termYears - 1} years (must leave at least 1 year for amortization)</p>
                      )}
                    </div>
                  )}

                  {paymentStructure === 'graduated' && (
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-sm">
                      <p className="font-medium text-purple-700 dark:text-purple-400 mb-1">Graduated Payment Schedule</p>
                      <p className="text-muted-foreground">
                        Payments increase {inputs.graduatedStepUpRate}% annually, starting at ~75% of a standard P&I payment
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Amortization Schedule with Tax Impact</CardTitle>
                    <CardDescription>
                      {scheduleView === 'annual' ? 'Year-by-year' : 'Month-by-month'} payment breakdown
                      {paymentStructure !== 'pi_fully_amortizing' && ` - ${structureInfo?.label}`}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={scheduleView === 'annual' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setScheduleView('annual')}
                    >
                      Annual
                    </Button>
                    <Button
                      variant={scheduleView === 'monthly' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setScheduleView('monthly')}
                    >
                      Monthly
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  {scheduleView === 'annual' ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Year</TableHead>
                          <TableHead className="text-right">Beginning Balance</TableHead>
                          <TableHead className="text-right">Payment</TableHead>
                          <TableHead className="text-right">Principal</TableHead>
                          <TableHead className="text-right">Interest</TableHead>
                          <TableHead className="text-right">Ending Balance</TableHead>
                          <TableHead className="text-right">Gain Recognized</TableHead>
                          <TableHead className="text-right">Tax Due</TableHead>
                          <TableHead className="text-right">Net Cash Flow</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {annualSchedule.map((row) => (
                          <TableRow
                            key={row.year}
                            data-testid={`amort-row-${row.year}`}
                            className={row.isBalloon ? 'bg-amber-50/50 dark:bg-amber-900/10' : row.isInterestOnly ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {row.year === 0 ? 'Down Pmt' : row.year}
                                {row.isBalloon && <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Balloon</Badge>}
                                {row.isInterestOnly && <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">IO</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              ${row.beginningBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right">
                              ${row.totalPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              ${row.totalPrincipal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right text-blue-600">
                              ${row.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${row.endingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right">
                              ${row.taxableGainRecognized.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right text-red-500">
                              ${row.taxDue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-600">
                              ${row.netCashFlow.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t-2">
                          <TableCell>Total</TableCell>
                          <TableCell />
                          <TableCell className="text-right">
                            ${annualSchedule.reduce((s, r) => s + r.totalPayment, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            ${annualSchedule.reduce((s, r) => s + r.totalPrincipal, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell className="text-right text-blue-600">
                            ${annualSchedule.reduce((s, r) => s + r.totalInterest, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell />
                          <TableCell className="text-right">
                            ${annualSchedule.reduce((s, r) => s + r.taxableGainRecognized, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell className="text-right text-red-500">
                            ${totalTaxPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            ${annualSchedule.reduce((s, r) => s + r.netCashFlow, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Year</TableHead>
                          <TableHead className="text-right">Beginning Balance</TableHead>
                          <TableHead className="text-right">Payment</TableHead>
                          <TableHead className="text-right">Principal</TableHead>
                          <TableHead className="text-right">Interest</TableHead>
                          <TableHead className="text-right">Ending Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlySchedule.map((row) => (
                          <TableRow
                            key={row.period}
                            className={row.isBalloon ? 'bg-amber-50/50 dark:bg-amber-900/10 font-medium' : row.isInterestOnly ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {row.period}
                                {row.isBalloon && <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Balloon</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{row.year}</TableCell>
                            <TableCell className="text-right">
                              ${row.beginningBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right">
                              ${row.payment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              ${row.principal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right text-blue-600">
                              ${row.interest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${row.endingBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tax">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tax Rate Assumptions</CardTitle>
                  <CardDescription>Configure tax rates for installment sale analysis</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Federal Long-Term Capital Gains</Label>
                        <span className="font-medium">{taxRates.federalLongTermRate}%</span>
                      </div>
                      <Slider
                        value={[taxRates.federalLongTermRate]}
                        onValueChange={([value]) => setTaxRates({ ...taxRates, federalLongTermRate: value })}
                        min={0}
                        max={25}
                        step={0.1}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>NIIT Rate</Label>
                        <span className="font-medium">{taxRates.niitRate}%</span>
                      </div>
                      <Slider
                        value={[taxRates.niitRate]}
                        onValueChange={([value]) => setTaxRates({ ...taxRates, niitRate: value })}
                        min={0}
                        max={5}
                        step={0.1}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>State Capital Gains Rate</Label>
                        <span className="font-medium">{taxRates.stateRate}%</span>
                      </div>
                      <Slider
                        value={[taxRates.stateRate]}
                        onValueChange={([value]) => setTaxRates({ ...taxRates, stateRate: value })}
                        min={0}
                        max={15}
                        step={0.1}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Ordinary Income Rate (for Interest)</Label>
                        <span className="font-medium">{taxRates.ordinaryIncomeRate}%</span>
                      </div>
                      <Slider
                        value={[taxRates.ordinaryIncomeRate]}
                        onValueChange={([value]) => setTaxRates({ ...taxRates, ordinaryIncomeRate: value })}
                        min={0}
                        max={45}
                        step={0.1}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Installment Sale Tax Benefits</CardTitle>
                  <CardDescription>Compare installment vs. outright sale tax treatment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-3">Outright Sale (Year 0 Tax)</h4>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Capital Gains Tax on Full Gain</span>
                        <span className="font-medium text-red-500">
                          ${(totalGain * combinedCapitalGainsRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <h4 className="font-medium mb-3">Installment Sale (Spread Over Time)</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Year 0 Tax (Down Payment)</span>
                          <span className="font-medium">
                            ${annualSchedule[0]?.taxDue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Tax Over Term</span>
                          <span className="font-medium">
                            ${totalTaxPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Tax Timing Benefit</span>
                      <span className="font-bold text-green-600">
                        Defer ${((totalGain * combinedCapitalGainsRate) - (annualSchedule[0]?.taxDue || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })} in Year 0
                      </span>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Installment Sale Considerations
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>Interest income is taxed at ordinary income rates</li>
                      <li>Related party sales have special rules</li>
                      <li>Disposition of installment note triggers gain</li>
                      {paymentStructure === 'interest_only' && (
                        <li className="text-amber-600">IO structure: all principal + gain recognized at maturity</li>
                      )}
                      {paymentStructure === 'graduated' && (
                        <li className="text-purple-600">Graduated: lower early payments mean more deferred gain</li>
                      )}
                      <li>Consult tax advisor for specific guidance</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="risk">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Credit & Default Risk
                  </CardTitle>
                  <CardDescription>Assess buyer credit and note risk</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Default Probability</Label>
                        <span className="font-medium">{riskInputs.defaultProbability}%</span>
                      </div>
                      <Slider
                        value={[riskInputs.defaultProbability]}
                        onValueChange={([value]) => setRiskInputs({ ...riskInputs, defaultProbability: value })}
                        min={0}
                        max={30}
                        step={0.5}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Recovery Rate (if Default)</Label>
                        <span className="font-medium">{riskInputs.recoveryRate}%</span>
                      </div>
                      <Slider
                        value={[riskInputs.recoveryRate]}
                        onValueChange={([value]) => setRiskInputs({ ...riskInputs, recoveryRate: value })}
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Collateral Type</Label>
                      <Select
                        value={riskInputs.collateralType}
                        onValueChange={(value: typeof riskInputs.collateralType) =>
                          setRiskInputs({ ...riskInputs, collateralType: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="first_lien">First Lien (Property)</SelectItem>
                          <SelectItem value="second_lien">Second Lien</SelectItem>
                          <SelectItem value="unsecured">Unsecured</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Buyer Credit Score</Label>
                        <span className="font-medium">{riskInputs.buyerCreditScore}</span>
                      </div>
                      <Slider
                        value={[riskInputs.buyerCreditScore]}
                        onValueChange={([value]) => setRiskInputs({ ...riskInputs, buyerCreditScore: value })}
                        min={500}
                        max={850}
                        step={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Prepayment Probability</Label>
                        <span className="font-medium">{riskInputs.prepaymentProbability}%</span>
                      </div>
                      <Slider
                        value={[riskInputs.prepaymentProbability]}
                        onValueChange={([value]) => setRiskInputs({ ...riskInputs, prepaymentProbability: value })}
                        min={0}
                        max={50}
                        step={1}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Risk-Adjusted Value</CardTitle>
                  <CardDescription>Expected value accounting for default risk</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Collateral</p>
                      <div className="mt-1">{getCollateralBadge()}</div>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Credit Quality</p>
                      <div className="mt-1">{getCreditBadge()}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Note Face Value</span>
                      <span className="font-medium">${loanAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">NPV (8% discount)</span>
                      <span className="font-medium">${npvOfNote.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expected Loss</span>
                      <span className="font-medium text-red-500">
                        -${expectedLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="font-semibold">Risk-Adjusted Value</span>
                      <span className="font-bold text-blue-600">
                        ${riskAdjustedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  {paymentStructure === 'interest_only' && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
                      <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">IO Risk Note</p>
                      <p className="text-muted-foreground">
                        Interest-only structures carry higher refinance risk since the full principal is due at maturity.
                        Ensure the buyer has a clear exit/refinance plan.
                      </p>
                    </div>
                  )}

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Risk Mitigation Strategies</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>Require personal guarantees</li>
                      <li>Include due-on-sale clause</li>
                      <li>Maintain first lien position</li>
                      <li>Require hazard insurance</li>
                      <li>Consider note sale or syndication</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {comparisonScenarios.length > 0 && (
            <TabsContent value="compare">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Deal Structure Comparison
                      </CardTitle>
                      <CardDescription>Compare saved financing scenarios side-by-side</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={addCurrentAsScenario}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Current
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Metric</TableHead>
                          {comparisonScenarios.map(s => (
                            <TableHead key={s.id} className="text-center min-w-[160px]">
                              <div className="flex items-center justify-center gap-2">
                                <span>{s.label}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => removeScenario(s.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">Monthly Payment</TableCell>
                          {comparisonScenarios.map(s => (
                            <TableCell key={s.id} className="text-center">
                              ${s.metrics.monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Total Interest</TableCell>
                          {comparisonScenarios.map(s => (
                            <TableCell key={s.id} className="text-center text-green-600">
                              ${s.metrics.totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Total Payments</TableCell>
                          {comparisonScenarios.map(s => (
                            <TableCell key={s.id} className="text-center">
                              ${s.metrics.totalPayments.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">Balloon Amount</TableCell>
                          {comparisonScenarios.map(s => (
                            <TableCell key={s.id} className="text-center">
                              {s.metrics.balloonAmount > 0
                                ? <span className="text-amber-600">${s.metrics.balloonAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                : <span className="text-muted-foreground">None</span>
                              }
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">NPV of Note</TableCell>
                          {comparisonScenarios.map(s => (
                            <TableCell key={s.id} className="text-center text-blue-600 font-medium">
                              ${s.metrics.npv.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
