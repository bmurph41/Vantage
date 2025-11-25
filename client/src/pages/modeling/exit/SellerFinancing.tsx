import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, HandCoins, ChevronRight, Download } from "lucide-react";
import type { ModelingProject } from "@shared/schema";

interface SellerFinancingProps {
  projectId: string;
}

export default function ExitSellerFinancing({ projectId }: SellerFinancingProps) {
  const [, setLocation] = useLocation();
  
  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const basePath = `/modeling/projects/${projectId}/exit`;

  const [inputs, setInputs] = useState({
    salePrice: project?.purchasePrice ? Number(project.purchasePrice) * 1.3 : 10000000,
    downPayment: 20,
    interestRate: 6.5,
    termYears: 10,
    amortizationYears: 25,
    balloonYear: 10
  });

  const downPaymentAmount = inputs.salePrice * (inputs.downPayment / 100);
  const loanAmount = inputs.salePrice - downPaymentAmount;
  const monthlyRate = inputs.interestRate / 100 / 12;
  const amortizationMonths = inputs.amortizationYears * 12;
  const termMonths = inputs.termYears * 12;
  
  const monthlyPayment = loanAmount * 
    (monthlyRate * Math.pow(1 + monthlyRate, amortizationMonths)) / 
    (Math.pow(1 + monthlyRate, amortizationMonths) - 1);
  
  const annualPayment = monthlyPayment * 12;
  
  const generateAmortizationSchedule = () => {
    const schedule = [];
    let balance = loanAmount;
    
    for (let year = 1; year <= Math.min(inputs.termYears, 10); year++) {
      let yearInterest = 0;
      let yearPrincipal = 0;
      
      for (let month = 1; month <= 12; month++) {
        const interestPayment = balance * monthlyRate;
        const principalPayment = monthlyPayment - interestPayment;
        yearInterest += interestPayment;
        yearPrincipal += principalPayment;
        balance -= principalPayment;
      }
      
      schedule.push({
        year,
        payment: annualPayment,
        principal: yearPrincipal,
        interest: yearInterest,
        balance: Math.max(0, balance)
      });
    }
    
    return schedule;
  };

  const schedule = generateAmortizationSchedule();
  const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0);
  const balloonBalance = schedule[schedule.length - 1]?.balance || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button onClick={() => setLocation(basePath)} className="hover:text-primary transition-colors">
              Exit Strategy
            </button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">Seller Financing</span>
          </div>
          <h1 className="text-3xl font-bold" data-testid="seller-financing-title">Seller Financing</h1>
          <p className="text-muted-foreground mt-1">
            Installment sale modeling with amortization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLocation(basePath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="outline" data-testid="btn-export-seller-financing">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

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
              <div className="space-y-2">
                <Label htmlFor="amortizationYears">Amortization (years)</Label>
                <Input
                  id="amortizationYears"
                  type="number"
                  value={inputs.amortizationYears}
                  onChange={(e) => setInputs({ ...inputs, amortizationYears: Number(e.target.value) })}
                />
              </div>
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
                <span className="text-muted-foreground">Loan Amount</span>
                <span className="font-medium">${loanAmount.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Payment</span>
                <span className="font-medium" data-testid="text-monthly-payment">
                  ${monthlyPayment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
                <span className="font-medium text-red-500">
                  ${totalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Balloon Balance</span>
                <span className="font-medium">
                  ${balloonBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Amortization Schedule</CardTitle>
          <CardDescription>Year-by-year payment breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Year</th>
                  <th className="text-right py-2 px-4">Payment</th>
                  <th className="text-right py-2 px-4">Principal</th>
                  <th className="text-right py-2 px-4">Interest</th>
                  <th className="text-right py-2 px-4">Balance</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr key={row.year} className="border-b" data-testid={`amort-row-${row.year}`}>
                    <td className="py-2 px-4">{row.year}</td>
                    <td className="text-right py-2 px-4">
                      ${row.payment.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="text-right py-2 px-4 text-green-600">
                      ${row.principal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="text-right py-2 px-4 text-red-500">
                      ${row.interest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="text-right py-2 px-4 font-medium">
                      ${row.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
