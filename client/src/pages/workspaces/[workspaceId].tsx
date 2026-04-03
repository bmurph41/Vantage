import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  useWorkspaceOverview, useUpdateWorkspace, useLinkWorkspaceEntities,
  useCreateDDProject, useWorkspaceTasks, useUpdateTask,
  useWorkspaceMembers, useInviteMember, useRevokeMember, useUpdateMemberPermissions,
  useCurrentAgreement, useExecuteAgreement,
  useVdrTree, useCreateVdrFolder,
  useWorkspaceMilestones, useCreateMilestone,
} from '@/hooks/useDealWorkspaces';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DdChecklistPanel from "@/components/workspace/DdChecklistPanel";
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Calculator, Calendar, CheckCircle2, ClipboardList, Clock,
  DollarSign, Download, FileText, FolderOpen, FolderPlus, LayoutDashboard,
  Link2, Loader2, Lock, MoreVertical, Plus, Settings, Shield, TrendingUp,
  Upload, UserPlus, Users, AlertCircle, ChevronRight, ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import CompetitiveTracker from '@/components/pipeline/CompetitiveTracker';
import DealScoringCard from '@/components/pipeline/DealScoringCard';
import DDStatusReport from '@/components/dd/DDStatusReport';
import DocumentVersions from '@/components/vdr/DocumentVersions';
import { Swords, Award, ClipboardCheck, GitBranch } from 'lucide-react';
import { useDisplayMode } from '@/stores/display-mode-store';
import GuidedDealFlow from '@/components/deal-workspace/GuidedDealFlow';
import SimplifiedDDChecklist from '@/components/dd/SimplifiedDDChecklist';

// Matches existing workspace_status enum: active, pending, under_contract, due_diligence, closing, closed, dead, on_hold
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-blue-500' },
  pending: { label: 'Pending', color: 'bg-gray-500' },
  under_contract: { label: 'Under Contract', color: 'bg-amber-500' },
  due_diligence: { label: 'Due Diligence', color: 'bg-purple-500' },
  closing: { label: 'Closing', color: 'bg-indigo-500' },
  closed: { label: 'Closed', color: 'bg-green-500' },
  dead: { label: 'Dead', color: 'bg-red-500' },
  on_hold: { label: 'On Hold', color: 'bg-gray-400' },
};

const ROLE_LABELS: Record<string, string> = {
  owner_admin: 'Owner/Admin', internal_member: 'Internal', buyer: 'Buyer',
  seller: 'Seller', broker: 'Broker', lender: 'Lender', attorney: 'Attorney',
  accountant: 'Accountant', consultant: 'Consultant', viewer: 'Viewer',
};

// Matches existing status enum: not_started, engaged, scheduled, in_progress, completed
const TASK_STATUS_COLORS: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-700',
  engaged: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
};

// Maps ddCategory enum values to friendly labels
const DD_CATEGORY_LABELS: Record<string, string> = {
  title: 'Title', survey: 'Survey', ESA: 'Environmental', appraisal: 'Appraisal',
  inspection: 'Inspection / Physical', permits: 'Permits', zoning: 'Zoning',
  financial: 'Financial', legal: 'Legal', insurance: 'Insurance', other: 'Other',
};

