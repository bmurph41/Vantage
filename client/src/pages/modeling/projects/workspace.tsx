import { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useSearch } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Home,
  Settings2,
  Upload,
  TrendingUp,
  FileSpreadsheet,
  BarChart3,
  ClipboardList,
  ChevronRight,
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calculator,
  Target,
  History,
  Layers,
  Link2,
  SlidersHorizontal,
  FileText,
  Users,
  Anchor,
  Activity,
  Tornado,
  AlertTriangle,
  Store,
  Database,
  LineChart,
  Briefcase,
  Download,
  Save,
  Check,
  Receipt,
  Shield,
  Hammer,
  Scale,
  Landmark,
  PieChart,
  GitBranch,
  FileCheck,
  Gauge,
  Leaf,
  FileText,
  type LucideIcon
} from 'lucide-react';
import type { ModelingProject, DocIntelUpload } from '@shared/schema';
import { uwStageLabels, uwSubStatuses, assetClassValuationDefaults } from '@shared/schema';
import { getAssetClassConfig } from '@/components/crm/asset-class-fields';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FavoriteButton, PinButton } from '@/components/quick-access';
import { useTrackRecent } from '@/hooks/use-track-recent';
import { formatCurrency } from '@/lib/formatUtils';
import { useDisplayPreferences } from '@/hooks/use-display-preferences';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import ProjectTypeBadge from '@/components/modeling/ProjectTypeBadge';

import WorkspaceOverview from './workspace/overview';
import { OverviewDynamic } from './workspace/overview-dynamic';
import InputsAssumptions from './workspace/inputs';
import WorkspaceUploads from './workspace/uploads';
import WorkspaceAssumptions from './workspace/assumptions';
import WorkspaceHistoricalPL from './workspace/historical-pl';
import WorkspaceProForma from './workspace/pro-forma';
import WorkspaceExecutiveSummary from './workspace/executive-summary';
import { ExecutiveSummaryDynamic } from './workspace/executive-summary-dynamic';
import WorkspaceDebtScenarios from './workspace/debt-scenarios';
import WorkspaceExitStrategy from './workspace/exit-strategy';
import AuditTrailViewer from './workspace/audit-trail';
import CaseConfiguration from './workspace/case-configuration';
import DealPricing from './workspace/deal-pricing';
import AnalyticsNormalization from './workspace/analytics-normalization';
import CapitalStackWorkspace from './workspace/capital-stack';
import LeaseCashFlowPage from './workspace/lease-cashflow';
import ProfitCentersPage from './workspace/profit-centers';
import DCFCalculatorPage from './workspace/dcf-calculator';
import MonteCarloPage from './workspace/monte-carlo';
import MultiYearProjectionTab from '@/components/workspace/MultiYearProjectionTab';
import RentRollDataTab from './workspace/rent-roll-data';
import RentRollAnalysis from './workspace/rent-roll-analysis';
import ModelReturns from './workspace/model-returns';
import CommercialLeasesWorkspace from './workspace/commercial-leases';
import ModelingProjectIntegrationPanel from '@/components/modeling/ModelingProjectIntegrationPanel';
import WorkspaceProFormaCharts from './workspace/pro-forma-charts';
import ScenarioComparisonCharts from './workspace/scenario-comparison-charts';
import ExportModel from './workspace/export-model';
import SensitivityTornado from './workspace/sensitivity-tornado';
import ValidationWarnings from './workspace/validation-warnings';
import ValuatorProfitCenters from './workspace/valuator-profit-centers';
import PropertyTaxTab from './workspace/property-tax';
import TaxAndDistributionsPage from './workspace/tax-distributions';
import DebtInputs from './workspace/debt-inputs';
import { UploadDropzone } from '@/pages/modeling/doc-intel/UploadDropzone';
import { getModelConfig, getTabOverrides } from "@shared/asset-class-model-config";
import UnitMixLeases from "./workspace/unit-mix-leases";
import ProfitCentersDynamic from "./workspace/profit-centers-dynamic";

