import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExitProForma, type ProFormaCashFlowRow, type ProFormaLineItem } from "@/components/exit-strategies/ExitProForma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Award, ChevronRight, Download, Target, TrendingUp, DollarSign, Percent, Info, BarChart3, Shield, Calendar } from "lucide-react";
import type { ModelingProject } from "@shared/schema";

const METRIC_OPTIONS = [
  { value: "revenue", label: "Revenue", icon: TrendingUp, unit: "currency" },
  { value: "ebitda_noi", label: "EBITDA / NOI", icon: BarChart3, unit: "currency" },
  { value: "occupancy", label: "Occupancy", icon: Target, unit: "percent" },
  { value: "gross_profit", label: "Gross Profit", icon: DollarSign, unit: "currency" },
  { value: "retention", label: "Retention Rate", icon: Shield, unit: "percent" },
  { value: "slip_count", label: "Slip Count", icon: Target, unit: "number" },
] as const;

type MetricValue = typeof METRIC_OPTIONS[number]["value"];

interface YearEarnout {
  year: number;
  metric: MetricValue;
  threshold: number;
  probability: number;
  maxEarnout: number;
}

interface EarnoutProps {
  projectId: string;
}

function getMetricConfig(metric: MetricValue) {
  return METRIC_OPTIONS.find(m => m.value === metric) || METRIC_OPTIONS[0];
}

function formatThreshold(value: number, unit: string): string {
  if (unit === "percent") return `${value}%`;
  if (unit === "number") return value.toLocaleString();
  return `$${value.toLocaleString()}`;
}

