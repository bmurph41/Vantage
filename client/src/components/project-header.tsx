import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { Download, Share2, Calendar } from "lucide-react";
import type { Project, Task, ProjectSettings } from "@shared/schema";
import { ddClient } from "@/lib/ddClient";
import { useToast } from "@/hooks/use-toast";
import { ShareProjectDialog } from "./share-project-dialog";
import { AddToCalendarDialog } from "./add-to-calendar-dialog";

interface ProjectHeaderProps {
  project: Project;
  tasks: Task[];
  settings?: ProjectSettings | null;
}

export function ProjectHeader({ project, tasks, settings }: ProjectHeaderProps) {
  const { toast } = useToast();
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isCalendarDialogOpen, setIsCalendarDialogOpen] = useState(false);
  
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const overdueTasks = tasks.filter(t => {
    // This would need proper overdue calculation in a real implementation
    return t.status !== 'completed' && new Date() > new Date(); // Simplified
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
          <Button variant="outline" onClick={handleExportCSV} data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => setIsCalendarDialogOpen(true)} data-testid="button-add-to-calendar">
            <Calendar className="h-4 w-4 mr-2" />
            Add to Calendar
          </Button>
          <Button onClick={() => setIsShareDialogOpen(true)} data-testid="button-share">
            <Share2 className="h-4 w-4 mr-2" />
            Share Project
          </Button>
        </div>
      </div>
      
      {/* Progress Summary */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <Card className="p-4" data-testid="card-total-cost">
          <div className="text-2xl font-bold text-foreground">{formatCurrency(totalCost)}</div>
          <div className="text-sm text-muted-foreground">Total Cost</div>
        </Card>
        <Card className="p-4" data-testid="card-total-tasks">
          <div className="text-2xl font-bold text-foreground">{totalTasks}</div>
          <div className="text-sm text-muted-foreground">Total Tasks</div>
        </Card>
        <Card className="p-4" data-testid="card-completed-tasks">
          <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
          <div className="text-sm text-muted-foreground">Completed</div>
        </Card>
        <Card className="p-4" data-testid="card-in-progress-tasks">
          <div className="text-2xl font-bold text-blue-600">{inProgressTasks}</div>
          <div className="text-sm text-muted-foreground">In Progress</div>
        </Card>
        <Card className="p-4" data-testid="card-overdue-tasks">
          <div className="text-2xl font-bold text-red-600">{overdueTasks}</div>
          <div className="text-sm text-muted-foreground">Overdue</div>
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
        tasks={tasks}
        settings={settings}
      />
    </div>
  );
}