export default function WorkspaceDetailPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { simplifiedMode } = useDisplayMode();

  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const tabFromUrl = urlParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  // Dialogs
  const [showCreateDDDialog, setShowCreateDDDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showCADialog, setShowCADialog] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Form state
  const [ddExpiration, setDdExpiration] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviteVdr, setInviteVdr] = useState('view_only');

  useEffect(() => { setActiveTab(tabFromUrl); }, [tabFromUrl]);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    const newUrl = newTab === 'overview'
      ? `/workspaces/${workspaceId}`
      : `/workspaces/${workspaceId}?tab=${newTab}`;
    window.history.replaceState(null, '', newUrl);
  };

  // ─── Data queries ────────────────────────────────────────────────────────
  const { data, isLoading, error } = useWorkspaceOverview(workspaceId);
  const { data: taskList = [] } = useWorkspaceTasks(workspaceId);
  const { data: members = [] } = useWorkspaceMembers(workspaceId);
  const { data: agreementInfo } = useCurrentAgreement(workspaceId);
  const { data: vdrTree, error: vdrError } = useVdrTree(
    workspaceId,
    activeTab === 'documents' && !!data?.workspace?.ddProjectId
  );
  const { data: milestones = [] } = useWorkspaceMilestones(workspaceId);

  // ─── Mutations ───────────────────────────────────────────────────────────
  const createDD = useCreateDDProject();
  const updateTask = useUpdateTask();
  const inviteMember = useInviteMember();
  const revokeMember = useRevokeMember();
  const executeAgreement = useExecuteAgreement();
  const createMilestone = useCreateMilestone();
  const linkEntities = useLinkWorkspaceEntities();

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleCreateDD = () => {
    if (!workspaceId) return;
    createDD.mutate(
      { workspaceId, ddExpirationDate: ddExpiration || undefined, closingDate: closingDate || undefined },
      {
        onSuccess: (result) => {
          toast({ title: 'Due Diligence Created', description: `Created ${result.tasksCreated} tasks and ${result.foldersCreated} VDR folders.` });
          setShowCreateDDDialog(false);
        },
        onError: () => { toast({ title: 'Error', description: 'Failed to create Due Diligence project', variant: 'destructive' }); },
      }
    );
  };

  const handleInvite = () => {
    if (!workspaceId || !inviteEmail.trim()) return;
    inviteMember.mutate(
      { workspaceId, email: inviteEmail.trim(), role: inviteRole, vdrPermission: inviteVdr, ddPermission: 'view' },
      {
        onSuccess: () => {
          toast({ title: 'Invited', description: `Invitation sent to ${inviteEmail}` });
          setShowInviteDialog(false);
          setInviteEmail('');
        },
        onError: () => { toast({ title: 'Error', description: 'Failed to send invite', variant: 'destructive' }); },
      }
    );
  };

  const handleExecuteCA = () => {
    if (!workspaceId) return;
    executeAgreement.mutate(
      { workspaceId },
      {
        onSuccess: () => {
          toast({ title: 'Agreement Executed', description: 'You now have access to the Data Room.' });
          setShowCADialog(false);
        },
        onError: () => { toast({ title: 'Error', description: 'Failed to execute agreement', variant: 'destructive' }); },
      }
    );
  };

  const handleTaskToggle = (taskId: string, currentStatus: string) => {
    if (!workspaceId) return;
    const newStatus = currentStatus === 'completed' ? 'not_started' : 'completed';
    updateTask.mutate({ workspaceId, taskId, status: newStatus });
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleExportToc = () => {
    window.open(`/api/workspaces/${workspaceId}/vdr/toc`, '_blank');
  };

  const handleExportIcs = async () => {
    const response = await fetch(`/api/workspaces/${workspaceId}/calendar/ics`, {
      method: 'POST', credentials: 'include',
    });
    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workspace-${workspaceId}-milestones.ics`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // ─── Rendering ───────────────────────────────────────────────────────────

  const formatCurrency = (value: string | number | null | undefined) => {
    if (!value) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded" />
            <div className="space-y-1"><Skeleton className="h-5 w-64" /><Skeleton className="h-4 w-48" /></div>
          </div>
        </div>
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)}
          </div>
        </div>
        <div className="px-6 py-4 space-y-4">
          <Skeleton className="h-10 w-full rounded" />
          <Skeleton className="h-64 w-full rounded" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-6">
        <Card className="w-full max-w-md"><CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h3 className="text-lg font-semibold mb-2">Workspace not found</h3>
          <p className="text-gray-500 mb-4">This workspace may have been archived or you don't have access.</p>
          <Button onClick={() => navigate('/workspaces')}><ArrowLeft className="h-4 w-4 mr-2" />Back to Workspaces</Button>
        </CardContent></Card>
      </div>
    );
  }

  const { workspace, stats } = data;
  const statusConfig = STATUS_CONFIG[workspace.status] || STATUS_CONFIG.active;
  const ddProgress = stats.dd.total > 0 ? (stats.dd.completed / stats.dd.total) * 100 : 0;
  const hasDDProject = !!workspace.ddProjectId;

  const needsCA = activeTab === 'documents' && agreementInfo && !agreementInfo.executed && agreementInfo.agreement;
  const vdrIsCABlocked = vdrError && (vdrError as any)?.code === 'CA_REQUIRED';

  // Group tasks by ddCategory (existing task field)
  const tasksByCategory: Record<string, any[]> = {};
  for (const t of taskList) {
    const cat = DD_CATEGORY_LABELS[t.ddCategory] || t.ddCategory || 'Other';
    if (!tasksByCategory[cat]) tasksByCategory[cat] = [];
    tasksByCategory[cat].push(t);
  }

  // ─── Folder tree renderer ────────────────────────────────────────────────

  function renderFolderTree(folders: any[], depth = 0) {
    return folders.map((folder: any) => {
      const isExpanded = expandedFolders.has(folder.id);
      const hasChildren = folder.children?.length > 0 || folder.documents?.length > 0;
      return (
        <div key={folder.id} style={{ marginLeft: depth * 16 }}>
          <div
            className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted rounded cursor-pointer"
            onClick={() => toggleFolder(folder.id)}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : <span className="w-4" />}
            <FolderOpen className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">{folder.name}</span>
            {folder.securityLevel === 'restricted' && <Lock className="h-3 w-3 text-red-400" />}
            <span className="text-xs text-muted-foreground ml-auto">
              {(folder.documents?.length || 0)} files
            </span>
          </div>
          {isExpanded && (
            <>
              {folder.documents?.map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-2 py-1 px-2 ml-8 hover:bg-muted/50 rounded" style={{ marginLeft: (depth + 1) * 16 + 16 }}>
                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-sm">{doc.filename}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{doc.mimeType || ''}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDocId(doc.id);
                      setShowVersionHistory(true);
                    }}
                  >
                    <GitBranch className="h-3 w-3 mr-1" />
                    Versions
                  </Button>
                </div>
              ))}
              {folder.children && renderFolderTree(folder.children, depth + 1)}
            </>
          )}
        </div>
      );
    });
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">

      {/* ─── Page Header ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-900" onClick={() => navigate('/workspaces')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-gray-900" data-testid="workspace-title">{workspace.name}</h1>
                <Badge className={`${statusConfig.color} text-white text-xs px-2`}>{statusConfig.label}</Badge>
                {workspace.role && <Badge variant="outline" className="text-xs px-2">{ROLE_LABELS[workspace.role] || workspace.role}</Badge>}
              </div>
              <p className="text-sm text-gray-500">{workspace.description || 'No description'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportIcs}>
              <Calendar className="h-4 w-4 mr-1.5" />Export .ics
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/workspaces/${workspaceId}/settings`)}>
              <Settings className="h-4 w-4 mr-1.5" />Settings
            </Button>
          </div>
        </div>
      </div>

      {/* ─── KPI Stat Strip ──────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-base font-bold text-gray-900">{formatCurrency(workspace.targetPrice)}</div>
              <div className="text-xs text-gray-500">Deal Value</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-base font-bold text-gray-900">
                {stats.dd.completed}/{stats.dd.total}
                {stats.dd.overdue > 0 && <span className="text-xs font-normal text-red-500 ml-1">· {stats.dd.overdue} overdue</span>}
              </div>
              <div className="text-xs text-gray-500">DD Tasks</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-base font-bold text-gray-900">{stats.vdr.documents}</div>
              <div className="text-xs text-gray-500">Data Room Docs</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-base font-bold text-gray-900">{stats.team?.members || 0}</div>
              <div className="text-xs text-gray-500">Team Members</div>
            </div>
          </div>
        </div>
      </div>

      {/* Guided Deal Flow - shown in simplified mode */}
      {simplifiedMode && workspaceId && (
        <div className="px-6 pt-4">
          <GuidedDealFlow workspaceId={workspaceId} />
        </div>
      )}

      {/* ─── Tab Rail + Content ───────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-6">
          <TabsList className="h-auto bg-transparent p-0 gap-0 flex">
            <TabsTrigger value="overview" data-testid="tab-overview" className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-gray-600 hover:text-gray-900">
              <LayoutDashboard className="h-4 w-4" /><span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="financials" data-testid="tab-financials" className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-gray-600 hover:text-gray-900">
              <Calculator className="h-4 w-4" /><span className="hidden sm:inline">Financials</span>
            </TabsTrigger>
            <TabsTrigger value="diligence" data-testid="tab-diligence" className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-gray-600 hover:text-gray-900">
              <ClipboardList className="h-4 w-4" /><span className="hidden sm:inline">Diligence</span>
              {stats.dd.overdue > 0 && <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">{stats.dd.overdue}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="dd-status" data-testid="tab-dd-status" className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-gray-600 hover:text-gray-900">
              <ClipboardCheck className="h-4 w-4" /><span className="hidden sm:inline">DD Status</span>
            </TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents" className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-gray-600 hover:text-gray-900">
              <FolderOpen className="h-4 w-4" /><span className="hidden sm:inline">Documents</span>
            </TabsTrigger>
            <TabsTrigger value="competition" data-testid="tab-competition" className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-gray-600 hover:text-gray-900">
              <Swords className="h-4 w-4" /><span className="hidden sm:inline">Competition</span>
            </TabsTrigger>
            <TabsTrigger value="scoring" data-testid="tab-scoring" className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-gray-600 hover:text-gray-900">
              <Award className="h-4 w-4" /><span className="hidden sm:inline">Scoring</span>
            </TabsTrigger>
            <TabsTrigger value="team" data-testid="tab-team" className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-gray-600 hover:text-gray-900">
              <Users className="h-4 w-4" /><span className="hidden sm:inline">Team</span>
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{stats.team?.members || 0}</Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        <main className="flex-1 overflow-y-auto px-6 py-4">

        {/* ═══ OVERVIEW TAB ═══ */}
        <TabsContent value="overview" className="space-y-4 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-600" />Deal Value</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(workspace.targetPrice)}</div>
                {workspace.expectedCloseDate && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="h-3.5 w-3.5" />Expected close: {format(new Date(workspace.expectedCloseDate), 'MM/dd/yyyy')}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4 text-purple-600" />Due Diligence</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold">{stats.dd.completed}/{stats.dd.total}</span>
                  <span className="text-sm text-muted-foreground">tasks</span>
                </div>
                <Progress value={ddProgress} className="h-2" />
                {stats.dd.overdue > 0 && (
                  <p className="text-sm text-red-600 mt-2 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{stats.dd.overdue} overdue</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FolderOpen className="h-4 w-4 text-blue-600" />Data Room</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div><div className="text-2xl font-bold">{stats.vdr.documents}</div><p className="text-sm text-muted-foreground">documents</p></div>
                  <div><div className="text-2xl font-bold">{stats.vdr.folders}</div><p className="text-sm text-muted-foreground">folders</p></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Milestones */}
          {milestones.length > 0 && (
            <Card className="">
              <CardHeader><CardTitle className="text-base">Milestones</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {milestones.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between p-2 rounded bg-muted">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{m.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{format(new Date(m.dueDate), 'MM/dd/yyyy')}</span>
                        <Badge variant={m.status === 'completed' ? 'default' : m.status === 'overdue' ? 'destructive' : 'outline'} className="text-xs">
                          {m.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity (uses existing vdrAuditLogs fields) */}
          <Card className="">
            <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
            <CardContent>
              {data.recentActivity && data.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {data.recentActivity.slice(0, 5).map((a: any) => (
                    <div key={a.id} className="flex items-start gap-3 text-sm">
                      <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-3 w-3 text-blue-600" />
                      </div>
                      <div>
                        <span className="font-medium capitalize">{a.eventType?.replace(/_/g, ' ')}</span>
                        {a.metadata?.name && <span className="text-muted-foreground"> — {a.metadata.name}</span>}
                        <div className="text-xs text-muted-foreground">{a.timestamp ? format(new Date(a.timestamp), 'MMM d, h:mm a') : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ FINANCIALS TAB ═══ */}
        <TabsContent value="financials" className="space-y-4 mt-0">
          <Card>
            <CardHeader><CardTitle>Financial Modeling</CardTitle><CardDescription>Valuation analysis, pro forma, and exit strategies</CardDescription></CardHeader>
            <CardContent>
              {workspace.modelingProjectId ? (
                <div className="space-y-4">
                  <p>Linked modeling project ID: <strong>{workspace.modelingProjectId}</strong></p>
                  <Button onClick={() => navigate(`/modeling/projects/${workspace.modelingProjectId}`)}>
                    <Calculator className="h-4 w-4 mr-2" />Open Modeling Project
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calculator className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No modeling project linked</h3>
                  <p className="text-muted-foreground mb-4">Create or link a modeling project to run valuations and scenarios.</p>
                  <div className="flex justify-center gap-2">
                    <Button variant="outline">Link Existing</Button>
                    <Button>Create New Project</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ DILIGENCE TAB ═══ */}
        <TabsContent value="diligence" className="space-y-4 mt-0">
          {simplifiedMode ? (
            <SimplifiedDDChecklist workspaceId={workspaceId} />
          ) : (
            <>
              {!hasDDProject && (
                <Card className="mb-4">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Due Diligence Project Not Created</p>
                        <p className="text-xs text-muted-foreground">Create to set up tasks, data room, and milestones.</p>
                      </div>
                      <Button size="sm" onClick={() => setShowCreateDDDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />Create Due Diligence Project
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              <DdChecklistPanel workspaceId={workspaceId} />
            </>
          )}
        </TabsContent>

        {/* ═══ DD STATUS TAB ═══ */}
        <TabsContent value="dd-status" className="space-y-4 mt-0">
          {hasDDProject && workspace.ddProjectId ? (
            <DDStatusReport projectId={workspace.ddProjectId} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Due Diligence Project</h3>
                <p className="text-muted-foreground mb-4">Create a Due Diligence project to view status reports.</p>
                <Button variant="outline" onClick={() => { handleTabChange('diligence'); setShowCreateDDDialog(true); }}>
                  Go to Diligence
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ DOCUMENTS TAB ═══ */}
        <TabsContent value="documents" className="space-y-4 mt-0">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div><CardTitle>Data Room</CardTitle><CardDescription>Secure document storage and sharing</CardDescription></div>
                {hasDDProject && agreementInfo?.executed && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportToc}>
                      <Download className="h-4 w-4 mr-2" />Export ToC
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!hasDDProject ? (
                <div className="text-center py-12">
                  <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No data room created</h3>
                  <p className="text-muted-foreground mb-4">Create a Due Diligence project first to set up the data room.</p>
                  <Button variant="outline" onClick={() => { setActiveTab('diligence'); setShowCreateDDDialog(true); }}>
                    Go to Diligence
                  </Button>
                </div>
              ) : needsCA || vdrIsCABlocked ? (
                /* CA GATE */
                <div className="text-center py-12">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-amber-500" />
                  <h3 className="text-lg font-medium mb-2">Confidentiality Agreement Required</h3>
                  <p className="text-muted-foreground mb-4">
                    You must execute the Confidentiality Agreement before accessing the Data Room.
                  </p>
                  <Button onClick={() => setShowCADialog(true)}>
                    <Lock className="h-4 w-4 mr-2" />Review & Execute Agreement
                  </Button>
                </div>
              ) : vdrTree ? (
                /* VDR TREE */
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-muted-foreground">
                      {vdrTree.totalFolders} folders · {vdrTree.totalDocuments} documents
                    </div>
                  </div>
                  <div className="border rounded-lg p-3 max-h-[500px] overflow-y-auto">
                    {vdrTree.folders.length > 0 ? (
                      renderFolderTree(vdrTree.folders)
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Data room is empty</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Skeleton className="h-64 w-full" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TEAM TAB ═══ */}
        <TabsContent value="team" className="space-y-4 mt-0">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div><CardTitle>Team & Collaborators</CardTitle><CardDescription>Manage access and permissions</CardDescription></div>
                <Button onClick={() => setShowInviteDialog(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />Invite Member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {members.length > 0 ? (
                <div className="space-y-2">
                  {members.map((member: any) => (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Users className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{member.displayName || member.email || `User ${member.userId?.slice(0, 8)}`}</div>
                          <div className="text-xs text-muted-foreground">{member.email || 'Internal user'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{ROLE_LABELS[member.role] || member.role}</Badge>
                        <Badge variant="secondary" className="text-xs">VDR: {member.vdrPermission?.replace(/_/g, ' ')}</Badge>
                        <Badge variant="secondary" className="text-xs">DD: {member.ddPermission}</Badge>
                        {member.role !== 'owner_admin' && (
                          <Button
                            variant="ghost" size="sm" className="text-red-600 h-7 px-2"
                            onClick={() => workspaceId && revokeMember.mutate({ workspaceId, memberId: member.id })}
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No team members yet</h3>
                  <p className="text-muted-foreground mb-4">Invite team members to collaborate on this workspace.</p>
                  <Button onClick={() => setShowInviteDialog(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />Invite First Member
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ COMPETITION TAB ═══ */}
        <TabsContent value="competition" className="space-y-4 mt-0">
          <CompetitiveTracker
            dealId={workspaceId!}
            ourBid={workspace.targetPrice ? Number(workspace.targetPrice) : undefined}
          />
        </TabsContent>

        {/* ═══ SCORING TAB ═══ */}
        <TabsContent value="scoring" className="space-y-4 mt-0">
          <DealScoringCard dealId={workspaceId!} dealTitle={workspace.name} />
        </TabsContent>

        </main>
      </Tabs>

      {/* ═══ CREATE DD DIALOG ═══ */}
      <Dialog open={showCreateDDDialog} onOpenChange={setShowCreateDDDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Due Diligence Project</DialogTitle>
            <DialogDescription>
              This will create the standard DD checklist (28 tasks),
              VDR folder tree, confidentiality agreement, and milestones in one step.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>DD Expiration Date</Label>
              <Input type="date" value={ddExpiration} onChange={e => setDdExpiration(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Closing Date</Label>
              <Input type="date" value={closingDate} onChange={e => setClosingDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDDDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateDD} disabled={createDD.isPending}>
              {createDD.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create DD + Data Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ INVITE MEMBER DIALOG ═══ */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>Add an internal user or external collaborator to this workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input placeholder="email@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([val, lbl]) => (
                      <SelectItem key={val} value={val}>{lbl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Room Access</Label>
                <Select value={inviteVdr} onValueChange={setInviteVdr}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_access">No Access</SelectItem>
                    <SelectItem value="view_only">View Only</SelectItem>
                    <SelectItem value="view_download">View & Download</SelectItem>
                    <SelectItem value="view_download_print">View, Download & Print</SelectItem>
                    <SelectItem value="full_access">Full Access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviteMember.isPending}>
              {inviteMember.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ DOCUMENT VERSION HISTORY DIALOG ═══ */}
      <Dialog open={showVersionHistory} onOpenChange={setShowVersionHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>View and manage document versions</DialogDescription>
          </DialogHeader>
          {selectedDocId && <DocumentVersions documentId={selectedDocId} />}
        </DialogContent>
      </Dialog>

      {/* ═══ CA EXECUTION DIALOG ═══ */}
      <Dialog open={showCADialog} onOpenChange={setShowCADialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{agreementInfo?.agreement?.title || 'Confidentiality Agreement'}</DialogTitle>
            <DialogDescription>Please read and execute the following agreement to access the Data Room.</DialogDescription>
          </DialogHeader>
          {agreementInfo?.agreement?.bodyHtml && (
            <div
              className="border rounded-lg p-4 my-4 max-h-[400px] overflow-y-auto text-sm"
              dangerouslySetInnerHTML={{ __html: agreementInfo.agreement.bodyHtml }}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCADialog(false)}>Cancel</Button>
            <Button onClick={handleExecuteCA} disabled={executeAgreement.isPending}>
              {executeAgreement.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Shield className="h-4 w-4 mr-2" />I Agree & Execute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
