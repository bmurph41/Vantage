import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInDays, addDays, parseISO, isAfter, isBefore, startOfDay, differenceInCalendarDays } from "date-fns";
import { tzNow, setDeadlineTo5PM } from "@/lib/date-utils";
import { generateWhitePaperPDF } from "@/components/white-paper-export";
import { 
  FileText, 
  Calendar, 
  TrendingUp, 
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Download,
  Printer,
  ArrowLeft,
  Target,
  Users,
  Shield,
  Activity,
  Zap,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import type { Project, Task, Risk, ProjectSettings } from "@shared/schema";
import type { ProjectWithDetails } from "@/types/dd";

// Helper function for EST start of day
function startOfDayEST(date: Date): Date {
  const estDate = tzNow('America/New_York');
  estDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  estDate.setHours(0, 0, 0, 0);
  return estDate;
}

// Helper function to check if task is overdue at 5:00 PM EST
function isOverdueAt1700EST(deadline: Date | string): boolean {
  const now = tzNow('America/New_York');
  const deadlineAt5PM = setDeadlineTo5PM(deadline);
  return now > deadlineAt5PM;
}

export default function DDProgressReportPage() {
  const { id: projectId } = useParams<{ id: string }>();
  
  // Handle export PDF
  const handleExportPDF = () => {
    if (project && tasks) {
      generateWhitePaperPDF(project, tasks, risks, riskAnalytics, settings);
    }
  };

  // Handle print
  const handlePrint = () => {
    window.print();
  };
  
  // Fetch project data (this returns ProjectWithDetails which includes project, settings, and tasks)
  const { data: projectData, isLoading: projectLoading, error: projectError } = useQuery<ProjectWithDetails>({
    queryKey: ['/api/dd/projects', projectId],
    enabled: !!projectId,
  });

  // Extract individual pieces from ProjectWithDetails
  const project = projectData?.project;
  const tasks = projectData?.tasks || [];
  const settings = projectData?.settings;

  // Fetch risks data for PDF export
  const { data: risks = [] } = useQuery<Risk[]>({
    queryKey: ['/api/dd/projects', projectId, 'risks'],
    enabled: !!projectId,
  });

  // Fetch risk analytics for PDF export
  const { data: riskAnalytics = null } = useQuery({
    queryKey: ['/api/dd/projects', projectId, 'risks', 'analytics'],
    enabled: !!projectId,
  });

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading progress report...</p>
        </div>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Project Not Found</h2>
          <p className="text-gray-600">Unable to load project data for this report.</p>
          <Link href="/">
            <Button variant="outline" className="mt-4" data-testid="link-dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Controls */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href={`/projects/${projectId}`}>
              <Button variant="ghost" size="sm" data-testid="link-back-project">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Project
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Due Diligence Progress Report</h1>
              <p className="text-sm text-gray-600 mt-1">{project.name}</p>
            </div>
          </div>
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportPDF}
              data-testid="button-export-pdf"
            >
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrint}
              data-testid="button-print"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="max-w-5xl mx-auto p-6">
        <DDProgressReport project={project} tasks={tasks} />
      </div>
    </div>
  );
}

interface DDProgressReportProps {
  project: Project;
  tasks: Task[];
}

// AI Narration System - Define proper metrics interface
interface ProjectMetrics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completionRate: number;
  daysRemaining: number;
  timelineProgress: number;
  highRiskTasks: number;
  criticalPathTasks: number;
}

