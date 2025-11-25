import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, TrendingUp, ChevronRight, Download } from "lucide-react";
import type { ModelingProject } from "@shared/schema";

interface SensitivityProps {
  projectId: string;
}

export default function ExitSensitivity({ projectId }: SensitivityProps) {
  const [, setLocation] = useLocation();
  
  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const basePath = `/modeling/projects/${projectId}/exit`;

  const [baseCase, setBaseCase] = useState({
    exitNOI: 1200000,
    exitCapRate: 6.5,
    purchasePrice: project?.purchasePrice ? Number(project.purchasePrice) : 10000000,
    holdingPeriod: 5
  });

  const [ranges, setRanges] = useState({
    noiLow: -15,
    noiHigh: 15,
    noiStep: 5,
    capRateLow: -1,
    capRateHigh: 1,
    capRateStep: 0.25
  });

  const calculateExitPrice = (noi: number, capRate: number) => {
    return noi / (capRate / 100);
  };

  const calculateProfit = (exitPrice: number) => {
    return exitPrice - baseCase.purchasePrice;
  };

  const calculateIRR = (profit: number) => {
    const totalReturn = baseCase.purchasePrice + profit;
    return (Math.pow(totalReturn / baseCase.purchasePrice, 1 / baseCase.holdingPeriod) - 1) * 100;
  };

  const generateNoiRange = () => {
    const range = [];
    for (let pct = ranges.noiLow; pct <= ranges.noiHigh; pct += ranges.noiStep) {
      range.push(pct);
    }
    return range;
  };

  const generateCapRateRange = () => {
    const range = [];
    for (let delta = ranges.capRateLow; delta <= ranges.capRateHigh; delta += ranges.capRateStep) {
      range.push(baseCase.exitCapRate + delta);
    }
    return range;
  };

  const noiRange = generateNoiRange();
  const capRateRange = generateCapRateRange();

  const baseExitPrice = calculateExitPrice(baseCase.exitNOI, baseCase.exitCapRate);
  const baseProfit = calculateProfit(baseExitPrice);
  const baseIRR = calculateIRR(baseProfit);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button onClick={() => setLocation(basePath)} className="hover:text-primary transition-colors">
              Exit Strategy
            </button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">Sensitivity Analysis</span>
          </div>
          <h1 className="text-3xl font-bold" data-testid="sensitivity-title">Sensitivity Analysis</h1>
          <p className="text-muted-foreground mt-1">
            What-if scenario exploration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLocation(basePath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="outline" data-testid="btn-export-sensitivity">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Base Exit Price</p>
            <p className="text-2xl font-bold" data-testid="text-base-exit-price">
              ${baseExitPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Base Profit</p>
            <p className={`text-2xl font-bold ${baseProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${baseProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Base IRR</p>
            <p className="text-2xl font-bold text-blue-600">
              {baseIRR.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Holding Period</p>
            <p className="text-2xl font-bold">
              {baseCase.holdingPeriod} years
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Base Case Assumptions
          </CardTitle>
          <CardDescription>Configure the base scenario parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="exitNOI">Exit NOI ($)</Label>
              <Input
                id="exitNOI"
                type="number"
                value={baseCase.exitNOI}
                onChange={(e) => setBaseCase({ ...baseCase, exitNOI: Number(e.target.value) })}
                data-testid="input-exit-noi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exitCapRate">Exit Cap Rate (%)</Label>
              <Input
                id="exitCapRate"
                type="number"
                step="0.1"
                value={baseCase.exitCapRate}
                onChange={(e) => setBaseCase({ ...baseCase, exitCapRate: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchasePrice">Purchase Price ($)</Label>
              <Input
                id="purchasePrice"
                type="number"
                value={baseCase.purchasePrice}
                onChange={(e) => setBaseCase({ ...baseCase, purchasePrice: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="holdingPeriod">Holding Period (yrs)</Label>
              <Input
                id="holdingPeriod"
                type="number"
                value={baseCase.holdingPeriod}
                onChange={(e) => setBaseCase({ ...baseCase, holdingPeriod: Number(e.target.value) })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exit Price Sensitivity Matrix</CardTitle>
          <CardDescription>Exit price by NOI change and cap rate</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="border p-2 bg-muted">NOI \ Cap Rate</th>
                  {capRateRange.map((capRate) => (
                    <th key={capRate} className="border p-2 bg-muted">
                      {capRate.toFixed(2)}%
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {noiRange.map((noiPct) => {
                  const adjustedNoi = baseCase.exitNOI * (1 + noiPct / 100);
                  return (
                    <tr key={noiPct}>
                      <td className="border p-2 bg-muted font-medium">
                        {noiPct >= 0 ? '+' : ''}{noiPct}%
                      </td>
                      {capRateRange.map((capRate) => {
                        const exitPrice = calculateExitPrice(adjustedNoi, capRate);
                        const isBase = noiPct === 0 && Math.abs(capRate - baseCase.exitCapRate) < 0.01;
                        return (
                          <td 
                            key={capRate} 
                            className={`border p-2 text-right ${isBase ? 'bg-blue-100 dark:bg-blue-900 font-bold' : ''}`}
                            data-testid={`cell-price-${noiPct}-${capRate.toFixed(2)}`}
                          >
                            ${(exitPrice / 1000000).toFixed(2)}M
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IRR Sensitivity Matrix</CardTitle>
          <CardDescription>IRR by NOI change and cap rate</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="border p-2 bg-muted">NOI \ Cap Rate</th>
                  {capRateRange.map((capRate) => (
                    <th key={capRate} className="border p-2 bg-muted">
                      {capRate.toFixed(2)}%
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {noiRange.map((noiPct) => {
                  const adjustedNoi = baseCase.exitNOI * (1 + noiPct / 100);
                  return (
                    <tr key={noiPct}>
                      <td className="border p-2 bg-muted font-medium">
                        {noiPct >= 0 ? '+' : ''}{noiPct}%
                      </td>
                      {capRateRange.map((capRate) => {
                        const exitPrice = calculateExitPrice(adjustedNoi, capRate);
                        const profit = calculateProfit(exitPrice);
                        const irr = calculateIRR(profit);
                        const isBase = noiPct === 0 && Math.abs(capRate - baseCase.exitCapRate) < 0.01;
                        const irrColor = irr >= 15 ? 'text-green-600' : irr >= 8 ? 'text-blue-600' : 'text-red-600';
                        return (
                          <td 
                            key={capRate} 
                            className={`border p-2 text-right ${irrColor} ${isBase ? 'bg-blue-100 dark:bg-blue-900 font-bold' : ''}`}
                            data-testid={`cell-irr-${noiPct}-${capRate.toFixed(2)}`}
                          >
                            {irr.toFixed(1)}%
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analysis Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Upside Scenario</h4>
              <p className="text-sm text-muted-foreground mb-1">+15% NOI, -1% Cap Rate</p>
              <p className="text-lg font-bold text-green-600">
                IRR: {calculateIRR(calculateProfit(calculateExitPrice(baseCase.exitNOI * 1.15, baseCase.exitCapRate - 1))).toFixed(1)}%
              </p>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <h4 className="font-medium mb-2">Base Case</h4>
              <p className="text-sm text-muted-foreground mb-1">Current assumptions</p>
              <p className="text-lg font-bold text-blue-600">
                IRR: {baseIRR.toFixed(1)}%
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Downside Scenario</h4>
              <p className="text-sm text-muted-foreground mb-1">-15% NOI, +1% Cap Rate</p>
              <p className="text-lg font-bold text-red-600">
                IRR: {calculateIRR(calculateProfit(calculateExitPrice(baseCase.exitNOI * 0.85, baseCase.exitCapRate + 1))).toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
