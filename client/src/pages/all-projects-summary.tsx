import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { tzNow, formatLargeCurrency } from "@/lib/date-utils";
import { 
  FileText, 
  Calendar, 
  Clock,
  CheckCircle,
  AlertTriangle,
  Download,
  Target,
  Activity,
  DollarSign,
  TrendingUp,
  Building2,
  AlertCircle,
  Info,
  Plus,
  X
} from "lucide-react";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Project, DDTask } from "@shared/schema";

type ModalType = "deadlines" | "overdue" | "projects" | "progress" | "actions" | "investment" | null;

interface ProjectSummary {
  project: Project;
  tasks: DDTask[];
  completionPct: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  upcomingDeadlines: number;
  totalCost: number;
  paidCost: number;
  daysToClosing: number | null;
  daysRemaining: number | null;
}

export default function AllProjectsSummaryPage() {
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  
  // Fetch all projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/dd/projects"],
  });

  // Fetch tasks for all projects
  const projectIds = projects.map(p => p.id);
  const taskQueries = projectIds.map(projectId => ({
    queryKey: [`/api/dd/projects/${projectId}/tasks`],
  }));

  const { data: allTasksData = [] } = useQuery<DDTask[][]>({
    queryKey: ["all-projects-tasks", ...projectIds],
    queryFn: async () => {
      const responses = await Promise.all(
        projectIds.map(id => fetch(`/api/dd/projects/${id}/tasks`))
      );
      return Promise.all(responses.map(r => r.json()));
    },
    enabled: projectIds.length > 0,
  });

  // Calculate summaries for each project
  const projectSummaries = useMemo<ProjectSummary[]>(() => {
    if (!projects.length || !allTasksData.length) return [];

    const now = tzNow();
    
    return projects.map((project, index) => {
      const tasks = allTasksData[index] || [];
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const totalTasks = tasks.length;
      const completionPct = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Count overdue tasks
      const overdueTasks = tasks.filter(t => {
        if (t.status === 'completed' || !t.deadline) return false;
        return parseISO(t.deadline) < now;
      }).length;

      // Count upcoming deadlines (within 7 days)
      const upcomingDeadlines = tasks.filter(t => {
        if (t.status === 'completed' || !t.deadline) return false;
        const deadline = parseISO(t.deadline);
        const daysUntil = differenceInCalendarDays(deadline, now);
        return daysUntil >= 0 && daysUntil <= 7;
      }).length;

      // Calculate costs
      const totalCost = tasks.reduce((sum, t) => {
        const cost = parseFloat(t.cost?.replace(/[^0-9.-]/g, '') || '0');
        return sum + (isNaN(cost) ? 0 : cost);
      }, 0);

      const paidCost = tasks.reduce((sum, t) => {
        if (t.paymentStatus !== 'paid') return sum;
        const cost = parseFloat(t.cost?.replace(/[^0-9.-]/g, '') || '0');
        return sum + (isNaN(cost) ? 0 : cost);
      }, 0);

      // Calculate days to closing
      let daysToClosing: number | null = null;
      if (project.closingDate) {
        daysToClosing = differenceInCalendarDays(parseISO(project.closingDate), now);
      }

      // Calculate DD days remaining
      let daysRemaining: number | null = null;
      if (project.ddExpirationDate) {
        daysRemaining = differenceInCalendarDays(parseISO(project.ddExpirationDate), now);
      }

      return {
        project,
        tasks,
        completionPct,
        totalTasks,
        completedTasks,
        overdueTasks,
        upcomingDeadlines,
        totalCost,
        paidCost,
        daysToClosing,
        daysRemaining,
      };
    });
  }, [projects, allTasksData]);

  // Overall statistics
  const overallStats = useMemo(() => {
    const totalProjects = projectSummaries.length;
    const completedProjects = projectSummaries.filter(ps => ps.project.status === 'accepted').length;
    const activeProjects = totalProjects - completedProjects;
    const totalTasks = projectSummaries.reduce((sum, ps) => sum + ps.totalTasks, 0);
    const completedTasks = projectSummaries.reduce((sum, ps) => sum + ps.completedTasks, 0);
    const overallCompletionPct = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const totalOverdue = projectSummaries.reduce((sum, ps) => sum + ps.overdueTasks, 0);
    const totalUpcoming = projectSummaries.reduce((sum, ps) => sum + ps.upcomingDeadlines, 0);
    const totalInvestment = projectSummaries.reduce((sum, ps) => sum + ps.totalCost, 0);
    const totalPaid = projectSummaries.reduce((sum, ps) => sum + ps.paidCost, 0);

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      totalTasks,
      completedTasks,
      overallCompletionPct,
      totalOverdue,
      totalUpcoming,
      totalInvestment,
      totalPaid,
    };
  }, [projectSummaries]);

  // Computed data for modals
  const modalData = useMemo(() => {
    const now = tzNow();
    
    // Upcoming deadlines (within 7 days)
    const upcomingTasks: Array<{ task: DDTask; project: Project; daysUntil: number }> = [];
    projectSummaries.forEach(ps => {
      ps.tasks.forEach(t => {
        if (t.status === 'completed' || !t.deadline) return;
        const deadline = parseISO(t.deadline);
        const daysUntil = differenceInCalendarDays(deadline, now);
        if (daysUntil >= 0 && daysUntil <= 7) {
          upcomingTasks.push({ task: t, project: ps.project, daysUntil });
        }
      });
    });
    upcomingTasks.sort((a, b) => a.daysUntil - b.daysUntil);

    // Overdue tasks
    const overdueTasks: Array<{ task: DDTask; project: Project; daysOverdue: number }> = [];
    projectSummaries.forEach(ps => {
      ps.tasks.forEach(t => {
        if (t.status === 'completed' || !t.deadline) return;
        const deadline = parseISO(t.deadline);
        const daysOverdue = differenceInCalendarDays(now, deadline);
        if (daysOverdue > 0) {
          overdueTasks.push({ task: t, project: ps.project, daysOverdue });
        }
      });
    });
    overdueTasks.sort((a, b) => b.daysOverdue - a.daysOverdue);

    // Investment by project
    const investmentByProject = projectSummaries.map(ps => ({
      project: ps.project,
      totalCost: ps.totalCost,
      paidCost: ps.paidCost,
      tasks: ps.tasks.filter(t => {
        const cost = parseFloat(t.cost?.replace(/[^0-9.-]/g, '') || '0');
        return !isNaN(cost) && cost > 0;
      }).map(t => ({
        ...t,
        parsedCost: parseFloat(t.cost?.replace(/[^0-9.-]/g, '') || '0'),
      })),
    })).filter(p => p.totalCost > 0);

    return { upcomingTasks, overdueTasks, investmentByProject };
  }, [projectSummaries]);

  const handlePrint = () => {
    window.print();
  };

  if (projectsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading project data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - No print */}
      <div className="print:hidden bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Portfolio Summary Report</h1>
              <p className="text-sm text-gray-500">All Projects Overview</p>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={handlePrint} data-testid="button-print">
                <Download className="h-4 w-4 mr-2" />
                Print / Export PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Print Header */}
        <div className="hidden print:block mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Portfolio Summary Report</h1>
          <p className="text-gray-600">Generated on {format(new Date(), 'MMMM dd, yyyy')}</p>
        </div>

        {/* Hostaway-Style Today's Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Upcoming Tasks */}
          <Card 
            className="border-l-4 border-l-amber-500 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setActiveModal("deadlines")}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  Upcoming Deadlines
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Tasks due within the next 7 days</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  Next 7 Days
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-amber-600 mb-1">{overallStats.totalUpcoming}</div>
              <p className="text-sm text-muted-foreground">Tasks due soon</p>
            </CardContent>
          </Card>

          {/* Overdue Tasks */}
          <Card 
            className="border-l-4 border-l-red-500 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setActiveModal("overdue")}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  Overdue Tasks
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Tasks past their deadline</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
                {overallStats.totalOverdue > 0 && (
                  <Badge variant="destructive">
                    Action Required
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-red-600 mb-1">{overallStats.totalOverdue}</div>
              <p className="text-sm text-muted-foreground">Past deadline</p>
            </CardContent>
          </Card>
        </div>

        {/* Overall Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card 
            className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setActiveModal("projects")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-gray-900">{overallStats.totalProjects}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {overallStats.activeProjects} active, {overallStats.completedProjects} completed
                  </div>
                </div>
                <Building2 className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border-l-4 border-l-green-500 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setActiveModal("progress")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Overall Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-3xl font-bold text-gray-900">{Math.round(overallStats.overallCompletionPct)}%</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {overallStats.completedTasks} of {overallStats.totalTasks} tasks
                  </div>
                  <Progress value={overallStats.overallCompletionPct} className="mt-2" />
                </div>
                <Target className="h-8 w-8 text-green-500 ml-4" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border-l-4 border-l-purple-500 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setActiveModal("actions")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Action Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
                    <span className="text-sm text-gray-600">Overdue</span>
                  </div>
                  <span className="text-lg font-bold text-red-600">{overallStats.totalOverdue}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 text-amber-500 mr-2" />
                    <span className="text-sm text-gray-600">Upcoming (7d)</span>
                  </div>
                  <span className="text-lg font-bold text-amber-600">{overallStats.totalUpcoming}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border-l-4 border-l-emerald-500 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setActiveModal("investment")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Investment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{formatLargeCurrency(overallStats.totalInvestment)}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatLargeCurrency(overallStats.totalPaid)} paid ({Math.round((overallStats.totalPaid / (overallStats.totalInvestment || 1)) * 100)}%)
                  </div>
                </div>
                <DollarSign className="h-8 w-8 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Individual Project Summaries */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Project Details
            </CardTitle>
            <CreateProjectDialog />
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {projectSummaries.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No projects found</p>
                </div>
              ) : (
                projectSummaries.map((summary) => (
                  <Link key={summary.project.id} href={`/dd/projects/${summary.project.id}`}>
                    <div className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{summary.project.name}</h3>
                            {/* Badge priority: Completed > DD Accepted > DD Expired > DD Expiring Soon */}
                            {summary.completionPct === 100 ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Completed
                              </Badge>
                            ) : summary.project.status === 'accepted' ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                DD Accepted
                              </Badge>
                            ) : summary.daysRemaining !== null && summary.daysRemaining < 0 ? (
                              <Badge className="bg-red-100 text-red-800 border-red-200">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                DD Expired
                              </Badge>
                            ) : summary.daysRemaining !== null && summary.daysRemaining > 0 && summary.daysRemaining <= 14 ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                                <Clock className="h-3 w-3 mr-1" />
                                DD Expiring Soon
                              </Badge>
                            ) : null}
                          </div>
                          {summary.project.description && (
                            <p className="text-sm text-gray-600 mb-2">{summary.project.description}</p>
                          )}
                          {(summary.project.city || summary.project.state) && (
                            <p className="text-sm text-gray-500">
                              {[summary.project.city, summary.project.state].filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            data-testid={`button-view-report-${summary.project.id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              window.location.href = `/projects/${summary.project.id}/progress-report`;
                            }}
                          >
                            View Full Report
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            data-testid={`button-data-room-${summary.project.id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              window.location.href = `/vdr/projects/${summary.project.id}`;
                            }}
                          >
                            Data Room
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            data-testid={`button-dd-request-${summary.project.id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              window.location.href = `/vdr/projects/${summary.project.id}?tab=requests`;
                            }}
                          >
                            DD Request
                          </Button>
                        </div>
                      </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Progress</div>
                        <div className="flex items-center space-x-2">
                          <Progress 
                            value={summary.project.status === 'accepted' ? 100 : summary.completionPct} 
                            className={`flex-1 ${summary.project.status === 'accepted' ? '[&>div]:bg-emerald-500' : ''}`}
                          />
                          <span className="text-sm font-medium text-gray-900">
                            {summary.project.status === 'accepted' ? '100' : Math.round(summary.completionPct)}%
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {summary.completedTasks} / {summary.totalTasks} tasks
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500 mb-1">DD Remaining</div>
                        <div className={`text-lg font-bold ${
                          summary.project.status === 'accepted' ? 'text-emerald-600' :
                          summary.daysRemaining === null ? 'text-gray-400' :
                          summary.daysRemaining < 0 ? 'text-red-600' :
                          summary.daysRemaining < 5 ? 'text-amber-600' :
                          'text-gray-900'
                        }`}>
                          {summary.project.status === 'accepted' ? 'DD Accepted' : 
                           summary.daysRemaining === null ? 'N/A' : `${summary.daysRemaining}d`}
                        </div>
                        {summary.project.ddExpirationDate && summary.project.status !== 'accepted' && (
                          <div className="text-xs text-gray-500 mt-1">
                            {format(parseISO(summary.project.ddExpirationDate), 'MMM dd, yyyy')}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-xs text-gray-500 mb-1">To Closing</div>
                        <div className={`text-lg font-bold ${
                          summary.daysToClosing === null ? 'text-gray-400' :
                          summary.daysToClosing < 0 ? 'text-red-600' :
                          'text-gray-900'
                        }`}>
                          {summary.daysToClosing === null ? 'N/A' : `${summary.daysToClosing}d`}
                        </div>
                        {summary.project.closingDate && (
                          <div className="text-xs text-gray-500 mt-1">
                            {format(parseISO(summary.project.closingDate), 'MMM dd, yyyy')}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-xs text-gray-500 mb-1">Total Cost</div>
                        <div className="text-lg font-bold text-gray-900">
                          {formatLargeCurrency(summary.totalCost)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatLargeCurrency(summary.paidCost)} paid
                        </div>
                      </div>
                    </div>

                    {(summary.overdueTasks > 0 || summary.upcomingDeadlines > 0) && (
                      <div className="flex items-center space-x-4 pt-3 border-t border-gray-100">
                        {summary.overdueTasks > 0 && (
                          <div className="flex items-center text-sm">
                            <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />
                            <span className="text-red-600 font-medium">{summary.overdueTasks} overdue task{summary.overdueTasks !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {summary.upcomingDeadlines > 0 && (
                          <div className="flex items-center text-sm">
                            <Clock className="h-4 w-4 text-amber-500 mr-1" />
                            <span className="text-amber-600 font-medium">{summary.upcomingDeadlines} upcoming deadline{summary.upcomingDeadlines !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Dialogs */}
      {/* Upcoming Deadlines Modal */}
      <Dialog open={activeModal === "deadlines"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Upcoming Deadlines (Next 7 Days)
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {modalData.upcomingTasks.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No upcoming deadlines in the next 7 days</p>
              </div>
            ) : (
              <div className="space-y-3">
                {modalData.upcomingTasks.map(({ task, project, daysUntil }) => (
                  <Link key={task.id} href={`/dd/projects/${project.id}`}>
                    <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{task.name}</p>
                          <p className="text-sm text-muted-foreground">{project.name}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant={daysUntil === 0 ? "destructive" : daysUntil <= 2 ? "warning" : "outline"}>
                            {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil} days`}
                          </Badge>
                          {task.deadline && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(parseISO(task.deadline), 'MMM dd, yyyy')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Overdue Tasks Modal */}
      <Dialog open={activeModal === "overdue"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Overdue Tasks
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {modalData.overdueTasks.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-300" />
                <p>No overdue tasks - great job!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {modalData.overdueTasks.map(({ task, project, daysOverdue }) => (
                  <Link key={task.id} href={`/dd/projects/${project.id}`}>
                    <div className="border border-red-200 bg-red-50 rounded-lg p-4 hover:bg-red-100 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{task.name}</p>
                          <p className="text-sm text-muted-foreground">{project.name}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="destructive">
                            {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                          </Badge>
                          {task.deadline && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Due: {format(parseISO(task.deadline), 'MMM dd, yyyy')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Projects List Modal */}
      <Dialog open={activeModal === "projects"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              All Projects ({overallStats.totalProjects})
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {projectSummaries.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No projects found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {projectSummaries.map((summary) => (
                  <Link key={summary.project.id} href={`/dd/projects/${summary.project.id}`}>
                    <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{summary.project.name}</p>
                            {summary.project.status === 'accepted' ? (
                              <Badge className="bg-green-100 text-green-800">Completed</Badge>
                            ) : (
                              <Badge variant="outline">Active</Badge>
                            )}
                          </div>
                          {(summary.project.city || summary.project.state) && (
                            <p className="text-sm text-muted-foreground">
                              {[summary.project.city, summary.project.state].filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{Math.round(summary.completionPct)}% complete</p>
                          <p className="text-xs text-muted-foreground">
                            {summary.completedTasks}/{summary.totalTasks} tasks
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Progress Breakdown Modal */}
      <Dialog open={activeModal === "progress"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-500" />
              Progress Breakdown by Project
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {projectSummaries.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No projects to show progress for</p>
              </div>
            ) : (
              <div className="space-y-4">
                {projectSummaries.map((summary) => (
                  <Link key={summary.project.id} href={`/dd/projects/${summary.project.id}`}>
                    <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-gray-900">{summary.project.name}</p>
                        <span className="text-sm font-bold text-gray-900">
                          {Math.round(summary.completionPct)}%
                        </span>
                      </div>
                      <Progress value={summary.completionPct} className="h-2 mb-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{summary.completedTasks} completed</span>
                        <span>{summary.totalTasks - summary.completedTasks} remaining</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Action Items Modal */}
      <Dialog open={activeModal === "actions"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-500" />
              Action Items Summary
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6">
              {/* Overdue Section */}
              <div>
                <h3 className="font-medium text-red-600 flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  Overdue ({modalData.overdueTasks.length})
                </h3>
                {modalData.overdueTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground pl-6">No overdue tasks</p>
                ) : (
                  <div className="space-y-2 pl-6">
                    {modalData.overdueTasks.slice(0, 5).map(({ task, project, daysOverdue }) => (
                      <Link key={task.id} href={`/dd/projects/${project.id}`}>
                        <div className="flex items-center justify-between p-2 border border-red-200 rounded bg-red-50 hover:bg-red-100 cursor-pointer">
                          <div>
                            <p className="text-sm font-medium">{task.name}</p>
                            <p className="text-xs text-muted-foreground">{project.name}</p>
                          </div>
                          <Badge variant="destructive" className="text-xs">
                            {daysOverdue}d overdue
                          </Badge>
                        </div>
                      </Link>
                    ))}
                    {modalData.overdueTasks.length > 5 && (
                      <p className="text-xs text-muted-foreground">+{modalData.overdueTasks.length - 5} more</p>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Upcoming Section */}
              <div>
                <h3 className="font-medium text-amber-600 flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4" />
                  Upcoming (7 days) ({modalData.upcomingTasks.length})
                </h3>
                {modalData.upcomingTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground pl-6">No upcoming deadlines</p>
                ) : (
                  <div className="space-y-2 pl-6">
                    {modalData.upcomingTasks.slice(0, 5).map(({ task, project, daysUntil }) => (
                      <Link key={task.id} href={`/dd/projects/${project.id}`}>
                        <div className="flex items-center justify-between p-2 border border-amber-200 rounded bg-amber-50 hover:bg-amber-100 cursor-pointer">
                          <div>
                            <p className="text-sm font-medium">{task.name}</p>
                            <p className="text-xs text-muted-foreground">{project.name}</p>
                          </div>
                          <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700">
                            {daysUntil === 0 ? "Today" : `${daysUntil}d`}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                    {modalData.upcomingTasks.length > 5 && (
                      <p className="text-xs text-muted-foreground">+{modalData.upcomingTasks.length - 5} more</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Investment Breakdown Modal */}
      <Dialog open={activeModal === "investment"} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              Investment Breakdown
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-emerald-700">Total Investment</p>
                  <p className="text-2xl font-bold text-emerald-900">{formatLargeCurrency(overallStats.totalInvestment)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-emerald-700">Paid</p>
                  <p className="text-lg font-medium text-emerald-900">
                    {formatLargeCurrency(overallStats.totalPaid)} ({Math.round((overallStats.totalPaid / (overallStats.totalInvestment || 1)) * 100)}%)
                  </p>
                </div>
              </div>
            </div>

            {modalData.investmentByProject.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No costs tracked yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {modalData.investmentByProject.map(({ project, totalCost, paidCost, tasks }) => (
                  <div key={project.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Link href={`/dd/projects/${project.id}`}>
                        <p className="font-medium text-gray-900 hover:text-blue-600 cursor-pointer">{project.name}</p>
                      </Link>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatLargeCurrency(totalCost)}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatLargeCurrency(paidCost)} paid
                        </p>
                      </div>
                    </div>
                    {tasks.length > 0 && (
                      <div className="pl-4 border-l-2 border-gray-200 space-y-1">
                        {tasks.slice(0, 3).map(t => (
                          <div key={t.id} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t.name}</span>
                            <span className="font-medium">{formatLargeCurrency(t.parsedCost)}</span>
                          </div>
                        ))}
                        {tasks.length > 3 && (
                          <p className="text-xs text-muted-foreground">+{tasks.length - 3} more items</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
