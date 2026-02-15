import { useState, Fragment } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils';
import { useDisplayPreferences } from '@/hooks/use-display-preferences';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageTour } from '@/components/onboarding/PageTour';
import { TOUR_IDS, valuatorTourSteps } from '@/lib/tour-configs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, Pencil, Trash2, TrendingUp, BarChart3, FileSpreadsheet, Settings, PieChart, Info, Clock, CheckCircle, XCircle, AlertCircle, Sparkles, Brain } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link } from 'wouter';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import ModelingProjectFormDialog from './form-dialog';
import ModelingAnalytics from './analytics';
import { DealTemplateSelector } from '@/components/modeling/DealTemplateSelector';
import { ModelingEmptyState } from '@/components/ui/_primitives/enhanced-empty-state';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { computeDealSignal, getSignalBadgeProps } from '@/lib/dealSignal';

type ModelingProject = {
  id: string;
  orgId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  marinaName: string;
  city: string | null;
  state: string | null;
  region: string | null;
  purchasePrice: number | null;
  year1CapRate: number | null;
  totalStorageUnits: number | null;
  ebitda: number | null;
  t12Ebitda: number | null;
  t12Label: string | null;
  year1Ebitda: number | null;
  dealOutcome: string;
  ddProjectId: string | null;
  salesCompId: string | null;
  rateCompId: string | null;
  propertyId: string | null;
  brokerId: string | null;
  companyId: string | null;
  customMetrics: Record<string, any> | null;
  notes: string | null;
  irr: number | null;
  exitYear: number | null;
  createdByName: string | null;
};

