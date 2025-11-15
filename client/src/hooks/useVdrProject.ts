import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

type VdrFolder = {
  id: string;
  name: string;
  projectId: string;
  parentFolderId: string | null;
  orgId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type VdrDocument = {
  id: string;
  folderId: string;
  projectId: string;
  name: string;
  originalName: string;
  fileType: string;
  size: number;
  checksum: string;
  description: string | null;
  version: number;
  orgId: string;
  uploadedBy: string;
  uploadedAt: string;
};

type VdrPermission = {
  id: string;
  resourceType: 'project' | 'folder' | 'document';
  resourceId: string;
  userId: string | null;
  externalUserId: string | null;
  permissionLevel: 'no_access' | 'view_only' | 'view_download' | 'view_download_print' | 'full_access';
  grantedBy: string;
  grantedAt: string;
  orgId: string;
};

export function useVdrProject(projectId: string | undefined) {
  // Fetch folders
  const {
    data: folders = [],
    isLoading: foldersLoading,
    error: foldersError,
  } = useQuery<VdrFolder[]>({
    queryKey: [`/api/vdr/projects/${projectId}/folders`],
    enabled: !!projectId,
  });

  // Fetch documents for a specific folder
  const useDocuments = (folderId: string | undefined) => {
    return useQuery<VdrDocument[]>({
      queryKey: ['/api/vdr/folders', folderId, 'documents'],
      enabled: !!folderId,
    });
  };

  // Fetch permissions for a resource
  const usePermissions = (resourceType: 'project' | 'folder' | 'document', resourceId: string | undefined) => {
    return useQuery<VdrPermission[]>({
      queryKey: [`/api/vdr/permissions/${resourceType}/${resourceId}`],
      enabled: !!resourceId,
    });
  };

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (data: { name: string; parentFolderId?: string }) => {
      const response = await fetch(`/api/vdr/projects/${projectId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.message || 'Failed to create folder');
        Object.assign(error, errorData);
        throw error;
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vdr/projects/${projectId}/folders`] });
    },
  });

  // Update folder mutation
  const updateFolderMutation = useMutation({
    mutationFn: async ({ folderId, data }: { folderId: string; data: { name?: string; parentFolderId?: string } }) => {
      return apiRequest(`/api/vdr/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vdr/projects/${projectId}/folders`] });
    },
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      return apiRequest(`/api/vdr/folders/${folderId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/vdr/projects/${projectId}/folders`] });
    },
  });

  // Upload document mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: async ({ folderId, formData }: { folderId: string; formData: FormData }) => {
      const response = await fetch(`/api/vdr/folders/${folderId}/documents`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const error = new Error(errorData.message || 'Failed to upload document');
        Object.assign(error, errorData);
        throw error;
      }
      
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/folders', variables.folderId, 'documents'] });
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async ({ documentId, folderId }: { documentId: string; folderId: string }) => {
      return apiRequest(`/api/vdr/documents/${documentId}`, {
        method: "DELETE",
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/folders', variables.folderId, 'documents'] });
    },
  });

  // Move document mutation
  const moveDocumentMutation = useMutation({
    mutationFn: async ({ documentId, folderId, oldFolderId }: { documentId: string; folderId: string; oldFolderId: string }) => {
      return apiRequest(`/api/vdr/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/folders', variables.oldFolderId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vdr/folders', variables.folderId, 'documents'] });
    },
  });

  // Grant permission mutation
  const grantPermissionMutation = useMutation({
    mutationFn: async (data: {
      resourceType: 'project' | 'folder' | 'document';
      resourceId: string;
      userId?: string;
      externalUserId?: string;
      permissionLevel: string;
    }) => {
      return apiRequest(`/api/vdr/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/vdr/permissions/${variables.resourceType}/${variables.resourceId}`] 
      });
    },
  });

  // Revoke permission mutation
  const revokePermissionMutation = useMutation({
    mutationFn: async ({ permissionId, resourceType, resourceId }: { 
      permissionId: string; 
      resourceType: string;
      resourceId: string;
    }) => {
      return apiRequest(`/api/vdr/permissions/${permissionId}`, {
        method: "DELETE",
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/vdr/permissions/${variables.resourceType}/${variables.resourceId}`] 
      });
    },
  });

  // Build folder tree hierarchy
  const buildFolderTree = () => {
    const rootFolders = folders.filter(f => !f.parentFolderId);
    const folderMap = new Map(folders.map(f => [f.id, f]));
    
    const buildChildren = (parentId: string): VdrFolder[] => {
      return folders
        .filter(f => f.parentFolderId === parentId)
        .sort((a, b) => a.name.localeCompare(b.name));
    };

    return rootFolders.map(folder => ({
      ...folder,
      children: buildChildren(folder.id),
    }));
  };

  return {
    // Queries
    folders,
    foldersLoading,
    foldersError,
    folderTree: buildFolderTree(),
    useDocuments,
    usePermissions,
    
    // Mutations
    createFolder: createFolderMutation.mutate,
    createFolderAsync: createFolderMutation.mutateAsync,
    isCreatingFolder: createFolderMutation.isPending,
    
    updateFolder: updateFolderMutation.mutate,
    updateFolderAsync: updateFolderMutation.mutateAsync,
    isUpdatingFolder: updateFolderMutation.isPending,
    
    deleteFolder: deleteFolderMutation.mutate,
    deleteFolderAsync: deleteFolderMutation.mutateAsync,
    isDeletingFolder: deleteFolderMutation.isPending,
    
    uploadDocument: uploadDocumentMutation.mutate,
    uploadDocumentAsync: uploadDocumentMutation.mutateAsync,
    isUploadingDocument: uploadDocumentMutation.isPending,
    
    deleteDocument: deleteDocumentMutation.mutate,
    deleteDocumentAsync: deleteDocumentMutation.mutateAsync,
    isDeletingDocument: deleteDocumentMutation.isPending,
    
    moveDocument: moveDocumentMutation.mutate,
    moveDocumentAsync: moveDocumentMutation.mutateAsync,
    isMovingDocument: moveDocumentMutation.isPending,
    
    grantPermission: grantPermissionMutation.mutate,
    grantPermissionAsync: grantPermissionMutation.mutateAsync,
    isGrantingPermission: grantPermissionMutation.isPending,
    
    revokePermission: revokePermissionMutation.mutate,
    revokePermissionAsync: revokePermissionMutation.mutateAsync,
    isRevokingPermission: revokePermissionMutation.isPending,
  };
}
