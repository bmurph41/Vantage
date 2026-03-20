import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { apiRequest } from '@/lib/queryClient';

interface LoanSizingInputs {
  propertyValue: number;
  noi: number;
  interestRate: number;
  amortizationYears: number;
  maxLTV: number;
  minDSCR: number;
  minDebtYield: number;
}

interface ConstraintResult {
  name: string;
  maxLoan: number;
  isBinding: boolean;
  color: string;
}

interface LoanSizingResult {
  maxLoanAmount: number;
  bindingConstraint: string;
  impliedLTV: number;
  impliedDSCR: number;
  impliedDebtYield: number;
  equityRequired: number;
  annualDebtService: number;
  constraints: ConstraintResult[];
  ltvSensitivity: { ltv: number; loanAmount: number; dscr: number; debtYield: number }[];
  dscrSensitivity: { dscr: number; loanAmount: number; ltv: number; debtYield: number }[];
  debtYieldSensitivity: { debtYield: number; loanAmount: number; ltv: number; dscr: number }[];
  scenarioGrid: { interestRate: number; ltv65: number; ltv70: number; ltv75: number }[];
}

const defaultInputs: LoanSizingInputs = {
  propertyValue: 25000000,
  noi: 2000000,
  interestRate: 6.5,
  amortizationYears: 25,
  maxLTV: 70,
  minDSCR: 1.25,
  minDebtYield: 9.0,
};

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function calcAnnualDebtService(loanAmount: number, annualRate: number, amortYears: number): number {
  const monthlyRate = annualRate / 100 / 12;
  const nPayments = amortYears * 12;
  if (monthlyRate === 0) return loanAmount / nPayments * 12;
  const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, nPayments)) / (Math.pow(1 + monthlyRate, nPayments) - 1);
  return monthlyPayment * 12;
}

const constraintColors = {
  LTV: '#3b82f6',
  DSCR: '#f59e0b',
  'Debt Yield': '#10b981',
};

