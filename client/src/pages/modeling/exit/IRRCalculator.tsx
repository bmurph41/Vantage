import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Percent, ChevronRight, Download, Plus, Trash2 } from "lucide-react";
import type { ModelingProject } from "@shared/schema";

interface IRRCalculatorProps {
  projectId: string;
}

export default function ExitIRRCalculator({ projectId }: IRRCalculatorProps) {
  const [, setLocation] = useLocation();
  
  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const basePath = `/modeling/projects/${projectId}/exit`;

  const [cashFlows, setCashFlows] = useState([
    { id: 0, year: 0, amount: -(project?.purchasePrice ? Number(project.purchasePrice) : 10000000), description: "Initial Investment" },
    { id: 1, year: 1, amount: 600000, description: "Year 1 Cash Flow" },
    { id: 2, year: 2, amount: 650000, description: "Year 2 Cash Flow" },
    { id: 3, year: 3, amount: 700000, description: "Year 3 Cash Flow" },
    { id: 4, year: 4, amount: 750000, description: "Year 4 Cash Flow" },
    { id: 5, year: 5, amount: 13800000, description: "Year 5 Sale + Cash Flow" },
  ]);

  const addCashFlow = () => {
    const maxYear = Math.max(...cashFlows.map(cf => cf.year));
    const newId = Math.max(...cashFlows.map(cf => cf.id)) + 1;
    setCashFlows([...cashFlows, {
      id: newId,
      year: maxYear + 1,
      amount: 500000,
      description: `Year ${maxYear + 1} Cash Flow`
    }]);
  };

  const removeCashFlow = (id: number) => {
    if (id === 0) return;
    setCashFlows(cashFlows.filter(cf => cf.id !== id));
  };

  const updateCashFlow = (id: number, field: string, value: number | string) => {
    setCashFlows(cashFlows.map(cf => 
      cf.id === id ? { ...cf, [field]: value } : cf
    ));
  };

  const calculateIRR = () => {
    const sorted = [...cashFlows].sort((a, b) => a.year - b.year);
    const amounts = sorted.map(cf => cf.amount);
    
    let low = -0.99;
    let high = 10;
    let irr = 0;
    
    for (let i = 0; i < 100; i++) {
      irr = (low + high) / 2;
      let npv = 0;
      for (let j = 0; j < amounts.length; j++) {
        npv += amounts[j] / Math.pow(1 + irr, sorted[j].year);
      }
      if (Math.abs(npv) < 0.01) break;
      if (npv > 0) low = irr;
      else high = irr;
    }
    
    return irr * 100;
  };

  const calculateNPV = (discountRate: number) => {
    const sorted = [...cashFlows].sort((a, b) => a.year - b.year);
    let npv = 0;
    for (const cf of sorted) {
      npv += cf.amount / Math.pow(1 + discountRate / 100, cf.year);
    }
    return npv;
  };

  const calculateMOIC = () => {
    const invested = cashFlows.filter(cf => cf.amount < 0).reduce((sum, cf) => sum + Math.abs(cf.amount), 0);
    const returned = cashFlows.filter(cf => cf.amount > 0).reduce((sum, cf) => sum + cf.amount, 0);
    return invested > 0 ? returned / invested : 0;
  };

  const irr = calculateIRR();
  const npv8 = calculateNPV(8);
  const npv10 = calculateNPV(10);
  const npv12 = calculateNPV(12);
  const moic = calculateMOIC();
  
  const totalInvested = Math.abs(cashFlows.filter(cf => cf.amount < 0).reduce((sum, cf) => sum + cf.amount, 0));
  const totalReturned = cashFlows.filter(cf => cf.amount > 0).reduce((sum, cf) => sum + cf.amount, 0);
  const totalProfit = totalReturned - totalInvested;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button onClick={() => setLocation(basePath)} className="hover:text-primary transition-colors">
              Exit Strategy Suite
            </button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">IRR Calculator</span>
          </div>
          <h1 className="text-3xl font-bold" data-testid="irr-title">IRR Calculator</h1>
          <p className="text-muted-foreground mt-1">
            Multi-period return analysis with NPV
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLocation(basePath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Strategies
          </Button>
          <Button variant="outline" data-testid="btn-export-irr">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">IRR</p>
            <p className="text-2xl font-bold text-green-600" data-testid="text-irr">
              {irr.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">MOIC</p>
            <p className="text-2xl font-bold text-blue-600">
              {moic.toFixed(2)}x
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Invested</p>
            <p className="text-2xl font-bold">
              ${totalInvested.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Returned</p>
            <p className="text-2xl font-bold">
              ${totalReturned.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Profit</p>
            <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${totalProfit.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                Cash Flows
              </CardTitle>
              <CardDescription>Enter investment and return cash flows</CardDescription>
            </div>
            <Button onClick={addCashFlow} size="sm" data-testid="btn-add-cashflow">
              <Plus className="h-4 w-4 mr-2" />
              Add Year
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cashFlows.sort((a, b) => a.year - b.year).map((cf) => (
                <div key={cf.id} className="flex items-center gap-3" data-testid={`cashflow-${cf.id}`}>
                  <div className="w-20">
                    <Label className="text-xs text-muted-foreground">Year</Label>
                    <Input
                      type="number"
                      value={cf.year}
                      onChange={(e) => updateCashFlow(cf.id, 'year', Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <Input
                      value={cf.description}
                      onChange={(e) => updateCashFlow(cf.id, 'description', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="w-40">
                    <Label className="text-xs text-muted-foreground">Amount ($)</Label>
                    <Input
                      type="number"
                      value={cf.amount}
                      onChange={(e) => updateCashFlow(cf.id, 'amount', Number(e.target.value))}
                      className={`mt-1 ${cf.amount < 0 ? 'text-red-600' : 'text-green-600'}`}
                    />
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => removeCashFlow(cf.id)}
                    disabled={cf.id === 0}
                    className="text-red-500 mt-5"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Return Analysis</CardTitle>
            <CardDescription>NPV at various discount rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Net Present Value (NPV)</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">NPV @ 8%</span>
                    <span className={`font-medium ${npv8 >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${npv8.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">NPV @ 10%</span>
                    <span className={`font-medium ${npv10 >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${npv10.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">NPV @ 12%</span>
                    <span className={`font-medium ${npv12 >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${npv12.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Investment Metrics</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Internal Rate of Return (IRR)</span>
                    <span className="font-medium text-green-600">{irr.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Multiple on Invested Capital (MOIC)</span>
                    <span className="font-medium">{moic.toFixed(2)}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Holding Period</span>
                    <span className="font-medium">{Math.max(...cashFlows.map(cf => cf.year))} years</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Equity Multiple</span>
                    <span className="font-medium">{moic.toFixed(2)}x</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <h4 className="font-medium mb-2 text-blue-700 dark:text-blue-300">Analysis Notes</h4>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  IRR of {irr.toFixed(2)}% exceeds typical hurdle rates of 8-10% for value-add 
                  real estate investments. The {moic.toFixed(2)}x equity multiple indicates 
                  strong overall return on invested capital.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
