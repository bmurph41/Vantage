import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DocumentRequirement } from "@shared/schema";

export interface CreateDocumentRequirementData {
  taskId: string;
  requirementKey: string;
  title: string;
  description?: string;
  provider: string;
}

export interface UpdateDocumentRequirementData {
  status?: "requested" | "received" | "verified" | "rejected" | "outdated" | "external_unavailable";
  externalDocId?: string;
  externalVersion?: string;
  metadata?: Record<string, any>;
}

// Hook to get document requirements for a project
export function useProjectDocumentRequirements(projectId: string) {
  return useQuery({
    queryKey: ["/api/document-requirements", "project", projectId],
    enabled: !!projectId,
  });
}

// Hook to get document requirements for a specific task
export function useTaskDocumentRequirements(taskId: string) {
  return useQuery({
    queryKey: ["/api/document-requirements", "task", taskId],
    enabled: !!taskId,
  });
}

// Hook to get a specific document requirement
export function useDocumentRequirement(requirementId: string) {
  return useQuery({
    queryKey: ["/api/document-requirements", requirementId],
    enabled: !!requirementId,
  });
}

// Hook to create a new document requirement
export function useCreateDocumentRequirement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateDocumentRequirementData) => {
      return apiRequest(`/api/document-requirements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ 
        queryKey: ["/api/document-requirements", "task", variables.taskId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/document-requirements", "project"] 
      });
      toast({
        title: "Document requirement created",
        description: "The document requirement has been added successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating document requirement",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });
}

// Hook to update a document requirement status
export function useUpdateDocumentRequirement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      requirementId, 
      data 
    }: { 
      requirementId: string; 
      data: UpdateDocumentRequirementData 
    }) => {
      return apiRequest(`/api/document-requirements/${requirementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ 
        queryKey: ["/api/document-requirements", variables.requirementId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/document-requirements", "task"] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["/api/document-requirements", "project"] 
      });
      toast({
        title: "Document requirement updated",
        description: "The document requirement status has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating document requirement",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });
}

// Hook to delete a document requirement
export function useDeleteDocumentRequirement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (requirementId: string) => {
      return apiRequest(`/api/document-requirements/${requirementId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      // Invalidate all document requirement queries
      queryClient.invalidateQueries({ 
        queryKey: ["/api/document-requirements"] 
      });
      toast({
        title: "Document requirement deleted",
        description: "The document requirement has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting document requirement",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });
}

// Hook to bulk update document requirements
export function useBulkUpdateDocumentRequirements() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (updates: Array<{ 
      requirementId: string; 
      data: UpdateDocumentRequirementData 
    }>) => {
      return apiRequest(`/api/document-requirements/bulk-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
    },
    onSuccess: () => {
      // Invalidate all document requirement queries
      queryClient.invalidateQueries({ 
        queryKey: ["/api/document-requirements"] 
      });
      toast({
        title: "Document requirements updated",
        description: "Multiple document requirements have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating document requirements",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });
}

// Hook to check if all document requirements are satisfied for a task
export function useTaskDocumentCompletionStatus(taskId: string) {
  const { data: requirements = [], isLoading } = useTaskDocumentRequirements(taskId);
  
  const allRequirementsVerified = requirements.every(
    (req: DocumentRequirement) => req.status === "verified"
  );
  
  const hasBlockingIssues = requirements.some(
    (req: DocumentRequirement) => ["rejected", "external_unavailable", "outdated"].includes(req.status)
  );
  
  const pendingRequirements = requirements.filter(
    (req: DocumentRequirement) => !["verified", "rejected", "external_unavailable"].includes(req.status)
  );
  
  return {
    requirements,
    isLoading,
    allRequirementsVerified,
    hasBlockingIssues,
    pendingRequirements,
    canComplete: allRequirementsVerified || requirements.length === 0,
    totalRequirements: requirements.length,
    verifiedCount: requirements.filter((req: DocumentRequirement) => req.status === "verified").length,
  };
}