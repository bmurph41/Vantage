import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, 
  Users, 
  DollarSign, 
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Target,
  Activity,
  BarChart3,
  Briefcase,
  Calendar
} from "lucide-react";
import { Link } from "wouter";
import { useProjects } from "@/hooks/use-project";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInCalendarDays } from "date-fns";
import { tzNow } from "@/lib/date-utils";
import type { Project, Task, Risk } from "@shared/schema";

interface PortfolioMetrics {
  totalDeals: number;
  activeDeals: number;
  totalInvestment: number;
  avgHealthScore: number;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  highRiskCount: number;
}

function calculatePortfolioMetrics(projects: Project[], tasksMap: Map<string, Task[]>, risksMap: Map<string, Risk[]>): PortfolioMetrics {
  const activeDeals = projects.filter(p => {
    if (!p.closingDate) return true;
    return differenceInCalendarDays(new Date(p.closingDate), tzNow('America/New_York')) >= 0;
  }).length;

  const totalInvestment = projects.reduce((sum, p) => sum + (p.purchasePrice || 0), 0);
  const avgHealthScore = projects.length > 0 
    ? Math.round(projects.reduce((sum, p) => sum + (p.dealHealthScore || 75), 0) / projects.length)
    : 0;

  let totalTasks = 0;
  let completedTasks = 0;
  let overdueTasks = 0;
  const today = tzNow('America/New_York');

  tasksMap.forEach(tasks => {
    totalTasks += tasks.length;
    completedTasks += tasks.filter(t => t.status === 'completed').length;
    overdueTasks += tasks.filter(t => {
      if (!t.deadline || t.status === 'completed') return false;
      return differenceInCalendarDays(new Date(t.deadline), today) < 0;
    }).length;
  });

  let highRiskCount = 0;
  risksMap.forEach(risks => {
    highRiskCount += risks.filter(r => r.riskScore && r.riskScore >= 15).length;
  });

  return {
    totalDeals: projects.length,
    activeDeals,
    totalInvestment,
    avgHealthScore,
    totalTasks,
    completedTasks,
    overdueTasks,
    highRiskCount
  };
}

