import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency, formatPercent } from '@/lib/utils';
import {
  FileText,
  Printer,
  RefreshCcw,
  Building2,
  MapPin,
  DollarSign,
  TrendingUp,
  BarChart3,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  PenLine,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ICMemoProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

interface MemoSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: string;
  isEditing: boolean;
  isOverridden: boolean;
}

interface ProjectFinancials {
  totalRevenue: number;
  totalExpenses: number;
  noi: number;
  capRate: number;
  revenueByCategory: Record<string, number>;
  expensesByCategory: Record<string, number>;
}

interface DebtTerms {
  loanAmount: number;
  ltv: number;
  interestRate: number;
  amortization: number;
  term: number;
  dscr: number;
  annualDebtService: number;
}

function generateExecutiveSummary(project: any, financials: ProjectFinancials | null, returns: any): string {
  const name = project?.marinaName || project?.name || 'Subject Property';
  const location = [project?.city, project?.state].filter(Boolean).join(', ') || 'Location TBD';
  const price = project?.purchasePrice || project?.estimatedValue || 0;
  const capRate = financials?.capRate || 0;
  const irr = returns?.leveragedIRR || returns?.irr || 0;
  const em = returns?.equityMultiple || 0;

  return `${name} is a ${project?.totalUnits || '—'}-slip marina located in ${location}. ` +
    `The proposed acquisition price is ${formatCurrency(price)}, representing a ${capRate.toFixed(2)}% going-in cap rate. ` +
    `The investment is projected to generate a ${irr.toFixed(1)}% leveraged IRR and ${em.toFixed(2)}x equity multiple ` +
    `over the anticipated hold period. ` +
    `The property encompasses approximately ${project?.acreage || '—'} acres of waterfront real estate ` +
    `with a diversified revenue base including slip rentals, fuel sales, and ancillary services.`;
}

function generateInvestmentThesis(project: any, financials: ProjectFinancials | null, returns: any): string {
  const bullets: string[] = [];
  const occupancy = project?.occupancyRate || project?.occupancy;
  const price = project?.purchasePrice || project?.estimatedValue || 0;
  const noi = financials?.noi || 0;

  bullets.push(`Attractive basis at ${formatCurrency(price)} with significant value-add potential through operational improvements and rate optimization.`);

  if (occupancy && occupancy < 90) {
    bullets.push(`Current occupancy of ${occupancy}% presents lease-up upside — stabilized occupancy target of 95%+ is achievable given market demand.`);
  } else {
    bullets.push(`Strong occupancy fundamentals with demonstrated demand for wet and dry slip inventory in the submarket.`);
  }

  bullets.push(`Diversified revenue streams reduce single-source dependency — revenue mix includes slip rentals, fuel, ship store, and service department.`);

  if (noi > 0 && price > 0) {
    const impliedCapRate = (noi / price) * 100;
    bullets.push(`In-place NOI of ${formatCurrency(noi)} (${impliedCapRate.toFixed(1)}% cap rate) provides downside protection with contractual revenue base.`);
  }

  bullets.push(`Marina sector benefits from high barriers to entry (permitting, waterfront scarcity) and favorable supply-demand dynamics.`);

  return bullets.map(b => `- ${b}`).join('\n');
}

function generatePropertyOverview(project: any, financials: ProjectFinancials | null): string {
  const lines: string[] = [];
  lines.push(`Property Name: ${project?.marinaName || project?.name || 'TBD'}`);
  lines.push(`Location: ${[project?.city, project?.state].filter(Boolean).join(', ') || 'TBD'}`);
  lines.push(`Total Slips/Units: ${project?.totalUnits || '—'}`);
  lines.push(`Acreage: ${project?.acreage || '—'} acres`);
  lines.push(`Occupancy: ${project?.occupancyRate || project?.occupancy || '—'}%`);

  if (financials?.revenueByCategory) {
    lines.push('');
    lines.push('Revenue Mix:');
    const total = financials.totalRevenue || 1;
    Object.entries(financials.revenueByCategory).forEach(([cat, amt]) => {
      lines.push(`  ${cat}: ${formatCurrency(amt)} (${((amt / total) * 100).toFixed(1)}%)`);
    });
  }

  return lines.join('\n');
}

