import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInDays, addDays, parseISO, isAfter, isBefore, startOfDay, differenceInCalendarDays } from "date-fns";
import { tzNow, setDeadlineTo5PM, formatLargeCurrency } from "@/lib/date-utils";
import { generateWhitePaperPDF } from "@/components/white-paper-export";
import { generateProgressBriefPDF } from "@/components/progress-brief-export";
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
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  Mail,
  Phone,
  MapPin,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AddToCalendarDialog } from "@/components/add-to-calendar-dialog";
import { useToast } from "@/hooks/use-toast";
import type { Project, Task, Risk, ProjectSettings, Contact } from "@shared/schema";
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
  const { toast } = useToast();
  
  // State for modals
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  
  // Handle export DD Summary PDF
  const handleExportDDSummary = () => {
    if (project && tasks) {
      generateWhitePaperPDF(project, tasks, risks, riskAnalytics, settings);
    }
  };

  // Handle export Progress Brief PDF
  const handleExportProgressBrief = () => {
    if (project && tasks) {
      generateProgressBriefPDF(project, tasks);
    }
  };

  // Handle print
  const handlePrint = () => {
    window.print();
  };
  
  // Handle View Detailed Timeline - Navigate to project page
  const handleViewDetailedTimeline = () => {
    // Navigate to project page which shows the detailed timeline
    window.location.href = `/projects/${projectId}`;
  };

  // Handle Contact Team Member - Open team contact modal
  const handleContactTeam = () => {
    setIsContactModalOpen(true);
  };

  // Handle Export Comprehensive Report - Export detailed progress report
  const handleExportReport = () => {
    if (project && tasks) {
      // Use the existing Progress Brief export functionality  
      generateProgressBriefPDF(project, tasks);
      toast({
        title: "Report exported successfully",
        description: "Your comprehensive progress report has been downloaded.",
      });
    }
  };

  // Handle Schedule Review Meeting - Open calendar scheduling modal
  const handleScheduleReviewMeeting = () => {
    setIsCalendarModalOpen(true);
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

  // Fetch AI risk analysis
  const { data: aiRiskAnalysis = null } = useQuery<{
    overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskSummary: string;
    categoryInsights: Array<{
      category: string;
      count: number;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      insight: string;
    }>;
    recommendations: string[];
    criticalFactors: string[];
  }>({
    queryKey: ['/api/dd/projects', projectId, 'risks', 'ai-analysis'],
    enabled: !!projectId,
  });

  // Fetch contacts data for team contact modal
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/dd/contacts'],
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
              variant="default" 
              size="sm" 
              onClick={handleExportProgressBrief}
              data-testid="button-export-progress-brief"
            >
              <Download className="h-4 w-4 mr-2" />
              Progress Brief
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportDDSummary}
              data-testid="button-export-dd-summary"
            >
              <FileText className="h-4 w-4 mr-2" />
              DD Summary
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
        <DDProgressReport project={project} tasks={tasks} aiRiskAnalysis={aiRiskAnalysis} />
      </div>
    </div>
  );
}

interface DDProgressReportProps {
  project: Project;
  tasks: Task[];
  aiRiskAnalysis: {
    overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskSummary: string;
    categoryInsights: Array<{
      category: string;
      count: number;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      insight: string;
    }>;
    recommendations: string[];
    criticalFactors: string[];
  } | null;
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
  
  // Performance narrative - executive perspective
  if (metrics.completionRate >= 80) {
    insights.push(`Our due diligence execution is performing exceptionally well at ${metrics.completionRate}% completion. I'm observing strong operational momentum across all workstreams, positioning us favorably for our targeted closing timeline. This level of performance excellence reinforces my confidence in our ability to identify and capitalize on strategic value drivers within this transaction.`);
  } else if (metrics.completionRate >= 60) {
    insights.push(`Our current ${metrics.completionRate}% completion rate demonstrates solid progress, though I see opportunities for enhanced execution velocity across certain critical workstreams. My assessment indicates that strategic resource reallocation and accelerated task prioritization will substantially strengthen our risk mitigation posture for the remaining timeline.`);
  } else {
    insights.push(`The ${metrics.completionRate}% completion rate requires immediate strategic intervention. From my operational assessment, we must implement aggressive resource reallocation and enhanced project governance to mitigate transaction timeline risk. I am directing immediate corrective action to ensure acquisition objectives remain achievable.`);
  }
  
  // Timeline analysis - strategic observations
  if (metrics.daysRemaining <= 14) {
    insights.push(`With ${metrics.daysRemaining} days remaining to closing, we have entered the critical execution phase where operational precision is paramount. I am implementing enhanced oversight protocols and daily deliverable monitoring to ensure zero tolerance for schedule deviation. Every milestone requires executive-level attention at this juncture.`);
  } else if (metrics.daysRemaining <= 30) {
    insights.push(`Our ${metrics.daysRemaining}-day runway to closing provides adequate execution bandwidth, contingent on maintaining current velocity metrics. I am closely monitoring project cadence and stakeholder performance indicators to ensure sustained momentum through the final phase. Strategic vigilance remains essential.`);
  } else {
    insights.push(`The ${metrics.daysRemaining}-day timeline to closing represents a strategic advantage, providing sufficient bandwidth for comprehensive risk assessment and value optimization analysis. This extended runway enables thorough due diligence depth without compromising transaction quality or stakeholder confidence.`);
  }
  