// Institutional Analysis Pages
import IRRDecomposition from './workspace/irr-decomposition';
import MarkToMarket from './workspace/mark-to-market';
import CapExBudget from './workspace/capex-budget';
import StabilizedNOI from './workspace/stabilized-noi';
import HoldPeriodSummary from './workspace/hold-period-summary';
import PEWaterfall from './workspace/pe-waterfall';
import FundMetrics from './workspace/fund-metrics';
import ReplacementCost from './workspace/replacement-cost';
import LoanSizing from './workspace/loan-sizing';
import StressTesting from './workspace/stress-testing';
import DepreciationSchedule from './workspace/depreciation-schedule';
import CompAdjustmentGrid from './workspace/comp-adjustment-grid';
import OperatorBenchmarking from './workspace/operator-benchmarking';
import BenchmarkOverlay from './workspace/benchmark-overlay';
import PortfolioRisk from './workspace/portfolio-risk';
import LPReporting from './workspace/lp-reporting';
import EnvironmentalRisk from './workspace/environmental-risk';
import ICMemo from './workspace/ic-memo';
import WaterfallSensitivity from './workspace/waterfall-sensitivity';
import ModelVersioning from './workspace/model-versioning';
import AssumptionAudit from './workspace/assumption-audit';

interface TabItem {
  value: string;
  label: string;
  icon: LucideIcon;
}

interface TabGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  tabs: TabItem[];
}

const TAB_GROUPS: TabGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: Home,
    tabs: [
      { value: 'overview', label: 'Overview', icon: Home },
      { value: 'summary', label: 'Summary', icon: ClipboardList },
      { value: 'validation', label: 'Advisor Review', icon: AlertTriangle },
    ],
  },
  {
    id: 'data',
    label: 'Inputs & Data',
    icon: Database,
    tabs: [
      { value: 'inputs', label: 'Inputs & Assumptions', icon: Settings2 },
      { value: 'property-tax', label: 'Property Tax', icon: Building2 },
      { value: 'storage-leases', label: 'Storage Leases', icon: Anchor },
      { value: 'commercial-leases', label: 'Commercial Leases', icon: Building2 },
      { value: 'profit', label: 'Profit Centers', icon: Store },
    ],
  },
  {
    id: 'uploads',
    label: 'Uploads',
    icon: Upload,
    tabs: [
      { value: 'uploads', label: 'Document Uploads', icon: Upload },
    ],
  },
  {
    id: 'model',
    label: 'Financial Model',
    icon: Calculator,
    tabs: [
      { value: 'historical', label: 'Historical P&L', icon: FileSpreadsheet },
      { value: 'proforma', label: 'Pro Forma', icon: BarChart3 },
      { value: 'pricing', label: 'Pricing', icon: DollarSign },
      { value: 'debt', label: 'Debt', icon: Briefcase },
      { value: 'capital', label: 'Capital Stack', icon: Building2 },
      { value: 'exit', label: 'Exit Strategy', icon: Target },
      { value: 'dcf', label: 'DCF', icon: Calculator },
      { value: 'returns', label: 'Returns', icon: TrendingUp },
      { value: 'multi-year', label: 'Multi-Year', icon: TrendingUp },
      { value: 'tax-dist', label: 'Tax & Distributions', icon: Receipt },
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    icon: LineChart,
    tabs: [
      { value: 'analytics', label: 'Analytics', icon: SlidersHorizontal },
      { value: 'proforma-charts', label: 'Charts', icon: BarChart3 },
      { value: 'scenario-compare', label: 'Compare', icon: Layers },
      { value: 'sensitivity', label: 'Sensitivity', icon: Tornado },
      { value: 'monte-carlo', label: 'Monte Carlo', icon: Activity },
      { value: 'stress-testing', label: 'Stress Tests', icon: Shield },
      { value: 'benchmark-overlay', label: 'Benchmarks', icon: Target },
    ],
  },
  {
    id: 'institutional',
    label: 'Institutional',
    icon: Landmark,
    tabs: [
      { value: 'irr-decomposition', label: 'IRR Attribution', icon: TrendingUp },
      { value: 'hold-period-summary', label: 'Hold Period CF', icon: DollarSign },
      { value: 'mark-to-market', label: 'Mark-to-Market', icon: Scale },
      { value: 'stabilized-noi', label: 'Stabilized NOI', icon: Target },
      { value: 'capex-budget', label: 'CapEx Budget', icon: Hammer },
      { value: 'replacement-cost', label: 'Replacement Cost', icon: Building2 },
      { value: 'loan-sizing', label: 'Loan Sizing', icon: Calculator },
      { value: 'pe-waterfall', label: 'PE Waterfall', icon: Layers },
      { value: 'waterfall-sensitivity', label: 'Waterfall Sensitivity', icon: Activity },
      { value: 'depreciation', label: 'Depreciation', icon: Receipt },
      { value: 'comp-grid', label: 'Comp Adjustments', icon: SlidersHorizontal },
      { value: 'operator-bench', label: 'Operator Benchmark', icon: Gauge },
      { value: 'environmental', label: 'Environmental Risk', icon: Leaf },
      { value: 'ic-memo', label: 'IC Memo', icon: FileText },
    ],
  },
  {
    id: 'fund',
    label: 'Fund & Portfolio',
    icon: PieChart,
    tabs: [
      { value: 'fund-metrics', label: 'Fund Metrics', icon: BarChart3 },
      { value: 'lp-reporting', label: 'LP Reporting', icon: Users },
      { value: 'portfolio-risk', label: 'Portfolio Risk', icon: Shield },
    ],
  },
  {
    id: 'scenarios',
    label: 'Scenarios',
    icon: Layers,
    tabs: [
      { value: 'cases', label: 'Scenario Config', icon: Layers },
      { value: 'model-versions', label: 'Model Versions', icon: GitBranch },
      { value: 'assumption-audit', label: 'Assumption Audit', icon: FileCheck },
      { value: 'audit', label: 'Audit Trail', icon: History },
    ],
  },
  {
    id: 'output',
    label: 'Output',
    icon: Download,
    tabs: [
      { value: 'comps', label: 'Comps & Links', icon: Link2 },
      { value: 'export', label: 'Export', icon: FileSpreadsheet },
    ],
  },
];