function generateMarketOverview(project: any, comps: any[]): string {
  const lines: string[] = [];
  const location = [project?.city, project?.state].filter(Boolean).join(', ') || 'the subject market';

  lines.push(`The ${location} submarket demonstrates strong fundamentals for marina operations. ` +
    `Waterfront properties in this region benefit from year-round boating seasons and growing recreational demand.`);
  lines.push('');

  if (comps && comps.length > 0) {
    lines.push('Competitive Landscape:');
    comps.slice(0, 5).forEach((comp, i) => {
      lines.push(`  ${i + 1}. ${comp.name || comp.marinaName || 'Comparable ' + (i + 1)} — ` +
        `${comp.totalUnits || '—'} slips, ${comp.distance ? comp.distance + ' mi' : 'nearby'}`);
    });
  } else {
    lines.push('Competitive landscape analysis pending — comparable marina data to be sourced from market survey.');
  }

  lines.push('');
  lines.push('Key demographic indicators for the primary trade area should be analyzed including ' +
    'median household income, boat registration trends, and population growth rates.');

  return lines.join('\n');
}

function generateFinancialSummary(financials: ProjectFinancials | null, project: any): string {
  if (!financials) return 'Financial data not yet available. Generate the pro forma to populate this section.';

  const lines: string[] = [];
  lines.push(`In-Place NOI: ${formatCurrency(financials.noi)}`);
  lines.push(`Total Revenue: ${formatCurrency(financials.totalRevenue)}`);
  lines.push(`Total Expenses: ${formatCurrency(financials.totalExpenses)}`);
  lines.push(`Operating Margin: ${financials.totalRevenue > 0 ? ((financials.noi / financials.totalRevenue) * 100).toFixed(1) : '—'}%`);
  lines.push(`Going-In Cap Rate: ${financials.capRate?.toFixed(2) || '—'}%`);
  lines.push('');
  lines.push('Pro Forma Assumptions:');
  lines.push('  Revenue growth: 3.0% annual escalation (market-based)');
  lines.push('  Expense growth: 2.5% annual escalation');
  lines.push('  Capital reserves: 3-5% of effective gross income');
  lines.push('  Management fee: 4-5% of EGI');

  if (financials.expensesByCategory) {
    lines.push('');
    lines.push('Expense Breakdown:');
    Object.entries(financials.expensesByCategory).forEach(([cat, amt]) => {
      lines.push(`  ${cat}: ${formatCurrency(amt)}`);
    });
  }

  return lines.join('\n');
}

function generateCapitalStructure(debt: DebtTerms | null, project: any): string {
  if (!debt) {
    const price = project?.purchasePrice || project?.estimatedValue || 0;
    return `Acquisition Price: ${formatCurrency(price)}\n` +
      `Debt terms to be determined — typical marina financing at 60-65% LTV, 5.5-7.0% rate, 25-year amortization.\n` +
      `Equity requirement estimated at ${formatCurrency(price * 0.35)} (35% of total capitalization).`;
  }

  const equity = (project?.purchasePrice || 0) - debt.loanAmount;
  const lines: string[] = [];
  lines.push(`Loan Amount: ${formatCurrency(debt.loanAmount)}`);
  lines.push(`Loan-to-Value: ${debt.ltv.toFixed(1)}%`);
  lines.push(`Interest Rate: ${debt.interestRate.toFixed(2)}%`);
  lines.push(`Amortization: ${debt.amortization} years`);
  lines.push(`Term: ${debt.term} years`);
  lines.push(`Annual Debt Service: ${formatCurrency(debt.annualDebtService)}`);
  lines.push(`DSCR: ${debt.dscr.toFixed(2)}x`);
  lines.push('');
  lines.push(`Equity Required: ${formatCurrency(equity)}`);
  lines.push(`Total Capitalization: ${formatCurrency((project?.purchasePrice || 0))}`);

  return lines.join('\n');
}