export function LoanSizing({ projectId, onTabChange }: { projectId: string; onTabChange?: (tab: string) => void }) {
  const [inputs, setInputs] = useState<LoanSizingInputs>(defaultInputs);
  const [submitted, setSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState('inputs');

  const { data: result, isLoading, refetch } = useQuery<LoanSizingResult>({
    queryKey: ['loan-sizing', projectId, submitted],
    queryFn: async () => {
      const res = await apiRequest('POST', '/api/institutional-analysis/loan-sizing', {
        projectId,
        ...inputs,
      });
      return res.json();
    },
    enabled: submitted,
  });

  const localCalc = useMemo(() => {
    const ltvLoan = inputs.propertyValue * (inputs.maxLTV / 100);

    // DSCR-constrained: find max loan where NOI / ADS >= minDSCR
    // ADS = loan * [r(1+r)^n] / [(1+r)^n - 1] * 12, solve for loan = NOI / (minDSCR * constant)
    const monthlyRate = inputs.interestRate / 100 / 12;
    const nPayments = inputs.amortizationYears * 12;
    let loanConstant: number;
    if (monthlyRate === 0) {
      loanConstant = 12 / nPayments;
    } else {
      const monthlyConstant = (monthlyRate * Math.pow(1 + monthlyRate, nPayments)) / (Math.pow(1 + monthlyRate, nPayments) - 1);
      loanConstant = monthlyConstant * 12;
    }
    const dscrLoan = inputs.noi / (inputs.minDSCR * loanConstant);

    // Debt yield constrained: NOI / Loan >= minDebtYield
    const debtYieldLoan = inputs.noi / (inputs.minDebtYield / 100);

    const constraints: ConstraintResult[] = [
      { name: 'LTV', maxLoan: ltvLoan, isBinding: false, color: constraintColors.LTV },
      { name: 'DSCR', maxLoan: dscrLoan, isBinding: false, color: constraintColors.DSCR },
      { name: 'Debt Yield', maxLoan: debtYieldLoan, isBinding: false, color: constraintColors['Debt Yield'] },
    ];

    const maxLoanAmount = Math.min(ltvLoan, dscrLoan, debtYieldLoan);
    const bindingIdx = constraints.findIndex(c => c.maxLoan === maxLoanAmount);
    constraints[bindingIdx].isBinding = true;
    const bindingConstraint = constraints[bindingIdx].name;

    const annualDS = calcAnnualDebtService(maxLoanAmount, inputs.interestRate, inputs.amortizationYears);
    const impliedLTV = (maxLoanAmount / inputs.propertyValue) * 100;
    const impliedDSCR = inputs.noi / annualDS;
    const impliedDebtYield = (inputs.noi / maxLoanAmount) * 100;
    const equityRequired = inputs.propertyValue - maxLoanAmount;

    // LTV sensitivity
    const ltvLevels = [55, 60, 65, 70, 75, 80];
    const ltvSensitivity = ltvLevels.map(ltv => {
      const loan = inputs.propertyValue * (ltv / 100);
      const ads = calcAnnualDebtService(loan, inputs.interestRate, inputs.amortizationYears);
      return { ltv, loanAmount: loan, dscr: inputs.noi / ads, debtYield: (inputs.noi / loan) * 100 };
    });

    // DSCR sensitivity
    const dscrLevels = [1.0, 1.15, 1.20, 1.25, 1.30, 1.40, 1.50];
    const dscrSensitivity = dscrLevels.map(dscr => {
      const loan = inputs.noi / (dscr * loanConstant);
      return { dscr, loanAmount: loan, ltv: (loan / inputs.propertyValue) * 100, debtYield: (inputs.noi / loan) * 100 };
    });

    // Debt yield sensitivity
    const dyLevels = [7.0, 8.0, 9.0, 10.0, 11.0, 12.0];
    const debtYieldSensitivity = dyLevels.map(dy => {
      const loan = inputs.noi / (dy / 100);
      const ads = calcAnnualDebtService(loan, inputs.interestRate, inputs.amortizationYears);
      return { debtYield: dy, loanAmount: loan, ltv: (loan / inputs.propertyValue) * 100, dscr: inputs.noi / ads };
    });

    // Scenario grid: different rates x LTV levels
    const rates = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0];
    const scenarioGrid = rates.map(rate => {
      const calcLoan = (ltv: number) => inputs.propertyValue * (ltv / 100);
      const calcDscr = (loan: number) => {
        const ads = calcAnnualDebtService(loan, rate, inputs.amortizationYears);
        return inputs.noi / ads;
      };
      return {
        interestRate: rate,
        ltv65: calcDscr(calcLoan(65)),
        ltv70: calcDscr(calcLoan(70)),
        ltv75: calcDscr(calcLoan(75)),
      };
    });

    return {
      maxLoanAmount,
      bindingConstraint,
      impliedLTV,
      impliedDSCR,
      impliedDebtYield,
      equityRequired,
      annualDebtService: annualDS,
      constraints,
      ltvSensitivity,
      dscrSensitivity,
      debtYieldSensitivity,
      scenarioGrid,
    };
  }, [inputs]);

  const displayData = result || localCalc;

  const handleSubmit = () => {
    setSubmitted(true);
    refetch();
    setActiveTab('results');
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const maxConstraintLoan = useMemo(() => {
    return Math.max(...displayData.constraints.map(c => c.maxLoan));
  }, [displayData]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Loan Sizing Calculator</h2>
        <p className="text-muted-foreground">Determine maximum loan proceeds by LTV, DSCR, and debt yield constraints</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="inputs">Inputs</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="sensitivity">Sensitivity</TabsTrigger>
          <TabsTrigger value="scenarios">Scenario Grid</TabsTrigger>
        </TabsList>

        <TabsContent value="inputs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Property & Loan Parameters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Property Value ($)</Label>
                  <Input type="number" value={inputs.propertyValue} onChange={(e) => setInputs({ ...inputs, propertyValue: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Net Operating Income ($)</Label>
                  <Input type="number" value={inputs.noi} onChange={(e) => setInputs({ ...inputs, noi: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Interest Rate (%)</Label>
                  <Input type="number" step="0.125" value={inputs.interestRate} onChange={(e) => setInputs({ ...inputs, interestRate: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Amortization (years)</Label>
                  <Input type="number" value={inputs.amortizationYears} onChange={(e) => setInputs({ ...inputs, amortizationYears: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Max LTV (%)</Label>
                  <Input type="number" step="1" value={inputs.maxLTV} onChange={(e) => setInputs({ ...inputs, maxLTV: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Min DSCR (x)</Label>
                  <Input type="number" step="0.05" value={inputs.minDSCR} onChange={(e) => setInputs({ ...inputs, minDSCR: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Min Debt Yield (%)</Label>
                  <Input type="number" step="0.5" value={inputs.minDebtYield} onChange={(e) => setInputs({ ...inputs, minDebtYield: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Button onClick={handleSubmit} disabled={isLoading} className="w-full md:w-auto">
            {isLoading ? 'Calculating...' : 'Size Loan'}
          </Button>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Max Loan Amount</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(displayData.maxLoanAmount)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Binding Constraint</p>
                <div className="mt-1">
                  <Badge variant="destructive" className="text-sm">{displayData.bindingConstraint}</Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Implied LTV</p>
                <p className="text-2xl font-bold mt-1">{formatPct(displayData.impliedLTV)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Implied DSCR</p>
                <p className="text-2xl font-bold mt-1">{displayData.impliedDSCR.toFixed(2)}x</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Implied Debt Yield</p>
                <p className="text-2xl font-bold mt-1">{formatPct(displayData.impliedDebtYield)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Equity Required</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(displayData.equityRequired)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Constraint Comparison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {displayData.constraints.map((constraint) => (
                <div key={constraint.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      {constraint.name}
                      {constraint.isBinding && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Binding</Badge>}
                    </span>
                    <span className="font-semibold">{formatCurrency(constraint.maxLoan)}</span>
                  </div>
                  <div className="relative w-full h-6 bg-muted rounded overflow-hidden">
                    <div
                      className="absolute h-full rounded transition-all duration-500"
                      style={{
                        width: `${(constraint.maxLoan / maxConstraintLoan) * 100}%`,
                        backgroundColor: constraint.color,
                        opacity: constraint.isBinding ? 1 : 0.5,
                      }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-sm text-muted-foreground mt-2">
                The binding constraint ({displayData.bindingConstraint}) produces the lowest max loan at {formatCurrency(displayData.maxLoanAmount)}, determining the final sizing.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sensitivity" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">LTV Sensitivity</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>LTV</TableHead>
                      <TableHead className="text-right">Loan</TableHead>
                      <TableHead className="text-right">DSCR</TableHead>
                      <TableHead className="text-right">DY</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayData.ltvSensitivity.map((row) => {
                      const isBinding = Math.abs(row.ltv - inputs.maxLTV) < 0.01;
                      return (
                        <TableRow key={row.ltv} className={isBinding ? 'bg-blue-50 dark:bg-blue-950' : ''}>
                          <TableCell className="font-medium">{row.ltv}%</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.loanAmount)}</TableCell>
                          <TableCell className="text-right">{row.dscr.toFixed(2)}x</TableCell>
                          <TableCell className="text-right">{formatPct(row.debtYield)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">DSCR Sensitivity</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DSCR</TableHead>
                      <TableHead className="text-right">Loan</TableHead>
                      <TableHead className="text-right">LTV</TableHead>
                      <TableHead className="text-right">DY</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayData.dscrSensitivity.map((row) => {
                      const isBinding = Math.abs(row.dscr - inputs.minDSCR) < 0.01;
                      return (
                        <TableRow key={row.dscr} className={isBinding ? 'bg-amber-50 dark:bg-amber-950' : ''}>
                          <TableCell className="font-medium">{row.dscr.toFixed(2)}x</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.loanAmount)}</TableCell>
                          <TableCell className="text-right">{formatPct(row.ltv)}</TableCell>
                          <TableCell className="text-right">{formatPct(row.debtYield)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Debt Yield Sensitivity</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>DY</TableHead>
                      <TableHead className="text-right">Loan</TableHead>
                      <TableHead className="text-right">LTV</TableHead>
                      <TableHead className="text-right">DSCR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayData.debtYieldSensitivity.map((row) => {
                      const isBinding = Math.abs(row.debtYield - inputs.minDebtYield) < 0.01;
                      return (
                        <TableRow key={row.debtYield} className={isBinding ? 'bg-green-50 dark:bg-green-950' : ''}>
                          <TableCell className="font-medium">{formatPct(row.debtYield)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.loanAmount)}</TableCell>
                          <TableCell className="text-right">{formatPct(row.ltv)}</TableCell>
                          <TableCell className="text-right">{row.dscr.toFixed(2)}x</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Constraint Visualization</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={displayData.constraints} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v: number) => formatCurrency(v)} />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip formatter={(v: number) => formatCurrency(v as number)} />
                  <Bar dataKey="maxLoan" name="Max Loan" radius={[0, 4, 4, 0]}>
                    {displayData.constraints.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} opacity={entry.isBinding ? 1 : 0.4} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scenarios" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>DSCR at Various Interest Rates and LTV Levels</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Interest Rate</TableHead>
                    <TableHead className="text-right">DSCR @ 65% LTV</TableHead>
                    <TableHead className="text-right">DSCR @ 70% LTV</TableHead>
                    <TableHead className="text-right">DSCR @ 75% LTV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayData.scenarioGrid.map((row) => (
                    <TableRow key={row.interestRate} className={Math.abs(row.interestRate - inputs.interestRate) < 0.01 ? 'bg-muted/50' : ''}>
                      <TableCell className="font-medium">{formatPct(row.interestRate)}</TableCell>
                      <TableCell className={`text-right ${row.ltv65 < inputs.minDSCR ? 'text-red-600 font-semibold' : 'text-green-600'}`}>
                        {row.ltv65.toFixed(2)}x
                      </TableCell>
                      <TableCell className={`text-right ${row.ltv70 < inputs.minDSCR ? 'text-red-600 font-semibold' : 'text-green-600'}`}>
                        {row.ltv70.toFixed(2)}x
                      </TableCell>
                      <TableCell className={`text-right ${row.ltv75 < inputs.minDSCR ? 'text-red-600 font-semibold' : 'text-green-600'}`}>
                        {row.ltv75.toFixed(2)}x
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-sm text-muted-foreground mt-4">
                Red values indicate the DSCR falls below the minimum threshold of {inputs.minDSCR.toFixed(2)}x. Current scenario highlighted.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>DSCR by Interest Rate (at 70% LTV)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={displayData.scenarioGrid}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="interestRate" tickFormatter={(v: number) => `${v}%`} />
                  <YAxis domain={[0, 'auto']} tickFormatter={(v: number) => `${v.toFixed(1)}x`} />
                  <Tooltip formatter={(v: number) => `${(v as number).toFixed(2)}x`} labelFormatter={(l: number) => `Rate: ${l}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="ltv65" name="65% LTV" stroke="#10b981" strokeWidth={2} />
                  <Line type="monotone" dataKey="ltv70" name="70% LTV" stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="ltv75" name="75% LTV" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default LoanSizing;
