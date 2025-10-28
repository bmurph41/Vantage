import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Calendar, DollarSign, Clock, AlertTriangle, CheckCircle, Building, X, LayoutDashboard, PieChart, Briefcase, TrendingUp } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useProjects, useCreateProject, useDeleteProject } from "@/hooks/use-project";
import { useCreateTask } from "@/hooks/use-tasks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, differenceInCalendarDays, isPast, isToday, parseISO } from "date-fns";
import { tzNow } from "@/lib/date-utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  quickAddTasks: z.object({
    pca: z.boolean().default(false),
    environmental: z.boolean().default(false),
    survey: z.boolean().default(false),
    title: z.boolean().default(false),
  }).default({}),
});

// Pre-defined DD task templates
const DD_TASK_TEMPLATES = {
  pca: {
    title: "PCA",
    description: "Phase I Environmental Site Assessment and Property Condition Assessment",
    priority: "high" as const,
    deadlineType: "days_after_psa" as const,
    deadlineDays: 30,
    showOnTimeline: true,
  },
  environmental: {
    title: "Environmental",
    description: "Environmental Due Diligence and Assessment",
    priority: "high" as const,
    deadlineType: "days_after_psa" as const,
    deadlineDays: 45,
    showOnTimeline: true,
  },
  survey: {
    title: "Survey",
    description: "Property Survey and Boundary Assessment",
    priority: "med" as const,
    deadlineType: "days_after_psa" as const,
    deadlineDays: 60,
    showOnTimeline: true,
  },
  title: {
    title: "Title",
    description: "Title Search and Insurance Commitment",
    priority: "high" as const,
    deadlineType: "days_after_psa" as const,
    deadlineDays: 30,
    showOnTimeline: true,
  },
};

