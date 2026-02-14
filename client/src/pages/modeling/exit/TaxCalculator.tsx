import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Calculator, ChevronRight, Download } from "lucide-react";
import type { ModelingProject } from "@shared/schema";
import { ExitProForma, buildExitProFormaRows } from "@/components/exit-strategies/ExitProForma";

interface TaxCalculatorProps {
  projectId: string;
}

export default function ExitTaxCalculator({ projectId }: TaxCalculatorProps) {
  const [, setLocation] = useLocation();
  
  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const basePath = `/modeling/projects/${projectId}/exit`;

  const [inputs, setInputs] = useState({
    salePrice: project?.purchasePrice ? Number(project.purchasePrice) * 1.3 : 10000000,
    originalBasis: project?.purchasePrice ? Number(project.purchasePrice) : 8000000,
    accumulatedDepreciation: 500000,
    sellingCosts: 300000,
    federalCapGainsRate: 20,
    stateCapGainsRate: 9.3,
    niitRate: 3.8,
    depreciationRecaptureRate: 25,
    holdingPeriodYears: 5
  });

  const [opAssumptions, setOpAssumptions] = useState({
    monthlyNOI: 100000,
    noiGrowthRate: 3,
    monthlyDebtService: 40000,
    outstandingDebt: 6000000,
  });

  const adjustedBasis = inputs.originalBasis - inputs.accumulatedDepreciation;
  const netSalePrice = inputs.salePrice - inputs.sellingCosts;
  const totalGain = netSalePrice - adjustedBasis;
  const deprecRecapture = Math.min(inputs.accumulatedDepreciation, totalGain);
  const capitalGain = Math.max(0, totalGain - deprecRecapture);
  
  const deprecRecaptureTax = deprecRecapture * (inputs.depreciationRecaptureRate / 100);
  const federalCapGainsTax = capitalGain * (inputs.federalCapGainsRate / 100);
  const stateCapGainsTax = totalGain * (inputs.stateCapGainsRate / 100);
  const niitTax = totalGain * (inputs.niitRate / 100);
  
  const totalTax = deprecRecaptureTax + federalCapGainsTax + stateCapGainsTax + niitTax;
  const netProceeds = netSalePrice - totalTax;
  const effectiveRate = totalGain > 0 ? (totalTax / totalGain) * 100 : 0;

  const proFormaConfig = useMemo(() => {
    const { rows, lineItems } = buildExitProFormaRows({
      holdPeriodYears: inputs.holdingPeriodYears,
      monthlyNOI: opAssumptions.monthlyNOI,
      noiGrowthRate: opAssumptions.noiGrowthRate,
      monthlyDebtService: opAssumptions.monthlyDebtService,
      exitProceeds: inputs.salePrice,
      exitCosts: inputs.sellingCosts,
      exitTax: totalTax,
      debtPayoff: opAssumptions.outstandingDebt,
    });

    const totalCF = rows.reduce((s, r) => s + (r.values["Total Cash Flow"] || 0), 0);
    const avgMonthlyCF = rows.length > 0 ? totalCF / rows.length : 0;

    return {
      strategyName: "Cash Sale",
      holdPeriodYears: inputs.holdingPeriodYears,
      lineItems,
      rows,
      summaryMetrics: [
        { label: "Total Cash Flow", value: `$${Math.round(totalCF).toLocaleString()}` },
        { label: "Avg Monthly CF", value: `$${Math.round(avgMonthlyCF).toLocaleString()}` },
        { label: "Total Tax", value: `$${Math.round(totalTax).toLocaleString()}` },
        { label: "Net Proceeds", value: `$${Math.round(netProceeds).toLocaleString()}` },
      ],
    };
  }, [inputs, opAssumptions, totalTax, netProceeds]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button onClick={() => setLocation(basePath)} className="hover:text-primary transition-colors">
              Exit Strategy Suite
            </button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">Tax Calculator</span>
          </div>
          <h1 className="text-3xl font-bold" data-testid="tax-calculator-title">Tax Calculator</h1>
          <p className="text-muted-foreground mt-1">
            Capital gains and depreciation recapture analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLocation(basePath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Strategies
          </Button>
          <Button variant="outline" data-testid="btn-export-tax">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Sale Inputs
            </CardTitle>
            <CardDescription>Enter the sale details and tax rates</CardDescription>
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
                <Label htmlFor="originalBasis">Original Cost Basis ($)</Label>
                <Input
                  id="originalBasis"
                  type="number"
                  value={inputs.originalBasis}
                  onChange={(e) => setInputs({ ...inputs, originalBasis: Number(e.target.value) })}
                  data-testid="input-original-basis"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accumulatedDepreciation">Accumulated Depreciation ($)</Label>
                <Input
                  id="accumulatedDepreciation"
                  type="number"
                  value={inputs.accumulatedDepreciation}
                  onChange={(e) => setInputs({ ...inputs, accumulatedDepreciation: Number(e.target.value) })}
                  data-testid="input-accumulated-depreciation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sellingCosts">Selling Costs ($)</Label>
                <Input
                  id="sellingCosts"
                  type="number"
                  value={inputs.sellingCosts}
                  onChange={(e) => setInputs({ ...inputs, sellingCosts: Number(e.target.value) })}
                  data-testid="input-selling-costs"
                />
              </div>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="federalCapGainsRate">Federal Cap Gains Rate (%)</Label>
                <Input
                  id="federalCapGainsRate"
                  type="number"
                  step="0.1"
                  value={inputs.federalCapGainsRate}
                  onChange={(e) => setInputs({ ...inputs, federalCapGainsRate: Number(e.target.value) })}
                  data-testid="input-federal-rate"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stateCapGainsRate">State Cap Gains Rate (%)</Label>
                <Input
                  id="stateCapGainsRate"
                  type="number"
                  step="0.1"
                  value={inputs.stateCapGainsRate}
                  onChange={(e) => setInputs({ ...inputs, stateCapGainsRate: Number(e.target.value) })}
                  data-testid="input-state-rate"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="niitRate">NIIT Rate (%)</Label>
                <Input
                  id="niitRate"
                  type="number"
                  step="0.1"
                  value={inputs.niitRate}
                  onChange={(e) => setInputs({ ...inputs, niitRate: Number(e.target.value) })}
                  data-testid="input-niit-rate"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="depreciationRecaptureRate">Depreciation Recapture Rate (%)</Label>
                <Input
                  id="depreciationRecaptureRate"
                  type="number"
                  step="0.1"
                  value={inputs.depreciationRecaptureRate}
                  onChange={(e) => setInputs({ ...inputs, depreciationRecaptureRate: Number(e.target.value) })}
                  data-testid="input-depreciation-rate"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax Analysis Results</CardTitle>
            <CardDescription>Calculated tax liability breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net Sale Price</span>
                <span className="num font-medium" data-testid="text-net-sale-price">
                  ${netSalePrice.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Adjusted Basis</span>
                <span className="num font-medium">${adjustedBasis.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Gain</span>
                <span className="num font-medium text-green-600">${totalGain.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Depreciation Recapture</span>
                <span className="num font-medium">${deprecRecapture.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capital Gain</span>
                <span className="num font-medium">${capitalGain.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Depreciation Recapture Tax</span>
                <span className="num font-medium text-red-500">${deprecRecaptureTax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Federal Capital Gains Tax</span>
                <span className="num font-medium text-red-500">${federalCapGainsTax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">State Capital Gains Tax</span>
                <span className="num font-medium text-red-500">${stateCapGainsTax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">NIIT Tax</span>
                <span className="num font-medium text-red-500">${niitTax.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Total Tax Liability</span>
                <span className="num font-bold text-red-600" data-testid="text-total-tax">
                  ${totalTax.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Net Proceeds After Tax</span>
                <span className="num font-bold text-green-600" data-testid="text-net-proceeds">
                  ${netProceeds.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Effective Tax Rate</span>
                <span className="num font-medium">{effectiveRate.toFixed(2)}%</span>
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
              <Label>Outstanding Debt ($)</Label>
              <Input type="number" value={opAssumptions.outstandingDebt} onChange={(e) => setOpAssumptions({ ...opAssumptions, outstandingDebt: Number(e.target.value) })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <ExitProForma config={proFormaConfig} />
    </div>
  );
}
