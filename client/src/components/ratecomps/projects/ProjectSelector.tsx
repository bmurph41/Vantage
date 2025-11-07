import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { useProjects, useCreateProject } from '@/hooks/ratecomps/useProjects';
import ProjectForm from "./ProjectForm";
import type { ProjectWithStats } from '@/lib/ratecomps/api';
import type { InsertRcProject } from "@shared/schema";

interface ProjectSelectorProps {
  selectedProjectId?: string;
  onProjectSelect: (projectId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowCreateNew?: boolean;
  className?: string;
}

export default function ProjectSelector({
  selectedProjectId,
  onProjectSelect,
  placeholder = "Select a project...",
  disabled = false,
  allowCreateNew = true,
  className = "",
}: ProjectSelectorProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { data: projects, isLoading } = useProjects();
  const createProjectMutation = useCreateProject();

  const handleProjectSubmit = (formData: any) => {
    // The hook will handle adding the required fields like tenantId and createdBy
    createProjectMutation.mutate(formData, {
      onSuccess: (newProject) => {
        setShowCreateDialog(false);
        onProjectSelect(newProject.id);
      },
    });
  };

  const selectedProject = projects?.find(p => p.id === selectedProjectId);

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 p-2 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading projects...</span>
      </div>
    );
  }

  return (
    <>
      <div className={`space-y-2 ${className}`}>
        <Select 
          value={selectedProjectId || ""} 
          onValueChange={onProjectSelect}
          disabled={disabled}
        >
          <SelectTrigger data-testid="select-project">
            <SelectValue placeholder={placeholder}>
              {selectedProject && (
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedProject.color || '#64748b' }}
                  />
                  <span>{selectedProject.name}</span>
                  {selectedProject.compCount !== undefined && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedProject.compCount} comps
                    </Badge>
                  )}
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(!projects || projects.length === 0) ? (
              <div className="p-2 text-center text-muted-foreground text-sm">
                No projects found
              </div>
            ) : (
              projects.map((project) => (
                <SelectItem key={project.id} value={project.id} data-testid={`option-project-${project.id}`}>
                  <div className="flex items-center gap-2 w-full">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: project.color || '#64748b' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{project.name}</div>
                      {project.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {project.description}
                        </div>
                      )}
                    </div>
                    {project.compCount !== undefined && (
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        {project.compCount}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {allowCreateNew && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            disabled={disabled}
            className="w-full"
            data-testid="button-create-new-project"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Project
          </Button>
        )}
      </div>

      {showCreateDialog && (
        <ProjectForm
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onSubmit={handleProjectSubmit}
          isLoading={createProjectMutation.isPending}
        />
      )}
    </>
  );
}