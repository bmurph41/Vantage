import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useProjects, useCreateProject } from "@/hooks/use-project";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
});

function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createProject = useCreateProject();
  const [, navigate] = useLocation();
  
  const form = useForm({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof createProjectSchema>) => {
    try {
      const project = await createProject.mutateAsync({
        name: data.name,
        description: data.description,
        anchorType: "psa",
        tz: "America/New_York",
      });
      onOpenChange(false);
      form.reset();
      navigate(`/project/${project.id}`);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link key={project.id} href={`/project/${project.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-project-${project.id}`}>
                  <CardHeader>
                    <CardTitle className="text-lg" data-testid={`text-project-name-${project.id}`}>
                      {project.name}
                    </CardTitle>
                    {project.description && (
                      <p className="text-sm text-muted-foreground" data-testid={`text-project-description-${project.id}`}>
                        {project.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {project.psaSignedDate && (
                        <div className="flex justify-between" data-testid={`text-psa-date-${project.id}`}>
                          <span className="text-muted-foreground">PSA Signed:</span>
                          <span>{format(new Date(project.psaSignedDate), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                      {project.ddExpirationDate && (
                        <div className="flex justify-between" data-testid={`text-dd-expiration-${project.id}`}>
                          <span className="text-muted-foreground">DD Expiration:</span>
                          <span>{format(new Date(project.ddExpirationDate), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                      {project.closingDate && (
                        <div className="flex justify-between" data-testid={`text-closing-date-${project.id}`}>
                          <span className="text-muted-foreground">Closing:</span>
                          <span>{format(new Date(project.closingDate), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                      {(project as any).totalCost !== undefined && (
                        <div className="flex justify-between border-t pt-2 mt-2" data-testid={`text-total-cost-${project.id}`}>
                          <span className="text-muted-foreground font-medium">Total Cost:</span>
                          <span className="font-bold text-lg">
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            }).format((project as any).totalCost)}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
      
      <CreateProjectDialog 
        open={isCreateDialogOpen} 
        onOpenChange={setIsCreateDialogOpen} 
      />
    </div>
  );
}
