import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Settings2,
  Upload,
  TrendingUp,
  FileSpreadsheet,
  BarChart3,
  ClipboardList,
  Calendar,
  Building2,
  DollarSign,
  Percent,
  Layers
} from 'lucide-react';
import type { ModelingProject } from '@shared/schema';
import { LiveDataStatusPanel } from '@/components/modeling/LiveDataStatusPanel';

interface WorkspaceOverviewProps {
  project: ModelingProject;
  onTabChange: (tab: string) => void;
}

type WorkflowStep = {
  id: string;
  title: string;
  description: string;
  tab: string;
  icon: React.ReactNode;
  status: 'complete' | 'in-progress' | 'pending';
};

export default function WorkspaceOverview({ project, onTabChange }: WorkspaceOverviewProps) {
  const { data: config } = useQuery<any>({
    queryKey: ['/api/modeling/projects', project.id, 'config'],
  });

  const { data: uploads = [] } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects', project.id, 'documents'],
  });

  const { data: assumptions } = useQuery<any>({
    queryKey: ['/api/modeling/projects', project.id, 'assumptions'],
  });

  const hasConfig = config?.holdPeriod && config?.seasonMonths?.length > 0;
  const hasUploads = uploads.length > 0;
  const hasCompletedUploads = uploads.some((u: any) => u.status === 'completed');
  const hasAssumptions = assumptions?.growthRates && Object.keys(assumptions.growthRates).length > 0;

  const workflowSteps: WorkflowStep[] = [
    {
      id: 'inputs',
      title: 'Configure Inputs',
      description: 'Set up seasonality, hold period, and department settings',
      tab: 'inputs',
      icon: <Settings2 className="h-5 w-5" />,
      status: hasConfig ? 'complete' : 'in-progress',
    },
    {
      id: 'uploads',
      title: 'Upload Documents',
      description: 'Upload P&L statements and rent rolls for AI parsing',
      tab: 'uploads',
      icon: <Upload className="h-5 w-5" />,
      status: hasCompletedUploads ? 'complete' : hasUploads ? 'in-progress' : 'pending',
    },
    {
      id: 'assumptions',
      title: 'Set Assumptions',
      description: 'Configure growth rates, occupancy, and margin assumptions',
      tab: 'assumptions',
      icon: <TrendingUp className="h-5 w-5" />,
      status: hasAssumptions ? 'complete' : hasCompletedUploads ? 'in-progress' : 'pending',
    },
    {
      id: 'historical',
      title: 'Review Historical P&L',
      description: 'Verify categorized historical data by month',
      tab: 'historical',
      icon: <FileSpreadsheet className="h-5 w-5" />,
      status: hasAssumptions ? 'in-progress' : 'pending',
    },
    {
      id: 'proforma',
      title: 'Generate Pro Forma',
      description: 'Project forward with growth assumptions applied',
      tab: 'proforma',
      icon: <BarChart3 className="h-5 w-5" />,
      status: 'pending',
    },
    {
      id: 'summary',
      title: 'Executive Summary',
      description: 'Review scenarios and finalize analysis',
      tab: 'summary',
      icon: <ClipboardList className="h-5 w-5" />,
      status: 'pending',
    },
  ];

  const completedSteps = workflowSteps.filter(s => s.status === 'complete').length;
  const progressPercent = (completedSteps / workflowSteps.length) * 100;

  const getStatusBadge = (status: WorkflowStep['status']) => {
    switch (status) {
      case 'complete':
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Complete
          </Badge>
        );
      case 'in-progress':
        return (
          <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
            <Clock className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const formatCurrency = (value: number | string | null) => {
    if (value === null || value === undefined) return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numValue);
  };

  const formatPercent = (value: number | string | null) => {
    if (value === null || value === undefined) return '-';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return `${numValue.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Zilculator-Style KPI Cards */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="finance-kpi-card" data-testid="card-overview-price">
          <div className="kpi-icon">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <div className="kpi-label">Purchase Price</div>
            <div className="kpi-value">{formatCurrency(project.purchasePrice)}</div>
          </div>
        </div>
        <div className="finance-kpi-card variant-green" data-testid="card-overview-caprate">
          <div className="kpi-icon">
            <Percent className="h-5 w-5" />
          </div>
          <div>
            <div className="kpi-label">Year 1 Cap Rate</div>
            <div className="kpi-value">{formatPercent(project.year1CapRate)}</div>
          </div>
        </div>
        <div className="finance-kpi-card variant-blue" data-testid="card-overview-units">
          <div className="kpi-icon">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="kpi-label">Total Units</div>
            <div className="kpi-value">{project.totalStorageUnits?.toLocaleString() ?? '-'}</div>
          </div>
        </div>
        <div className="finance-kpi-card variant-orange" data-testid="card-overview-ebitda">
          <div className="kpi-icon">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="kpi-label">EBITDA</div>
            <div className="kpi-value">{formatCurrency(project.ebitda)}</div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Workflow</CardTitle>
          <CardDescription>
            Complete each step to build your valuation model
          </CardDescription>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="font-medium">{completedSteps} of {workflowSteps.length} steps</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {workflowSteps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center gap-4 p-4 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50 ${
                  step.status === 'in-progress' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20' : ''
                }`}
                onClick={() => onTabChange(step.tab)}
                data-testid={`workflow-step-${step.id}`}
              >
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  step.status === 'complete' 
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                    : step.status === 'in-progress'
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {step.icon}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{step.title}</span>
                    {getStatusBadge(step.status)}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{step.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => onTabChange('inputs')}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Configure Project Settings
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => onTabChange('uploads')}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Financial Documents
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => onTabChange('summary')}
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              View Executive Summary
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Region</span>
              <span className="text-sm font-medium">{project.region || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Deal Source</span>
              <span className="text-sm font-medium capitalize">
                {(project as any).dealSource?.replace('_', ' ') || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant="outline" className="capitalize">
                {project.dealOutcome?.replace('_', ' ') || 'Active'}
              </Badge>
            </div>
            {config?.holdPeriod && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Hold Period</span>
                <span className="text-sm font-medium">{config.holdPeriod} Years</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <LiveDataStatusPanel 
        projectId={project.id} 
        dealSource={(project as any).dealSource} 
      />
    </div>
  );
}