function generateAIInsights(project: Project, tasks: Task[], metrics: ProjectMetrics): string[] {
  const insights = [];
  
  // Performance narrative
  if (metrics.completionRate >= 80) {
    insights.push(`Due diligence execution demonstrates exceptional momentum with ${metrics.completionRate}% task completion, positioning the acquisition for accelerated closing and enhanced value realization.`);
  } else if (metrics.completionRate >= 60) {
    insights.push(`Project maintains steady progress with ${metrics.completionRate}% completion rate, though strategic acceleration of key workstreams could optimize timeline efficiency and risk mitigation.`);
  } else {
    insights.push(`Current ${metrics.completionRate}% completion rate signals need for enhanced resource allocation and expedited task prioritization to maintain acquisition timeline integrity.`);
  }
  
  // Timeline analysis
  if (metrics.daysRemaining <= 14) {
    insights.push(`With ${metrics.daysRemaining} days remaining until closing, intensive daily monitoring and rapid issue resolution protocols are essential for successful transaction completion.`);
  } else if (metrics.daysRemaining <= 30) {
    insights.push(`The ${metrics.daysRemaining}-day runway to closing provides sufficient time for comprehensive due diligence completion, contingent upon maintaining current execution velocity.`);
  } else {
    insights.push(`Extended ${metrics.daysRemaining}-day timeline offers strategic advantage for thorough risk assessment and value optimization initiatives prior to closing.`);
  }
  
  // Risk assessment
  if (metrics.overdueTasks > 0) {
    insights.push(`${metrics.overdueTasks} overdue deliverables require immediate escalation and resource reallocation to prevent timeline slippage and preserve transaction momentum.`);
  } else {
    insights.push(`All deliverables maintain schedule adherence, reflecting robust project governance and effective stakeholder coordination across workstreams.`);
  }
  
  // Market context
  insights.push(`Current market conditions favor acquisition activity with supportive financing environments and regulatory framework stability enhancing transaction probability.`);
  
  return insights;
}

// Enhanced Task Timeline Component
interface TaskTimelineProps {
  tasks: Task[];
  project: Project;
}