function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createProject = useCreateProject();
  const createTask = useCreateTask();
  const [, navigate] = useLocation();
  
  const form = useForm({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      city: "",
      state: "",
      quickAddTasks: {
        pca: false,
        environmental: false,
        survey: false,
        title: false,
      },
    },
  });

  const onSubmit = async (data: z.infer<typeof createProjectSchema>) => {
    try {
      // Create the project first
      const project = await createProject.mutateAsync({
        name: data.name,
        description: data.description,
        city: data.city,
        state: data.state,
        anchorType: "psa",
        tz: "America/New_York",
      });
      
      // Create selected DD tasks
      const selectedTasks = Object.entries(data.quickAddTasks || {})
        .filter(([_, isSelected]) => isSelected)
        .map(([taskKey]) => taskKey as keyof typeof DD_TASK_TEMPLATES);

      // Create tasks in parallel if any are selected
      if (selectedTasks.length > 0) {
        await Promise.all(
          selectedTasks.map(async (taskKey, index) => {
            const template = DD_TASK_TEMPLATES[taskKey];
            return createTask.mutateAsync({
              projectId: project.id,
              task: {
                ...template,
                sortOrder: index + 1, // Set sort order based on selection order
              },
            });
          })
        );
      }

      onOpenChange(false);
      form.reset();
      navigate(`/projects/${project.id}`);
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-create-project">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="Marina Acquisition - Harbor View"
              data-testid="input-create-project-name"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              placeholder="Optional project description..."
              rows={3}
              data-testid="textarea-create-project-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                {...form.register("city")}
                placeholder="Key West"
                data-testid="input-create-project-city"
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                {...form.register("state")}
                placeholder="FL"
                data-testid="input-create-project-state"
              />
            </div>
          </div>

          {/* Quick Add DD Tasks */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Quick Add Common DD Tasks</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Select common due diligence tasks to automatically add to your new project
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(DD_TASK_TEMPLATES).map(([key, template]) => (
                <div key={key} className="flex items-center space-x-3">
                  <Checkbox
                    id={`task-${key}`}
                    checked={form.watch(`quickAddTasks.${key as keyof typeof DD_TASK_TEMPLATES}`)}
                    onCheckedChange={(checked) => {
                      form.setValue(`quickAddTasks.${key as keyof typeof DD_TASK_TEMPLATES}`, !!checked);
                    }}
                    data-testid={`checkbox-task-${key}`}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label 
                      htmlFor={`task-${key}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {template.title}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {template.deadlineDays} days after PSA • {template.priority} priority
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-create-project"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createProject.isPending}
              data-testid="button-submit-create-project"
            >
              {createProject.isPending ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Dashboard() {
  const { data: projects = [], isLoading } = useProjects();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const deleteProject = useDeleteProject();

  // Calculate days remaining from today to a target date (timezone-aware)
  const calculateDaysRemaining = (targetDate: string): number => {
    const today = tzNow('America/New_York');
    const target = parseISO(targetDate);
    return differenceInCalendarDays(target, today);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-muted rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="dashboard">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-primary" data-testid="app-title">
                Due Diligence Tracker
              </h1>
              <span className="text-sm text-muted-foreground">MarinaMatch</span>
            </div>
            <div className="flex items-center space-x-4">
              {/* Dashboard View Selector */}
              <div className="flex items-center gap-2 border border-border rounded-md p-1">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="h-8" data-testid="button-default-view">
                    <LayoutDashboard className="h-4 w-4 mr-1" />
                    Default
                  </Button>
                </Link>
                <Link href="/investor">
                  <Button variant="ghost" size="sm" className="h-8" data-testid="button-investor-view">
                    <PieChart className="h-4 w-4 mr-1" />
                    Investor
                  </Button>
                </Link>
                <Link href="/owner">
                  <Button variant="ghost" size="sm" className="h-8" data-testid="button-owner-view">
                    <Briefcase className="h-4 w-4 mr-1" />
                    Owner
                  </Button>
                </Link>
              </div>
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                data-testid="button-new-project"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                JD
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2" data-testid="page-title">
            Your Projects
          </h2>
          <p className="text-muted-foreground">
            Manage and track due diligence for all your real estate transactions
          </p>
        </div>

        {projects.length === 0 ? (
          <Card className="text-center py-12" data-testid="empty-state">
            <CardContent>
              <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                <Plus className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first due diligence project to get started
              </p>
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                data-testid="button-create-first-project"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {projects.map((project) => {
              // Calculate project timeline metrics
              const today = tzNow('America/New_York');
              
              // Calculate timeline progress (PSA to Closing)
              let timelineProgress = 0;
              let daysInDeal = 0;
              let daysToClosing = null;
              
              if (project.psaSignedDate) {
                daysInDeal = differenceInCalendarDays(today, parseISO(project.psaSignedDate));
                
                if (project.closingDate) {
                  const totalDays = differenceInCalendarDays(parseISO(project.closingDate), parseISO(project.psaSignedDate));
                  const elapsedDays = differenceInCalendarDays(today, parseISO(project.psaSignedDate));
                  timelineProgress = totalDays > 0 ? Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100)) : 0;
                  daysToClosing = differenceInCalendarDays(parseISO(project.closingDate), today);
                }
              }
              
              // Calculate total deposits
              const totalDeposits = (project.firstDepositAmount || 0) + (project.secondDepositAmount || 0);
              
              // Status checks
              const ddExpired = project.ddExpirationDate && isPast(parseISO(project.ddExpirationDate));
              const ddExpiringSoon = project.ddExpirationDate && !ddExpired && differenceInCalendarDays(parseISO(project.ddExpirationDate), today) <= 7;
              
              let statusBadge = null;
              
              if (ddExpired) {
                statusBadge = { text: "DD Expired", variant: "destructive" as const };
              } else if (ddExpiringSoon) {
                statusBadge = { text: "DD Expiring Soon", variant: "default" as const, className: "bg-amber-100 text-amber-800 border-amber-300" };
              } else if (daysToClosing !== null && daysToClosing <= 14 && daysToClosing > 0) {
                statusBadge = { text: "Closing Soon", variant: "default" as const, className: "bg-blue-100 text-blue-800 border-blue-300" };
              } else if (timelineProgress >= 50) {
                statusBadge = { text: "In Progress", variant: "default" as const, className: "bg-green-100 text-green-800 border-green-300" };
              }
              
              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="hover:shadow-xl transition-all duration-200 cursor-pointer border-l-4 border-l-blue-500 hover:scale-[1.01]" data-testid={`card-project-${project.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-xl font-bold text-gray-900 mb-1" data-testid={`text-project-name-${project.id}`}>
                            {project.name}
                          </CardTitle>
                          {(project.city || project.state) && (
                            <p className="text-sm text-gray-500" data-testid={`text-project-location-${project.id}`}>
                              {[project.city, project.state].filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {statusBadge && (
                            <Badge variant={statusBadge.variant} className={statusBadge.className || ""}>
                              {statusBadge.text}
                            </Badge>
                          )}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteProjectId(project.id);
                            }}
                            className="p-1 rounded-sm text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                            data-testid={`button-delete-project-${project.id}`}
                            title="Delete project"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {/* Timeline Progress Bar */}
                      {project.psaSignedDate && project.closingDate && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-600">Deal Timeline Progress</span>
                            <span className="text-2xl font-bold text-blue-600">
                              {Math.round(timelineProgress)}%
                            </span>
                          </div>
                          <Progress value={timelineProgress} className="h-3" data-testid={`progress-timeline-${project.id}`} />
                          <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                            <span>{format(parseISO(project.psaSignedDate), 'MMM d')}</span>
                            <span>{format(parseISO(project.closingDate), 'MMM d')}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Key Metrics Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* Time in Deal */}
                        <div className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                            <Clock className="h-4 w-4" />
                            <span>Time in Deal</span>
                          </div>
                          <div className="text-xl font-bold text-gray-900" data-testid={`text-days-in-deal-${project.id}`}>
                            {daysInDeal}d
                          </div>
                        </div>
                        
                        {/* Days to Closing */}
                        <div className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                            <Calendar className="h-4 w-4" />
                            <span>To Closing</span>
                          </div>
                          <div className="text-xl font-bold text-gray-900" data-testid={`text-days-to-closing-${project.id}`}>
                            {daysToClosing !== null ? `${daysToClosing}d` : 'TBD'}
                          </div>
                        </div>
                        
                        {/* Total Deposits */}
                        {totalDeposits > 0 && (
                          <div className="bg-green-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                              <DollarSign className="h-4 w-4" />
                              <span>Total Deposits</span>
                            </div>
                            <div className="text-xl font-bold text-gray-900" data-testid={`text-total-deposits-${project.id}`}>
                              ${(totalDeposits / 1000).toFixed(0)}K
                            </div>
                          </div>
                        )}
                        
                        {/* Purchase Price */}
                        {project.purchasePrice && (
                          <div className="bg-blue-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                              <Building className="h-4 w-4" />
                              <span>Purchase Price</span>
                            </div>
                            <div className="text-xl font-bold text-gray-900" data-testid={`text-purchase-price-${project.id}`}>
                              ${(project.purchasePrice / 1000000).toFixed(1)}M
                            </div>
                          </div>
                        )}
                        
                        {/* DD Days Remaining (if applicable) */}
                        {project.ddExpirationDate && !ddExpired && (
                          <div className={`rounded-lg p-3 ${ddExpiringSoon ? 'bg-amber-50' : 'bg-purple-50'}`}>
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                              <AlertTriangle className="h-4 w-4" />
                              <span>DD Remaining</span>
                            </div>
                            <div className={`text-xl font-bold ${ddExpiringSoon ? 'text-amber-700' : 'text-gray-900'}`} data-testid={`text-dd-remaining-${project.id}`}>
                              {calculateDaysRemaining(project.ddExpirationDate)}d
                            </div>
                          </div>
                        )}
                        
                        {/* Projected Revenue (if applicable) */}
                        {project.projectedAnnualRevenue && (
                          <div className="bg-indigo-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                              <TrendingUp className="h-4 w-4" />
                              <span>Annual Rev.</span>
                            </div>
                            <div className="text-xl font-bold text-gray-900" data-testid={`text-annual-revenue-${project.id}`}>
                              ${(project.projectedAnnualRevenue / 1000).toFixed(0)}K
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      
      <CreateProjectDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen} 
      />

      <AlertDialog open={!!deleteProjectId} onOpenChange={() => setDeleteProjectId(null)}>
        <AlertDialogContent data-testid="dialog-delete-project-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This action cannot be undone and will permanently delete all associated tasks, files, and data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-project">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteProjectId) {
                  await deleteProject.mutateAsync(deleteProjectId);
                  setDeleteProjectId(null);
                }
              }}
              disabled={deleteProject.isPending}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-project"
            >
              {deleteProject.isPending ? "Deleting..." : "Yes, Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
