import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, type ProjectWithStats, type ProjectCompsResponse } from "@/lib/salescomps/api";
import { queryKeys } from "@/lib/salescomps/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/salescomps/authUtils";
import type { Project, InsertProject, UpdateProject, InsertProjectComp } from "@shared/schema";

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: projectsApi.getProjects,
    retry: false,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id),
    queryFn: () => projectsApi.getProject(id),
    retry: false,
    enabled: !!id,
  });
}

export function useProjectComps(id: string) {
  return useQuery({
    queryKey: queryKeys.projects.comps(id),
    queryFn: () => projectsApi.getProjectComps(id),
    retry: false,
    enabled: !!id,
  });
}

export function useCreateProject(onProjectCreated?: (project: Project, recommendations: any) => void) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (projectData: InsertProject) => projectsApi.createProject(projectData),
    onSuccess: (response) => {
      const { project, recommendations } = response;
      toast({
        title: "Success",
        description: `Project "${project.name}" created successfully`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      
      // Call callback with project and recommendations if provided
      if (onProjectCreated) {
        onProjectCreated(project, recommendations);
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to create project",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateProject }) => 
      projectsApi.updateProject(id, updates),
    onSuccess: (project) => {
      toast({
        title: "Success",
        description: `Project "${project.name}" updated successfully`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to update project",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => projectsApi.deleteProject(id),
    onSuccess: (_, id) => {
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      queryClient.removeQueries({ queryKey: queryKeys.projects.detail(id) });
      queryClient.removeQueries({ queryKey: queryKeys.projects.comps(id) });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to delete project",
        variant: "destructive",
      });
    },
  });
}

export function useAddCompToProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ projectId, compData }: { projectId: string; compData: InsertProjectComp }) => 
      projectsApi.addCompToProject(projectId, compData),
    onSuccess: (_, { projectId }) => {
      toast({
        title: "Success",
        description: "Sales comp added to project successfully",
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.comps(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
    onError: (error) => {
      const message = (error as Error).message;
      if (message.includes("already added")) {
        toast({
          title: "Already Added",
          description: "This sales comp is already in the project",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Error",
        description: message || "Failed to add comp to project",
        variant: "destructive",
      });
    },
  });
}

export function useBulkAddCompsToProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ projectId, compIds }: { projectId: string; compIds: string[] }) => 
      projectsApi.bulkAddCompsToProject(projectId, compIds),
    onSuccess: (result, { projectId }) => {
      const { added, skipped } = result;
      let message = `Added ${added} sales comps to project`;
      if (skipped > 0) {
        message += `, skipped ${skipped} already in project`;
      }
      toast({
        title: "Success",
        description: message,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.comps(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to add comps to project",
        variant: "destructive",
      });
    },
  });
}

export function useBulkRemoveCompsFromProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ projectId, compIds }: { projectId: string; compIds: string[] }) => 
      projectsApi.bulkRemoveCompsFromProject(projectId, compIds),
    onSuccess: (result, { projectId }) => {
      const { removed } = result;
      toast({
        title: "Success",
        description: `Removed ${removed} sales comps from project`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.comps(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to remove comps from project",
        variant: "destructive",
      });
    },
  });
}

export function useRemoveCompFromProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ projectId, compId }: { projectId: string; compId: string }) => 
      projectsApi.removeCompFromProject(projectId, compId),
    onSuccess: (_, { projectId }) => {
      toast({
        title: "Success",
        description: "Sales comp removed from project successfully",
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.comps(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to remove comp from project",
        variant: "destructive",
      });
    },
  });
}