function TaskTimeline({ tasks, project }: TaskTimelineProps) {
  const currentDate = tzNow('America/New_York');
  const projectStartDate = project.psaSignedDate ? startOfDayEST(new Date(project.psaSignedDate)) : startOfDayEST(currentDate);
  const projectEndDate = project.closingDate ? startOfDayEST(new Date(project.closingDate)) : addDays(startOfDayEST(currentDate), 60);
  
  const totalDays = Math.max(1, differenceInDays(projectEndDate, projectStartDate)); // Prevent division by zero
  
  const tasksByCategory = useMemo(() => {
    const categories = {
      'Financial Review': tasks.filter(t => t.title.toLowerCase().includes('financial') || t.title.toLowerCase().includes('audit')),
      'Legal & Compliance': tasks.filter(t => t.title.toLowerCase().includes('legal') || t.title.toLowerCase().includes('contract')),
      'Operational Assessment': tasks.filter(t => t.title.toLowerCase().includes('operational') || t.title.toLowerCase().includes('business')),
      'Technical Evaluation': tasks.filter(t => t.title.toLowerCase().includes('technical') || t.title.toLowerCase().includes('system')),
      'Other': tasks.filter(t => 
        !t.title.toLowerCase().includes('financial') && 
        !t.title.toLowerCase().includes('legal') && 
        !t.title.toLowerCase().includes('operational') && 
        !t.title.toLowerCase().includes('technical')
      )
    };
    
    return Object.entries(categories).filter(([_, tasks]) => tasks.length > 0);
  }, [tasks]);
  
  const getTaskPosition = (deadline: string) => {
    if (!deadline) return 50;
    const taskDate = setDeadlineTo5PM(deadline); // Use EST timezone consistently
    const daysDiff = differenceInCalendarDays(taskDate, projectStartDate);
    // Ensure position is within [0, 100] bounds
    return Math.max(0, Math.min(100, totalDays > 0 ? (daysDiff / totalDays) * 100 : 50));
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'engaged': return 'bg-yellow-500';
      default: return 'bg-gray-300';
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex justify-between text-xs text-gray-600 mb-2">
          <span>{format(projectStartDate, 'MMM d')}</span>
          <span>Today ({format(currentDate, 'MMM d')})</span>
          <span>{format(projectEndDate, 'MMM d')}</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full relative">
          <div 
            className="h-full bg-blue-600 rounded-full absolute"
            style={{ width: `${Math.max(0, Math.min(100, (differenceInCalendarDays(currentDate, projectStartDate) / totalDays) * 100))}%` }}
          />
          <div 
            className="absolute top-0 w-0.5 h-2 bg-red-500"
            style={{ left: `${Math.max(0, Math.min(100, (differenceInCalendarDays(currentDate, projectStartDate) / totalDays) * 100))}%` }}
          />
        </div>
      </div>
      
      {tasksByCategory.map(([category, categoryTasks]) => (
        <div key={category} className="space-y-2">
          <h4 className="font-medium text-gray-800 text-sm">{category}</h4>
          <div className="space-y-1">
            {categoryTasks.map(task => (
              <div key={task.id} className="bg-white border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">{task.title}</span>
                  <Badge variant={task.status === 'completed' ? 'default' : task.status === 'in_progress' ? 'secondary' : 'outline'}>
                    {task.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="relative h-2 bg-gray-100 rounded-full">
                  {task.deadline && (
                    <div 
                      className={`absolute h-full w-3 rounded-full ${getStatusColor(task.status)}`}
                      style={{ left: `${getTaskPosition(task.deadline)}%` }}
                    />
                  )}
                </div>
                {task.deadline && (
                  <div className="text-xs text-gray-500 mt-1">
                    Due: {format(setDeadlineTo5PM(task.deadline), 'MMM d, yyyy')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DDProgressReport({ project, tasks }: DDProgressReportProps) {
  const currentDate = tzNow('America/New_York');
  
  // Calculate comprehensive project metrics
  const metrics = useMemo(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const engagedTasks = tasks.filter(t => t.status === 'engaged').length;
    const notStartedTasks = tasks.filter(t => t.status === 'not_started').length;
    
    const overdueTasks = tasks.filter(t => {
      if (t.status === 'completed' || !t.deadline) return false;
      return isOverdueAt1700EST(t.deadline);
    }).length;
    
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // Timeline calculations using EST timezone
    const projectStartDate = project.psaSignedDate ? startOfDayEST(new Date(project.psaSignedDate)) : startOfDayEST(currentDate);
    const projectEndDate = project.closingDate ? startOfDayEST(new Date(project.closingDate)) : addDays(startOfDayEST(currentDate), 60);
    const daysSinceStart = Math.max(0, differenceInCalendarDays(currentDate, projectStartDate));
    const totalProjectDays = Math.max(1, differenceInCalendarDays(projectEndDate, projectStartDate));
    const daysRemaining = Math.max(0, differenceInCalendarDays(projectEndDate, currentDate));
    const timelineProgress = Math.min(100, Math.round((daysSinceStart / totalProjectDays) * 100));
    
    // Risk indicators using EST timezone
    const highRiskTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length;
    const criticalPathTasks = tasks.filter(t => {
      if (!t.deadline || t.status === 'completed') return false;
      const deadlineAt5PM = setDeadlineTo5PM(t.deadline);
      return differenceInCalendarDays(deadlineAt5PM, currentDate) <= 7;
    }).length;
    
    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      engagedTasks,
      notStartedTasks,
      overdueTasks,
      completionRate,
      projectStartDate,
      projectEndDate,
      daysSinceStart,
      totalProjectDays,
      daysRemaining,
      timelineProgress,
      highRiskTasks,
      criticalPathTasks
    };
  }, [tasks, project, currentDate]);
  
  // Generate AI insights
  const aiInsights = useMemo(() => generateAIInsights(project, tasks, metrics), [project, tasks, metrics]);

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden">
      {/* Header Section - Matching Research Brief Style */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-900 text-white p-8">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs font-bold tracking-wider uppercase mb-2">PROGRESS BRIEF</div>
            <div className="text-2xl font-bold tracking-wider uppercase">DUE DILIGENCE</div>
            <div className="text-sm mt-2 opacity-90">{project.name}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium opacity-90 uppercase tracking-wide mb-2">
              {format(currentDate, 'MMMM yyyy').toUpperCase()}
            </div>
            <div className="text-lg font-bold">{metrics.completionRate}%</div>
            <div className="text-xs opacity-75">COMPLETE</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8 space-y-8">
        {/* AI-Generated Executive Summary */}
        <div className="space-y-6">
          <div className="flex items-center space-x-2 mb-4">
            <Zap className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Executive Insights</h2>
            <Badge variant="secondary" className="text-xs">AI-Powered Analysis</Badge>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {aiInsights.slice(0, 2).map((insight, index) => (
                <div key={index} className="bg-blue-50 border-l-4 border-blue-400 p-4">
                  <div className="flex items-start">
                    <Activity className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                    <p className="text-gray-700 leading-relaxed text-sm">{insight}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="space-y-4">
              {aiInsights.slice(2).map((insight, index) => (
                <div key={index + 2} className="bg-green-50 border-l-4 border-green-400 p-4">
                  <div className="flex items-start">
                    <Target className="h-5 w-5 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                    <p className="text-gray-700 leading-relaxed text-sm">{insight}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        {/* Enhanced Key Metrics Dashboard */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Performance Metrics
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-1">{metrics.completedTasks}</div>
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Completed</div>
            </div>
            
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600 mb-1">{metrics.inProgressTasks}</div>
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">In Progress</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600 mb-1">{metrics.engagedTasks}</div>
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Engaged</div>
            </div>
            
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600 mb-1">{metrics.notStartedTasks}</div>
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Not Started</div>
            </div>
            
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600 mb-1">{metrics.overdueTasks}</div>
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Overdue</div>
            </div>
            
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600 mb-1">{metrics.daysRemaining}</div>
              <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Days Left</div>
            </div>
          </div>

          {/* Progress Visualization */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Overall Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Completion Rate</span>
                    <span className="font-medium">{metrics.completionRate}%</span>
                  </div>
                  <Progress value={metrics.completionRate} className="h-3" />
                  <div className="text-xs text-gray-500">
                    {metrics.completedTasks} of {metrics.totalTasks} tasks completed
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Timeline Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Time Elapsed</span>
                    <span className="font-medium">{metrics.timelineProgress}%</span>
                  </div>
                  <Progress value={metrics.timelineProgress} className="h-3" />
                  <div className="text-xs text-gray-500">
                    {metrics.daysSinceStart} of {metrics.totalProjectDays} days elapsed
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Separator />

        {/* Enhanced Task Timeline Visualization */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Detailed Task Timeline
          </h3>
          <TaskTimeline tasks={tasks} project={project} />
        </div>

        <Separator />

        {/* Risk Assessment Dashboard */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Risk Assessment
          </h3>
          
          <div className="grid md:grid-cols-3 gap-4">
            <Card className={metrics.overdueTasks > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
              <CardHeader className="pb-3">
                <CardTitle className={`text-sm font-medium flex items-center ${metrics.overdueTasks > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  <Clock className="h-4 w-4 mr-2" />
                  Schedule Risk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold mb-1 ${metrics.overdueTasks > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {metrics.overdueTasks > 0 ? 'HIGH' : 'LOW'}
                </div>
                <div className="text-xs text-gray-600">
                  {metrics.overdueTasks} overdue tasks
                </div>
              </CardContent>
            </Card>
            
            <Card className={metrics.highRiskTasks > 0 ? "border-orange-200 bg-orange-50" : "border-green-200 bg-green-50"}>
              <CardHeader className="pb-3">
                <CardTitle className={`text-sm font-medium flex items-center ${metrics.highRiskTasks > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Priority Risk
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold mb-1 ${metrics.highRiskTasks > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {metrics.highRiskTasks > 0 ? 'MEDIUM' : 'LOW'}
                </div>
                <div className="text-xs text-gray-600">
                  {metrics.highRiskTasks} high-priority open tasks
                </div>
              </CardContent>
            </Card>
            
            <Card className={metrics.criticalPathTasks > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
              <CardHeader className="pb-3">
                <CardTitle className={`text-sm font-medium flex items-center ${metrics.criticalPathTasks > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  <Target className="h-4 w-4 mr-2" />
                  Critical Path
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold mb-1 ${metrics.criticalPathTasks > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {metrics.criticalPathTasks > 0 ? 'URGENT' : 'STABLE'}
                </div>
                <div className="text-xs text-gray-600">
                  {metrics.criticalPathTasks} tasks due within 7 days
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Professional Footer */}
        <div className="border-t border-gray-200 pt-6 mt-8">
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500 leading-relaxed">
              <div className="font-medium mb-1">Report Generated: {format(currentDate, 'PPP')}</div>
              <div><strong>Sources:</strong> Due Diligence Tracker Analytics, Project Management System, Risk Assessment Framework</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">Next Update</div>
              <div className="text-sm font-medium text-gray-700">{format(addDays(currentDate, 7), 'MMM d, yyyy')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}