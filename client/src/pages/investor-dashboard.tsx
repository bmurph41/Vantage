import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign, 
  Calendar,
  Target,
  Activity,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  Clock
} from "lucide-react";
import { Link } from "wouter";
import { useProjects } from "@/hooks/use-project";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { tzNow, setDeadlineTo5PM } from "@/lib/date-utils";
import type { Project, DDTask, Risk } from "@shared/schema";

interface DealHealthMetrics {
  healthScore: number;
  timelineConfidence: number;
  riskExposure: number;
  completionRate: number;
  budgetVariance: number;
}

function calculateDealHealth(project: Project, tasks: DDTask[], risks: Risk[]): DealHealthMetrics {
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const today = tzNow('America/New_York');
  const overdueTasks = tasks.filter(t => {
    if (!t.deadline || t.status === 'completed') return false;
    const deadlineDate = setDeadlineTo5PM(t.deadline);
    return differenceInCalendarDays(deadlineDate, today) < 0;
  }).length;

  const highRisks = risks.filter(r => r.riskScore && r.riskScore >= 15).length;
  const totalCost = tasks.reduce((sum, t) => {
    const cost = parseInt(t.cost || '0');
    return sum + (isNaN(cost) ? 0 : cost);
  }, 0);

  // Calculate health score (0-100)
  let healthScore = 100;
  healthScore -= overdueTasks * 5; // -5 per overdue task
  healthScore -= highRisks * 8; // -8 per high risk
  healthScore -= (100 - completionRate) * 0.3; // Weight completion

  const timelineConfidence = Math.max(0, 100 - (overdueTasks * 10));
  const riskExposure = risks.length > 0 ? (highRisks / risks.length) * 100 : 0;
  const budgetVariance = project.purchasePrice 
    ? ((totalCost / project.purchasePrice) * 100) - 100 
    : 0;

  return {
    healthScore: Math.max(0, Math.min(100, healthScore)),
    timelineConfidence,
    riskExposure,
    completionRate,
    budgetVariance
  };
}

function getHealthScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 40) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function getHealthScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'At Risk';
}

export default function InvestorDashboard() {
  const { data: projects = [], isLoading, isError } = useProjects();
  const today = tzNow('America/New_York');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="border-red-200 dark:border-red-800">
            <CardContent className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Failed to Load Investment Data</h2>
              <p className="text-gray-600 dark:text-gray-400">Unable to fetch portfolio information. Please refresh the page or try again later.</p>
              <Button onClick={() => window.location.reload()} className="mt-4">Retry</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Investment Portfolio</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">Real-time deal health & investment metrics</p>
          </div>
          <Link href="/">
            <Button variant="outline" data-testid="button-standard-dashboard">
              Standard Dashboard
            </Button>
          </Link>
        </div>

        {/* Portfolio Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Active Deals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{projects.length}</div>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3" />
                Portfolio value tracking
              </p>
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
                ${projects.reduce((sum, p) => sum + (p.purchasePrice || 0), 0).toLocaleString()}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Committed capital</p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Projected Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                ${projects.reduce((sum, p) => sum + (p.projectedAnnualRevenue || 0), 0).toLocaleString()}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Annual forecast</p>
            </CardContent>
          </Card>

          <Card className="border-orange-200 dark:border-orange-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Avg Health Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {projects.length > 0 
                  ? Math.round(projects.reduce((sum, p) => sum + (p.dealHealthScore || 75), 0) / projects.length)
                  : 'N/A'}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Portfolio health</p>
            </CardContent>
          </Card>
        </div>

        {/* Deal Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projects.map(project => (
            <DealCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DealCard({ project }: { project: Project }) {
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['/api/dd/projects', project.id, 'tasks'],
  });

  const { data: risks = [] } = useQuery<Risk[]>({
    queryKey: ['/api/dd/projects', project.id, 'risks'],
  });

  const metrics = calculateDealHealth(project, tasks, risks);
  const today = tzNow('America/New_York');
  const daysToClose = project.closingDate 
    ? differenceInCalendarDays(setDeadlineTo5PM(project.closingDate), today)
    : null;

  const roiEstimate = project.purchasePrice && project.projectedAnnualRevenue
    ? ((project.projectedAnnualRevenue / project.purchasePrice) * 100).toFixed(1)
    : null;

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-blue-500">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="text-xl text-gray-900 dark:text-white">{project.name}</CardTitle>
            </div>
            <Badge 
              variant={metrics.healthScore >= 80 ? 'default' : metrics.healthScore >= 60 ? 'secondary' : 'destructive'}
              className="ml-4"
              data-testid={`badge-health-${project.id}`}
            >
              {getHealthScoreLabel(metrics.healthScore)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Deal Health Score */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Deal Health Score</span>
              <span className={`text-2xl font-bold ${getHealthScoreColor(metrics.healthScore)}`}>
                {Math.round(metrics.healthScore)}
              </span>
            </div>
            <Progress value={metrics.healthScore} className="h-3" data-testid={`progress-health-${project.id}`} />
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Activity className="h-4 w-4" />
                <span>Completion</span>
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {Math.round(metrics.completionRate)}%
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Clock className="h-4 w-4" />
                <span>Timeline</span>
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {daysToClose !== null ? `${daysToClose}d` : 'TBD'}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <AlertTriangle className="h-4 w-4" />
                <span>Risk Exposure</span>
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {Math.round(metrics.riskExposure)}%
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <BarChart3 className="h-4 w-4" />
                <span>Est. ROI</span>
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {roiEstimate ? `${roiEstimate}%` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Investment Thesis */}
          {project.investmentThesis && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Investment Thesis</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{project.investmentThesis}</p>
            </div>
          )}

          {/* Financial Summary */}
          {project.purchasePrice && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Purchase</p>
                  <p className="font-semibold text-gray-900 dark:text-white">${(project.purchasePrice / 1000000).toFixed(1)}M</p>
                </div>
                {project.estimatedRenovationCost && (
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Reno Cost</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      ${(project.estimatedRenovationCost / 1000).toFixed(0)}K
                    </p>
                  </div>
                )}
                {project.projectedAnnualRevenue && (
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Revenue</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      ${(project.projectedAnnualRevenue / 1000).toFixed(0)}K/yr
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
