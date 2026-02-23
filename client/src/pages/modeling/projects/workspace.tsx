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
    ],
  },
  {
    id: 'scenarios',
    label: 'Scenarios',
    icon: Layers,
    tabs: [
      { value: 'cases', label: 'Scenario Config', icon: Layers },
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
    <div className="space-y-6">
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
      <div className="p-6 space-y-6">
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/modeling/projects')}
            data-testid="button-back-to-projects"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="h-6 w-px bg-border" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3" data-testid="text-project-name">
              <Building2 className="h-6 w-6 text-muted-foreground" />
              {project.marinaName}
              <ProjectTypeBadge project={project} />
              {(project as any).assetClass && (project as any).assetClass !== "marina" && (
                <Badge variant="outline" className="text-[10px] capitalize h-5">
                  {(project as any).assetClass.replace("_", " ")}
                </Badge>
              )}
            </h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              {(project.city || project.state) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[project.city, project.state].filter(Boolean).join(', ')}
                </span>
              )}
              {project.purchasePrice && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  {formatCurrencyValue(project.purchasePrice)}
                </span>
              )}
              {project.dealOutcome && (
                <Badge variant="outline" className="capitalize">
                  {project.dealOutcome.replace('_', ' ')}
                </Badge>
              )}
              {/* UW Stage */}
              <div className="flex items-center gap-1.5 ml-2 pl-2 border-l">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">UW:</span>
                <Select
                  value={(project as any).uwStage || "not_started"}
                  onValueChange={(val) => {
                    uwStageMutation.mutate({ uwStage: val, uwSubStatus: undefined });
                  }}
                >
                  <SelectTrigger className="h-6 w-[140px] text-xs border-dashed">
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
                    <SelectTrigger className="h-6 w-[150px] text-xs border-dashed">
                      <SelectValue placeholder="Sub-status..." />
                    </SelectTrigger>
                    <SelectContent>
                      {uwSubStatuses[(project as any).uwStage || "not_started"]?.map((s: any) => (
                        <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={saveSuccess ? "default" : "outline"}
            size="sm"
            onClick={() => saveProjectMutation.mutate()}
            disabled={saveProjectMutation.isPending}
            className={saveSuccess ? "bg-green-600 hover:bg-green-700 text-white" : ""}
            data-testid="button-save-project"
          >
            {saveSuccess ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Saved
              </>
            ) : saveProjectMutation.isPending ? (
              <>
                <Save className="h-4 w-4 mr-2 animate-pulse" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateOm}
            disabled={createOmMutation.isPending}
            data-testid="button-create-om"
          >
            <FileText className="h-4 w-4 mr-2" />
            {createOmMutation.isPending ? 'Creating...' : 'Create OM'}
          </Button>
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

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-6 px-6 pt-2 pb-3 border-b border-border/40 space-y-2">
          <div className="flex items-center gap-1 overflow-x-auto pb-1" data-testid="tab-groups">
            {TAB_GROUPS.map((group) => {
              const GroupIcon = group.icon;
              const isActive = activeGroup === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => handleGroupChange(group.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  data-testid={`tab-group-${group.id}`}
                >
                  <GroupIcon className="h-3.5 w-3.5" />
                  <span>{group.label}</span>
                </button>
              );
            })}
          </div>
          <div className="overflow-x-auto">
            <TabsList className="inline-flex" data-testid="tabs-workspace">
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
                    className="gap-2"
                    data-testid={`tab-${tab.value}`}
                  >
                    <TabIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.value === "storage-leases" ? (tabOverrides.storageLabel || tab.label) : tab.value === "profit" ? (tabOverrides.profitCentersLabel || tab.label) : tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <OverviewDynamic project={project} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="inputs" className="space-y-6" data-tour="valuator-inputs">
          <InputsAssumptions project={project!} />
        </TabsContent>

        <TabsContent value="cases" className="space-y-6" data-tour="valuator-scenarios">
          <CaseConfiguration projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="uploads" className="space-y-6">
          <WorkspaceUploads projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>


        <TabsContent value="historical" className="space-y-6">
          <WorkspaceHistoricalPL projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="property-tax" className="space-y-6">
          <PropertyTaxTab projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6" data-tour="valuator-analysis">
          <AnalyticsNormalization projectId={projectId!} />
        </TabsContent>

        <TabsContent value="proforma" className="space-y-6">
          <WorkspaceProForma projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="pricing" className="space-y-6">
          <DealPricing projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="summary" className="space-y-6" data-tour="valuator-export">
          <ExecutiveSummaryDynamic projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="debt" className="space-y-6">
          <DebtInputs projectId={projectId!} purchasePrice={project?.purchasePrice ? parseFloat(project.purchasePrice) : undefined} />
        </TabsContent>

        <TabsContent value="capital" className="space-y-6">
          <CapitalStackWorkspace projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="exit" className="space-y-6" data-tour="valuator-exit">
          <WorkspaceExitStrategy projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>


        <TabsContent value="audit" className="space-y-6">
          <AuditTrailViewer projectId={projectId!} />
        </TabsContent>

        <TabsContent value="comps" className="space-y-6">
          <ModelingProjectIntegrationPanel 
            projectId={projectId!} 
            projectName={project.marinaName} 
          />
        </TabsContent>

        <TabsContent value="storage-leases" className="space-y-6">
          <UnitMixLeases project={project!} />
        </TabsContent>

        <TabsContent value="commercial-leases" className="space-y-6">
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

        <TabsContent value="profit" className="space-y-6">
          <ProfitCentersDynamic project={project!} />
        </TabsContent>

        <TabsContent value="dcf" className="space-y-6">
          <DCFCalculatorPage onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="returns" className="space-y-6">
          <ModelReturns projectId={projectId!} projectName={project.marinaName} />
        </TabsContent>

        <TabsContent value="monte-carlo" className="space-y-6">
          <MonteCarloPage />
        </TabsContent>

        <TabsContent value="proforma-charts" className="space-y-6">
          <WorkspaceProFormaCharts projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="scenario-compare" className="space-y-6">
          <ScenarioComparisonCharts projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="sensitivity" className="space-y-6">
          <SensitivityTornado projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="validation" className="space-y-6">
          <ValidationWarnings projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <ExportModel projectId={projectId!} projectName={project.marinaName} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="tax-dist" className="space-y-6">
          <TaxAndDistributionsPage projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
