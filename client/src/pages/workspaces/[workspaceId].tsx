import { useState } from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { useWorkspaceOverview, useUpdateWorkspace, useLinkWorkspaceEntities } from '@/hooks/useDealWorkspaces';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Building2,
  Calculator,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  DollarSign,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Link2,
  Loader2,
  MoreVertical,
  Settings,
  TrendingUp,
  Users,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-blue-500' },
  pending: { label: 'Pending', color: 'bg-gray-500' },
  under_contract: { label: 'Under Contract', color: 'bg-amber-500' },
  due_diligence: { label: 'Due Diligence', color: 'bg-purple-500' },
  closing: { label: 'Closing', color: 'bg-indigo-500' },
  closed: { label: 'Closed', color: 'bg-green-500' },
  dead: { label: 'Dead', color: 'bg-red-500' },
  on_hold: { label: 'On Hold', color: 'bg-orange-500' },
};

const ROLE_LABELS: Record<string, string> = {
  buyer: 'Buyer',
  seller: 'Seller',
  broker: 'Broker',
  lender: 'Lender',
  consultant: 'Consultant',
};

export default function WorkspaceDetailPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');

  const { data, isLoading, error } = useWorkspaceOverview(workspaceId);

  const formatCurrency = (value: string | number | null | undefined) => {
    if (!value) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(num);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-medium mb-2">Workspace not found</h3>
            <p className="text-muted-foreground mb-4">
              This workspace may have been archived or you don't have access.
            </p>
            <Button onClick={() => navigate('/workspaces')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Workspaces
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { workspace, stats } = data;
  const statusConfig = STATUS_CONFIG[workspace.status] || STATUS_CONFIG.active;
  const ddProgress = stats.dd.total > 0 ? (stats.dd.completed / stats.dd.total) * 100 : 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/workspaces')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold" data-testid="workspace-title">{workspace.name}</h1>
              <Badge className={`${statusConfig.color} text-white`}>
                {statusConfig.label}
              </Badge>
              <Badge variant="outline">
                {ROLE_LABELS[workspace.role] || workspace.role}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {workspace.description || 'No description'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/workspaces/${workspaceId}/settings`)}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:grid-cols-none lg:flex">
          <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="financials" className="gap-2" data-testid="tab-financials">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">Financials</span>
          </TabsTrigger>
          <TabsTrigger value="diligence" className="gap-2" data-testid="tab-diligence">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Diligence</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2" data-testid="tab-documents">
            <FolderOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Documents</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2" data-testid="tab-team">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Team</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  Deal Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(workspace.targetPrice)}
                </div>
                {workspace.expectedCloseDate && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Expected close: {format(new Date(workspace.expectedCloseDate), 'MMM d, yyyy')}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-purple-600" />
                  Due Diligence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold">{stats.dd.completed}/{stats.dd.total}</span>
                  <span className="text-sm text-muted-foreground">tasks</span>
                </div>
                <Progress value={ddProgress} className="h-2" />
                {stats.dd.pending > 0 && (
                  <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {stats.dd.pending} pending
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-blue-600" />
                  Data Room
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold">{stats.vdr.documents}</div>
                    <p className="text-sm text-muted-foreground">documents</p>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{stats.vdr.folders}</div>
                    <p className="text-sm text-muted-foreground">folders</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Linked Entities</CardTitle>
                <CardDescription>Connected projects and records</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {workspace.modelingProject ? (
                  <Link href={`/modeling/projects/${workspace.modelingProject.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted hover:bg-muted/80 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <Calculator className="h-5 w-5 text-green-600" />
                        <div>
                          <div className="font-medium">Modeling Project</div>
                          <div className="text-sm text-muted-foreground">{workspace.modelingProject.marinaName}</div>
                        </div>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-dashed">
                    <div className="flex items-center gap-3">
                      <Calculator className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Modeling Project</div>
                        <div className="text-sm text-muted-foreground">Not linked</div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      <Link2 className="h-4 w-4 mr-1" />
                      Link
                    </Button>
                  </div>
                )}

                {workspace.ddProject ? (
                  <Link href={`/projects/${workspace.ddProject.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted hover:bg-muted/80 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <ClipboardList className="h-5 w-5 text-purple-600" />
                        <div>
                          <div className="font-medium">DD Project</div>
                          <div className="text-sm text-muted-foreground">{workspace.ddProject.name}</div>
                        </div>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-dashed">
                    <div className="flex items-center gap-3">
                      <ClipboardList className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">DD Project</div>
                        <div className="text-sm text-muted-foreground">Not linked</div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      <Link2 className="h-4 w-4 mr-1" />
                      Link
                    </Button>
                  </div>
                )}

                {workspace.deal ? (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="font-medium">CRM Deal</div>
                        <div className="text-sm text-muted-foreground">{workspace.deal.title}</div>
                      </div>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-dashed">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="font-medium">CRM Deal</div>
                        <div className="text-sm text-muted-foreground">Not linked</div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      <Link2 className="h-4 w-4 mr-1" />
                      Link
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <CardDescription>Latest updates on this deal</CardDescription>
              </CardHeader>
              <CardContent>
                {workspace.lastActivityAt ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium">{workspace.lastActivityType || 'Activity'}</div>
                        <div className="text-sm text-muted-foreground">
                          {workspace.lastActivityDescription || 'No description'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(workspace.lastActivityAt), 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No recent activity</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financials" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial Modeling</CardTitle>
              <CardDescription>
                Valuation analysis, pro forma, and exit strategies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workspace.modelingProject ? (
                <div className="space-y-4">
                  <p>Linked to: <strong>{workspace.modelingProject.marinaName}</strong></p>
                  <Button onClick={() => navigate(`/modeling/projects/${workspace.modelingProject.id}`)}>
                    <Calculator className="h-4 w-4 mr-2" />
                    Open Modeling Project
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calculator className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No modeling project linked</h3>
                  <p className="text-muted-foreground mb-4">
                    Create or link a modeling project to run valuations and scenarios.
                  </p>
                  <div className="flex justify-center gap-2">
                    <Button variant="outline">Link Existing</Button>
                    <Button>Create New Project</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diligence" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Due Diligence</CardTitle>
              <CardDescription>
                Tasks, checklists, and fee tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workspace.ddProject ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold text-green-600">{stats.dd.completed}</div>
                      <div className="text-sm text-muted-foreground">Completed</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold text-amber-600">{stats.dd.pending}</div>
                      <div className="text-sm text-muted-foreground">Pending</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">{stats.dd.total}</div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </div>
                  </div>
                  <Button onClick={() => navigate(`/projects/${workspace.ddProject.id}`)}>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Open DD Project
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No DD project linked</h3>
                  <p className="text-muted-foreground mb-4">
                    Create or link a due diligence project to track tasks and progress.
                  </p>
                  <div className="flex justify-center gap-2">
                    <Button variant="outline">Link Existing</Button>
                    <Button>Create New Project</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Room</CardTitle>
              <CardDescription>
                Secure document storage and sharing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workspace.ddProject ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">{stats.vdr.documents}</div>
                      <div className="text-sm text-muted-foreground">Documents</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted">
                      <div className="text-2xl font-bold">{stats.vdr.folders}</div>
                      <div className="text-sm text-muted-foreground">Folders</div>
                    </div>
                  </div>
                  <Button onClick={() => navigate(`/vdr/${workspace.ddProject.id}`)}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Open Data Room
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No data room linked</h3>
                  <p className="text-muted-foreground mb-4">
                    Link a DD project to access its data room for document management.
                  </p>
                  <Button variant="outline">Link DD Project</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Team & Collaborators</CardTitle>
              <CardDescription>
                Manage access and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">Team management coming soon</h3>
                <p className="text-muted-foreground">
                  Invite team members and external collaborators to this workspace.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
