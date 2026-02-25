import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ddClient } from "@/lib/ddClient";
import { useToast } from "@/hooks/use-toast";
import type { Project, ProjectSettings } from "@shared/schema";

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ['/api/dd/projects', projectId],
    queryFn: () => ddClient.getProject(projectId),
    enabled: !!projectId,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ['/api/dd/projects'],
    queryFn: () => ddClient.getProjects(),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (project: Partial<Project>) => ddClient.createProject(project),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects'] });
      toast({
        title: "Success",
        description: "Project created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create project",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Project> }) =>
      ddClient.updateProject(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects'] });
      toast({
        title: "Success",
        description: "Project updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update project",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateProjectSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ projectId, settings }: { projectId: string; settings: Partial<ProjectSettings> }) =>
      ddClient.updateProjectSettings(projectId, settings),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects', projectId] });
      toast({
        title: "Success",
        description: "Settings updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (projectId: string) => ddClient.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dd/projects'] });
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      });
    },
  });
}