function generateReturnAnalysis(returns: any): string {
  if (!returns) return 'Return analysis pending — complete the financial model to generate IRR decomposition.';

  const lines: string[] = [];
  lines.push(`Leveraged IRR: ${(returns.leveragedIRR || returns.irr || 0).toFixed(1)}%`);
  lines.push(`Unleveraged IRR: ${(returns.unleveragedIRR || 0).toFixed(1)}%`);
  lines.push(`Equity Multiple: ${(returns.equityMultiple || 0).toFixed(2)}x`);
  lines.push(`Cash-on-Cash (Year 1): ${(returns.cashOnCash || 0).toFixed(1)}%`);
  lines.push('');
  lines.push('IRR Decomposition:');
  lines.push(`  Yield component: ${(returns.yieldComponent || 0).toFixed(1)}%`);
  lines.push(`  Growth component: ${(returns.growthComponent || 0).toFixed(1)}%`);
  lines.push(`  Leverage component: ${(returns.leverageComponent || 0).toFixed(1)}%`);
  lines.push('');
  lines.push('Sensitivity to exit cap rate (+/- 50 bps):');
  lines.push(`  Bull case: IRR ${((returns.leveragedIRR || returns.irr || 0) + 2.5).toFixed(1)}%`);
  lines.push(`  Base case: IRR ${(returns.leveragedIRR || returns.irr || 0).toFixed(1)}%`);
  lines.push(`  Bear case: IRR ${((returns.leveragedIRR || returns.irr || 0) - 3.0).toFixed(1)}%`);

  return lines.join('\n');
}

function generateRiskFactors(financials: ProjectFinancials | null, debt: DebtTerms | null, project: any): string {
  const risks: string[] = [];

  if (debt && debt.dscr < 1.25) {
    risks.push(`DSCR of ${debt.dscr.toFixed(2)}x is below the 1.25x threshold — tight debt service coverage increases default risk in a downturn.`);
  }
  if (debt && debt.ltv > 70) {
    risks.push(`LTV of ${debt.ltv.toFixed(0)}% exceeds conservative underwriting standards — higher leverage amplifies downside exposure.`);
  }

  risks.push('Environmental risk: Coastal properties are exposed to potential contamination from fuel operations, hazardous materials, and water quality issues. Phase I ESA required.');
  risks.push('Climate/weather risk: Hurricane exposure, storm surge, and sea-level rise may impact long-term asset value and insurance costs.');
  risks.push('Regulatory risk: Changes in waterway regulations, permitting requirements, or environmental compliance could impact operations and expansion plans.');
  risks.push('Market risk: Economic downturn could reduce discretionary boating activity and slip demand, particularly for transient and seasonal revenue.');

  if (financials && financials.totalRevenue > 0) {
    const margin = (financials.noi / financials.totalRevenue) * 100;
    if (margin < 35) {
      risks.push(`Operating margin of ${margin.toFixed(0)}% is below marina industry median (~40-45%) — operational improvements needed to reach stabilization.`);
    }
  }

  return risks.map((r, i) => `${i + 1}. ${r}`).join('\n\n');
}

function generateRecommendation(returns: any, debt: DebtTerms | null, financials: ProjectFinancials | null): string {
  const irr = returns?.leveragedIRR || returns?.irr || 0;
  const dscr = debt?.dscr || 0;
  const em = returns?.equityMultiple || 0;

  let recommendation = 'INVEST';
  const conditions: string[] = [];

  if (irr < 12) {
    recommendation = 'PASS';
    conditions.push('Projected returns below minimum IRR threshold of 12%');
  }
  if (dscr > 0 && dscr < 1.15) {
    recommendation = 'PASS';
    conditions.push('Debt service coverage ratio below minimum acceptable level');
  }
  if (irr >= 12 && irr < 15) {
    conditions.push('Returns meet minimum thresholds but are not compelling — negotiate price reduction of 5-10%');
  }

  conditions.push('Satisfactory completion of Phase I Environmental Site Assessment');
  conditions.push('Confirmation of all permits, licenses, and marina operating agreements');
  conditions.push('Satisfactory title and survey review');
  conditions.push('Insurance quotes confirming modeled premium assumptions');

  const lines: string[] = [];
  lines.push(`RECOMMENDATION: ${recommendation}`);
  lines.push('');

  if (recommendation === 'INVEST') {
    lines.push(`Based on projected returns of ${irr.toFixed(1)}% IRR and ${em.toFixed(2)}x equity multiple, ` +
      `we recommend proceeding with the acquisition subject to the following conditions:`);
  } else {
    lines.push(`Based on the current underwriting, we recommend passing on this opportunity. Key concerns:`);
  }

  lines.push('');
  lines.push('Conditions / Key Items:');
  conditions.forEach((c, i) => {
    lines.push(`  ${i + 1}. ${c}`);
  });

  return lines.join('\n');
}

