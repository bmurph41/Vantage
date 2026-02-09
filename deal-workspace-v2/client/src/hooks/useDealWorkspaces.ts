/**
 * Deal Workspace Hooks (v2)
 * 
 * React Query hooks for the workspace system.
 * All IDs are strings (varchar UUIDs).
 * Uses existing tasks table fields (status, ddCategory, deadline, etc.)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DealWorkspace {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  role: string;
  status: string;
  dealId: string | null;
  modelingProjectId: string | null;
  ddProjectId: string | null;
  propertyId: string | null;
  targetPrice: string | null;
  expectedCloseDate: string | null;
  priority: string | null;
  ddStartDate: string | null;
  ddExpirationDate: string | null;
  closingDate: string | null;
  lastActivityAt: string | null;
  lastActivityType: string | null;
  lastActivityDescription: string | null;
  openDdTasks: number;
  totalDdTasks: number;
  pendingDocuments: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  orgId: string;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  role: string;
  vdrPermission: string;
  ddPermission: string;
  inviteStatus: string;
  invitedBy: string | null;
  invitedAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export interface ConfidentialityAgreement {
  id: string;
  workspaceId: string;
  version: string;
  title: string;
  bodyHtml: string;
  accessPolicy: string;
  isActive: boolean;
}

export interface DdMilestone {
  id: string;
  workspaceId: string;
  type: string;
  title: string;
  dueDate: string;
  status: string;
  notes: string | null;
}

export interface VdrTreeNode {
  id: string;
  name: string;
  path: string;
  parentFolderId: string | null;
  securityLevel?: string;
  children: VdrTreeNode[];
  documents: VdrDocument[];
}

export interface VdrDocument {
  id: string;
  folderId: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

// ─── Workspace CRUD ──────────────────────────────────────────────────────────

export function useDealWorkspaces(filters?: { status?: string; role?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.role) params.set('role', filters.role);
  const qs = params.toString();

  return useQuery<DealWorkspace[]>({
    queryKey: ['deal-workspaces', filters],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/workspaces${qs ? `?${qs}` : ''}`);
      return res.json();
    },
  });
}

export function useDealWorkspace(id: string | undefined) {
  return useQuery<DealWorkspace>({
    queryKey: ['deal-workspace', id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/workspaces/${id}`);
      return res.json();
    },
    enabled: !!id,
  });
}

export function useWorkspaceOverview(id: string | undefined) {
  return useQuery({
    queryKey: ['workspace-overview', id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/workspaces/${id}/overview`);
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; role?: string; dealId?: string; propertyId?: string }) => {
      const res = await apiRequest('POST', '/api/workspaces', data);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal-workspaces'] }),
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, any>) => {
      const res = await apiRequest('PATCH', `/api/workspaces/${id}`, data);
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['deal-workspaces'] });
      qc.invalidateQueries({ queryKey: ['deal-workspace', vars.id] });
    },
  });
}

export function useArchiveWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/workspaces/${id}`);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal-workspaces'] }),
  });
}

export function useLinkWorkspaceEntities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; dealId?: string; propertyId?: string; ddProjectId?: string; modelingProjectId?: string }) => {
      const res = await apiRequest('POST', `/api/workspaces/${id}/link`, data);
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['deal-workspace', vars.id] });
      qc.invalidateQueries({ queryKey: ['workspace-overview', vars.id] });
    },
  });
}

// ─── DD Provisioning ─────────────────────────────────────────────────────────

export function useProvisionDDProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, ...data }: { workspaceId: string; ddExpirationDate?: string; closingDate?: string; projectName?: string }) => {
      const res = await apiRequest('POST', `/api/workspaces/${workspaceId}/dd-project`, data);
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['deal-workspace', vars.workspaceId] });
      qc.invalidateQueries({ queryKey: ['workspace-overview', vars.workspaceId] });
      qc.invalidateQueries({ queryKey: ['workspace-tasks', vars.workspaceId] });
      qc.invalidateQueries({ queryKey: ['workspace-vdr', vars.workspaceId] });
      qc.invalidateQueries({ queryKey: ['workspace-milestones', vars.workspaceId] });
    },
  });
}

// ─── Members ─────────────────────────────────────────────────────────────────

export function useWorkspaceMembers(id: string | undefined) {
  return useQuery<WorkspaceMember[]>({
    queryKey: ['workspace-members', id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/workspaces/${id}/members`);
      return res.json();
    },
    enabled: !!id,
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, ...data }: { workspaceId: string; userId?: string; email?: string; displayName?: string; role?: string; vdrPermission?: string; ddPermission?: string }) => {
      const res = await apiRequest('POST', `/api/workspaces/${workspaceId}/members/invite`, data);
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['workspace-members', vars.workspaceId] }),
  });
}

export function useUpdateMemberPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, memberId, ...data }: { workspaceId: string; memberId: string; role?: string; vdrPermission?: string; ddPermission?: string }) => {
      const res = await apiRequest('PATCH', `/api/workspaces/${workspaceId}/members/${memberId}/permissions`, data);
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['workspace-members', vars.workspaceId] }),
  });
}

export function useRevokeMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, memberId }: { workspaceId: string; memberId: string }) => {
      const res = await apiRequest('POST', `/api/workspaces/${workspaceId}/members/${memberId}/revoke`);
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['workspace-members', vars.workspaceId] }),
  });
}

// ─── Agreements ──────────────────────────────────────────────────────────────

export function useCurrentAgreement(id: string | undefined) {
  return useQuery<{ agreement: ConfidentialityAgreement | null; executed: boolean; executionStatus: string | null }>({
    queryKey: ['workspace-agreement', id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/workspaces/${id}/agreements/current`);
      return res.json();
    },
    enabled: !!id,
  });
}

export function useExecuteAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, notes }: { workspaceId: string; notes?: string }) => {
      const res = await apiRequest('POST', `/api/workspaces/${workspaceId}/agreements/execute`, { notes });
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['workspace-agreement', vars.workspaceId] });
      qc.invalidateQueries({ queryKey: ['workspace-vdr', vars.workspaceId] });
    },
  });
}

// ─── VDR ─────────────────────────────────────────────────────────────────────

export function useVdrTree(id: string | undefined, enabled = true) {
  return useQuery<{ folders: VdrTreeNode[]; totalFolders: number; totalDocuments: number }>({
    queryKey: ['workspace-vdr', id],
    queryFn: async () => {
      const res = await fetch(`/api/workspaces/${id}/vdr/tree`, { credentials: 'include' });
      if (res.status === 403) {
        const body = await res.json();
        throw { code: body.code, message: body.message };
      }
      if (!res.ok) throw new Error('Failed to fetch VDR');
      return res.json();
    },
    enabled: !!id && enabled,
    retry: false,
  });
}

export function useCreateVdrFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, ...data }: { workspaceId: string; name: string; parentFolderId?: string }) => {
      const res = await apiRequest('POST', `/api/workspaces/${workspaceId}/vdr/folders`, data);
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['workspace-vdr', vars.workspaceId] }),
  });
}

export function useUploadVdrDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, ...data }: { workspaceId: string; folderId: string; filename: string; mimeType?: string; size?: number; storagePath?: string }) => {
      const res = await apiRequest('POST', `/api/workspaces/${workspaceId}/vdr/upload`, data);
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['workspace-vdr', vars.workspaceId] }),
  });
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export function useWorkspaceTasks(id: string | undefined) {
  return useQuery<any[]>({
    queryKey: ['workspace-tasks', id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/workspaces/${id}/tasks`);
      return res.json();
    },
    enabled: !!id,
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, taskId, ...data }: { workspaceId: string; taskId: string; status?: string; assignee?: string; taskOwner?: string }) => {
      const res = await apiRequest('PATCH', `/api/workspaces/${workspaceId}/tasks/${taskId}`, data);
      return res.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['workspace-tasks', vars.workspaceId] });
      qc.invalidateQueries({ queryKey: ['workspace-overview', vars.workspaceId] });
    },
  });
}

// ─── Milestones ──────────────────────────────────────────────────────────────

export function useWorkspaceMilestones(id: string | undefined) {
  return useQuery<DdMilestone[]>({
    queryKey: ['workspace-milestones', id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/workspaces/${id}/milestones`);
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, ...data }: { workspaceId: string; type?: string; title: string; dueDate: string; notes?: string }) => {
      const res = await apiRequest('POST', `/api/workspaces/${workspaceId}/milestones`, data);
      return res.json();
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['workspace-milestones', vars.workspaceId] }),
  });
}

// ─── Convenience ─────────────────────────────────────────────────────────────

export function useCreateWorkspaceFromDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { dealName: string; dealId: string; propertyId?: string; role?: string }) => {
      const res = await apiRequest('POST', '/api/workspaces', {
        name: data.dealName,
        dealId: data.dealId,
        propertyId: data.propertyId || null,
        role: data.role || 'buyer',
      });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deal-workspaces'] }),
  });
}
