import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Grid, List } from "lucide-react";
import ProjectCard from "./ProjectCard";
import ProjectForm from "./ProjectForm";
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '@/hooks/salescomps/useProjects';
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { ProjectWithStats } from '@/lib/salescomps/api';
import type { Project, InsertProject, UpdateProject, User } from "@shared/schema";

interface ProjectListProps {
  onSelectProject?: (project: Project) => void;
  selectedProjectId?: string;
}

export default function ProjectList({ onSelectProject, selectedProjectId }: ProjectListProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithStats | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: projects, isLoading, error } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const canCreate: boolean = Boolean(user && ['Owner', 'Broker', 'Analyst', 'Admin'].includes((user as User).role));

  // Filter projects based on search query
  const filteredProjects = projects?.filter(project => 
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()))
  ) || [];

  const handleCreateProject = (data: InsertProject) => {
    createProject.mutate(data, {
      onSuccess: () => {
        setShowForm(false);
      },
    });
  };

  const handleUpdateProject = (data: UpdateProject) => {
    if (!editingProject) return;
    
    updateProject.mutate({ id: editingProject.id, updates: data }, {
      onSuccess: () => {
        setEditingProject(null);
      },
    });
  };

  const handleEdit = (project: ProjectWithStats) => {
    setEditingProject(project);
  };

  const handleDelete = (id: string) => {
    deleteProject.mutate(id);
  };

  const handleView = (id: string) => {
    const project = projects?.find(p => p.id === id);
    if (project && onSelectProject) {
      onSelectProject(project);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProject(null);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load projects</p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projects</h1>
            <p className="text-muted-foreground">
              Organize and manage your sales comparison projects
            </p>
          </div>
          {canCreate && (
            <Button 
              onClick={() => setShowForm(true)}
              data-testid="button-create-project"
              size="lg"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Project
            </Button>
          )}
        </div>

        {/* Search and View Controls */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search projects..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-projects"
            />
          </div>
          
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              data-testid="button-grid-view"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              data-testid="button-list-view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {filteredProjects.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              {searchQuery ? (
                <>
                  <p className="text-muted-foreground mb-4">
                    No projects found matching "{searchQuery}"
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setSearchQuery("")}
                    data-testid="button-clear-search"
                  >
                    Clear Search
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground">
                  No projects yet. Create your first project to get started.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div 
            className={
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "space-y-4"
            }
          >
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                user={user as User}
              />
            ))}
          </div>
        )}
      </div>

      {/* Project Form Dialog */}
      <ProjectForm
        open={showForm || !!editingProject}
        onClose={handleCloseForm}
        onSubmit={(editingProject ? handleUpdateProject : handleCreateProject) as ((data: InsertProject | UpdateProject) => void)}
        project={editingProject || undefined}
        isLoading={createProject.isPending || updateProject.isPending}
      />
    </div>
  );
}