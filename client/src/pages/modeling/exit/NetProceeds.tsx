import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, DollarSign, ChevronRight, Download } from "lucide-react";
import type { ModelingProject } from "@shared/schema";
import { ExitProForma, buildExitProFormaRows } from "@/components/exit-strategies/ExitProForma";

interface NetProceedsProps {
  projectId: string;
}

export default function ExitNetProceeds({ projectId }: NetProceedsProps) {
  const [, setLocation] = useLocation();
  
  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const basePath = `/modeling/projects/${projectId}/exit`;

  const [inputs, setInputs] = useState({
    grossSalePrice: project?.purchasePrice ? Number(project.purchasePrice) * 1.3 : 10000000,
    brokerCommission: 3,
    transferTax: 1.1,
    legalFees: 50000,
    otherClosingCosts: 25000,
    outstandingDebt: 6000000,
    prepaymentPenalty: 1,
    escrowHoldback: 100000,
    prorations: 25000,
    taxLiability: 400000
  });

  const [opAssumptions, setOpAssumptions] = useState({
    monthlyNOI: 100000,
    noiGrowthRate: 3,
    monthlyDebtService: 40000,
    holdPeriodYears: 5,
  });

  const brokerFee = inputs.grossSalePrice * (inputs.brokerCommission / 100);
  const transferTaxAmount = inputs.grossSalePrice * (inputs.transferTax / 100);
  const prepaymentAmount = inputs.outstandingDebt * (inputs.prepaymentPenalty / 100);
  
  const totalClosingCosts = brokerFee + transferTaxAmount + inputs.legalFees + inputs.otherClosingCosts;
  const totalDebtPayoff = inputs.outstandingDebt + prepaymentAmount;
  const netSaleProceeds = inputs.grossSalePrice - totalClosingCosts;
  const proceedsAfterDebt = netSaleProceeds - totalDebtPayoff;
  const netProceedsAfterTax = proceedsAfterDebt - inputs.taxLiability - inputs.escrowHoldback + inputs.prorations;
  
  const purchasePrice = Number(project?.purchasePrice) || 0;
  const totalProfit = netProceedsAfterTax - (purchasePrice - inputs.outstandingDebt);
  const roi = purchasePrice > 0 ? (totalProfit / (purchasePrice - inputs.outstandingDebt)) * 100 : 0;

  const proFormaConfig = useMemo(() => {
    const { rows, lineItems } = buildExitProFormaRows({
      holdPeriodYears: opAssumptions.holdPeriodYears,
      monthlyNOI: opAssumptions.monthlyNOI,
      noiGrowthRate: opAssumptions.noiGrowthRate,
      monthlyDebtService: opAssumptions.monthlyDebtService,
      exitProceeds: inputs.grossSalePrice,
      exitCosts: totalClosingCosts,
      exitTax: inputs.taxLiability,
      debtPayoff: totalDebtPayoff,
    });

    const totalCF = rows.reduce((s, r) => s + (r.values["Total Cash Flow"] || 0), 0);
    const avgMonthlyCF = rows.length > 0 ? totalCF / rows.length : 0;

    return {
      strategyName: "Net Proceeds",
      holdPeriodYears: opAssumptions.holdPeriodYears,
      lineItems,
      rows,
      summaryMetrics: [
        { label: "Total Cash Flow", value: `$${Math.round(totalCF).toLocaleString()}` },
        { label: "Avg Monthly CF", value: `$${Math.round(avgMonthlyCF).toLocaleString()}` },
        { label: "Net After Tax", value: `$${Math.round(netProceedsAfterTax).toLocaleString()}` },
        { label: "Total ROI", value: `${roi.toFixed(1)}%` },
      ],
    };
  }, [inputs, opAssumptions, totalClosingCosts, totalDebtPayoff, netProceedsAfterTax, roi]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button onClick={() => setLocation(basePath)} className="hover:text-primary transition-colors">
              Exit Strategy Suite
            </button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">Net Proceeds</span>
          </div>
          <h1 className="text-3xl font-bold" data-testid="net-proceeds-title">Net Proceeds Calculator</h1>
          <p className="text-muted-foreground mt-1">
            Cash-on-cash analysis at exit
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLocation(basePath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Strategies
          </Button>
          <Button variant="outline" data-testid="btn-export-proceeds">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Sale & Cost Inputs
            </CardTitle>
            <CardDescription>Enter sale price and associated costs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="grossSalePrice">Gross Sale Price ($)</Label>
              <Input
                id="grossSalePrice"
                type="number"
                value={inputs.grossSalePrice}
                onChange={(e) => setInputs({ ...inputs, grossSalePrice: Number(e.target.value) })}
                data-testid="input-gross-sale-price"
              />
            </div>
            
            <Separator />
            <h4 className="font-medium text-sm">Closing Costs</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brokerCommission">Broker Commission (%)</Label>
                <Input
                  id="brokerCommission"
                  type="number"
                  step="0.1"
                  value={inputs.brokerCommission}
                  onChange={(e) => setInputs({ ...inputs, brokerCommission: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transferTax">Transfer Tax (%)</Label>
                <Input
                  id="transferTax"
                  type="number"
                  step="0.1"
                  value={inputs.transferTax}
                  onChange={(e) => setInputs({ ...inputs, transferTax: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalFees">Legal Fees ($)</Label>
                <Input
                  id="legalFees"
                  type="number"
                  value={inputs.legalFees}
                  onChange={(e) => setInputs({ ...inputs, legalFees: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="otherClosingCosts">Other Closing Costs ($)</Label>
                <Input
                  id="otherClosingCosts"
                  type="number"
                  value={inputs.otherClosingCosts}
                  onChange={(e) => setInputs({ ...inputs, otherClosingCosts: Number(e.target.value) })}
                />
              </div>
            </div>
            
            <Separator />
            <h4 className="font-medium text-sm">Debt & Other</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="outstandingDebt">Outstanding Debt ($)</Label>
                <Input
                  id="outstandingDebt"
                  type="number"
                  value={inputs.outstandingDebt}
                  onChange={(e) => setInputs({ ...inputs, outstandingDebt: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prepaymentPenalty">Prepayment Penalty (%)</Label>
                <Input
                  id="prepaymentPenalty"
                  type="number"
                  step="0.1"
                  value={inputs.prepaymentPenalty}
                  onChange={(e) => setInputs({ ...inputs, prepaymentPenalty: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxLiability">Estimated Tax Liability ($)</Label>
                <Input
                  id="taxLiability"
                  type="number"
                  value={inputs.taxLiability}
                  onChange={(e) => setInputs({ ...inputs, taxLiability: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="escrowHoldback">Escrow Holdback ($)</Label>
                <Input
                  id="escrowHoldback"
                  type="number"
                  value={inputs.escrowHoldback}
                  onChange={(e) => setInputs({ ...inputs, escrowHoldback: Number(e.target.value) })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Net Proceeds Analysis</CardTitle>
            <CardDescription>Waterfall from gross sale to net proceeds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gross Sale Price</span>
                <span className="font-medium" data-testid="text-gross-sale">
                  ${inputs.grossSalePrice.toLocaleString()}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Less: Broker Commission</span>
                <span className="text-red-500">-${brokerFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Less: Transfer Tax</span>
                <span className="text-red-500">-${transferTaxAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Less: Legal Fees</span>
                <span className="text-red-500">-${inputs.legalFees.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Less: Other Closing Costs</span>
                <span className="text-red-500">-${inputs.otherClosingCosts.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Net Sale Proceeds</span>
                <span>${netSaleProceeds.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Less: Outstanding Debt</span>
                <span className="text-red-500">-${inputs.outstandingDebt.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Less: Prepayment Penalty</span>
                <span className="text-red-500">-${prepaymentAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Proceeds After Debt</span>
                <span>${proceedsAfterDebt.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Less: Tax Liability</span>
                <span className="text-red-500">-${inputs.taxLiability.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Less: Escrow Holdback</span>
                <span className="text-red-500">-${inputs.escrowHoldback.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Add: Prorations</span>
                <span className="text-green-500">+${inputs.prorations.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Net Proceeds</span>
                <span className="font-bold text-green-600" data-testid="text-net-proceeds">
                  ${netProceedsAfterTax.toLocaleString()}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Profit</span>
                <span className={`font-medium ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${totalProfit.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Return on Equity</span>
                <span className={`font-medium ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {roi.toFixed(2)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operating Assumptions</CardTitle>
          <CardDescription>Inputs for the monthly pro forma projection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Monthly NOI ($)</Label>
              <Input type="number" value={opAssumptions.monthlyNOI} onChange={(e) => setOpAssumptions({ ...opAssumptions, monthlyNOI: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>NOI Growth Rate (%)</Label>
              <Input type="number" step="0.1" value={opAssumptions.noiGrowthRate} onChange={(e) => setOpAssumptions({ ...opAssumptions, noiGrowthRate: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Monthly Debt Service ($)</Label>
              <Input type="number" value={opAssumptions.monthlyDebtService} onChange={(e) => setOpAssumptions({ ...opAssumptions, monthlyDebtService: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Hold Period (Years)</Label>
              <Input type="number" value={opAssumptions.holdPeriodYears} onChange={(e) => setOpAssumptions({ ...opAssumptions, holdPeriodYears: Number(e.target.value) })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <ExitProForma config={proFormaConfig} />
    </div>
  );
}
