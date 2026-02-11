import { useState, useEffect } from 'react';
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
  Store
} from 'lucide-react';
import type { ModelingProject } from '@shared/schema';
import { FavoriteButton, PinButton } from '@/components/quick-access';
import { useTrackRecent } from '@/hooks/use-track-recent';
import { formatCurrency } from '@/lib/formatUtils';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import ProjectTypeBadge from '@/components/modeling/ProjectTypeBadge';

import WorkspaceOverview from './workspace/overview';
import WorkspaceInputs from './workspace/inputs';
import WorkspaceUploads from './workspace/uploads';
import WorkspaceAssumptions from './workspace/assumptions';
import WorkspaceHistoricalPL from './workspace/historical-pl';
import WorkspaceProForma from './workspace/pro-forma';
import WorkspaceExecutiveSummary from './workspace/executive-summary';
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
import LeasesCombined from './workspace/leases-combined';
import ModelingProjectIntegrationPanel from '@/components/modeling/ModelingProjectIntegrationPanel';
import WorkspaceProFormaCharts from './workspace/pro-forma-charts';
import ScenarioComparisonCharts from './workspace/scenario-comparison-charts';
import ExportModel from './workspace/export-model';
import SensitivityTornado from './workspace/sensitivity-tornado';
import ValidationWarnings from './workspace/validation-warnings';
import ValuatorProfitCenters from './workspace/valuator-profit-centers';

export default function ProjectWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(searchString);
    return params.get('tab') || 'overview';
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const tabFromUrl = params.get('tab');
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchString]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const url = `/modeling/projects/${projectId}?tab=${tab}`;
    window.history.replaceState(null, '', url);
  };

  const { data: project, isLoading } = useQuery<ModelingProject>({
    queryKey: ['/api/modeling/projects', projectId],
    enabled: !!projectId,
  });

  const createOmMutation = useMutation({
    mutationFn: (data: { projectId: string; name: string; status: string; modelingProjectId: string }) =>
      apiRequest('/api/om/oms', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (newOm: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/om/oms'] });
      toast({ title: "OM Created", description: "Offering Memorandum created successfully." });
      navigate(`/om/builder/${newOm.id}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create OM.", variant: "destructive" });
    }
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
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-6 px-6 pt-2 pb-3 border-b border-border/40">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex min-w-full lg:min-w-0" data-testid="tabs-workspace">
            <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="inputs" className="gap-2" data-testid="tab-inputs">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Inputs</span>
            </TabsTrigger>
            <TabsTrigger value="uploads" className="gap-2" data-testid="tab-uploads">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Uploads</span>
            </TabsTrigger>
            <TabsTrigger value="historical" className="gap-2" data-testid="tab-historical">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Historical</span>
            </TabsTrigger>
            <TabsTrigger value="assumptions" className="gap-2" data-testid="tab-assumptions">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Assumptions</span>
            </TabsTrigger>
            <TabsTrigger value="proforma" className="gap-2" data-testid="tab-proforma">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Pro Forma</span>
            </TabsTrigger>
            <TabsTrigger value="pricing" className="gap-2" data-testid="tab-pricing">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Pricing</span>
            </TabsTrigger>
            <TabsTrigger value="summary" className="gap-2" data-testid="tab-summary">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Summary</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2" data-testid="tab-analytics">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="cases" className="gap-2" data-testid="tab-scenarios">
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Scenario Analysis</span>
            </TabsTrigger>
            <TabsTrigger value="capital" className="gap-2" data-testid="tab-capital">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Capital</span>
            </TabsTrigger>
            <TabsTrigger value="exit" className="gap-2" data-testid="tab-exit">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Exit</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2" data-testid="tab-audit">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Audit</span>
            </TabsTrigger>
            <TabsTrigger value="comps" className="gap-2" data-testid="tab-comps">
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Comps</span>
            </TabsTrigger>
            <TabsTrigger value="leases" className="gap-2" data-testid="tab-leases">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Leases</span>
            </TabsTrigger>
            <TabsTrigger value="profit" className="gap-2" data-testid="tab-profit">
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Profit Ctrs</span>
            </TabsTrigger>
            <TabsTrigger value="dcf" className="gap-2" data-testid="tab-dcf">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">DCF</span>
            </TabsTrigger>
            <TabsTrigger value="monte-carlo" className="gap-2" data-testid="tab-monte-carlo">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Monte Carlo</span>
            </TabsTrigger>
            <TabsTrigger value="proforma-charts" className="gap-2" data-testid="tab-proforma-charts">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Charts</span>
            </TabsTrigger>
            <TabsTrigger value="scenario-compare" className="gap-2" data-testid="tab-scenario-compare">
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Compare</span>
            </TabsTrigger>
            <TabsTrigger value="sensitivity" className="gap-2" data-testid="tab-sensitivity">
              <Tornado className="h-4 w-4" />
              <span className="hidden sm:inline">Sensitivity</span>
            </TabsTrigger>
            <TabsTrigger value="validation" className="gap-2" data-testid="tab-validation">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Validation</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-2" data-testid="tab-export">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </TabsTrigger>
          </TabsList>
        </div>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <WorkspaceOverview project={project} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="inputs" className="space-y-6" data-tour="valuator-inputs">
          <WorkspaceInputs projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="cases" className="space-y-6" data-tour="valuator-scenarios">
          <CaseConfiguration projectId={projectId!} />
        </TabsContent>

        <TabsContent value="uploads" className="space-y-6">
          <WorkspaceUploads projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="assumptions" className="space-y-6">
          <WorkspaceAssumptions projectId={projectId!} onTabChange={handleTabChange} />
        </TabsContent>

        <TabsContent value="historical" className="space-y-6">
          <WorkspaceHistoricalPL projectId={projectId!} onTabChange={handleTabChange} />
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
          <WorkspaceExecutiveSummary projectId={projectId!} onTabChange={handleTabChange} />
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

        <TabsContent value="leases" className="space-y-6">
          <LeasesCombined projectId={projectId!} projectName={project.marinaName} />
        </TabsContent>

        <TabsContent value="profit" className="space-y-6">
          <ValuatorProfitCenters projectId={projectId!} projectName={project.marinaName} />
        </TabsContent>

        <TabsContent value="dcf" className="space-y-6">
          <DCFCalculatorPage onTabChange={handleTabChange} />
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
      </Tabs>
    </div>
  );
}