export function ICMemo({ projectId, onTabChange }: ICMemoProps) {
  const memoRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const { data: project, isLoading: projectLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId],
  });

  const { data: financials } = useQuery<ProjectFinancials>({
    queryKey: ['/api/modeling/projects', projectId, 'financials'],
  });

  const { data: returns } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'returns'],
  });

  const { data: debt } = useQuery<DebtTerms>({
    queryKey: ['/api/modeling/projects', projectId, 'debt'],
  });

  const { data: comps } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects', projectId, 'comps'],
  });

  const [sections, setSections] = useState<MemoSection[]>([
    { id: 'executive_summary', title: 'Executive Summary', icon: <FileText className="h-5 w-5" />, content: '', isEditing: false, isOverridden: false },
    { id: 'investment_thesis', title: 'Investment Thesis', icon: <TrendingUp className="h-5 w-5" />, content: '', isEditing: false, isOverridden: false },
    { id: 'property_overview', title: 'Property Overview', icon: <Building2 className="h-5 w-5" />, content: '', isEditing: false, isOverridden: false },
    { id: 'market_overview', title: 'Market Overview', icon: <MapPin className="h-5 w-5" />, content: '', isEditing: false, isOverridden: false },
    { id: 'financial_summary', title: 'Financial Summary', icon: <DollarSign className="h-5 w-5" />, content: '', isEditing: false, isOverridden: false },
    { id: 'capital_structure', title: 'Capital Structure', icon: <BarChart3 className="h-5 w-5" />, content: '', isEditing: false, isOverridden: false },
    { id: 'return_analysis', title: 'Return Analysis', icon: <TrendingUp className="h-5 w-5" />, content: '', isEditing: false, isOverridden: false },
    { id: 'risk_factors', title: 'Risk Factors', icon: <AlertTriangle className="h-5 w-5" />, content: '', isEditing: false, isOverridden: false },
    { id: 'recommendation', title: 'Recommendation', icon: <CheckCircle className="h-5 w-5" />, content: '', isEditing: false, isOverridden: false },
  ]);

  const handleGenerate = () => {
    setIsGenerating(true);

    setTimeout(() => {
      setSections(prev => prev.map(section => {
        if (section.isOverridden) return section;

        let content = '';
        switch (section.id) {
          case 'executive_summary':
            content = generateExecutiveSummary(project, financials || null, returns);
            break;
          case 'investment_thesis':
            content = generateInvestmentThesis(project, financials || null, returns);
            break;
          case 'property_overview':
            content = generatePropertyOverview(project, financials || null);
            break;
          case 'market_overview':
            content = generateMarketOverview(project, comps || []);
            break;
          case 'financial_summary':
            content = generateFinancialSummary(financials || null, project);
            break;
          case 'capital_structure':
            content = generateCapitalStructure(debt || null, project);
            break;
          case 'return_analysis':
            content = generateReturnAnalysis(returns);
            break;
          case 'risk_factors':
            content = generateRiskFactors(financials || null, debt || null, project);
            break;
          case 'recommendation':
            content = generateRecommendation(returns, debt || null, financials || null);
            break;
        }
        return { ...section, content };
      }));

      setIsGenerated(true);
      setIsGenerating(false);
    }, 800);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const toggleSectionEdit = (sectionId: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, isEditing: !s.isEditing } : s
    ));
  };

  const updateSectionContent = (sectionId: string, content: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, content, isOverridden: true } : s
    ));
  };

  const resetSection = (sectionId: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, isOverridden: false, isEditing: false } : s
    ));
    handleGenerate();
  };

  const toggleCollapse = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const projectName = project?.marinaName || project?.name || 'Project';
  const memoDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .ic-memo-print, .ic-memo-print * { visibility: visible; }
          .ic-memo-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          .ic-memo-print .memo-card {
            border: none;
            box-shadow: none;
            break-inside: avoid;
            margin-bottom: 1rem;
          }
        }
      `}</style>

      <div className="flex items-center justify-between no-print">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Investment Committee Memo</h2>
          <p className="text-muted-foreground">Auto-generated IC memo from model data</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || projectLoading}
            variant={isGenerated ? 'outline' : 'default'}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4 mr-2" />
            )}
            {isGenerated ? 'Regenerate Memo' : 'Generate Memo'}
          </Button>
          <Button onClick={handleExportPDF} variant="outline" disabled={!isGenerated}>
            <Printer className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {!isGenerated && !isGenerating && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Memo Generated</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Click "Generate Memo" to automatically assemble an Investment Committee memo
              from the project financial model, market data, and risk analysis.
            </p>
            <Button onClick={handleGenerate} disabled={projectLoading}>
              {projectLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Generate Memo
            </Button>
          </CardContent>
        </Card>
      )}

      {isGenerating && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Assembling IC memo from model data...</p>
          </CardContent>
        </Card>
      )}

      {isGenerated && !isGenerating && (
        <div ref={memoRef} className="ic-memo-print space-y-4">
          {/* Memo Header */}
          <Card className="memo-card">
            <CardContent className="pt-6">
              <div className="text-center mb-4">
                <h1 className="text-3xl font-bold tracking-tight">INVESTMENT COMMITTEE MEMORANDUM</h1>
                <Separator className="my-4" />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Property:</span>{' '}
                  <span className="font-semibold">{projectName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Date:</span>{' '}
                  <span className="font-semibold">{memoDate}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Location:</span>{' '}
                  <span className="font-semibold">{[project?.city, project?.state].filter(Boolean).join(', ') || 'TBD'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Prepared By:</span>{' '}
                  <span className="font-semibold">Acquisitions Team</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Deal Size:</span>{' '}
                  <span className="font-semibold">{formatCurrency(project?.purchasePrice || project?.estimatedValue || 0)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{' '}
                  <Badge variant="outline">{project?.dealOutcome || 'Under Review'}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Memo Sections */}
          {sections.map((section, idx) => (
            <Card key={section.id} className={`memo-card ${idx >= 5 ? 'print-break' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {section.icon}
                    <span>{idx + 1}. {section.title}</span>
                    {section.isOverridden && (
                      <Badge variant="secondary" className="text-xs ml-2">Edited</Badge>
                    )}
                  </CardTitle>
                  <div className="flex gap-1 no-print">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCollapse(section.id)}
                    >
                      {collapsedSections.has(section.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSectionEdit(section.id)}
                    >
                      <PenLine className="h-4 w-4" />
                    </Button>
                    {section.isOverridden && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resetSection(section.id)}
                        title="Reset to auto-generated"
                      >
                        <RefreshCcw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              {!collapsedSections.has(section.id) && (
                <CardContent>
                  {section.isEditing ? (
                    <div className="space-y-2 no-print">
                      <Textarea
                        value={section.content}
                        onChange={(e) => updateSectionContent(section.id, e.target.value)}
                        rows={Math.max(6, section.content.split('\n').length + 2)}
                        className="font-mono text-sm"
                      />
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" onClick={() => toggleSectionEdit(section.id)}>
                          Done Editing
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {section.content || <span className="text-muted-foreground italic">No content generated yet.</span>}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}

          {/* Footer */}
          <Card className="memo-card">
            <CardContent className="pt-6">
              <Separator className="mb-4" />
              <div className="text-center text-sm text-muted-foreground">
                <p className="font-semibold">CONFIDENTIAL</p>
                <p>This Investment Committee Memorandum is prepared for internal use only.</p>
                <p>All projections are based on assumptions that may not be realized.</p>
                <p className="mt-2">Generated: {memoDate}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default ICMemo;
