import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileBarChart, Plus, FolderOpen, Briefcase } from "lucide-react";
import { ProjectHeader } from "@/components/project-header";
import { ThirdPartyReports } from "@/components/third-party-reports";
import { DocumentsWorkspace } from "@/components/vdr/DocumentsWorkspace";
import { ProjectSetup } from "@/components/project-setup";
import { TimelineView } from "@/components/timeline-view";
import { TaskOwnersView } from "@/components/task-owners-view";
import { ProjectIntegrationSettings } from "@/components/project-integration-settings";
import { AddTaskModal } from "@/components/add-task-modal";
import { KeyContactsSection } from "@/components/key-contacts-section";
import { ArchiveView } from "@/components/archive-view";
import { CddAdvisor } from "@/components/cdd-advisor";
import { FindingsManager } from "@/components/findings-manager";
import { KpisOverview } from "@/components/kpis-overview";
import { TemplatesView } from "@/components/templates-view";
import { PortfolioPropertiesView } from "@/components/portfolio-properties-view";
import NotificationSettingsPage from "@/pages/notification-settings";
import DdChecklistProjectWrapper from "@/components/workspace/DdChecklistProjectWrapper";
import { useProject } from "@/hooks/use-project";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { differenceInDays, format, parseISO } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calendar, Clock, AlertTriangle, CheckCircle2, TrendingUp,
  DollarSign, Building2, User, ExternalLink, Target, Shield,
  ChevronRight, Anchor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DDTask } from "@shared/schema";