const TAB_TO_GROUP: Record<string, string> = {};
TAB_GROUPS.forEach((group) => {
  group.tabs.forEach((tab) => {
    TAB_TO_GROUP[tab.value] = group.id;
  });
});

function getGroupForTab(tabValue: string): string {
  return TAB_TO_GROUP[tabValue] || 'overview';
}

const STORAGE_SUB_TYPES = [
  'WET_SLIPS', 'DRY_STACK', 'MOORINGS', 'TRAILER_STORAGE', 'RV_STORAGE', 'SERVICE_BAYS',
  'wet_slips', 'lift_slips', 'moorings', 'dinghies', 'jet_skis',
  'dry_racks_indoor', 'dry_racks_outdoor', 'land_storage',
  'boats_on_trailers', 'trailers', 'carports', 'houseboats', 'rv_sites',
];

interface UploadWithStats extends DocIntelUpload {
  stats?: {
    total: number;
    pending: number;
    confirmed: number;
    rejected: number;
    needsReview: number;
    highConfidence: number;
    lowConfidence: number;
  };
}

function StorageLeaseUploads({ projectId }: { projectId: string }) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: allUploads = [], isLoading } = useQuery<UploadWithStats[]>({
    queryKey: ['/api/modeling/projects', projectId, 'documents'],
    enabled: !!projectId,
    refetchInterval: 3000,
  });

  const storageUploads = allUploads.filter(
    (u) => u.docType === 'rent_roll' && u.rentRollSubType && STORAGE_SUB_TYPES.includes(u.rentRollSubType)
  );

  const deleteMutation = useMutation({
    mutationFn: (uploadId: string) => apiRequest('DELETE', `/api/modeling/projects/${projectId}/documents/${uploadId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'documents'] });
      toast({ title: 'Deleted', description: 'Document has been removed.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete document.', variant: 'destructive' });
    },
  });

  const handleUploadComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId, 'documents'] });
  };

  const handleReview = (uploadId: string) => {
    navigate(`/modeling/projects/${projectId}/doc-intel?upload=${uploadId}`);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      uploaded: { variant: 'secondary', label: 'Pending' },
      processing: { variant: 'default', label: 'AI Processing' },
      parsed: { variant: 'outline', label: 'Ready for Review' },
      reviewing: { variant: 'default', label: 'In Review' },
      completed: { variant: 'secondary', label: 'Completed' },
      error: { variant: 'destructive', label: 'Error' },
    };
    const c = config[status] || config.uploaded;
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  return (
    <div className="mt-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Storage Rent Roll Uploads</h3>
        <p className="text-sm text-muted-foreground">
          Upload rent roll documents for storage units. Files are automatically tagged as storage rent rolls and sent for AI processing.
        </p>
      </div>

      <UploadDropzone
        projectId={projectId}
        onUploadComplete={handleUploadComplete}
        defaultDocType="rent_roll"
        lockDocType
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : storageUploads.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Uploaded Documents</CardTitle>
            <CardDescription>{storageUploads.length} storage rent roll{storageUploads.length !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {storageUploads.map((upload) => (
                <div
                  key={upload.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileSpreadsheet className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{upload.originalName || upload.filename}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {upload.rentRollSubType && (
                          <span className="capitalize">{upload.rentRollSubType.replace(/_/g, ' ')}</span>
                        )}
                        {upload.year && <span>Year {upload.year}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getStatusBadge(upload.status)}
                    {(upload.status === 'parsed' || upload.status === 'reviewing') && (
                      <Button variant="outline" size="sm" onClick={() => handleReview(upload.id)}>
                        Review
                      </Button>
                    )}
                    {upload.status === 'completed' && (
                      <Button variant="ghost" size="sm" onClick={() => handleReview(upload.id)}>
                        View
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(upload.id)}
                    >
                      <AlertCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="font-medium text-muted-foreground">No storage rent rolls uploaded yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Drag and drop your rent roll files above, or upload them from the Setup Wizard
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StorageLeasesWorkspace({ projectId, projectName, onTabChange }: { projectId: string; projectName: string; onTabChange: (tab: string) => void }) {
  const [subTab, setSubTab] = useState('lease-data');
  return (
    <Tabs value={subTab} onValueChange={setSubTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="lease-data" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Lease Data
        </TabsTrigger>
        <TabsTrigger value="uploads" className="gap-2">
          <Upload className="h-4 w-4" />
          Uploads
        </TabsTrigger>
        <TabsTrigger value="analysis" className="gap-2">
          <BarChart3 className="h-4 w-4" />
          Rent Roll Analysis
        </TabsTrigger>
      </TabsList>
      <TabsContent value="lease-data">
        <RentRollDataTab projectId={projectId} projectName={projectName} />
      </TabsContent>
      <TabsContent value="uploads">
        <StorageLeaseUploads projectId={projectId} />
      </TabsContent>
      <TabsContent value="analysis">
        <RentRollAnalysis projectId={projectId} projectName={projectName} onTabChange={onTabChange} />
      </TabsContent>
    </Tabs>
  );
}

export default function ProjectWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(searchString);
    const tab = params.get('tab') || 'overview';
    return TAB_TO_GROUP[tab] ? tab : 'overview';
  });

  // Allow child tabs to navigate via custom event (e.g. "Go to Inputs" CTA)
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setActiveTab(e.detail);
      setActiveGroup(getGroupForTab(e.detail));
    };
    window.addEventListener('navigate-tab', handler as EventListener);
    return () => window.removeEventListener('navigate-tab', handler as EventListener);
  }, []);
  const [activeGroup, setActiveGroup] = useState(() => getGroupForTab(activeTab));
  const queryClient = useQueryClient();
  useDisplayPreferences();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const tabFromUrl = params.get('tab');
    if (tabFromUrl && tabFromUrl !== activeTab) {
      const validTab = TAB_TO_GROUP[tabFromUrl] ? tabFromUrl : 'overview';
      setActiveTab(validTab);
      setActiveGroup(getGroupForTab(validTab));
    }
  }, [searchString]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setActiveGroup(getGroupForTab(tab));
    const url = `/modeling/projects/${projectId}?tab=${tab}`;
    window.history.replaceState(null, '', url);
  };

  const handleGroupChange = (groupId: string) => {
    setActiveGroup(groupId);
    const group = TAB_GROUPS.find((g) => g.id === groupId);
    if (group && group.tabs.length > 0) {
      const firstTab = group.tabs[0].value;
      setActiveTab(firstTab);
      const url = `/modeling/projects/${projectId}?tab=${firstTab}`;
      window.history.replaceState(null, '', url);
    }
  };

  const currentGroup = TAB_GROUPS.find((g) => g.id === activeGroup) || TAB_GROUPS[0];

  const { data: project, isLoading } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
    enabled: !!projectId,
  });

  // Pricing + financials for Overview/Summary KPI cards
  const { data: _pricingRaw } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'deal-pricing', 'inputs'],
    enabled: !!projectId,
  });
  const pricingData = _pricingRaw?.dealPricingResults ?? _pricingRaw?.dealPricing ?? (_pricingRaw?.irr !== undefined ? _pricingRaw : _pricingRaw);

  const { data: _proFormaRaw } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'pro-forma'],
    enabled: !!projectId,
  });
  const financials = (() => {
    if (!_proFormaRaw) return undefined;
    // Shape 1: { scenarios: [{ metrics: { totalRevenue, noi, ... } }] }
    const s0 = _proFormaRaw.scenarios?.[0];
    if (s0?.metrics) {
      return {
        totalRevenue: s0.metrics.totalRevenue ?? 0,
        totalExpenses: s0.metrics.totalExpenses ?? 0,
        noi: s0.metrics.noi ?? s0.metrics.stabilizedNoi ?? 0,
        capRate: s0.metrics.capRate ?? 0,
        irr: s0.metrics.irr ?? 0,
        equityMultiple: s0.metrics.equityMultiple ?? 0,
        cashOnCash: s0.metrics.cashOnCash ?? 0,
        noiMargin: s0.metrics.noiMargin ?? 0,
        revenueLines: s0.revenueBreakdown ?? [],
      };
    }
    // Shape 2: flat with revenue.totals[]
    const rev = _proFormaRaw.revenue?.totals?.[0] ?? _proFormaRaw.revenue?.total ?? _proFormaRaw.totalRevenue ?? 0;
    const exp = _proFormaRaw.expenses?.totals?.[0] ?? _proFormaRaw.expenses?.total ?? _proFormaRaw.totalExpenses ?? 0;
    const noi = Array.isArray(_proFormaRaw.noi) ? _proFormaRaw.noi[0] : (_proFormaRaw.noi ?? (rev - exp));
    return { totalRevenue: rev, totalExpenses: exp, noi, revenueLines: [] };
  })();

  // === Asset-class-aware tab config ===
  const tabOverrides = useMemo(() => getTabOverrides(project?.assetClass), [project?.assetClass]);

  const createOmMutation = useMutation({
    mutationFn: (data: { projectId: string; name: string; status: string; modelingProjectId: string }) =>
      apiRequest('POST', '/api/om/oms', data),
    onSuccess: (newOm: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/om/oms'] });
      toast({ title: "OM Created", description: "Offering Memorandum created successfully." });
      navigate(`/om/builder/${newOm.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create OM.", variant: "destructive" });
    }
  });

  const [saveSuccess, setSaveSuccess] = useState(false);
  const saveProjectMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', `/api/modeling/projects/${projectId}/save`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects'] });
      setSaveSuccess(true);
      toast({ title: "Saved", description: "Your progress has been saved." });
      setTimeout(() => setSaveSuccess(false), 2000);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save. Please try again.", variant: "destructive" });
    },
  });
  const uwStageMutation = useMutation({
    mutationFn: (data: { uwStage?: string; uwSubStatus?: string }) =>
      apiRequest("PATCH", `/api/modeling/projects/${projectId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects"] });
      toast({ title: "Updated", description: "Underwriting status updated." });
    },
  });

  const handleCreateOm = () => {
    if (!project) return;
    createOmMutation.mutate({
      projectId: `modeling-${projectId}`,
      name: `${project.marinaName} - Offering Memorandum`,
      status: 'draft',
      modelingProjectId: projectId!,
    });
  };

  useTrackRecent({
    itemType: 'modeling_project',
    itemId: projectId,
    title: project?.marinaName || 'Modeling Project',
    link: `/modeling/projects/${projectId}`,
    icon: 'TrendingUp',
    enabled: !!project && !!projectId,
  });

  if (isLoading) {
    return (
      <div className="px-6 pt-4 pb-8 space-y-0">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The modeling project you're looking for doesn't exist or you don't have access.
          </p>
          <Button onClick={() => navigate('/modeling/projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </Card>
      </div>
    );
  }

  const formatCurrencyValue = (value: number | string | null) => {
    if (value === null || value === undefined) return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return formatCurrency(numValue);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* ── Persistent Project Header ─────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-border/40 shadow-sm">
        {/* Breadcrumb row */}
        <div className="flex items-center gap-1.5 px-6 pt-2.5 pb-0 text-[11px] text-muted-foreground">
          <button
            onClick={() => navigate('/modeling/projects')}
            className="hover:text-foreground transition-colors font-medium"
          >
            Financial Model
          </button>
          <ChevronRight className="h-3 w-3 opacity-50 flex-shrink-0" />
          <span className="text-foreground font-semibold truncate max-w-[260px]">{project.marinaName}</span>
        </div>

        {/* Main header row */}
        <div className="flex items-center justify-between gap-4 px-6 py-2.5">
          {/* Left: back + project identity */}
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 -ml-1"
              onClick={() => navigate('/modeling/projects')}
              data-testid="button-back-to-projects"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[15px] font-bold tracking-tight leading-none truncate" data-testid="text-project-name">
                  {project.marinaName}
                </h1>
                <ProjectTypeBadge project={project} />
                {(project as any).assetClass && (
                  <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">
                    {(project as any).assetClass.replace(/_/g, " ")}
                  </Badge>
                )}
                {(project.city || project.state) && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {[project.city, project.state].filter(Boolean).join(', ')}
                  </span>
                )}
                {project.purchasePrice && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <DollarSign className="h-3 w-3" />
                    {formatCurrencyValue(project.purchasePrice)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: stage + actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Stage dot + label */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 border border-border/40">
              <div className={[
                'w-1.5 h-1.5 rounded-full flex-shrink-0',
                ((project as any).uwStage === 'active_uw' || (project as any).uwStage === 'building_model') ? 'bg-blue-500 animate-pulse' :
                (project as any).uwStage === 'loi_submitted' || (project as any).uwStage === 'under_contract' ? 'bg-amber-500' :
                (project as any).uwStage === 'closed' ? 'bg-emerald-500' :
                (project as any).uwStage === 'dead' ? 'bg-red-400' : 'bg-slate-400'
              ].join(' ')} />
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Stage</span>
            </div>
            <Select
              value={(project as any).uwStage || "not_started"}
              onValueChange={(val) => uwStageMutation.mutate({ uwStage: val, uwSubStatus: undefined })}
            >
              <SelectTrigger className="h-7 w-[140px] text-xs border border-border/60 bg-background font-medium shadow-sm hover:border-primary/40 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(uwStageLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {uwSubStatuses[(project as any).uwStage || "not_started"]?.length > 0 && (
              <Select
                value={(project as any).uwSubStatus || ""}
                onValueChange={(val) => uwStageMutation.mutate({ uwSubStatus: val })}
              >
                <SelectTrigger className="h-7 w-[145px] text-xs border border-border/60 bg-background shadow-sm hover:border-primary/40 transition-colors">
                  <SelectValue placeholder="Sub-status..." />
                </SelectTrigger>
                <SelectContent>
                  {uwSubStatuses[(project as any).uwStage || "not_started"]?.map((s: any) => (
                    <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="w-px h-5 bg-border/60 mx-1" />

            {/* Save */}
            <Button
              variant={saveSuccess ? "default" : "outline"}
              size="sm"
              onClick={() => saveProjectMutation.mutate()}
              disabled={saveProjectMutation.isPending}
              className={saveSuccess ? "bg-green-600 hover:bg-green-700 text-white h-8 text-xs" : "h-8 text-xs"}
              data-testid="button-save-project"
            >
              {saveSuccess ? <><Check className="h-3.5 w-3.5 mr-1.5" />Saved</> :
               saveProjectMutation.isPending ? <><Save className="h-3.5 w-3.5 mr-1.5 animate-pulse" />Saving...</> :
               <><Save className="h-3.5 w-3.5 mr-1.5" />Save</>}
            </Button>

            {/* Create OM */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateOm}
              disabled={createOmMutation.isPending}
              className="h-8 text-xs"
              data-testid="button-create-om"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              {createOmMutation.isPending ? 'Creating...' : 'Create OM'}
            </Button>

            {/* Pin */}
            <PinButton
              itemType="modeling_project"
              itemId={projectId}
              title={project.marinaName}
              description={`${project.city || ''} ${project.state || ''}`.trim() || undefined}
              link={`/modeling/projects/${projectId}`}
              icon="TrendingUp"
              color="#3B82F6"
              variant="outline"
              showLabel
            />

            {/* Star */}
            <FavoriteButton
              itemType="modeling_project"
              itemId={projectId!}
              title={project.marinaName}
              subtitle={`${project.city || ''} ${project.state || ''}`.trim() || undefined}
              link={`/modeling/projects/${projectId}`}
              icon="TrendingUp"
              variant="outline"
              showLabel
            />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-0 flex-1">
        <div className="ws-nav-strip sticky top-[56px] z-20 -mx-6 px-6 border-b-2 border-border shadow-[0_3px_12px_-2px_rgba(0,0,0,0.10)]" style={{background:'hsl(221,50%,98%)'}}>
          {/* ── Group Rail ── */}
          <div className="flex items-center gap-1 overflow-x-auto pt-1.5 pb-0 px-0" data-testid="tab-groups">
            {TAB_GROUPS.map((group) => {
              const GroupIcon = group.icon;
              const isActive = activeGroup === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => handleGroupChange(group.id)}
                  title={group.label}
                  className={`ws-nav-group ${isActive ? 'ws-nav-group-active' : ''}`}
                  data-testid={`tab-group-${group.id}`}
                >
                  <GroupIcon className="h-3 w-3 shrink-0" />
                  <span className="hidden sm:inline">{group.label}</span>
                </button>
              );
            })}
            <div className="flex-1" />
          </div>
          {/* ── Sub-tab Rail ── */}
          <div className="overflow-x-auto">
            <TabsList key={activeGroup} className="inline-flex h-8 bg-transparent gap-0.5 rounded-none p-0 py-0.5" data-testid="tabs-workspace">
              {currentGroup.tabs.filter((tab) => {
                if (tab.value === "storage-leases" && !tabOverrides.showStorageLeases) return false;
                if (tab.value === "profit" && !tabOverrides.showProfitCenters) return false;
                if (tab.value === "commercial-leases") {
                  if (!tabOverrides.showCommercialLeases) return false;
                  const cm = project?.customMetrics as any;
                  return cm?.profitCenters?.commercialTenants?.enabled === true;
                }
                return true;
              }).map((tab) => {







                const TabIcon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="ws-nav-tab data-[state=active]:ws-nav-tab-active"
                    data-testid={`tab-${tab.value}`}
                  >
                    <TabIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">{tab.value === "storage-leases" ? (tabOverrides.storageLabel || tab.label) : tab.value === "profit" ? (tabOverrides.profitCentersLabel || tab.label) : tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </div>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <OverviewDynamic project={project} pricingData={pricingData} financials={financials} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="inputs" className="space-y-6" data-tour="valuator-inputs">
          <InputsAssumptions project={project!} />
        </TabsContent>

        <TabsContent value="cases" className="space-y-6" data-tour="valuator-scenarios">
          <CaseConfiguration projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="uploads" className="mt-4 space-y-4">
          <WorkspaceUploads projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>


        <TabsContent value="historical" className="mt-4 space-y-4">
          <WorkspaceHistoricalPL projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="property-tax" className="mt-4 space-y-4">
          <PropertyTaxTab projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6" data-tour="valuator-analysis">
          <AnalyticsNormalization projectId={projectId!} />
        </TabsContent>

        <TabsContent value="proforma" className="mt-4 space-y-4">
          <WorkspaceProForma projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="pricing" className="mt-4 space-y-4">
          <DealPricing projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="summary" className="space-y-6" data-tour="valuator-export">
          <ExecutiveSummaryDynamic projectId={projectId!} pricingData={pricingData} financials={financials} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="debt" className="mt-4 space-y-4">
          <DebtInputs projectId={projectId!} purchasePrice={project?.purchasePrice ? parseFloat(project.purchasePrice) : undefined} />
        </TabsContent>

        <TabsContent value="capital" className="mt-4 space-y-4">
          <CapitalStackWorkspace projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="exit" className="space-y-6" data-tour="valuator-exit">
          <WorkspaceExitStrategy projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>


        <TabsContent value="audit" className="mt-4 space-y-4">
          <AuditTrailViewer projectId={projectId!} />
        </TabsContent>

        <TabsContent value="comps" className="mt-4 space-y-4">
          <ModelingProjectIntegrationPanel 
            projectId={projectId!} 
            projectName={project.marinaName} 
          />
        </TabsContent>

        <TabsContent value="storage-leases" className="mt-4 space-y-4">
          <UnitMixLeases project={project!} />
        </TabsContent>

        <TabsContent value="commercial-leases" className="mt-4 space-y-4">
          {(project?.customMetrics as any)?.profitCenters?.commercialTenants?.enabled ? (
            <CommercialLeasesWorkspace projectId={projectId!} projectName={project.marinaName} onTabChange={handleTabChange} />
          ) : (
            <Card className="p-8 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Commercial Leases Not Enabled</h2>
              <p className="text-muted-foreground">Enable Commercial Tenants in the Setup Wizard to use this feature.</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="profit" className="mt-4 space-y-4">
          <ProfitCentersDynamic project={project!} />
        </TabsContent>

        <TabsContent value="dcf" className="mt-4 space-y-4">
          <DCFCalculatorPage onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="returns" className="mt-4 space-y-4">
          <ModelReturns projectId={projectId!} projectName={project.marinaName} />
        </TabsContent>

        <TabsContent value="multi-year" className="mt-4 space-y-4">
          <MultiYearProjectionTab
            projectId={project.id}
            initialConfig={{
              holdPeriod: 5,
              revenueGrowthRate: 0.03,
              expenseGrowthRate: 0.025,
              exitCapRate: 0.065,
            }}
          />
        </TabsContent>
        <TabsContent value="monte-carlo" className="mt-4 space-y-4">
          <MonteCarloPage />
        </TabsContent>

        <TabsContent value="proforma-charts" className="mt-4 space-y-4">
          <WorkspaceProFormaCharts projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="scenario-compare" className="mt-4 space-y-4">
          <ScenarioComparisonCharts projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="sensitivity" className="mt-4 space-y-4">
          <SensitivityTornado projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="validation" className="mt-4 space-y-4">
          <ValidationWarnings projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="export" className="mt-4 space-y-4">
          <ExportModel projectId={projectId!} projectName={project.marinaName} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="tax-dist" className="mt-4 space-y-4">
          <TaxAndDistributionsPage projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        {/* ─── Institutional Analysis ─── */}
        <TabsContent value="irr-decomposition" className="mt-4 space-y-4">
          <IRRDecomposition projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="hold-period-summary" className="mt-4 space-y-4">
          <HoldPeriodSummary projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="mark-to-market" className="mt-4 space-y-4">
          <MarkToMarket projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="stabilized-noi" className="mt-4 space-y-4">
          <StabilizedNOI projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="capex-budget" className="mt-4 space-y-4">
          <CapExBudget projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="replacement-cost" className="mt-4 space-y-4">
          <ReplacementCost projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="loan-sizing" className="mt-4 space-y-4">
          <LoanSizing projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="pe-waterfall" className="mt-4 space-y-4">
          <PEWaterfall projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="waterfall-sensitivity" className="mt-4 space-y-4">
          <WaterfallSensitivity projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="depreciation" className="mt-4 space-y-4">
          <DepreciationSchedule projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="comp-grid" className="mt-4 space-y-4">
          <CompAdjustmentGrid projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="operator-bench" className="mt-4 space-y-4">
          <OperatorBenchmarking projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="environmental" className="mt-4 space-y-4">
          <EnvironmentalRisk projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="ic-memo" className="mt-4 space-y-4">
          <ICMemo projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="stress-testing" className="mt-4 space-y-4">
          <StressTesting projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="benchmark-overlay" className="mt-4 space-y-4">
          <BenchmarkOverlay projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        {/* ─── Fund & Portfolio ─── */}
        <TabsContent value="fund-metrics" className="mt-4 space-y-4">
          <FundMetrics projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="lp-reporting" className="mt-4 space-y-4">
          <LPReporting projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="portfolio-risk" className="mt-4 space-y-4">
          <PortfolioRisk projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        {/* ─── Scenario Management ─── */}
        <TabsContent value="model-versions" className="mt-4 space-y-4">
          <ModelVersioning projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
        <TabsContent value="assumption-audit" className="mt-4 space-y-4">
          <AssumptionAudit projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