  // Risk assessment - executive evaluation
  if (metrics.overdueTasks > 0) {
    insights.push(`I have identified ${metrics.overdueTasks} overdue deliverables requiring immediate executive escalation. My analysis indicates these timeline deviations pose cascading risk to overall transaction success. I am implementing immediate corrective measures and enhanced resource deployment to restore optimal project trajectory.`);
  } else {
    insights.push(`All deliverables are performing on schedule, demonstrating robust project governance and effective stakeholder coordination across our entire organizational matrix. This operational excellence validates our systematic approach and reinforces my confidence in successful transaction completion.`);
  }
  
  // Market context - strategic assessment
  insights.push(`My analysis of prevailing market conditions indicates we are executing this acquisition within a highly favorable macroeconomic environment. Capital markets remain supportive, regulatory frameworks are stable, and industry fundamentals align with our strategic thesis, significantly enhancing transaction probability and value realization potential.`);
  
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
  
  const totalDays = Math.max(1, differenceInCalendarDays(projectEndDate, projectStartDate)); // Prevent division by zero
  
  const tasksByCategory = useMemo(() => {
    // Filter out completed tasks from the timeline view
    const incompleteTasks = tasks.filter(t => t.status !== 'completed');
    
    const categories = {
      'Financial Review': incompleteTasks.filter(t => t.title.toLowerCase().includes('financial') || t.title.toLowerCase().includes('audit')),
      'Legal & Compliance': incompleteTasks.filter(t => t.title.toLowerCase().includes('legal') || t.title.toLowerCase().includes('contract')),
      'Operational Assessment': incompleteTasks.filter(t => t.title.toLowerCase().includes('operational') || t.title.toLowerCase().includes('business')),
      'Technical Evaluation': incompleteTasks.filter(t => t.title.toLowerCase().includes('technical') || t.title.toLowerCase().includes('system')),
      'Other': incompleteTasks.filter(t => 
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
    <TooltipProvider>
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div 
                          className={`absolute h-full w-3 rounded-full cursor-pointer ${getStatusColor(task.status)}`}
                          style={{ left: `${getTaskPosition(task.deadline)}%` }}
                        />
                      </TooltipTrigger>
                      <TooltipContent className="z-50">
                        <p className="font-medium">{task.title}</p>
                        <p className="text-xs opacity-90">Due: {format(setDeadlineTo5PM(task.deadline), 'MMM d, yyyy')}</p>
                        <p className="text-xs opacity-90 capitalize">Status: {task.status.replace('_', ' ')}</p>
                      </TooltipContent>
                    </Tooltip>
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
    </TooltipProvider>
  );
}

function DDProgressReport({ project, tasks, aiRiskAnalysis }: DDProgressReportProps) {
  const currentDate = tzNow('America/New_York');
  const [showDDDeadline, setShowDDDeadline] = useState(false);
  const { toast } = useToast();
  
  // State for modals
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  
  // Fetch contacts data for team contact modal
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/dd/contacts'],
    enabled: !!project?.id,
  });
  
  // Handle View Detailed Timeline - Navigate to project page
  const handleViewDetailedTimeline = () => {
    // Navigate to project page which shows the detailed timeline
    window.location.href = `/projects/${project.id}`;
  };

  // Handle Contact Team Member - Open team contact modal
  const handleContactTeam = () => {
    setIsContactModalOpen(true);
  };

  // Handle Export Comprehensive Report - Export detailed progress report
  const handleExportReport = () => {
    if (project && tasks) {
      // Use the existing Progress Brief export functionality  
      generateProgressBriefPDF(project, tasks);
      toast({
        title: "Report exported successfully",
        description: "Your comprehensive progress report has been downloaded.",
      });
    }
  };

  // Handle Schedule Review Meeting - Open calendar scheduling modal
  const handleScheduleReviewMeeting = () => {
    setIsCalendarModalOpen(true);
  };
  
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

    // Enhanced schedule risk assessment
    const tasksNext3Days = tasks.filter(t => {
      if (!t.deadline || t.status === 'completed') return false;
      const deadlineAt5PM = setDeadlineTo5PM(t.deadline);
      const daysUntil = differenceInCalendarDays(deadlineAt5PM, currentDate);
      return daysUntil >= 0 && daysUntil <= 3;
    }).length;

    const tasksNext7Days = tasks.filter(t => {
      if (!t.deadline || t.status === 'completed') return false;
      const deadlineAt5PM = setDeadlineTo5PM(t.deadline);
      const daysUntil = differenceInCalendarDays(deadlineAt5PM, currentDate);
      return daysUntil >= 4 && daysUntil <= 7;
    }).length;

    // Calculate schedule risk level and description
    const getScheduleRisk = () => {
      if (overdueTasks > 0) {
        return {
          level: 'URGENT',
          description: `${overdueTasks} overdue ${overdueTasks === 1 ? 'task' : 'tasks'}`,
          color: 'red',
          priority: 4
        };
      }
      if (tasksNext3Days > 0) {
        return {
          level: 'HIGH',
          description: `${tasksNext3Days} ${tasksNext3Days === 1 ? 'task' : 'tasks'} due within 3 days`,
          color: 'red',
          priority: 3
        };
      }
      if (tasksNext7Days > 0) {
        return {
          level: 'MEDIUM',
          description: `${tasksNext7Days} ${tasksNext7Days === 1 ? 'task' : 'tasks'} due within 7 days`,
          color: 'orange',
          priority: 2
        };
      }
      return {
        level: 'LOW',
        description: 'No imminent deadlines',
        color: 'green',
        priority: 1
      };
    };

    const scheduleRisk = getScheduleRisk();
    
    // Calculate time-weighted completion rate based on task duration
    const totalTimeAllocated = tasks.reduce((sum, task) => sum + (task.mostLikelyDays || 1), 0);
    const completedTimeAllocated = tasks
      .filter(t => t.status === 'completed')
      .reduce((sum, task) => sum + (task.mostLikelyDays || 1), 0);
    
    const completionRate = totalTimeAllocated > 0 ? Math.round((completedTimeAllocated / totalTimeAllocated) * 100) : 0;
    
    // Timeline calculations using EST timezone
    const projectStartDate = project.psaSignedDate ? startOfDayEST(new Date(project.psaSignedDate)) : startOfDayEST(currentDate);
    const projectEndDate = project.closingDate ? startOfDayEST(new Date(project.closingDate)) : addDays(startOfDayEST(currentDate), 60);
    const ddEndDate = project.ddExpirationDate ? startOfDayEST(new Date(project.ddExpirationDate)) : null;
    const daysSinceStart = Math.max(0, differenceInCalendarDays(currentDate, projectStartDate));
    const totalProjectDays = Math.max(1, differenceInCalendarDays(projectEndDate, projectStartDate));
    const daysRemainingToClosing = Math.max(0, differenceInCalendarDays(projectEndDate, currentDate));
    const daysRemainingToDD = ddEndDate ? Math.max(0, differenceInCalendarDays(ddEndDate, currentDate)) : null;
    const daysRemaining = showDDDeadline && daysRemainingToDD !== null ? daysRemainingToDD : daysRemainingToClosing;
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
      scheduleRisk,
      completionRate,
      projectStartDate,
      projectEndDate,
      ddEndDate,
      daysSinceStart,
      totalProjectDays,
      daysRemaining,
      daysRemainingToClosing,
      daysRemainingToDD,
      timelineProgress,
      highRiskTasks,
      criticalPathTasks
    };
  }, [tasks, project, currentDate, showDDDeadline]);
  
  // Generate AI insights
  const aiInsights = useMemo(() => generateAIInsights(project, tasks, metrics), [project, tasks, metrics]);

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden">
      {/* Header Section - Professional Dashboard Style */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-8">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-white mb-2">{project.name}</h1>
            <div className="text-lg font-medium opacity-90 mb-4">Due Diligence Progress Dashboard</div>
            
            {/* Status Badges */}
            <div className="flex items-center space-x-3">
              <Badge 
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  metrics.completionRate >= 80 ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                  metrics.completionRate >= 60 ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                  'bg-red-50 text-red-700 border border-red-200'
                }`}
                data-testid="badge-completion-status"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                {metrics.completionRate}% Complete
              </Badge>
              
              <Badge 
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  metrics.daysRemaining > 30 ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                  metrics.daysRemaining > 14 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  'bg-red-50 text-red-700 border border-red-200'
                }`}
                data-testid="badge-days-remaining"
              >
                <Clock className="h-4 w-4 mr-1" />
                {metrics.daysRemaining} Days Left
              </Badge>
              
              <Badge 
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  metrics.scheduleRisk.color === 'green' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                  metrics.scheduleRisk.color === 'orange' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  'bg-red-50 text-red-700 border border-red-200'
                }`}
                data-testid="badge-risk-level"
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                {metrics.scheduleRisk.level} Risk
              </Badge>
            </div>
          </div>
          
          {/* Key Dates Section */}
          <div className="text-right">
            <div className="text-sm font-medium opacity-90 uppercase tracking-wide mb-2">
              {format(currentDate, 'MMMM yyyy').toUpperCase()}
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-3 mb-3">
              <div className="text-xs uppercase tracking-wide opacity-75 mb-1">Days Remaining</div>
              <div className="text-lg font-bold">{metrics.daysRemaining}</div>
              <div className="text-xs opacity-75">Until Closing</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-3">
              <div className="text-xs uppercase tracking-wide opacity-75 mb-1">Overall Progress</div>
              <div className="text-2xl font-bold">{metrics.completionRate}%</div>
              <div className="text-xs opacity-75">Complete</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8 space-y-8">
        {/* Executive Summary Cards - 4-Card Grid */}
        <div className="space-y-6">
          <div className="flex items-center space-x-2 mb-6">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-semibold text-gray-900">Executive Summary</h2>
          </div>
          
          {/* 4-Card Executive Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Card 1: Tasks Completed */}
            <Card className="bg-white shadow-lg border-0 hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-full ${
                    metrics.completionRate >= 80 ? 'bg-slate-100' :
                    metrics.completionRate >= 60 ? 'bg-slate-100' :
                    'bg-red-50'
                  }`}>
                    <CheckCircle className={`h-6 w-6 ${
                      metrics.completionRate >= 80 ? 'text-slate-600' :
                      metrics.completionRate >= 60 ? 'text-slate-600' :
                      'text-red-600'
                    }`} />
                  </div>
                  <Badge className={`rounded-full text-xs ${
                    metrics.completionRate >= 80 ? 'bg-slate-50 text-slate-700 border border-slate-200' :
                    metrics.completionRate >= 60 ? 'bg-slate-50 text-slate-700 border border-slate-200' :
                    'bg-red-50 text-red-700 border border-red-100'
                  }`}>
                    {metrics.completionRate >= 80 ? 'Excellent' :
                     metrics.completionRate >= 60 ? 'Good' : 'Needs Attention'}
                  </Badge>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {metrics.completedTasks}/{metrics.totalTasks}
                </div>
                <div className="text-sm font-medium text-gray-600 mb-1">Tasks Completed</div>
                <div className={`text-xs ${
                  metrics.completionRate >= 80 ? 'text-slate-600' :
                  metrics.completionRate >= 60 ? 'text-slate-600' :
                  'text-red-600'
                }`}>
                  {metrics.completionRate}% Complete
                </div>
              </CardContent>
            </Card>

            {/* Card 2: DD Expiration */}
            <Card className="bg-white shadow-lg border-0 hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                {metrics.ddEndDate ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-full ${
                        metrics.daysRemainingToDD && metrics.daysRemainingToDD <= 7 ? 'bg-red-50' :
                        metrics.daysRemainingToDD && metrics.daysRemainingToDD <= 14 ? 'bg-amber-50' :
                        'bg-slate-100'
                      }`}>
                        <Calendar className={`h-6 w-6 ${
                          metrics.daysRemainingToDD && metrics.daysRemainingToDD <= 7 ? 'text-red-600' :
                          metrics.daysRemainingToDD && metrics.daysRemainingToDD <= 14 ? 'text-amber-600' :
                          'text-slate-600'
                        }`} />
                      </div>
                      <Badge className={`rounded-full text-xs ${
                        metrics.daysRemainingToDD && metrics.daysRemainingToDD <= 7 ? 'bg-red-50 text-red-700 border border-red-100' :
                        metrics.daysRemainingToDD && metrics.daysRemainingToDD <= 14 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-slate-50 text-slate-700 border border-slate-200'
                      }`}>
                        {metrics.daysRemainingToDD && metrics.daysRemainingToDD <= 7 ? 'Urgent' :
                         metrics.daysRemainingToDD && metrics.daysRemainingToDD <= 14 ? 'Soon' : 'Scheduled'}
                      </Badge>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-2">
                      {metrics.daysRemainingToDD || 0}
                    </div>
                    <div className="text-sm font-medium text-gray-600 mb-1">DD Expiration</div>
                    <div className={`text-xs ${
                      metrics.daysRemainingToDD && metrics.daysRemainingToDD <= 7 ? 'text-red-600' :
                      metrics.daysRemainingToDD && metrics.daysRemainingToDD <= 14 ? 'text-amber-600' :
                      'text-slate-600'
                    }`}>
                      {format(metrics.ddEndDate, 'MMM d, yyyy')}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 rounded-full bg-slate-100">
                        <Calendar className="h-6 w-6 text-slate-600" />
                      </div>
                      <Badge className="rounded-full text-xs bg-slate-50 text-slate-700 border border-slate-200">
                        Not Set
                      </Badge>
                    </div>
                    <div className="text-3xl font-bold text-gray-900 mb-2">
                      --
                    </div>
                    <div className="text-sm font-medium text-gray-600 mb-1">DD Expiration</div>
                    <div className="text-xs text-slate-600">
                      No Date Set
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Card 3: Deposit Due */}
            <Card className="bg-white shadow-lg border-0 hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-full ${
                    (() => {
                      const ddDate = project.ddExpirationDate ? new Date(project.ddExpirationDate) : null;
                      const today = new Date();
                      if (!ddDate) return 'bg-slate-100';
                      const daysUntil = Math.ceil((ddDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      return daysUntil <= 7 ? 'bg-red-50' : daysUntil <= 14 ? 'bg-amber-50' : 'bg-slate-100';
                    })()
                  }`}>
                    <DollarSign className={`h-6 w-6 ${
                      (() => {
                        const ddDate = project.ddExpirationDate ? new Date(project.ddExpirationDate) : null;
                        const today = new Date();
                        if (!ddDate) return 'text-slate-600';
                        const daysUntil = Math.ceil((ddDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        return daysUntil <= 7 ? 'text-red-600' : daysUntil <= 14 ? 'text-amber-600' : 'text-slate-600';
                      })()
                    }`} />
                  </div>
                  <Badge className={`rounded-full text-xs ${
                    (() => {
                      const ddDate = project.ddExpirationDate ? new Date(project.ddExpirationDate) : null;
                      const today = new Date();
                      if (!ddDate) return 'bg-slate-50 text-slate-700 border border-slate-200';
                      const daysUntil = Math.ceil((ddDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      return daysUntil <= 7 ? 'bg-red-50 text-red-700 border border-red-100' : 
                             daysUntil <= 14 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 
                             'bg-slate-50 text-slate-700 border border-slate-200';
                    })()
                  }`}>
                    {
                      (() => {
                        const ddDate = project.ddExpirationDate ? new Date(project.ddExpirationDate) : null;
                        const today = new Date();
                        if (!ddDate) return 'Pending';
                        const daysUntil = Math.ceil((ddDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        return daysUntil <= 7 ? 'Urgent' : daysUntil <= 14 ? 'Soon' : 'Scheduled';
                      })()
                    }
                  </Badge>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {
                    (() => {
                      // Determine which deposit is due based on DD expiration date
                      const ddDate = project.ddExpirationDate ? new Date(project.ddExpirationDate) : null;
                      const firstDepositDate = project.firstDepositDueDate ? new Date(project.firstDepositDueDate) : null;
                      const secondDepositDate = project.secondDepositDueDate ? new Date(project.secondDepositDueDate) : null;
                      
                      let amount = 0;
                      
                      // Check which deposit is closest to or matches DD expiration
                      if (ddDate && firstDepositDate && Math.abs(ddDate.getTime() - firstDepositDate.getTime()) <= 7 * 24 * 60 * 60 * 1000) {
                        amount = project.firstDepositAmount || 0;
                      } else if (ddDate && secondDepositDate && Math.abs(ddDate.getTime() - secondDepositDate.getTime()) <= 7 * 24 * 60 * 60 * 1000) {
                        amount = project.secondDepositAmount || 0;
                      } else if (project.firstDepositAmount && (!project.secondDepositAmount || !secondDepositDate)) {
                        amount = project.firstDepositAmount;
                      } else if (project.secondDepositAmount) {
                        amount = project.secondDepositAmount;
                      }
                      
                      return amount > 0 ? formatLargeCurrency(amount) : '$0';
                    })()
                  }
                </div>
                <div className="text-sm font-medium text-gray-600 mb-1">Deposit Due</div>
                <div className="text-xs text-slate-600">
                  {
                    (() => {
                      const ddDate = project.ddExpirationDate ? new Date(project.ddExpirationDate) : null;
                      if (!ddDate) return 'No DD Date Set';
                      const today = new Date();
                      const daysUntil = Math.ceil((ddDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      if (daysUntil < 0) return 'Past Due';
                      if (daysUntil === 0) return 'Due Today';
                      if (daysUntil === 1) return 'Due Tomorrow';
                      return `Due in ${daysUntil} days`;
                    })()
                  }
                </div>
              </CardContent>
            </Card>

            {/* Card 4: High-Severity Risks */}
            <Card className="bg-white shadow-lg border-0 hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-full ${
                    metrics.highRiskTasks === 0 ? 'bg-slate-100' :
                    metrics.highRiskTasks <= 2 ? 'bg-amber-50' :
                    'bg-red-50'
                  }`}>
                    <AlertTriangle className={`h-6 w-6 ${
                      metrics.highRiskTasks === 0 ? 'text-slate-600' :
                      metrics.highRiskTasks <= 2 ? 'text-amber-600' :
                      'text-red-600'
                    }`} />
                  </div>
                  <Badge className={`rounded-full text-xs ${
                    metrics.highRiskTasks === 0 ? 'bg-slate-50 text-slate-700 border border-slate-200' :
                    metrics.highRiskTasks <= 2 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                    'bg-red-50 text-red-700 border border-red-100'
                  }`}>
                    {metrics.highRiskTasks === 0 ? 'Clear' :
                     metrics.highRiskTasks <= 2 ? 'Manageable' : 'Critical'}
                  </Badge>
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {metrics.highRiskTasks}
                </div>
                <div className="text-sm font-medium text-gray-600 mb-1">High-Severity Risks</div>
                <div className={`text-xs ${
                  metrics.highRiskTasks === 0 ? 'text-slate-600' :
                  metrics.highRiskTasks <= 2 ? 'text-amber-600' :
                  'text-red-600'
                }`}>
                  {metrics.highRiskTasks === 0 ? 'No Critical Risks' :
                   `${metrics.highRiskTasks} Risk${metrics.highRiskTasks > 1 ? 's' : ''} Identified`}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* AI Insights Section - Moved below cards */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Zap className="h-5 w-5 text-slate-600" />
              <h3 className="text-lg font-semibold text-slate-800">AI-Powered Executive Insights</h3>
              <Badge variant="secondary" className="text-xs">Analysis</Badge>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <Activity className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-slate-800 text-sm mb-1">Performance Analysis</div>
                    <p className="text-gray-700 text-sm leading-relaxed">{aiInsights[0]}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <Clock className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-slate-800 text-sm mb-1">Timeline Assessment</div>
                    <p className="text-gray-700 text-sm leading-relaxed">{aiInsights[1]}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Progress Visualization - Enhanced Dashboard */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
            <TrendingUp className="h-6 w-6 mr-3" />
            Due Diligence Progress
          </h2>

          {/* Enhanced Progress Visualization */}
          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            <Card className="bg-white shadow-lg border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold flex items-center text-gray-900">
                  <CheckCircle className="h-5 w-5 mr-3 text-emerald-600" />
                  Task Completion Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Overall Completion</span>
                    <span className="text-2xl font-bold text-gray-900">{metrics.completionRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        metrics.completionRate >= 80 ? 'bg-emerald-500' :
                        metrics.completionRate >= 60 ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${metrics.completionRate}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-600">{metrics.completedTasks}</div>
                      <div className="text-xs text-gray-600 uppercase tracking-wide">Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{metrics.inProgressTasks}</div>
                      <div className="text-xs text-gray-600 uppercase tracking-wide">In Progress</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white shadow-lg border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold flex items-center text-gray-900">
                  <Calendar className="h-5 w-5 mr-3 text-blue-600" />
                  Timeline Progression
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Time Elapsed</span>
                    <span className="text-2xl font-bold text-gray-900">{metrics.timelineProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${metrics.timelineProgress}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{metrics.daysSinceStart}</div>
                      <div className="text-xs text-gray-600 uppercase tracking-wide">Days Elapsed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-amber-600">{metrics.daysRemaining}</div>
                      <div className="text-xs text-gray-600 uppercase tracking-wide">Days Remaining</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Task Status Breakdown */}
          <Card className="bg-white shadow-lg border-0 mb-8">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center text-gray-900">
                <BarChart3 className="h-5 w-5 mr-3 text-gray-600" />
                Task Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="text-2xl font-bold text-emerald-600 mb-1">{metrics.completedTasks}</div>
                  <div className="text-sm font-medium text-emerald-800">Completed</div>
                  <div className="w-3 h-3 bg-emerald-500 rounded-full mx-auto mt-2"></div>
                </div>
                
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600 mb-1">{metrics.inProgressTasks}</div>
                  <div className="text-sm font-medium text-blue-800">In Progress</div>
                  <div className="w-3 h-3 bg-blue-500 rounded-full mx-auto mt-2"></div>
                </div>
                
                <div className="text-center p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="text-2xl font-bold text-amber-600 mb-1">{metrics.engagedTasks}</div>
                  <div className="text-sm font-medium text-amber-800">Engaged</div>
                  <div className="w-3 h-3 bg-amber-500 rounded-full mx-auto mt-2"></div>
                </div>
                
                <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-2xl font-bold text-gray-600 mb-1">{metrics.notStartedTasks}</div>
                  <div className="text-sm font-medium text-gray-800">Not Started</div>
                  <div className="w-3 h-3 bg-gray-400 rounded-full mx-auto mt-2"></div>
                </div>
                
                <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-2xl font-bold text-red-600 mb-1">{metrics.overdueTasks}</div>
                  <div className="text-sm font-medium text-red-800">Overdue</div>
                  <div className="w-3 h-3 bg-red-500 rounded-full mx-auto mt-2"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Task Timeline Visualization */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
            <Shield className="h-6 w-6 mr-3" />
            Project Team & Timeline
          </h2>
          <Card className="bg-white shadow-lg border-0">
            <CardContent className="p-6">
              <TaskTimeline tasks={tasks} project={project} />
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Risk Assessment Dashboard - Professional Style */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
            <AlertTriangle className="h-6 w-6 mr-3" />
            Current Risk Status
          </h2>
          
          {/* Risk Heat Map Header */}
          <div className="bg-white shadow-lg rounded-lg border-0 mb-6">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Risk Heat Map</h3>
                {metrics.overdueTasks === 0 && metrics.highRiskTasks === 0 ? (
                  <Badge className="bg-emerald-100 text-emerald-800 rounded-full px-4 py-2">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    No Critical Risks Identified
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 rounded-full px-4 py-2">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Risk Mitigation Required
                  </Badge>
                )}
              </div>
              
              {/* Risk Summary Cards */}
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Schedule Risk Card */}
                <Card className={`border-2 ${
                  metrics.scheduleRisk.color === 'red' ? 'border-red-300 bg-red-50' :
                  metrics.scheduleRisk.color === 'orange' ? 'border-amber-300 bg-amber-50' :
                  'border-emerald-300 bg-emerald-50'
                }`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-full ${
                        metrics.scheduleRisk.color === 'red' ? 'bg-red-100' :
                        metrics.scheduleRisk.color === 'orange' ? 'bg-amber-100' :
                        'bg-emerald-100'
                      }`}>
                        <Clock className={`h-6 w-6 ${
                          metrics.scheduleRisk.color === 'red' ? 'text-red-600' :
                          metrics.scheduleRisk.color === 'orange' ? 'text-amber-600' :
                          'text-emerald-600'
                        }`} />
                      </div>
                      <Badge className={`rounded-full text-xs font-medium ${
                        metrics.scheduleRisk.color === 'red' ? 'bg-red-200 text-red-800' :
                        metrics.scheduleRisk.color === 'orange' ? 'bg-amber-200 text-amber-800' :
                        'bg-emerald-200 text-emerald-800'
                      }`}>
                        Schedule
                      </Badge>
                    </div>
                    <div className={`text-2xl font-bold mb-2 ${
                      metrics.scheduleRisk.color === 'red' ? 'text-red-700' :
                      metrics.scheduleRisk.color === 'orange' ? 'text-amber-700' :
                      'text-emerald-700'
                    }`}>
                      {metrics.scheduleRisk.level}
                    </div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Schedule Risk Level</div>
                    <div className="text-xs text-gray-600">
                      {metrics.scheduleRisk.description}
                    </div>
                  </CardContent>
                </Card>
                
                {/* Priority Risk Card */}
                <Card className={`border-2 ${
                  metrics.highRiskTasks > 0 ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'
                }`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-full ${
                        metrics.highRiskTasks > 0 ? 'bg-amber-100' : 'bg-emerald-100'
                      }`}>
                        <AlertTriangle className={`h-6 w-6 ${
                          metrics.highRiskTasks > 0 ? 'text-amber-600' : 'text-emerald-600'
                        }`} />
                      </div>
                      <Badge className={`rounded-full text-xs font-medium ${
                        metrics.highRiskTasks > 0 ? 'bg-amber-200 text-amber-800' : 'bg-emerald-200 text-emerald-800'
                      }`}>
                        Priority
                      </Badge>
                    </div>
                    <div className={`text-2xl font-bold mb-2 ${
                      metrics.highRiskTasks > 0 ? 'text-amber-700' : 'text-emerald-700'
                    }`}>
                      {metrics.highRiskTasks > 0 ? 'MEDIUM' : 'LOW'}
                    </div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Priority Risk Level</div>
                    <div className="text-xs text-gray-600">
                      {metrics.highRiskTasks} high-priority open tasks
                    </div>
                  </CardContent>
                </Card>
                
                {/* Overdue Risk Card */}
                <Card className={`border-2 ${
                  metrics.overdueTasks > 0 ? 'border-red-300 bg-red-50' : 'border-emerald-300 bg-emerald-50'
                }`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-full ${
                        metrics.overdueTasks > 0 ? 'bg-red-100' : 'bg-emerald-100'
                      }`}>
                        <Target className={`h-6 w-6 ${
                          metrics.overdueTasks > 0 ? 'text-red-600' : 'text-emerald-600'
                        }`} />
                      </div>
                      <Badge className={`rounded-full text-xs font-medium ${
                        metrics.overdueTasks > 0 ? 'bg-red-200 text-red-800' : 'bg-emerald-200 text-emerald-800'
                      }`}>
                        Deadline
                      </Badge>
                    </div>
                    <div className={`text-2xl font-bold mb-2 ${
                      metrics.overdueTasks > 0 ? 'text-red-700' : 'text-emerald-700'
                    }`}>
                      {metrics.overdueTasks > 0 ? 'HIGH' : 'LOW'}
                    </div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Deadline Risk Level</div>
                    <div className="text-xs text-gray-600">
                      {metrics.overdueTasks > 0 ? `${metrics.overdueTasks} overdue task${metrics.overdueTasks > 1 ? 's' : ''}` : 'All tasks on schedule'}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* AI-Powered Risk Analysis */}
              {aiRiskAnalysis ? (
                <div className="mt-6 space-y-4">
                  {/* Overall Risk Assessment */}
                  <div className={`p-6 rounded-lg border-2 ${
                    aiRiskAnalysis.overallRiskLevel === 'CRITICAL' ? 'bg-red-50 border-red-200' :
                    aiRiskAnalysis.overallRiskLevel === 'HIGH' ? 'bg-amber-50 border-amber-200' :
                    aiRiskAnalysis.overallRiskLevel === 'MEDIUM' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-emerald-50 border-emerald-200'
                  }`}>
                    <div className="flex items-center space-x-3 mb-4">
                      <div className={`p-3 rounded-full ${
                        aiRiskAnalysis.overallRiskLevel === 'CRITICAL' ? 'bg-red-100' :
                        aiRiskAnalysis.overallRiskLevel === 'HIGH' ? 'bg-amber-100' :
                        aiRiskAnalysis.overallRiskLevel === 'MEDIUM' ? 'bg-yellow-100' :
                        'bg-emerald-100'
                      }`}>
                        <Zap className={`h-6 w-6 ${
                          aiRiskAnalysis.overallRiskLevel === 'CRITICAL' ? 'text-red-600' :
                          aiRiskAnalysis.overallRiskLevel === 'HIGH' ? 'text-amber-600' :
                          aiRiskAnalysis.overallRiskLevel === 'MEDIUM' ? 'text-yellow-600' :
                          'text-emerald-600'
                        }`} />
                      </div>
                      <div>
                        <div className={`text-lg font-semibold ${
                          aiRiskAnalysis.overallRiskLevel === 'CRITICAL' ? 'text-red-900' :
                          aiRiskAnalysis.overallRiskLevel === 'HIGH' ? 'text-amber-900' :
                          aiRiskAnalysis.overallRiskLevel === 'MEDIUM' ? 'text-yellow-900' :
                          'text-emerald-900'
                        }`}>
                          AI Risk Assessment: {aiRiskAnalysis.overallRiskLevel}
                        </div>
                        <Badge className={`${
                          aiRiskAnalysis.overallRiskLevel === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                          aiRiskAnalysis.overallRiskLevel === 'HIGH' ? 'bg-amber-100 text-amber-800' :
                          aiRiskAnalysis.overallRiskLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          AI-Powered Analysis
                        </Badge>
                      </div>
                    </div>
                    <p className={`text-sm leading-relaxed ${
                      aiRiskAnalysis.overallRiskLevel === 'CRITICAL' ? 'text-red-700' :
                      aiRiskAnalysis.overallRiskLevel === 'HIGH' ? 'text-amber-700' :
                      aiRiskAnalysis.overallRiskLevel === 'MEDIUM' ? 'text-yellow-700' :
                      'text-emerald-700'
                    }`}>
                      {aiRiskAnalysis.riskSummary}
                    </p>
                  </div>

                  {/* Category Insights */}
                  {aiRiskAnalysis.categoryInsights && aiRiskAnalysis.categoryInsights.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <BarChart3 className="h-5 w-5 mr-2" />
                        Risk Category Analysis
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        {aiRiskAnalysis.categoryInsights.map((insight, index) => (
                          <div key={index} className={`p-4 rounded-lg border ${
                            insight.riskLevel === 'CRITICAL' ? 'bg-red-50 border-red-200' :
                            insight.riskLevel === 'HIGH' ? 'bg-amber-50 border-amber-200' :
                            insight.riskLevel === 'MEDIUM' ? 'bg-yellow-50 border-yellow-200' :
                            'bg-emerald-50 border-emerald-200'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-900 capitalize">{insight.category}</span>
                              <Badge variant="outline" className="text-xs">
                                {insight.count} risk{insight.count !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-700">{insight.insight}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {aiRiskAnalysis.recommendations && aiRiskAnalysis.recommendations.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                      <h4 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                        <Target className="h-5 w-5 mr-2" />
                        AI Recommendations
                      </h4>
                      <ul className="space-y-2">
                        {aiRiskAnalysis.recommendations.map((recommendation, index) => (
                          <li key={index} className="flex items-start space-x-2 text-sm text-blue-800">
                            <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>{recommendation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Critical Factors */}
                  {aiRiskAnalysis.criticalFactors && aiRiskAnalysis.criticalFactors.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Shield className="h-5 w-5 mr-2" />
                        Critical Success Factors
                      </h4>
                      <div className="grid md:grid-cols-3 gap-4">
                        {aiRiskAnalysis.criticalFactors.map((factor, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                            <span className="text-sm text-gray-700">{factor}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Fallback to basic risk analysis */
                <div className="mt-6">
                  {metrics.overdueTasks === 0 && metrics.highRiskTasks === 0 ? (
                    <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-emerald-100 rounded-full">
                          <CheckCircle className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-emerald-900">Excellent Risk Management</div>
                          <div className="text-sm text-emerald-700">All project deliverables are on track with no critical risks identified. Continue maintaining current execution standards.</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-amber-100 rounded-full">
                          <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-amber-900">Risk Mitigation Required</div>
                          <div className="text-sm text-amber-700">Immediate attention needed for overdue tasks and high-priority items to maintain project timeline integrity.</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Professional Footer - Call to Action Elements */}
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200 mt-8">
          <CardContent className="p-8">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Report Info */}
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Report Details
                </h3>
                <div className="space-y-2 text-sm text-blue-800">
                  <div><span className="font-medium">Generated:</span> {format(currentDate, 'PPP')}</div>
                  <div><span className="font-medium">Next Update:</span> {format(addDays(currentDate, 7), 'MMM d, yyyy')}</div>
                  <div><span className="font-medium">Sources:</span> DD Analytics, Project Management System</div>
                </div>
              </div>
              
              {/* Quick Actions */}
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
                  <Target className="h-5 w-5 mr-2" />
                  Quick Actions
                </h3>
                <div className="space-y-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start border-blue-300 text-blue-700 hover:bg-blue-50"
                    onClick={handleViewDetailedTimeline}
                    data-testid="button-view-detailed-timeline"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    View Detailed Timeline
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start border-blue-300 text-blue-700 hover:bg-blue-50"
                    onClick={handleContactTeam}
                    data-testid="button-contact-team"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Contact Team Member
                  </Button>
                </div>
              </div>
              
              {/* Export Options */}
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
                  <Download className="h-5 w-5 mr-2" />
                  Export & Share
                </h3>
                <div className="space-y-3">
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="w-full justify-start bg-blue-600 hover:bg-blue-700"
                    onClick={handleExportReport}
                    data-testid="button-export-comprehensive-report"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Export Report
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start border-blue-300 text-blue-700 hover:bg-blue-50"
                    onClick={handleScheduleReviewMeeting}
                    data-testid="button-schedule-review-meeting"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Review Meeting
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Status Summary */}
            <div className="border-t border-blue-200 pt-6 mt-6">
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-blue-700">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full mr-2"></div>
                  <span>{metrics.completedTasks} Completed</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <span>{metrics.inProgressTasks} In Progress</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-amber-500 rounded-full mr-2"></div>
                  <span>{metrics.engagedTasks} Engaged</span>
                </div>
                {metrics.overdueTasks > 0 && (
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                    <span>{metrics.overdueTasks} Overdue</span>
                  </div>
                )}
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>{metrics.daysRemaining} days remaining</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Team Member Modal */}
        <Dialog open={isContactModalOpen} onOpenChange={setIsContactModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Contact Team Member</DialogTitle>
              <DialogDescription>
                Select a team member or contact to reach out to regarding this project.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {contacts.length > 0 ? (
                <div className="space-y-3">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium">{contact.name}</div>
                          <div className="text-sm text-gray-500">{contact.email}</div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            window.location.href = `mailto:${contact.email}?subject=Regarding ${project.name} Due Diligence`;
                            setIsContactModalOpen(false);
                          }}
                          data-testid={`button-email-${contact.id}`}
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Email
                        </Button>
                        {contact.phone && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              window.location.href = `tel:${contact.phone}`;
                              setIsContactModalOpen(false);
                            }}
                            data-testid={`button-call-${contact.id}`}
                          >
                            <Phone className="h-4 w-4 mr-1" />
                            Call
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-sm">No team members found.</p>
                  <p className="text-xs mt-1">Add contacts in the project settings.</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Schedule Review Meeting - Using AddToCalendarDialog */}
        <AddToCalendarDialog 
          open={isCalendarModalOpen}
          onOpenChange={setIsCalendarModalOpen}
          project={project}
          settings={undefined}
        />

      </div>
    </div>
  );
}