// ── DD Overview Tab ───────────────────────────────────────────────────
function DDOverviewTab({ project, tasks, settings }: { project: any; tasks: any[]; settings: any }) {
  // Fetch linked deal — only if the project has an explicit dealId FK set
  const linkedDealId = project.dealId || null;
  const { data: linkedDeal } = useQuery({
    queryKey: ['dd-linked-deal', project.id, linkedDealId],
    enabled: !!linkedDealId,
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', `/api/deals/${linkedDealId}`);
        if (!res.ok) return null;
        return await res.json();
      } catch { return null; }
    },
    retry: false,
  });

  // Task stats
  const totalTasks = tasks.length;
  const completed = tasks.filter((t: any) => t.status === 'completed').length;
  const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length;
  const overdue = tasks.filter((t: any) => {
    if (t.status === 'completed') return false;
    if (!t.deadline) return false;
    return new Date(t.deadline) < new Date();
  }).length;
  const pct = totalTasks ? Math.round((completed / totalTasks) * 100) : 0;

  // Task breakdown by category
  const byCategory = tasks.reduce((acc: any, t: any) => {
    const cat = t.category || 'other';
    if (!acc[cat]) acc[cat] = { total: 0, done: 0 };
    acc[cat].total++;
    if (t.status === 'completed') acc[cat].done++;
    return acc;
  }, {});

  // Key dates
  const now = new Date();
  const dates = [
    { label: 'PSA Signed', date: project.psaSignedDate, icon: Shield, color: 'blue' },
    { label: 'DD Expiration', date: project.ddExpirationDate, icon: AlertTriangle, color: 'amber', urgent: true },
    { label: 'Closing Date', date: project.closingDate, icon: Calendar, color: 'emerald' },
  ].filter(d => d.date);

  const categoryColors: Record<string, string> = {
    title: 'bg-blue-500', survey: 'bg-purple-500', ESA: 'bg-green-500',
    appraisal: 'bg-amber-500', inspection: 'bg-orange-500', permits: 'bg-cyan-500',
    zoning: 'bg-indigo-500', financial: 'bg-emerald-500', legal: 'bg-red-500',
    insurance: 'bg-pink-500', other: 'bg-gray-400',
  };

  return (
    <div className="space-y-6">
      {/* Top KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 p-4">
          <p className="text-xs text-blue-500 mb-1">Total Tasks</p>
          <p className="text-3xl font-bold text-blue-700">{totalTasks}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
          <p className="text-xs text-emerald-500 mb-1">Completed</p>
          <p className="text-3xl font-bold text-emerald-700">{completed}</p>
          <p className="text-xs text-emerald-400 mt-0.5">{pct}%</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 p-4">
          <p className="text-xs text-amber-500 mb-1">In Progress</p>
          <p className="text-3xl font-bold text-amber-700">{inProgress}</p>
        </div>
        <div className={`rounded-xl p-4 ${overdue > 0 ? 'bg-gradient-to-br from-red-50 to-red-100' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}>
          <p className={`text-xs mb-1 ${overdue > 0 ? 'text-red-500' : 'text-gray-400'}`}>Overdue</p>
          <p className={`text-3xl font-bold ${overdue > 0 ? 'text-red-700' : 'text-gray-400'}`}>{overdue}</p>
        </div>
      </div>

      {/* Overall progress bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">Overall Progress</p>
            <p className="text-sm font-bold text-blue-600">{pct}%</p>
          </div>
          <Progress value={pct} className="h-3" />
          <p className="text-xs text-gray-400 mt-1.5">{completed} of {totalTasks} tasks complete</p>
        </CardContent>
      </Card>

      {/* Key Dates */}
      {dates.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Key Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {dates.map(({ label, date, icon: Icon, color, urgent }) => {
                const d = new Date(date);
                const daysLeft = differenceInDays(d, now);
                const isPast = daysLeft < 0;
                const isSoon = !isPast && daysLeft <= 7;
                return (
                  <div key={label} className={cn(
                    'rounded-xl p-3 border-2 transition-colors',
                    isPast && urgent ? 'border-red-300 bg-red-50' :
                    isSoon && urgent ? 'border-amber-300 bg-amber-50' :
                    `border-${color}-200 bg-${color}-50/50`
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={cn('h-3.5 w-3.5', isPast && urgent ? 'text-red-500' : isSoon && urgent ? 'text-amber-500' : `text-${color}-500`)} />
                      <p className="text-xs font-medium text-gray-600">{label}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-800">{format(d, 'MM/dd/yyyy')}</p>
                    <p className={cn('text-xs mt-0.5 font-medium',
                      isPast ? 'text-red-600' : isSoon ? 'text-amber-600' : 'text-gray-400'
                    )}>
                      {isPast ? `${Math.abs(daysLeft)}d ago` : daysLeft === 0 ? 'Today' : `${daysLeft}d remaining`}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task breakdown by category */}
      {Object.keys(byCategory).length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-500" />
              Progress by Category
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2.5">
            {Object.entries(byCategory)
              .sort((a: any, b: any) => b[1].total - a[1].total)
              .map(([cat, stats]: any) => {
                const catPct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
                const color = categoryColors[cat] || 'bg-gray-400';
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${color}`} />
                        <span className="text-xs font-medium text-gray-700 capitalize">{cat}</span>
                      </div>
                      <span className="text-xs text-gray-500">{stats.done}/{stats.total} · {catPct}%</span>
                    </div>
                    <Progress value={catPct} className="h-1.5" />
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}

      {/* CRM cross-links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {linkedDeal && (
          <Card className="hover:shadow-md cursor-pointer transition-shadow"
            onClick={() => window.location.href = `/crm/deals/${linkedDeal.id}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-100 p-2.5 shrink-0">
                  <DollarSign className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">Linked Deal</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{linkedDeal.title || linkedDeal.name}</p>
                  {linkedDeal.value && (
                    <p className="text-xs text-emerald-600 font-medium">${parseFloat(linkedDeal.value || linkedDeal.amount || '0').toLocaleString()}</p>
                  )}
                </div>
                <ExternalLink className="h-4 w-4 text-gray-400 shrink-0" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress Report link */}
        <Card className="hover:shadow-md cursor-pointer transition-shadow"
          onClick={() => window.location.href = `/dd/projects/${project.id}/progress-report`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2.5 shrink-0">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400">Reports</p>
                <p className="text-sm font-semibold text-gray-900">Progress Report</p>
                <p className="text-xs text-gray-400">PDF export · executive summary</p>
              </div>
              <ExternalLink className="h-4 w-4 text-gray-400 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs extracted from documents */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Extracted KPIs</p>
        <KpisOverview projectId={project.id} />
      </div>

      {/* Findings */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Findings & Issues</p>
        <FindingsManager projectId={project.id} />
      </div>
    </div>
  );
}

export default function ProjectPage() {
  const { id } = useParams();
  const [location] = useLocation();
  const urlTab = new URLSearchParams(window.location.search).get('tab');
  const [activeTab, setActiveTab] = useState<string | null>(urlTab);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<DDTask | null>(null);
  
  const { data, isLoading, error } = useProject(id!);
  

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-6"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Project not found</h1>
          <Link href="/dd/projects">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { project, settings, tasks } = data;

  const handleTaskClick = (taskId: string) => {
    // Ensure we're on the Tasks & Timeline tab
    setActiveTab('reports');
    
    // Use requestAnimationFrame to ensure the tab switch has been rendered
    requestAnimationFrame(() => {
      const taskElement = document.querySelector(`[data-testid="task-summary-card-${taskId}"]`) as HTMLElement | null;
      if (taskElement) {
        // Scroll to the task summary card
        taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add highlight effect
        taskElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'transition-all', 'duration-300');
        
        // Remove highlight effect after 1200ms
        setTimeout(() => {
          taskElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'transition-all', 'duration-300');
        }, 1200);
      }
    });
  };

  const isPortfolio = project.projectType === "portfolio";
  
  const effectiveActiveTab = activeTab || (isPortfolio ? "portfolio" : "overview");

  const baseTabs = [
    { id: "overview", label: "Overview" },
    { id: "reports", label: "Tasks & Timeline" },
    { id: "documents", label: "Documents" },
    { id: "ddrequest", label: "DD Request" },
    { id: "templates", label: "Templates" },
    { id: "setup", label: "Deal Details" },
    { id: "owners", label: "Task Owners" },
    { id: "contacts", label: "Deal Team" },
    { id: "integrations", label: "Integrations" },
    { id: "notifications", label: "Notifications" },
    { id: "archive", label: "Archive" },
  ];

  const tabs = isPortfolio 
    ? [{ id: "portfolio", label: "Portfolio Properties" }, ...baseTabs]
    : baseTabs;

  return (
    <div className="min-h-screen bg-background" data-testid="project-page">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/dd/projects">
                <Button variant="ghost" size="sm" data-testid="link-back-dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <h1 className="text-xl font-semibold text-primary">Due Diligence Tracker</h1>
              <span className="text-sm text-muted-foreground">MarinaMatch</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                JD
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProjectHeader project={project} tasks={tasks} settings={settings} />

        {/* Tab Navigation */}
        <div className="mb-6">
          <nav className="flex space-x-1 bg-muted p-1 rounded-lg" data-testid="tab-navigation">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  effectiveActiveTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`tab-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
            
            {/* Add Task Button */}
            <div className="flex-1"></div>
            <Button
              onClick={() => setIsTaskModalOpen(true)}
              variant="default"
              size="sm"
              className="ml-auto px-4 py-2 h-auto text-sm font-medium"
              data-testid="add-task-button-header"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {effectiveActiveTab === "portfolio" && isPortfolio && (
            <PortfolioPropertiesView portfolioId={project.id} portfolioName={project.name} />
          )}
          {effectiveActiveTab === "overview" && !isPortfolio && (
            <DDOverviewTab project={project} tasks={tasks} settings={settings} />
          )}
          {effectiveActiveTab === "reports" && (
            <>
              {/* Timeline - Professional View (Only on Tasks & Timeline tab) */}
              <div className="mb-8">
                <TimelineView tasks={tasks} project={project} settings={settings} onTaskClick={handleTaskClick} />
              </div>
              <ThirdPartyReports tasks={tasks} projectId={project.id} project={project} settings={settings} />
            </>
          )}
          {effectiveActiveTab === "documents" && (
            <div className="h-[calc(100dvh-20rem)] border rounded-lg bg-card overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold">Data Room</h2>
                </div>
                <Link href={`/vdr/projects/${project.id}`}>
                  <Button variant="outline" size="sm">
                    Open Full Data Room
                  </Button>
                </Link>
              </div>
              <div className="h-[calc(100%-4rem)]">
                <DocumentsWorkspace projectId={project.id} />
              </div>
            </div>
          )}
          {effectiveActiveTab === "ddrequest" && (
            <DdChecklistProjectWrapper projectId={project.id} projectName={project.name} />
          )}
          {effectiveActiveTab === "templates" && (
            <TemplatesView projectId={project.id} />
          )}
          {effectiveActiveTab === "setup" && (
            <ProjectSetup project={project} settings={settings} tasks={tasks} />
          )}
          {effectiveActiveTab === "owners" && (
            <TaskOwnersView tasks={tasks} projectId={project.id} />
          )}
          {effectiveActiveTab === "contacts" && (
            <KeyContactsSection projectId={project.id} />
          )}
          {effectiveActiveTab === "integrations" && (
            <ProjectIntegrationSettings projectId={project.id} />
          )}
          {effectiveActiveTab === "notifications" && (
            <NotificationSettingsPage projectId={project.id} />
          )}
          {effectiveActiveTab === "archive" && (
            <ArchiveView projectId={project.id} />
          )}
        </div>
      </div>

      {/* Task Edit Modal */}
      <AddTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        projectId={project.id}
        editingTask={editingTask}
      />
    </div>
  );
}