export default function ModelingProjectsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<ModelingProject | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isNewProjectWizardOpen, setIsNewProjectWizardOpen] = useState(false);

  const { data: projects = [], isLoading } = useQuery<ModelingProject[]>({
    queryKey: ['/api/modeling/projects'],
  });

  type ExitSummary = {
    modelingProjectId: string;
    bestNetProceeds: number | null;
    bestIrr: number | null;
    bestMoic: number | null;
    scenarioCount: number;
  };

  const { data: exitSummaries = [] } = useQuery<ExitSummary[]>({
    queryKey: ['/api/modeling/exit-summaries'],
  });

  const exitSummaryMap = new Map(
    exitSummaries.map((s) => [s.modelingProjectId, s])
  );

  const { metricLabel } = useDisplayPreferences();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/modeling/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects'] });
      toast({ title: 'Success', description: 'Modeling project deleted successfully' });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete modeling project',
        variant: 'destructive',
      });
    },
  });

  const handleCreate = () => {
    setIsNewProjectWizardOpen(true);
  };

  const handleProjectCreated = (projectId: string) => {
    setLocation(`/modeling/projects/${projectId}?tab=inputs`);
  };

  const handleEdit = (project: ModelingProject) => {
    setSelectedProject(project);
    setFormMode('edit');
    setIsFormOpen(true);
  };

  const handleDelete = async (project: ModelingProject) => {
    if (confirm(`Are you sure you want to delete "${project.marinaName}"?`)) {
      deleteMutation.mutate(project.id);
    }
  };

  const filteredProjects = projects.filter((project) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      project.marinaName.toLowerCase().includes(searchLower) ||
      project.city?.toLowerCase().includes(searchLower) ||
      project.state?.toLowerCase().includes(searchLower) ||
      project.region?.toLowerCase().includes(searchLower)
    );
  });

  // Compute status counts for Hostaway-style cards
  const statusCounts = {
    active: projects.filter(p => p.dealOutcome === 'active').length,
    underReview: projects.filter(p => p.dealOutcome === 'under_review').length,
    won: projects.filter(p => p.dealOutcome === 'won').length,
    lost: projects.filter(p => p.dealOutcome === 'lost').length,
    passed: projects.filter(p => p.dealOutcome === 'passed').length,
  };

  const totalPipelineValue = projects
    .filter(p => p.dealOutcome === 'active' || p.dealOutcome === 'under_review')
    .reduce((sum, p) => sum + (p.purchasePrice || 0), 0);

  const getOutcomeBadgeColor = (outcome: string) => {
    switch (outcome) {
      case 'won':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'lost':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'passed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'active':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatOutcome = (outcome: string) => {
    const outcomeMap: Record<string, string> = {
      'under_review': 'Under Review',
      'active': 'Active',
      'won': 'Won',
      'lost': 'Lost',
      'passed': 'Passed',
    };
    return outcomeMap[outcome] || outcome.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Model</h1>
          <p className="text-muted-foreground mt-1">
            Marina valuation and financial modeling workspace
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/modeling/portfolio">
            <Button variant="outline" data-testid="button-portfolio">
              <PieChart className="h-4 w-4 mr-2" />
              Portfolio
            </Button>
          </Link>
          <Link href="/modeling/settings">
            <Button variant="outline" data-testid="button-settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setIsTemplateOpen(true)} data-testid="button-use-template">
            <Sparkles className="h-4 w-4 mr-2" />
            Use Template
          </Button>
          <Button onClick={handleCreate} data-testid="button-create-project">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* Hostaway-Style Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Active Projects */}
        <Card className="border-l-4 border-l-blue-500">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                Active Models
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3.5 h-3.5" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Projects currently being modeled</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                Current
              </Badge>
            </div>
            <div className="text-3xl font-bold text-blue-600">{statusCounts.active}</div>
            <p className="text-xs text-muted-foreground mt-1">In active modeling</p>
          </div>
        </Card>

        {/* Under Review */}
        <Card className="border-l-4 border-l-amber-500">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                Under Review
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3.5 h-3.5" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Projects awaiting decision</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-3xl font-bold text-amber-600">{statusCounts.underReview}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting decision</p>
          </div>
        </Card>

        {/* Won */}
        <Card className="border-l-4 border-l-green-500">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Closed Won</span>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-green-600">{statusCounts.won}</div>
            <p className="text-xs text-muted-foreground mt-1">Successful acquisitions</p>
          </div>
        </Card>

        {/* Lost/Passed */}
        <Card className="border-l-4 border-l-gray-400">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">Passed/Lost</span>
              <XCircle className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-3xl font-bold text-gray-600">{statusCounts.lost + statusCounts.passed}</div>
            <p className="text-xs text-muted-foreground mt-1">Not pursued</p>
          </div>
        </Card>
      </div>

      {/* Pipeline Value Banner */}
      {totalPipelineValue > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200">
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Active Pipeline Value</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {statusCounts.active + statusCounts.underReview} projects in pipeline
                </p>
              </div>
            </div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {formatCurrency(totalPipelineValue)}
            </div>
          </div>
        </Card>
      )}

      <Tabs defaultValue="projects" className="space-y-6">
        <TabsList>
          <TabsTrigger value="projects" data-testid="tab-projects">
            Projects
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <TrendingUp className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects by marina name, city, state, or region..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
                data-testid="input-search"
              />
            </div>
          </Card>

          <Card>
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading projects...</div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {searchTerm ? 'No projects match your search.' : 'No projects yet. Create your first project to get started!'}
              </div>
            ) : (
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-bold text-foreground min-w-[180px]">Marina Name</TableHead>
                      <TableHead className="font-bold text-foreground text-right whitespace-nowrap">Purchase Price</TableHead>
                      <TableHead className="font-bold text-foreground text-right">IRR</TableHead>
                      <TableHead className="font-bold text-foreground text-right whitespace-nowrap">Yr 1 Cap Rate</TableHead>
                      <TableHead className="font-bold text-foreground text-right whitespace-nowrap">Hist. {metricLabel}</TableHead>
                      <TableHead className="font-bold text-foreground text-right whitespace-nowrap">Yr. 1 {metricLabel}</TableHead>
                      <TableHead className="font-bold text-foreground text-center">Status</TableHead>
                      <TableHead className="font-bold text-foreground text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Brain className="h-3.5 w-3.5 text-indigo-500" />
                          AI Signal
                        </span>
                      </TableHead>
                      <TableHead className="font-bold text-foreground whitespace-nowrap">Created</TableHead>
                      <TableHead className="font-bold text-foreground text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((project) => (
                      <Fragment key={project.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50 border-b-0"
                          onClick={() => setLocation(`/modeling/projects/${project.id}`)}
                          data-testid={`row-project-${project.id}`}
                        >
                          <TableCell className="pb-0" data-testid={`text-marina-name-${project.id}`}>
                            <div className="font-semibold">{project.marinaName}</div>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-semibold pb-0" data-testid={`text-price-${project.id}`}>
                            {formatCurrency(project.purchasePrice, { dash: true, context: 'price' })}
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap pb-0" data-testid={`text-irr-${project.id}`}>
                            <span className={`font-semibold ${(project.irr != null && project.irr !== 0) ? (project.irr >= 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
                              {(project.irr != null && project.irr !== 0) ? formatPercent(project.irr, { dash: true }) : '-'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-semibold pb-0" data-testid={`text-cap-rate-${project.id}`}>
                            {(project.year1CapRate != null && project.year1CapRate !== 0) ? formatPercent(project.year1CapRate, { dash: true }) : '-'}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-semibold pb-0" data-testid={`text-t12-ebitda-${project.id}`}>
                            {project.t12Ebitda != null ? formatCurrency(project.t12Ebitda, { context: 'ebitda' }) : '-'}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-semibold pb-0" data-testid={`text-yr1-ebitda-${project.id}`}>
                            {project.year1Ebitda != null ? formatCurrency(project.year1Ebitda, { context: 'ebitda' }) : '-'}
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap pb-0">
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getOutcomeBadgeColor(project.dealOutcome)}`}
                              data-testid={`badge-status-${project.id}`}
                            >
                              {formatOutcome(project.dealOutcome)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap pb-0">
                            {(() => {
                              const exitData = exitSummaryMap.get(project.id);
                              const signal = computeDealSignal({
                                irr: project.irr,
                                capRate: project.year1CapRate,
                                purchasePrice: project.purchasePrice,
                                exitNetProceeds: exitData?.bestNetProceeds ?? null,
                                exitMoic: exitData?.bestMoic ?? null,
                                exitIrr: exitData?.bestIrr ?? null,
                              });
                              const badge = getSignalBadgeProps(signal.signal);
                              return signal.score === 0 ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.className}`} data-testid={`badge-signal-${project.id}`}>
                                        <Brain className="h-3 w-3" />
                                        {badge.label}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-xs">
                                      <p className="font-semibold text-xs mb-1">Score: {signal.score}/100</p>
                                      {signal.reasons.slice(0, 3).map((r, i) => (
                                        <p key={i} className="text-xs text-muted-foreground">• {r}</p>
                                      ))}
                                      {exitData && exitData.scenarioCount > 0 && (
                                        <p className="text-xs text-indigo-500 mt-1">
                                          {exitData.scenarioCount} exit scenario{exitData.scenarioCount > 1 ? 's' : ''} analyzed
                                        </p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="pb-0 whitespace-nowrap" rowSpan={2}>
                            <div className="font-medium text-sm">{project.createdByName || '-'}</div>
                            <div className="text-xs text-muted-foreground">
                              {project.createdAt
                                ? new Date(project.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-center pb-0" rowSpan={2} onClick={(e) => e.stopPropagation()}>
                            <div className="grid grid-cols-2 gap-0.5 justify-items-center w-fit mx-auto">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLocation(`/modeling/projects/${project.id}/doc-intel`)} title="Document Intelligence" data-testid={`button-doc-intel-${project.id}`}>
                                <FileSpreadsheet className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLocation(`/modeling/projects/${project.id}/exit`)} title="Exit Strategy Suite" data-testid={`button-exit-strategy-${project.id}`}>
                                <BarChart3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(project)} title="Edit" data-testid={`button-edit-${project.id}`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(project)} title="Delete" data-testid={`button-delete-${project.id}`}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        <tr
                          className="cursor-pointer hover:bg-muted/50 border-b"
                          onClick={() => setLocation(`/modeling/projects/${project.id}`)}
                        >
                          <td className="px-4 pt-0 pb-2 text-xs text-muted-foreground whitespace-nowrap" data-testid={`text-location-${project.id}`}>
                            {[project.city, project.state].filter(Boolean).join(', ') || '\u00A0'}
                          </td>
                          <td className="px-4 pt-0 pb-2"></td>
                          <td className="px-4 pt-0 pb-2 text-center text-xs text-muted-foreground whitespace-nowrap">
                            {project.exitYear ? `Exit: ${project.exitYear}` : '\u00A0'}
                          </td>
                          <td className="px-4 pt-0 pb-2"></td>
                          <td className="px-4 pt-0 pb-2 text-center text-xs text-muted-foreground whitespace-nowrap">
                            {project.t12Label || '\u00A0'}
                          </td>
                          <td className="px-4 pt-0 pb-2 text-center text-xs whitespace-nowrap">
                            {project.year1Ebitda != null && project.t12Ebitda != null && project.t12Ebitda !== 0 ? (
                              <span className={`font-medium ${((project.year1Ebitda - project.t12Ebitda) / Math.abs(project.t12Ebitda)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {((project.year1Ebitda - project.t12Ebitda) / Math.abs(project.t12Ebitda) * 100) >= 0 ? '+' : ''}
                                {((project.year1Ebitda - project.t12Ebitda) / Math.abs(project.t12Ebitda) * 100).toFixed(1)}%
                              </span>
                            ) : '\u00A0'}
                          </td>
                          <td className="px-4 pt-0 pb-2"></td>
                          <td className="px-4 pt-0 pb-2"></td>
                        </tr>
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <ModelingAnalytics />
        </TabsContent>
      </Tabs>

      <ModelingProjectFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        mode={formMode}
        project={selectedProject}
      />

      <OnboardingWizard
        open={isNewProjectWizardOpen}
        onOpenChange={setIsNewProjectWizardOpen}
        mode="new_project"
        onProjectCreated={handleProjectCreated}
      />

      <DealTemplateSelector
        open={isTemplateOpen}
        onOpenChange={setIsTemplateOpen}
      />

      <PageTour 
        tourId={TOUR_IDS.VALUATOR} 
        steps={valuatorTourSteps}
        videoTitle="Financial Model Walkthrough"
      />
    </div>
  );
}
