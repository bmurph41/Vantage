import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2, 
  Calendar,
  Database,
  Palette
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ProjectWithStats } from '@/lib/ratecomps/api';
import type { User } from "@shared/schema";

interface ProjectCardProps {
  project: ProjectWithStats;
  onView: (id: string) => void;
  onEdit: (project: ProjectWithStats) => void;
  onDelete: (id: string) => void;
  user: User;
}

export default function ProjectCard({ project, onView, onEdit, onDelete, user }: ProjectCardProps) {
  const [showActions, setShowActions] = useState(false);

  const canEdit = user && ['Owner', 'Broker', 'Analyst', 'Admin'].includes(user.role);
  const canDelete = user && ['Owner', 'Admin'].includes(user.role);

  const handleView = () => {
    onView(project.id);
  };

  const handleEdit = () => {
    onEdit(project);
  };

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete project "${project.name}"? This action cannot be undone.`
    );
    if (confirmed) {
      onDelete(project.id);
    }
  };

  const projectColor = project.color || '#64748b'; // Default to slate-500 if no color
  const compCount = project.compCount || 0;
  const lastUpdated = project.updatedAt ? 
    formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true }) : 
    'Never';

  return (
    <Card 
      className="h-full hover:shadow-md transition-shadow duration-200 cursor-pointer group"
      onClick={handleView}
      data-testid={`project-card-${project.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Project color indicator */}
            <div 
              className="w-4 h-4 rounded-full border-2 border-background flex-shrink-0"
              style={{ backgroundColor: projectColor }}
              data-testid={`project-color-${project.id}`}
            />
            <div className="min-w-0 flex-1">
              <CardTitle 
                className="text-lg text-foreground group-hover:text-primary transition-colors duration-200 truncate"
                data-testid={`project-name-${project.id}`}
              >
                {project.name}
              </CardTitle>
            </div>
          </div>
          
          {(canEdit || canDelete) && (
            <DropdownMenu onOpenChange={setShowActions}>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`project-actions-${project.id}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={handleView} data-testid={`project-view-${project.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                {canEdit && (
                  <DropdownMenuItem onClick={handleEdit} data-testid={`project-edit-${project.id}`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem 
                    onClick={handleDelete} 
                    className="text-destructive focus:text-destructive"
                    data-testid={`project-delete-${project.id}`}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        {project.description && (
          <p 
            className="text-sm text-muted-foreground line-clamp-2 mt-2"
            data-testid={`project-description-${project.id}`}
          >
            {project.description}
          </p>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Stats */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Database className="h-4 w-4" />
              <span data-testid={`project-comp-count-${project.id}`}>
                {compCount} {compCount === 1 ? 'comp' : 'comps'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span data-testid={`project-last-updated-${project.id}`}>
                {lastUpdated}
              </span>
            </div>
          </div>

          {/* Color preview */}
          {project.color && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Palette className="h-4 w-4" />
              <span className="capitalize">
                Project Color
              </span>
              <div 
                className="w-3 h-3 rounded-full border"
                style={{ backgroundColor: project.color }}
              />
            </div>
          )}

          {/* Created by info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>
              Created {project.createdAt ? 
                formatDistanceToNow(new Date(project.createdAt), { addSuffix: true }) : 
                'Unknown'
              }
            </span>
            {compCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                Active
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}