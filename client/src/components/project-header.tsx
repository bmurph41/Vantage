import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, parseISO, isAfter, addDays } from "date-fns";
import { tzNow } from "@/lib/date-utils";
import { Download, Share2, Calendar, FileText, Loader2, FileBarChart, CheckCircle2, X, FolderLock } from "lucide-react";
import type { Project, Task, ProjectSettings } from "@shared/schema";
import { ddClient } from "@/lib/ddClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ShareProjectDialog } from "./share-project-dialog";
import { AddToCalendarDialog } from "./add-to-calendar-dialog";
import { generateWhitePaperPDF } from "./white-paper-export";

interface ProjectHeaderProps {
  project: Project;
  tasks: Task[];
  settings?: ProjectSettings | null;
}

export function ProjectHeader({ project, tasks, settings }: ProjectHeaderProps) {
  const { toast } = useToast();
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isCalendarDialogOpen, setIsCalendarDialogOpen] = useState(false);
  const [isExportingReport, setIsExportingReport] = useState(false);

  // Fetch risks data for PDF export - temporarily disabled due to missing API endpoints
  // TODO: Enable when risk API endpoints are implemented
  const risks: any[] = [];
  const riskAnalytics = null;
  
  // const { data: risks = [] } = useQuery({
  //   queryKey: ['/api/dd/projects', project.id, 'risks'],
  //   queryFn: () => apiRequest(`/api/dd/projects/${project.id}/risks`),
  //   enabled: !!project.id,
  // });

  // const { data: riskAnalytics } = useQuery({
  //   queryKey: ['/api/dd/projects', project.id, 'risks', 'analytics'],
  //   queryFn: () => apiRequest(`/api/dd/projects/${project.id}/risks/analytics`),
  //   enabled: !!project.id,
  // });
  
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'engaged' || t.status === 'scheduled' || t.status === 'in_progress').length;
  const notStartedTasks = tasks.filter(t => t.status === 'not_started').length;
  const overdueTasks = tasks.filter(t => {
    if (t.status === 'completed') return false;
    
    const today = tzNow('America/New_York');
    
    // Calculate task deadline
    if (t.deadline) {
      return isAfter(today, parseISO(t.deadline));
    } else if (t.deadlineType === 'days_after_psa' && t.deadlineDays && project.psaSignedDate) {
      const psaDate = parseISO(project.psaSignedDate);
      const deadline = addDays(psaDate, t.deadlineDays);
      return isAfter(today, deadline);
    }
    
    return false; // Not overdue if no deadline can be determined
  }).length;

  // Calculate total cost from all tasks
  const totalCost = tasks.reduce((sum, task) => {
    if (task.cost) {
      // Remove currency symbols and commas, then parse as float
      const cleanCost = task.cost.replace(/[$,]/g, '').trim();
      const numericCost = parseFloat(cleanCost);
      return sum + (isNaN(numericCost) ? 0 : numericCost);
    }
    return sum;
  }, 0);

  // Format total cost for display
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleExportCSV = async () => {
    try {
      const csvData = await ddClient.exportCSV(project.id);
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name}-tasks.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export CSV",
        variant: "destructive",
      });
    }
  };

  const handleExportReport = async () => {
    if (isExportingReport) return; // Prevent duplicate clicks
    
    setIsExportingReport(true);
    try {
      await generateWhitePaperPDF(project, tasks, risks, riskAnalytics, settings);
      toast({
        title: "Success",
        description: "Due diligence report exported successfully",
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: "Error",
        description: "Failed to export report",
        variant: "destructive",
      });
    } finally {
      setIsExportingReport(false);
    }
  };

  const acceptMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/dd/projects/${project.id}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', project.id] });
      toast({
        title: "Success",
        description: "DD marked as approved",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark DD as approved",
        variant: "destructive",
      });
    },
  });

  const unacceptMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/dd/projects/${project.id}/unaccept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', project.id] });
      toast({
        title: "Success",
        description: "DD approval removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to undo DD approval",
        variant: "destructive",
      });
    },
  });

  const handleAcceptProject = () => {
    acceptMutation.mutate();
  };

  const handleUnacceptProject = () => {
    if (confirm("Are you sure you want to undo DD approval? This will change the project status back to active.")) {
      unacceptMutation.mutate();
    }
  };


  return (
    <div className="mb-8" data-testid="project-header">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground" data-testid="project-name">
            {project.name}
          </h2>
          <p className="text-muted-foreground" data-testid="project-dates">
            {project.closingDate && `Target Closing Date: ${format(parseISO(project.closingDate), 'MMMM d, yyyy')}`}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <a href={`/projects/${project.id}/progress-report`}>
            <Button variant="outline" data-testid="link-progress-report">
              <FileBarChart className="h-4 w-4 mr-2" />
              Progress Report
            </Button>
          </a>
          <a href={`/vdr/projects/${project.id}`}>
            <Button variant="outline" className="border-orange-500 text-orange-700 hover:bg-orange-50" data-testid="link-data-room">
              <FolderLock className="h-4 w-4 mr-2" />
              Data Room
            </Button>
          </a>
          {project.status !== 'accepted' ? (
            <Button 
              variant="default"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleAcceptProject}
              disabled={acceptMutation.isPending}
              data-testid="button-accept-project"
            >
              {acceptMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              DD Approved
            </Button>
          ) : (
            <Button 
              variant="outline"
              className="border-amber-500 text-amber-700 hover:bg-amber-50"
              onClick={handleUnacceptProject}
              disabled={unacceptMutation.isPending}
              data-testid="button-unaccept-project"
            >
              {unacceptMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Undo Approval
            </Button>
          )}
          <Button variant="outline" onClick={handleExportCSV} data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          {/* Prominent Calendar Export Button */}
          <Button 
            variant="default" 
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md"
            onClick={() => setIsCalendarDialogOpen(true)} 
            data-testid="button-export-calendar"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Export to Calendar
          </Button>
          <Button variant="outline" onClick={() => setIsShareDialogOpen(true)} data-testid="button-share">
            <Share2 className="h-4 w-4 mr-2" />
            Share Project
          </Button>
        </div>
      </div>
      
      {/* Progress Summary */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <Card className="p-4" data-testid="card-total-cost">
          <div className="text-2xl font-bold text-foreground">{formatCurrency(totalCost)}</div>
          <div className="text-sm text-muted-foreground">Total Cost</div>
        </Card>
        <Card className="p-4" data-testid="card-total-tasks">
          <div className="text-2xl font-bold text-foreground">{totalTasks}</div>
          <div className="text-sm text-muted-foreground">Total Tasks</div>
        </Card>
        <Card className="p-4" data-testid="card-in-progress-tasks">
          <div className="text-2xl font-bold text-blue-600">{inProgressTasks}</div>
          <div className="text-sm text-muted-foreground">In Progress</div>
        </Card>
        <Card className="p-4" data-testid="card-not-started-tasks">
          <div className="text-2xl font-bold text-gray-600">{notStartedTasks}</div>
          <div className="text-sm text-muted-foreground">Not Started</div>
        </Card>
        <Card className="p-4" data-testid="card-overdue-tasks">
          <div className="text-2xl font-bold text-red-600">{overdueTasks}</div>
          <div className="text-sm text-muted-foreground">Overdue</div>
        </Card>
        <Card className="p-4 bg-green-50 border-green-200" data-testid="card-completed-tasks">
          <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
          <div className="text-sm text-green-700 font-medium">Completed</div>
        </Card>
      </div>

      <ShareProjectDialog
        open={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        project={project}
      />

      <AddToCalendarDialog
        open={isCalendarDialogOpen}
        onOpenChange={setIsCalendarDialogOpen}
        project={project}
        settings={settings}
      />
    </div>
  );
}