export default function OwnerDashboard() {
  const { data: projects = [], isLoading, isError } = useProjects();
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch all tasks and risks for portfolio view using stable hook calls
  const projectIds = projects.map(p => p.id);
  
  const tasksQueries = projectIds.map(projectId => 
    useQuery<Task[]>({
      queryKey: ['/api/dd/projects', projectId, 'tasks'],
      enabled: !!projectId,
    })
  );

  const risksQueries = projectIds.map(projectId => 
    useQuery<Risk[]>({
      queryKey: ['/api/dd/projects', projectId, 'risks'],
      enabled: !!projectId,
    })
  );

  // Build maps from query results
  const tasksMap = new Map<string, Task[]>();
  const risksMap = new Map<string, Risk[]>();
  
  projectIds.forEach((projectId, index) => {
    tasksMap.set(projectId, tasksQueries[index]?.data || []);
    risksMap.set(projectId, risksQueries[index]?.data || []);
  });

  const metrics = calculatePortfolioMetrics(projects, tasksMap, risksMap);
  const completionRate = metrics.totalTasks > 0 ? (metrics.completedTasks / metrics.totalTasks) * 100 : 0;
  
  const isLoadingData = isLoading || tasksQueries.some(q => q.isLoading) || risksQueries.some(q => q.isLoading);
  const hasError = isError || tasksQueries.some(q => q.isError) || risksQueries.some(q => q.isError);

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="border-red-200 dark:border-red-800">
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Failed to Load Portfolio Data</h2>
              <p className="text-gray-600 dark:text-gray-400">Unable to fetch portfolio metrics. Please refresh the page or try again later.</p>
              <Button onClick={() => window.location.reload()} className="mt-4">Retry</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Briefcase className="h-10 w-10" />
              Command Center
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">Portfolio management & team performance</p>
          </div>
          <div className="flex gap-2">
            <Link href="/investor">
              <Button variant="outline" data-testid="button-investor-view">
                Investor View
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" data-testid="button-standard-dashboard">
                Standard Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Portfolio KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Portfolio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.totalDeals}</div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{metrics.activeDeals} active deals</p>
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Investment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                ${(metrics.totalInvestment / 1000000).toFixed(1)}M
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Capital deployed</p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Task Completion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {Math.round(completionRate)}%
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {metrics.completedTasks} of {metrics.totalTasks} tasks
              </p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 dark:border-orange-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Health Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{metrics.avgHealthScore}</div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Portfolio average</p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts & Action Items */}
        {(metrics.overdueTasks > 0 || metrics.highRiskCount > 0) && (
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <CardHeader>
              <CardTitle className="text-red-800 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Requires Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metrics.overdueTasks > 0 && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-red-600 dark:text-red-400" />
                    <div>
                      <p className="font-semibold text-red-900 dark:text-red-100">{metrics.overdueTasks} Overdue Tasks</p>
                      <p className="text-sm text-red-700 dark:text-red-300">Immediate action required</p>
                    </div>
                  </div>
                )}
                {metrics.highRiskCount > 0 && (
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                    <div>
                      <p className="font-semibold text-red-900 dark:text-red-100">{metrics.highRiskCount} High-Risk Items</p>
                      <p className="text-sm text-red-700 dark:text-red-300">Risk mitigation needed</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for different views */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3" data-testid="tabs-owner-dashboard">
            <TabsTrigger value="overview" data-testid="tab-overview">Deal Overview</TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
            <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {projects.map(project => (
                <ProjectCard key={project.id} project={project} tasks={tasksMap.get(project.id) || []} risks={risksMap.get(project.id) || []} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6 mt-6">
            <PerformanceView projects={projects} tasksMap={tasksMap} />
          </TabsContent>

          <TabsContent value="timeline" className="space-y-6 mt-6">
            <TimelineView projects={projects} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ProjectCard({ project, tasks, risks }: { project: Project; tasks: Task[]; risks: Risk[] }) {
  const today = tzNow('America/New_York');
  const daysToClose = project.closingDate 
    ? differenceInCalendarDays(new Date(project.closingDate), today)
    : null;

  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const completionRate = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;
  const healthScore = project.dealHealthScore || 75;

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg text-gray-900 dark:text-white">{project.name}</CardTitle>
            <Badge variant={healthScore >= 80 ? 'default' : healthScore >= 60 ? 'secondary' : 'destructive'}>
              {healthScore >= 80 ? 'Healthy' : healthScore >= 60 ? 'Fair' : 'At Risk'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">Progress</span>
              <span className="font-semibold text-gray-900 dark:text-white">{Math.round(completionRate)}%</span>
            </div>
            <Progress value={completionRate} className="h-2" />
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-400">Tasks</p>
              <p className="font-semibold text-gray-900 dark:text-white">{completedTasks}/{tasks.length}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Risks</p>
              <p className="font-semibold text-gray-900 dark:text-white">{risks.length}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Days to Close</p>
              <p className="font-semibold text-gray-900 dark:text-white">{daysToClose !== null ? daysToClose : 'TBD'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function PerformanceView({ projects, tasksMap }: { projects: Project[]; tasksMap: Map<string, Task[]> }) {
  const projectPerformance = projects.map(project => {
    const tasks = tasksMap.get(project.id) || [];
    const completed = tasks.filter(t => t.status === 'completed').length;
    const total = tasks.length;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    return {
      project,
      completionRate,
      taskCount: total,
      completedCount: completed
    };
  }).sort((a, b) => b.completionRate - a.completionRate);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Deal Performance Rankings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {projectPerformance.map(({ project, completionRate, taskCount, completedCount }, index) => (
            <div key={project.id} className="flex items-center gap-4">
              <div className="text-2xl font-bold text-gray-400 dark:text-gray-600 w-8">#{index + 1}</div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <Link href={`/projects/${project.id}`}>
                    <span className="font-semibold text-gray-900 dark:text-white hover:underline">{project.name}</span>
                  </Link>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{completedCount}/{taskCount} tasks</span>
                </div>
                <Progress value={completionRate} className="h-2" />
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-white w-16 text-right">
                {Math.round(completionRate)}%
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineView({ projects }: { projects: Project[] }) {
  const today = tzNow('America/New_York');
  const upcomingDeadlines = projects
    .filter(p => p.closingDate)
    .map(p => ({
      project: p,
      daysUntil: differenceInCalendarDays(new Date(p.closingDate!), today)
    }))
    .filter(d => d.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Closing Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {upcomingDeadlines.map(({ project, daysUntil }) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{project.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {format(new Date(project.closingDate!), 'MMM d, yyyy')}
                  </p>
                </div>
                <Badge variant={daysUntil <= 7 ? 'destructive' : daysUntil <= 30 ? 'secondary' : 'default'}>
                  {daysUntil} days
                </Badge>
              </div>
            </Link>
          ))}
          {upcomingDeadlines.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No upcoming closing dates</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
