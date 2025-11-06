import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Calendar, 
  Database, 
  Palette,
  Search,
  Plus,
  MoreHorizontal,
  FileText,
  Lightbulb
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useProject, useProjectComps, useUpdateProject, useDeleteProject } from '@/hooks/salescomps/useProjects';
import { useAuth } from "@/hooks/useAuth";
import ProjectForm from "./ProjectForm";
import ProjectCompsTable from "./ProjectCompsTable";
import BulkProjectCompsActions from "./BulkProjectCompsActions";
import AddCompsToProjectDialog from "./AddCompsToProjectDialog";
import RecommendationsDialog from "./RecommendationsDialog";
import type { Project, UpdateProject, SalesComp, User } from "@shared/schema";
import type { ProjectCompsResponse } from '@/lib/salescomps/api';

interface ProjectDetailsProps {
  projectId: string;
  onClose: () => void;
  onEdit?: (project: Project) => void;
}

export default function ProjectDetails({ projectId, onClose, onEdit }: ProjectDetailsProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompIds, setSelectedCompIds] = useState<string[]>([]);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showAddCompsDialog, setShowAddCompsDialog] = useState(false);
  const [showRecommendationsDialog, setShowRecommendationsDialog] = useState(false);
  const [sortBy, setSortBy] = useState("marina");
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>("asc");

  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: projectCompsData, isLoading: compsLoading, refetch: refetchComps } = useProjectComps(projectId);
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const canEdit: boolean = Boolean(user && ['Owner', 'Broker', 'Analyst', 'Admin'].includes((user as User).role));
  const canDelete: boolean = Boolean(user && ['Owner', 'Admin'].includes((user as User).role));

  const comps = projectCompsData?.comps || [];

  const handleUpdateProject = (data: UpdateProject) => {
    updateProject.mutate({ id: projectId, updates: data }, {
      onSuccess: () => {
        setShowEditForm(false);
      },
    });
  };

  const handleDeleteProject = () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete project "${project?.name}"? This action cannot be undone.`
    );
    if (confirmed) {
      deleteProject.mutate(projectId, {
        onSuccess: () => {
          onClose();
        },
      });
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const handleRefresh = () => {
    refetchComps();
    setSelectedCompIds([]);
  };

  const handleGenerateReport = () => {
    setLocation(`/projects/${projectId}/report`);
  };

  // Filter comps based on search query  
  const filteredComps = comps.filter(projectComp => 
    projectComp.salesComp.marina.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (projectComp.salesComp.state && projectComp.salesComp.state.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (projectComp.salesComp.market && projectComp.salesComp.market.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Sort filtered comps
  const sortedComps = [...filteredComps].sort((a, b) => {
    const aValue = a.salesComp[sortBy as keyof SalesComp] || '';
    const bValue = b.salesComp[sortBy as keyof SalesComp] || '';
    
    if (sortDir === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  // Get selected comps for preview
  const selectedCompsPreview = sortedComps
    .filter(pc => selectedCompIds.includes(pc.salesCompId))
    .map(pc => pc.salesComp);

  // Get existing comp IDs for AddCompsDialog
  const existingCompIds = comps.map(pc => pc.salesCompId);

  if (projectLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Project not found</p>
          <Button onClick={onClose}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              data-testid="button-back-to-projects"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Button>
            
            <div className="flex items-center gap-3">
              <div 
                className="w-6 h-6 rounded-full border-2 border-background"
                style={{ backgroundColor: project.color || '#64748b' }}
                data-testid={`project-color-indicator-${project.id}`}
              />
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="project-name">
                  {project.name}
                </h1>
                {project.description && (
                  <p className="text-muted-foreground" data-testid="project-description">
                    {project.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {(canEdit || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-project-actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem onClick={() => setShowEditForm(true)} data-testid="action-edit-project">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Project
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem 
                    onClick={handleDeleteProject}
                    className="text-destructive focus:text-destructive"
                    data-testid="action-delete-project"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Project
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Project Stats */}
        <div className="flex items-center gap-6 mt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Database className="h-4 w-4" />
            <span data-testid="project-comp-count">
              {comps.length} {comps.length === 1 ? 'comp' : 'comps'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span data-testid="project-last-updated">
              Updated {project.updatedAt ? formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true }) : 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* Comps Section */}
      <div className="flex-1 flex flex-col">
        {/* Comps Header */}
        <div className="border-b border-border p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Sales Comparables
            </h2>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRecommendationsDialog(true)}
                data-testid="button-get-suggestions"
                className="w-full sm:w-auto"
              >
                <Lightbulb className="mr-2 h-4 w-4" />
                Get Suggestions
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateReport}
                    data-testid="button-generate-project-report"
                    disabled={comps.length === 0}
                    className="w-full sm:w-auto"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Report
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Generate a professional portfolio analysis report for this project</p>
                </TooltipContent>
              </Tooltip>
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowAddCompsDialog(true)}
                data-testid="button-add-comps-to-project"
                className="w-full sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Comps
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search comps..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-comps"
            />
          </div>
        </div>

        {/* Comps Table with our new component */}
        <ProjectCompsTable
          data={sortedComps}
          loading={compsLoading}
          selectedIds={selectedCompIds}
          onSelectionChange={setSelectedCompIds}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={handleSort}
          canEdit={canEdit}
          canDelete={canDelete}
          projectId={projectId}
          projectName={project.name}
        />
      </div>

      {/* Bulk Actions */}
      <BulkProjectCompsActions
        selectedIds={selectedCompIds}
        selectedCompsPreview={selectedCompsPreview}
        projectId={projectId}
        projectName={project.name}
        onClearSelection={() => setSelectedCompIds([])}
        onRefresh={handleRefresh}
      />

      {/* Edit Project Dialog */}
      {showEditForm && project && (
        <ProjectForm
          open={true}
          project={project}
          onClose={() => setShowEditForm(false)}
          onSubmit={handleUpdateProject}
          isLoading={updateProject.isPending}
        />
      )}

      {/* Add Comps Dialog */}
      {showAddCompsDialog && (
        <AddCompsToProjectDialog
          open={showAddCompsDialog}
          onClose={() => setShowAddCompsDialog(false)}
          projectId={projectId}
          projectName={project.name}
          existingCompIds={existingCompIds}
        />
      )}

      {/* Recommendations Dialog */}
      {showRecommendationsDialog && project && (
        <RecommendationsDialog
          open={showRecommendationsDialog}
          onClose={() => setShowRecommendationsDialog(false)}
          project={project}
          existingCompIds={existingCompIds}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  );
}