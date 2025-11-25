import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Landmark, ChevronRight, Download, Plus, Trash2 } from "lucide-react";
import type { ModelingProject } from "@shared/schema";

interface DSTAnalysisProps {
  projectId: string;
}

export default function ExitDSTAnalysis({ projectId }: DSTAnalysisProps) {
  const [, setLocation] = useLocation();
  
  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const basePath = `/modeling/projects/${projectId}/exit`;

  const [investmentAmount, setInvestmentAmount] = useState(1000000);
  const [dstOptions, setDstOptions] = useState([
    { id: 1, name: "Industrial DST Fund I", cashOnCash: 5.5, projectedAppreciation: 3.0, holdPeriod: 7, ltv: 45 },
    { id: 2, name: "Multi-Family DST Fund III", cashOnCash: 4.8, projectedAppreciation: 4.0, holdPeriod: 10, ltv: 50 },
    { id: 3, name: "Net Lease DST Portfolio", cashOnCash: 6.2, projectedAppreciation: 2.0, holdPeriod: 5, ltv: 35 },
  ]);

  const addDstOption = () => {
    const newId = Math.max(...dstOptions.map(d => d.id)) + 1;
    setDstOptions([...dstOptions, {
      id: newId,
      name: `DST Option ${newId}`,
      cashOnCash: 5.0,
      projectedAppreciation: 3.0,
      holdPeriod: 7,
      ltv: 45
    }]);
  };

  const removeDstOption = (id: number) => {
    setDstOptions(dstOptions.filter(d => d.id !== id));
  };

  const updateDstOption = (id: number, field: string, value: number | string) => {
    setDstOptions(dstOptions.map(d => 
      d.id === id ? { ...d, [field]: value } : d
    ));
  };

  const calculateDstReturns = (dst: typeof dstOptions[0]) => {
    const annualCashFlow = investmentAmount * (dst.cashOnCash / 100);
    const totalCashFlow = annualCashFlow * dst.holdPeriod;
    const appreciationMultiple = Math.pow(1 + dst.projectedAppreciation / 100, dst.holdPeriod);
    const projectedValue = investmentAmount * appreciationMultiple;
    const totalReturn = totalCashFlow + projectedValue - investmentAmount;
    const irr = ((Math.pow((totalCashFlow + projectedValue) / investmentAmount, 1 / dst.holdPeriod) - 1) * 100);
    return { annualCashFlow, totalCashFlow, projectedValue, totalReturn, irr };
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button onClick={() => setLocation(basePath)} className="hover:text-primary transition-colors">
              Exit Strategy
            </button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">DST Analysis</span>
          </div>
          <h1 className="text-3xl font-bold" data-testid="dst-title">DST Analysis</h1>
          <p className="text-muted-foreground mt-1">
            Delaware Statutory Trust comparison and modeling
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLocation(basePath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="outline" data-testid="btn-export-dst">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Investment Parameters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Label htmlFor="investmentAmount">Investment Amount ($)</Label>
            <Input
              id="investmentAmount"
              type="number"
              value={investmentAmount}
              onChange={(e) => setInvestmentAmount(Number(e.target.value))}
              className="mt-2"
              data-testid="input-investment-amount"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>DST Options Comparison</CardTitle>
            <CardDescription>Compare different DST investment options</CardDescription>
          </div>
          <Button onClick={addDstOption} size="sm" data-testid="btn-add-dst">
            <Plus className="h-4 w-4 mr-2" />
            Add Option
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {dstOptions.map((dst, index) => {
              const returns = calculateDstReturns(dst);
              return (
                <div key={dst.id} className="border rounded-lg p-4" data-testid={`dst-option-${dst.id}`}>
                  <div className="flex items-center justify-between mb-4">
                    <Input
                      value={dst.name}
                      onChange={(e) => updateDstOption(dst.id, 'name', e.target.value)}
                      className="max-w-xs font-medium"
                    />
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => removeDstOption(dst.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label>Cash-on-Cash (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={dst.cashOnCash}
                        onChange={(e) => updateDstOption(dst.id, 'cashOnCash', Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Appreciation (%/yr)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={dst.projectedAppreciation}
                        onChange={(e) => updateDstOption(dst.id, 'projectedAppreciation', Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hold Period (yrs)</Label>
                      <Input
                        type="number"
                        value={dst.holdPeriod}
                        onChange={(e) => updateDstOption(dst.id, 'holdPeriod', Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>LTV (%)</Label>
                      <Input
                        type="number"
                        step="1"
                        value={dst.ltv}
                        onChange={(e) => updateDstOption(dst.id, 'ltv', Number(e.target.value))}
                      />
                    </div>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Annual Cash Flow</p>
                      <p className="font-semibold text-green-600">${returns.annualCashFlow.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Cash Flow</p>
                      <p className="font-semibold">${returns.totalCashFlow.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Projected Value</p>
                      <p className="font-semibold">${returns.projectedValue.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Return</p>
                      <p className="font-semibold text-green-600">${returns.totalReturn.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Estimated IRR</p>
                      <p className="font-semibold text-blue-600">{returns.irr.toFixed(2)}%</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>DST Benefits Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Tax Deferral</h4>
              <p className="text-sm text-muted-foreground">
                Full tax deferral through 1031 exchange into fractional DST ownership
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Passive Investment</h4>
              <p className="text-sm text-muted-foreground">
                No management responsibilities - professional sponsor handles operations
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Diversification</h4>
              <p className="text-sm text-muted-foreground">
                Access to institutional-quality properties across asset classes
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
