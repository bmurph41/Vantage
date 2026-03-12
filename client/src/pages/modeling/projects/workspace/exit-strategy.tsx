import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  TrendingUp,
  FileSpreadsheet,
  DollarSign,
  Percent,
  Link2,
  Plus,
  RefreshCcw
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartTooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import type { ModelingProject, ModelingCase } from "@shared/schema";
import type { ProjectConfig, ProFormaData } from '@/types/modeling';
import { WorkflowNavigation } from '@/components/modeling/workflow-navigation';
import { defaultScenarios, type ScenarioConfig } from '@/lib/modeling-scenarios';
import { useExitStrategiesStore } from "@/stores/exitStrategiesStore";

import {
  exitTools,
  SummaryDashboardPanel,
  TaxAndProceedsPanel,
  Exchange1031Panel,
  DSTAnalysisPanel,
  SellerFinancingPanel,
  EarnoutPanel,
  WaterfallPanel,
  IRRCalculatorPanel,
  SensitivityPanel,
  CrossStrategyComparisonPanel,
  AdvisorInsightsPanel,
} from "@/pages/modeling/exit-strategies";
import { ExportPdfButton } from '@/components/ui/export-pdf-button';

interface WorkspaceExitStrategyProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

export default function WorkspaceExitStrategy({ projectId, onTabChange }: WorkspaceExitStrategyProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const hydrationRef = useRef<string | null>(null);

  const { setMode, bulkUpdateMaster } = useExitStrategiesStore();

  const { data: cases = [] } = useQuery<ModelingCase[]>({
    queryKey: ['/api/modeling/projects', projectId, 'cases'],
  });

  const { data: project, isLoading: projectLoading } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const { data: config } = useQuery<ProjectConfig>({
    queryKey: ['/api/modeling/projects', projectId, 'config'],
  });

  const { data: proForma } = useQuery<ProFormaData>({
    queryKey: ['/api/modeling/projects', projectId, 'pro-forma'],
  });

  useEffect(() => {
    if (cases.length > 0 && !activeCaseId) {
      const defaultCase = cases.find(c => c.isDefault) || cases[0];
      setActiveCaseId(defaultCase.id);
    }
  }, [cases, activeCaseId]);

  const activeCase = cases.find(c => c.id === activeCaseId) || cases[0];

  const holdPeriod = config?.holdPeriod || 5;
  const purchasePrice = Number(project?.purchasePrice) || 0;

  const dealPricingExitCapRate = (() => {
    const cm = (project as any)?.customMetrics;
    const dp = cm?.dealPricing;
    if (dp?.exitCapRate !== undefined && dp.exitCapRate !== null && !isNaN(Number(dp.exitCapRate)) && Number(dp.exitCapRate) > 0) {
      return Number(dp.exitCapRate);
    }
    return null;
  })();

  const currentScenario: ScenarioConfig = activeCase ? {
    name: activeCase.name,
    description: activeCase.description || '',
    revenueGrowth: parseFloat(activeCase.revenueGrowthRate || '0') * 100,
    expenseGrowth: parseFloat(activeCase.expenseGrowthRate || '0') * 100,
    exitCapRate: parseFloat(activeCase.exitCapRate || '0') * 100 || dealPricingExitCapRate || 7.5,
  } : {
    ...defaultScenarios.base,
    exitCapRate: dealPricingExitCapRate || defaultScenarios.base.exitCapRate,
  };

  const exitCapRate = currentScenario.exitCapRate || 7.5;
  const year1NOI = proForma?.year1NOI || Number(project?.ebitda) || 0;
  const netGrowthRate = (currentScenario.revenueGrowth - currentScenario.expenseGrowth) / 100;
  const exitNOI = year1NOI * Math.pow(1 + netGrowthRate, holdPeriod);
  const rawSalePrice = exitCapRate > 0 ? exitNOI / (exitCapRate / 100) : 0;
  const calculatedSalePrice = Number.isFinite(rawSalePrice) && rawSalePrice > 0 ? rawSalePrice : purchasePrice * 1.3;

  useEffect(() => {
    const hydrationKey = `${projectId}-${activeCaseId}-${purchasePrice}-${holdPeriod}-${calculatedSalePrice}`;
    if (hydrationRef.current === hydrationKey) return;
    if (!project) return;

    hydrationRef.current = hydrationKey;

    setMode({
      type: 'project-linked',
      projectId,
      lastSyncedAt: new Date().toISOString(),
      isDirty: false,
    });

    bulkUpdateMaster({
      salePrice: calculatedSalePrice || purchasePrice * 1.3,
      costBasis: purchasePrice,
      holdingPeriod: holdPeriod,
      currentDebtBalance: Number((project as any).currentDebtBalance) || 0,
      depreciationTaken: Number((project as any).depreciationTaken) || 500000,
      capitalImprovements: Number((project as any).capitalImprovements) || 200000,
    });
  }, [projectId, activeCaseId, purchasePrice, holdPeriod, calculatedSalePrice, project, setMode, bulkUpdateMaster]);

  useEffect(() => {
    return () => {
      setMode({ type: 'standalone' });
    };
  }, [setMode]);

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div ref={pdfRef} className="space-y-3">
      {onTabChange && (
        <WorkflowNavigation currentTab="exit" onNavigate={onTabChange} />
      )}
      
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold" data-testid="exit-strategy-title">Exit Strategy Suite</h2>
          <p className="text-sm text-muted-foreground">
            Institutional-grade exit analysis for {project?.marinaName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportPdfButton contentRef={pdfRef} filename="exit-strategy" title="Exit Strategy" />
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Scenario:</Label>
            {cases.length > 0 ? (
              <Select value={activeCaseId || ''} onValueChange={(v) => setActiveCaseId(v)}>
                <SelectTrigger className="w-52" data-testid="select-exit-scenario">
                  <SelectValue placeholder="Select scenario" />
                </SelectTrigger>
                <SelectContent>
                  {cases.filter(c => c.isEnabled).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-2 w-2 rounded-full" 
                          style={{ backgroundColor: ({ blue: '#3b82f6', green: '#22c55e', red: '#ef4444', amber: '#f59e0b', purple: '#a855f7', cyan: '#06b6d4', orange: '#f97316' } as Record<string, string>)[c.color || 'blue'] || '#3b82f6' }}
                        />
                        {c.name}
                        {c.isDefault && <Badge variant="outline" className="ml-1 text-[10px] py-0 px-1">Default</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                No scenarios configured
              </Badge>
            )}
            {cases.length === 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onTabChange?.('scenarios')}
              >
                <Plus className="h-4 w-4 mr-1" /> Create Scenario
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
        <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <span>
          <span className="font-medium text-blue-800 dark:text-blue-200">Project-Linked</span> — 
          Sale price from {currentScenario.name}: Exit NOI ({formatCurrency(exitNOI)}) ÷ Cap Rate ({exitCapRate}%) = {formatCurrency(calculatedSalePrice)}.
          All inputs derived from Deal Pricing, Assumptions, and Pro Forma tabs.
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => onTabChange?.('pricing')}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Building2 className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Purchase Price
                        <Link2 className="h-3 w-3 text-blue-400" />
                      </p>
                      <p className="text-lg font-bold" data-testid="text-exit-purchase-price">
                        {purchasePrice > 0 ? formatCurrency(purchasePrice) : <span className="text-muted-foreground text-sm">Not set</span>}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Click to update in Pricing tab</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-50 rounded-lg">
                <TrendingUp className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Exit NOI (Yr {holdPeriod})</p>
                <p className="text-lg font-bold" data-testid="text-exit-noi">
                  {formatCurrency(exitNOI)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Percent className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Exit Cap Rate</p>
                <p className="text-lg font-bold" data-testid="text-exit-cap-rate">
                  {exitCapRate}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="col-span-full grid grid-cols-2 md:grid-cols-5 divide-x divide-border border rounded-lg overflow-hidden">
          {[
            { label: 'Purchase Price', value: purchasePrice > 0 ? formatCurrency(purchasePrice) : '—', accent: 'text-foreground', bg: '' },
            { label: `Exit NOI (Yr ${holdPeriod})`, value: formatCurrency(exitNOI), accent: 'text-foreground', bg: '' },
            { label: `Sale Price`, value: formatCurrency(calculatedSalePrice), accent: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/5', testId: 'text-exit-sale-price' },
            { label: 'Appreciation', value: purchasePrice > 0 ? `${(((calculatedSalePrice - purchasePrice) / purchasePrice) * 100).toFixed(1)}%` : '—', accent: calculatedSalePrice > purchasePrice ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500', bg: '' },
            { label: 'Hold Period', value: `${holdPeriod} yrs`, accent: 'text-foreground', bg: '', testId: 'text-exit-hold-period' },
          ].map(m => (
            <div key={m.label} className={`px-4 py-3 ${m.bg}`} data-testid={(m as any).testId}>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{m.label}</p>
              <p className={`text-base font-bold tabular-nums ${m.accent}`}>{m.value}</p>
            </div>
          ))}
        </div>
      </div>

      {cases.length > 0 && (
        <div className="p-4 border rounded-lg bg-card">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Scenario Comparison — Estimated Sale Price</p>
          <ResponsiveContainer width="100%" height={Math.max(100, cases.length * 36)}>
            <BarChart data={cases.map((c, i) => {
              const scenario = defaultScenarios.find(s => s.id === c.scenarioType) || defaultScenarios[0];
              const growth = ((scenario?.revenueGrowth || 3) - (scenario?.expenseGrowth || 2)) / 100;
              const caseExitNOI = (year1NOI || 0) * Math.pow(1 + growth, holdPeriod);
              const capR = scenario?.exitCapRate || 7.5;
              const saleP = caseExitNOI / (capR / 100);
              return { name: c.name || scenario?.name || `Case ${i+1}`, price: Math.round(saleP > 0 ? saleP : purchasePrice * 1.2) };
            })} layout="vertical" margin={{ top: 2, right: 70, left: 90, bottom: 2 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => `${(v/1e6).toFixed(1)}M`} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={86} />
              <RechartTooltip formatter={(v) => [`${Number(v).toLocaleString()}`, 'Est. Sale Price']} contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="price" radius={[0,4,4,0]} maxBarSize={22}>
                {cases.map((_, i) => <Cell key={i} fill={['#3b82f6','#10b981','#f59e0b','#8b5cf6'][i % 4]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1 overflow-x-auto">
          {exitTools.map((tool) => (
            <TabsTrigger 
              key={tool.id} 
              value={tool.id}
              className="flex items-center gap-1.5 px-3 py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600"
              data-testid={`tab-exit-${tool.id}`}
            >
              <tool.icon className={`h-3.5 w-3.5 ${activeTab === tool.id ? 'text-blue-600' : ''}`} />
              <span className="hidden sm:inline">{tool.shortName}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="summary" className="mt-3">
          <SummaryDashboardPanel onNavigate={setActiveTab} />
        </TabsContent>

        <TabsContent value="tax-proceeds" className="mt-3">
          <TaxAndProceedsPanel />
        </TabsContent>

        <TabsContent value="1031" className="mt-3">
          <Exchange1031Panel />
        </TabsContent>

        <TabsContent value="dst" className="mt-3">
          <DSTAnalysisPanel />
        </TabsContent>

        <TabsContent value="seller-financing" className="mt-3">
          <SellerFinancingPanel />
        </TabsContent>

        <TabsContent value="earnout" className="mt-3">
          <EarnoutPanel />
        </TabsContent>

        <TabsContent value="waterfall" className="mt-3">
          <WaterfallPanel />
        </TabsContent>

        <TabsContent value="irr" className="mt-3">
          <IRRCalculatorPanel />
        </TabsContent>

        <TabsContent value="sensitivity" className="mt-3">
          <SensitivityPanel />
        </TabsContent>

        <TabsContent value="comparison" className="mt-3">
          <CrossStrategyComparisonPanel />
        </TabsContent>

        <TabsContent value="ai-insights" className="mt-3">
          <AdvisorInsightsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