export default function ExitEarnout({ projectId }: EarnoutProps) {
  const [, setLocation] = useLocation();

  const { data: project } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const basePath = `/modeling/projects/${projectId}/exit`;

  const [basePrice, setBasePrice] = useState(project?.purchasePrice ? Number(project.purchasePrice) : 8000000);
  const [earnoutPeriodYears, setEarnoutPeriodYears] = useState(3);
  const [overallMaxEarnout, setOverallMaxEarnout] = useState(2000000);
  const [usePerYearCaps, setUsePerYearCaps] = useState(true);
  const [opAssumptions, setOpAssumptions] = useState({
    monthlyNOI: 80000,
    noiGrowthRate: 3,
    monthlyDebtService: 35000,
    holdPeriodYears: 5,
    outstandingDebt: 5000000,
  });

  const [yearEarnouts, setYearEarnouts] = useState<YearEarnout[]>(() =>
    Array.from({ length: 3 }, (_, i) => ({
      year: i + 1,
      metric: i === 0 ? "ebitda_noi" as MetricValue : i === 1 ? "revenue" as MetricValue : "occupancy" as MetricValue,
      threshold: i === 0 ? 1200000 : i === 1 ? 5000000 : 85,
      probability: i === 0 ? 80 : i === 1 ? 65 : 50,
      maxEarnout: i === 0 ? 750000 : i === 1 ? 600000 : 400000,
    }))
  );

  const handlePeriodChange = (newPeriod: number) => {
    const clamped = Math.max(1, Math.min(10, newPeriod));
    setEarnoutPeriodYears(clamped);

    setYearEarnouts(prev => {
      if (clamped > prev.length) {
        const additions = Array.from({ length: clamped - prev.length }, (_, i) => {
          const yr = prev.length + i + 1;
          const lastRow = prev[prev.length - 1];
          return {
            year: yr,
            metric: lastRow?.metric || ("ebitda_noi" as MetricValue),
            threshold: lastRow?.threshold || 1000000,
            probability: Math.max(20, (lastRow?.probability || 60) - 10),
            maxEarnout: lastRow?.maxEarnout || 500000,
          };
        });
        return [...prev, ...additions];
      }
      return prev.slice(0, clamped);
    });
  };

  const updateYearEarnout = (year: number, field: keyof YearEarnout, value: number | string) => {
    setYearEarnouts(prev => prev.map(ye => {
      if (ye.year !== year) return ye;
      if (field === "metric") {
        const newMetric = value as MetricValue;
        const config = getMetricConfig(newMetric);
        let newThreshold = ye.threshold;
        if (config.unit === "percent" && ye.threshold > 100) {
          newThreshold = 85;
        } else if (config.unit === "currency" && ye.threshold <= 100) {
          newThreshold = 1000000;
        } else if (config.unit === "number" && ye.threshold > 10000) {
          newThreshold = 200;
        }
        return { ...ye, metric: newMetric, threshold: newThreshold };
      }
      return { ...ye, [field]: typeof value === "string" ? Number(value) : value };
    }));
  };

  const perYearCapTotal = yearEarnouts.reduce((sum, ye) => sum + ye.maxEarnout, 0);
  const effectiveMaxEarnout = usePerYearCaps
    ? Math.min(perYearCapTotal, overallMaxEarnout)
    : overallMaxEarnout;

  const totalProbabilityWeighted = usePerYearCaps
    ? yearEarnouts.reduce((sum, ye) => sum + ye.maxEarnout * (ye.probability / 100), 0)
    : yearEarnouts.reduce((sum, ye) => sum + (overallMaxEarnout / earnoutPeriodYears) * (ye.probability / 100), 0);
  const effectiveProbabilityWeighted = Math.min(totalProbabilityWeighted, overallMaxEarnout);

  const totalExpectedValue = basePrice + effectiveProbabilityWeighted;

  const avgProbability = yearEarnouts.length > 0
    ? yearEarnouts.reduce((s, ye) => s + ye.probability, 0) / yearEarnouts.length
    : 0;

  const proFormaConfig = useMemo(() => {
    const totalMonths = opAssumptions.holdPeriodYears * 12;
    const rows: ProFormaCashFlowRow[] = [];
    const monthlyGrowth = Math.pow(1 + opAssumptions.noiGrowthRate / 100, 1 / 12);

    const yearPayments: number[] = yearEarnouts.map(ye => {
      if (usePerYearCaps) {
        return ye.maxEarnout * (ye.probability / 100);
      }
      return (overallMaxEarnout / earnoutPeriodYears) * (ye.probability / 100);
    });

    let cumulativePaid = 0;
    const cappedYearPayments = yearPayments.map(pmt => {
      const remaining = overallMaxEarnout - cumulativePaid;
      const capped = Math.min(pmt, Math.max(0, remaining));
      cumulativePaid += capped;
      return capped;
    });

    for (let m = 1; m <= totalMonths; m++) {
      const year = Math.ceil(m / 12);
      const month = ((m - 1) % 12) + 1;
      const noi = opAssumptions.monthlyNOI * Math.pow(monthlyGrowth, m - 1);
      const debtSvc = opAssumptions.monthlyDebtService;
      const netOpCF = noi - debtSvc;
      const isExitMonth = m === totalMonths;

      const values: Record<string, number> = {
        "NOI": noi,
        "Debt Service": -debtSvc,
        "Net Operating CF": netOpCF,
      };

      let earnoutCF = 0;
      if (month === 12 && year <= earnoutPeriodYears) {
        earnoutCF = cappedYearPayments[year - 1] || 0;
      }
      values["Earnout Payments"] = earnoutCF;

      if (isExitMonth) {
        values["Sale Proceeds"] = basePrice;
        values["Debt Payoff"] = -opAssumptions.outstandingDebt;
      }

      values["Total Cash Flow"] = netOpCF + earnoutCF + (isExitMonth ? basePrice - opAssumptions.outstandingDebt : 0);
      rows.push({ period: m, year, month, values, isExitMonth });
    }

    const lineItems: ProFormaLineItem[] = [
      { label: "NOI" },
      { label: "Debt Service" },
      { label: "Net Operating CF", isBold: true },
      { label: "Earnout Payments" },
      { label: "Sale Proceeds" },
      { label: "Debt Payoff" },
      { label: "Total Cash Flow", isSubtotal: true, isBold: true },
    ];

    const totalCF = rows.reduce((s, r) => s + (r.values["Total Cash Flow"] || 0), 0);

    return {
      strategyName: "Earnout",
      holdPeriodYears: opAssumptions.holdPeriodYears,
      lineItems,
      rows,
      summaryMetrics: [
        { label: "Total Cash Flow", value: `$${Math.round(totalCF).toLocaleString()}` },
        { label: "Base Price", value: `$${basePrice.toLocaleString()}` },
        { label: "Expected Earnout", value: `$${Math.round(effectiveProbabilityWeighted).toLocaleString()}` },
        { label: "Total Value", value: `$${Math.round(totalExpectedValue).toLocaleString()}` },
      ],
    };
  }, [opAssumptions, yearEarnouts, basePrice, earnoutPeriodYears, effectiveProbabilityWeighted, totalExpectedValue, usePerYearCaps, overallMaxEarnout]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button onClick={() => setLocation(basePath)} className="hover:text-primary transition-colors">
              Exit Strategy Suite
            </button>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">Earnout Modeling</span>
          </div>
          <h1 className="text-3xl font-bold" data-testid="earnout-title">Earnout Modeling</h1>
          <p className="text-muted-foreground mt-1">
            Year-by-year contingent payment structures with milestone thresholds and probability weighting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLocation(basePath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Strategies
          </Button>
          <Button variant="outline" data-testid="btn-export-earnout">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Base Purchase Price</p>
            <p className="num text-2xl font-bold" data-testid="text-base-price">
              ${basePrice.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Earnout Period</p>
            <p className="num text-2xl font-bold text-blue-600">
              {earnoutPeriodYears} Year{earnoutPeriodYears !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Max Earnout Possible</p>
            <p className="num text-2xl font-bold text-amber-600">
              ${effectiveMaxEarnout.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Probability-Weighted</p>
            <p className="num text-2xl font-bold text-purple-600">
              ${Math.round(effectiveProbabilityWeighted).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Expected Total Value</p>
            <p className="num text-2xl font-bold text-green-600" data-testid="text-expected-value">
              ${Math.round(totalExpectedValue).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Deal Structure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="basePrice">Base Purchase Price ($)</Label>
              <Input
                id="basePrice"
                type="number"
                value={basePrice}
                onChange={(e) => setBasePrice(Number(e.target.value))}
                data-testid="input-base-price"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="earnoutPeriod">Earnout Period (Years)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Number of years the earnout is in effect. Each year gets its own achievement probability, metric threshold, and optional cap.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="earnoutPeriod"
                type="number"
                min={1}
                max={10}
                value={earnoutPeriodYears}
                onChange={(e) => handlePeriodChange(Number(e.target.value))}
                data-testid="input-earnout-period"
              />
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="overallMax">Overall Maximum Earnout ($)</Label>
                <Input
                  id="overallMax"
                  type="number"
                  value={overallMaxEarnout}
                  onChange={(e) => setOverallMaxEarnout(Number(e.target.value))}
                  data-testid="input-overall-max"
                />
                <p className="text-xs text-muted-foreground">
                  Aggregate cap on total earnout payments across all years
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="perYearCaps" className="text-sm">Per-Year Caps</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>When enabled, each year has its own maximum earnout in addition to the overall aggregate cap. The effective maximum is the lesser of the per-year total and the overall cap.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Switch
                  id="perYearCaps"
                  checked={usePerYearCaps}
                  onCheckedChange={setUsePerYearCaps}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operating Assumptions</CardTitle>
            <CardDescription>Inputs for the monthly pro forma projection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monthly NOI ($)</Label>
                <Input type="number" value={opAssumptions.monthlyNOI} onChange={(e) => setOpAssumptions({ ...opAssumptions, monthlyNOI: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>NOI Growth (%)</Label>
                <Input type="number" step="0.1" value={opAssumptions.noiGrowthRate} onChange={(e) => setOpAssumptions({ ...opAssumptions, noiGrowthRate: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Debt Service ($/mo)</Label>
                <Input type="number" value={opAssumptions.monthlyDebtService} onChange={(e) => setOpAssumptions({ ...opAssumptions, monthlyDebtService: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Hold Period (yrs)</Label>
                <Input type="number" value={opAssumptions.holdPeriodYears} onChange={(e) => setOpAssumptions({ ...opAssumptions, holdPeriodYears: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Outstanding Debt ($)</Label>
              <Input type="number" value={opAssumptions.outstandingDebt} onChange={(e) => setOpAssumptions({ ...opAssumptions, outstandingDebt: Number(e.target.value) })} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Year-by-Year Earnout Milestones
            </CardTitle>
            <CardDescription>
              Define achievement thresholds, probabilities, and payment caps for each earnout year
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-sm">
            {earnoutPeriodYears} Year{earnoutPeriodYears !== 1 ? "s" : ""}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="hidden md:grid grid-cols-[80px_1fr_1fr_140px_140px] gap-3 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div>Year</div>
              <div>Threshold Metric</div>
              <div>Target Value</div>
              <div>Probability</div>
              {usePerYearCaps && <div>Max Earnout</div>}
            </div>

            {yearEarnouts.map((ye) => {
              const metricCfg = getMetricConfig(ye.metric);
              const MetricIcon = metricCfg.icon;
              const isPercent = metricCfg.unit === "percent";
              const isNumber = metricCfg.unit === "number";
              const yearMaxForCalc = usePerYearCaps ? ye.maxEarnout : (overallMaxEarnout / earnoutPeriodYears);
              const expectedVal = yearMaxForCalc * (ye.probability / 100);

              return (
                <div
                  key={ye.year}
                  className="border rounded-lg p-4 bg-card hover:bg-accent/30 transition-colors"
                  data-testid={`earnout-year-${ye.year}`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-[80px_1fr_1fr_140px_140px] gap-3 items-end">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold text-lg">
                        {ye.year}
                      </div>
                      <span className="md:hidden text-sm font-medium text-muted-foreground">Year {ye.year}</span>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground md:hidden">Threshold Metric</Label>
                      <Select
                        value={ye.metric}
                        onValueChange={(val) => updateYearEarnout(ye.year, "metric", val)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {METRIC_OPTIONS.map((opt) => {
                            const Icon = opt.icon;
                            return (
                              <SelectItem key={opt.value} value={opt.value}>
                                <span className="flex items-center gap-2">
                                  <Icon className="h-3.5 w-3.5" />
                                  {opt.label}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground md:hidden">Target Value</Label>
                      <div className="relative">
                        {!isPercent && !isNumber && (
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        )}
                        {isPercent && (
                          <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        )}
                        <Input
                          type="number"
                          min={0}
                          max={isPercent ? 100 : undefined}
                          step={isPercent ? 0.5 : isNumber ? 1 : 1000}
                          value={ye.threshold}
                          onChange={(e) => updateYearEarnout(ye.year, "threshold", Number(e.target.value))}
                          className={`${!isPercent && !isNumber ? "pl-9" : ""} ${isPercent ? "pr-9" : ""}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground md:hidden">Probability (%)</Label>
                      <div className="space-y-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={ye.probability}
                          onChange={(e) => updateYearEarnout(ye.year, "probability", Math.min(100, Math.max(0, Number(e.target.value))))}
                        />
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              ye.probability >= 70 ? "bg-green-500" :
                              ye.probability >= 40 ? "bg-amber-500" : "bg-red-500"
                            }`}
                            style={{ width: `${ye.probability}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {usePerYearCaps && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground md:hidden">Max Earnout ($)</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            min={0}
                            value={ye.maxEarnout}
                            onChange={(e) => updateYearEarnout(ye.year, "maxEarnout", Number(e.target.value))}
                            className="pl-9"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <MetricIcon className="h-3 w-3" />
                      {metricCfg.label} {isPercent ? "≥" : "≥"} {formatThreshold(ye.threshold, metricCfg.unit)}
                    </span>
                    <span>
                      Achievement: <span className={`font-medium ${ye.probability >= 70 ? "text-green-600" : ye.probability >= 40 ? "text-amber-600" : "text-red-600"}`}>
                        {ye.probability}%
                      </span>
                    </span>
                    <span>
                      Expected: <span className="num font-medium text-purple-600">${Math.round(expectedVal).toLocaleString()}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Earnout Summary</CardTitle>
          <CardDescription>
            Year-by-year breakdown with probability weighting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Year</th>
                  <th className="text-left py-2 px-4">Metric</th>
                  <th className="text-right py-2 px-4">Threshold</th>
                  <th className="text-right py-2 px-4">Probability</th>
                  {usePerYearCaps && <th className="text-right py-2 px-4">Max Earnout</th>}
                  <th className="text-right py-2 px-4">Expected Value</th>
                </tr>
              </thead>
              <tbody>
                {yearEarnouts.map((ye) => {
                  const metricCfg = getMetricConfig(ye.metric);
                  const yearMax = usePerYearCaps ? ye.maxEarnout : (overallMaxEarnout / earnoutPeriodYears);
                  const expectedVal = yearMax * (ye.probability / 100);
                  return (
                    <tr key={ye.year} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-4 font-medium">Year {ye.year}</td>
                      <td className="py-2 px-4">{metricCfg.label}</td>
                      <td className="num text-right py-2 px-4">{formatThreshold(ye.threshold, metricCfg.unit)}</td>
                      <td className="num text-right py-2 px-4">
                        <Badge variant="outline" className={`${
                          ye.probability >= 70 ? "text-green-600 border-green-300" :
                          ye.probability >= 40 ? "text-amber-600 border-amber-300" : "text-red-600 border-red-300"
                        }`}>
                          {ye.probability}%
                        </Badge>
                      </td>
                      {usePerYearCaps && (
                        <td className="num text-right py-2 px-4">${ye.maxEarnout.toLocaleString()}</td>
                      )}
                      <td className="num text-right py-2 px-4 text-purple-600 font-medium">
                        ${Math.round(expectedVal).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                <tr className="font-semibold bg-muted">
                  <td className="py-2 px-4" colSpan={2}>Total</td>
                  <td className="text-right py-2 px-4">-</td>
                  <td className="num text-right py-2 px-4">
                    <Badge variant="outline">{Math.round(avgProbability)}% avg</Badge>
                  </td>
                  {usePerYearCaps && (
                    <td className="num text-right py-2 px-4">${perYearCapTotal.toLocaleString()}</td>
                  )}
                  <td className="num text-right py-2 px-4 text-purple-600">
                    ${Math.round(effectiveProbabilityWeighted).toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {usePerYearCaps && perYearCapTotal > overallMaxEarnout && (
            <div className="mt-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
              <strong>Cap Applied:</strong> Sum of per-year caps (${perYearCapTotal.toLocaleString()}) exceeds the
              overall maximum (${overallMaxEarnout.toLocaleString()}). The effective maximum is capped at ${effectiveMaxEarnout.toLocaleString()}.
            </div>
          )}
        </CardContent>
      </Card>

      <ExitProForma config={proFormaConfig} />
    </div>
  );
}
