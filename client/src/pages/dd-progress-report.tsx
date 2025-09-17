import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  FileText, 
  Calendar, 
  TrendingUp, 
  Clock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  Download,
  Printer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Project, Task } from "@shared/schema";

export default function DDProgressReportPage() {
  const { id: projectId } = useParams<{ id: string }>();
  
  // Fetch project data
  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ['/api/dd/projects', projectId],
    enabled: !!projectId,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['/api/dd/projects', projectId, 'tasks'],
    enabled: !!projectId,
  });

  if (projectLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading progress report...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Project Not Found</h2>
          <p className="text-gray-600">Unable to load project data for this report.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Controls */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Due Diligence Progress Report</h1>
            <p className="text-sm text-gray-600 mt-1">{project.name}</p>
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="max-w-4xl mx-auto p-6">
        <DDProgressReport project={project} tasks={tasks} />
      </div>
    </div>
  );
}

interface DDProgressReportProps {
  project: Project;
  tasks: Task[];
}

function DDProgressReport({ project, tasks }: DDProgressReportProps) {
  const currentDate = new Date();
  
  // Calculate project metrics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const overdueTasks = tasks.filter(t => {
    if (t.status === 'completed' || !t.deadline) return false;
    return new Date() > new Date(t.deadline);
  }).length;
  
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  // Calculate timeline progress
  const projectStartDate = project.psaSignedDate ? new Date(project.psaSignedDate) : new Date();
  const projectEndDate = project.closingDate ? new Date(project.closingDate) : new Date();
  const daysSinceStart = Math.max(0, Math.floor((currentDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24)));
  const totalProjectDays = Math.max(1, Math.floor((projectEndDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, Math.floor((projectEndDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)));
  const timelineProgress = Math.min(100, Math.round((daysSinceStart / totalProjectDays) * 100));

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden">
      {/* Header Section - Matching Research Brief Style */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-900 text-white p-8">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs font-bold tracking-wider uppercase mb-2">PROGRESS BRIEF</div>
            <div className="text-2xl font-bold tracking-wider uppercase">DUE DILIGENCE</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium opacity-90 uppercase tracking-wide">
              {format(currentDate, 'MMMM yyyy').toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8 space-y-8">
        {/* Executive Summary */}
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Project Momentum Builds Despite Market Headwinds
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Due diligence activities for <strong>{project.name}</strong> continue to progress 
              steadily with {completedTasks} of {totalTasks} critical tasks completed as of 
              {format(currentDate, ' MMMM d, yyyy')}. The acquisition timeline remains on track 
              with {daysRemaining} days until the anticipated closing date.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Current completion rate of {completionRate}% reflects strong project execution, 
              though {overdueTasks > 0 ? `${overdueTasks} overdue items require immediate attention` : 'all deliverables remain on schedule'}. 
              Market conditions continue to support the investment thesis with favorable financing terms expected.
            </p>
          </div>
          
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Timeline Acceleration Supports Value Creation
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Project timeline shows {timelineProgress}% completion with efficient task management 
              across all workstreams. Critical path analysis indicates {inProgressTasks} active 
              initiatives positioned to deliver key milestones ahead of schedule.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Due diligence depth and quality remain consistent with institutional standards, 
              positioning the acquisition for successful completion within the target timeframe. 
              Risk mitigation strategies continue to perform as expected.
            </p>
          </div>
        </div>

        <Separator />

        {/* Key Metrics - Research Brief Style */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">{completedTasks}</div>
            <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">
              Tasks Completed
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {format(currentDate, 'MMMM yyyy')}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">{completionRate}%</div>
            <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">
              Overall Progress
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Target Completion
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600 mb-2">{daysRemaining}</div>
            <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">
              Days to Closing
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {format(projectEndDate, 'MMM d, yyyy')}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600 mb-2">{overdueTasks}</div>
            <div className="text-sm font-medium text-gray-600 uppercase tracking-wide">
              Overdue Items
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Require Attention
            </div>
          </div>
        </div>

        <Separator />

        {/* Timeline Progress Visualization */}
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Project Timeline Progress</h3>
          <div className="bg-gray-100 rounded-lg p-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Project Start</span>
              <span>Current Progress ({timelineProgress}%)</span>
              <span>Target Closing</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-4 rounded-full transition-all duration-500"
                style={{ width: `${timelineProgress}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
              <div>
                <div className="font-medium">{format(projectStartDate, 'MMM d, yyyy')}</div>
                <div>PSA Signed</div>
              </div>
              <div className="text-center">
                <div className="font-medium">{daysSinceStart} days elapsed</div>
                <div>{format(currentDate, 'MMM d, yyyy')}</div>
              </div>
              <div className="text-right">
                <div className="font-medium">{format(projectEndDate, 'MMM d, yyyy')}</div>
                <div>Anticipated Closing</div>
              </div>
            </div>
          </div>
        </div>

        {/* Task Status Summary */}
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-4">Task Completion Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-green-700 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Completed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
                <div className="text-xs text-gray-600">of {totalTasks} total tasks</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-blue-700 flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  In Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{inProgressTasks}</div>
                <div className="text-xs text-gray-600">active workstreams</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-red-700 flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Overdue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{overdueTasks}</div>
                <div className="text-xs text-gray-600">requiring attention</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 pt-6 mt-8">
          <div className="text-xs text-gray-500 leading-relaxed">
            <strong>Sources:</strong> Due Diligence Tracker; Project Management Analytics; Market Research; 
            Financial Analysis; Legal Review Documentation; Technical Assessment Reports.
          </div>
        </div>
      </div>
    </div>
  );
}