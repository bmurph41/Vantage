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
  ArrowLeft,
  Target,
  Activity,
  DollarSign,
  TrendingUp,
  Building2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import type { Project, DDTask } from "@shared/schema";

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
    const activeProjects = projectSummaries.filter(ps => ps.completionPct < 100).length;
    const completedProjects = projectSummaries.filter(ps => ps.completionPct === 100).length;
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
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm" data-testid="button-back">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Projects
                </Button>
              </Link>
              <Separator orientation="vertical" className="h-8" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Portfolio Summary Report</h1>
                <p className="text-sm text-gray-500">All Projects Overview</p>
              </div>
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

        {/* Overall Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
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

          <Card>
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

          <Card>
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

          <Card>
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
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Project Details
            </CardTitle>
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
                  <div key={summary.project.id} className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{summary.project.name}</h3>
                          {summary.completionPct === 100 ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Completed
                            </Badge>
                          ) : summary.daysRemaining !== null && summary.daysRemaining < 5 ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200">
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
                      <Link href={`/projects/${summary.project.id}/progress-report`}>
                        <Button variant="outline" size="sm" data-testid={`button-view-report-${summary.project.id}`}>
                          View Full Report
                        </Button>
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Progress</div>
                        <div className="flex items-center space-x-2">
                          <Progress value={summary.completionPct} className="flex-1" />
                          <span className="text-sm font-medium text-gray-900">{Math.round(summary.completionPct)}%</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {summary.completedTasks} / {summary.totalTasks} tasks
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500 mb-1">DD Remaining</div>
                        <div className={`text-lg font-bold ${
                          summary.daysRemaining === null ? 'text-gray-400' :
                          summary.daysRemaining < 0 ? 'text-red-600' :
                          summary.daysRemaining < 5 ? 'text-amber-600' :
                          'text-gray-900'
                        }`}>
                          {summary.daysRemaining === null ? 'N/A' : `${summary.daysRemaining}d`}
                        </div>
                        {summary.project.ddExpirationDate && (
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
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
