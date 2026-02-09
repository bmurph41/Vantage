import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DealWorkspace {
  id: number;
  orgId: number;
  name: string;
  description: string | null;
  dealId: number | null;
  propertyId: number | null;
  ddProjectId: number | null;
  modelingProjectId: number | null;
  status: string;
  stage: string | null;
  role: string | null;
  targetPrice: string | null;
  ddStartDate: string | null;
  ddExpirationDate: string | null;
  closingDate: string | null;
  expectedCloseDate: string | null;
  lastActivityAt: string | null;
  lastActivityType: string | null;
  lastActivityDescription: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  // enriched fields from list endpoint
  totalDdTasks?: number;
  openDdTasks?: number;
  pendingDocuments?: number;
}

export interface WorkspaceMember {
  id: number;
  workspaceId: number;
  userId: number | null;
  email: string | null;
  displayName: string | null;
  role: string;
  vdrPermission: string;
  ddPermission: string;
  inviteStatus: string;
  createdAt: string;
}

export interface WorkspaceTask {
  id: number;
  workspaceId: number;
  templateKey: string | null;
  category: string | null;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  assignedToMemberId: number | null;
  required: boolean;
  tags: string[] | null;
  dependencyTaskId: number | null;
  sortOrder: number;
}

export interface DdMilestone {
  id: number;
  workspaceId: number;
  type: string;
  title: string;
  dueDate: string;
  status: string;
  notes: string | null;
}

export interface AgreementInfo {
  agreement: {
    id: number;
    title: string;
    bodyHtml: string;
    accessPolicy: string;
    version: string;
  } | null;
  executed: boolean;
  executionStatus: string | null;
}

export interface VdrTreeResponse {
  folders: any[];
  totalFolders: number;
  totalDocuments: number;
}

export interface WorkspaceOverview {
  workspace: DealWorkspace & {
    deal?: any;
    modelingProject?: any;
    ddProject?: any;
    property?: any;
  };
  stats: {
    dd: { total: number; completed: number; pending: number; overdue: number };
    vdr: { folders: number; documents: number; pendingRequests: number };
    modeling: { hasProject: boolean };
    team: { members: number };
  };
  nextMilestone: DdMilestone | null;
  recentActivity: any[];
}

// ─── Workspace CRUD ──────────────────────────────────────────────────────────

export function useDealWorkspaces(filters?: { status?: string; role?: string }) {
  const queryParams = new URLSearchParams();
  if (filters?.status) queryParams.set('status', filters.status);
  if (filters?.role) queryParams.set('role', filters.role);
  const qs = queryParams.toString();

  return useQuery<DealWorkspace[]>({
    queryKey: ['/api/workspaces', filters],
    queryFn: async () => {
      const url = qs ? `/api/workspaces?${qs}` : '/api/workspaces';
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch workspaces');
      return response.json();
    },
  });
}

export function useDealWorkspace(workspaceId: string | undefined) {
  return useQuery<DealWorkspace>({
    queryKey: ['/api/workspaces', workspaceId],
    queryFn: async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch workspace');
      return response.json();
    },
    enabled: !!workspaceId,
  });
}

export function useWorkspaceOverview(workspaceId: string | undefined) {
  return useQuery<WorkspaceOverview>({
    queryKey: ['/api/workspaces', workspaceId, 'overview'],
    queryFn: async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/overview`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch workspace overview');
      return response.json();
    },
    enabled: !!workspaceId,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<DealWorkspace>) => {
      const response = await apiRequest('POST', '/api/workspaces', data);
      return response.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/workspaces'] }); },
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DealWorkspace> }) => {
      const response = await apiRequest('PATCH', `/api/workspaces/${id}`, data);
      return response.json();
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['/api/workspaces'] });
      qc.invalidateQueries({ queryKey: ['/api/workspaces', v.id] });
    },
  });
}

export function useArchiveWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/workspaces/${id}`);
      return response.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/workspaces'] }); },
  });
}

export function useLinkWorkspaceEntities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, entities }: {
      id: string;
      entities: { dealId?: string; modelingProjectId?: string; ddProjectId?: string; propertyId?: string };
    }) => {
      const response = await apiRequest('POST', `/api/workspaces/${id}/link`, entities);
      return response.json();
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['/api/workspaces'] });
      qc.invalidateQueries({ queryKey: ['/api/workspaces', v.id] });
    },
  });
}

// ─── DD Provisioning ─────────────────────────────────────────────────────────

export function useProvisionDDProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, ddExpirationDate, closingDate, projectName }: {
      workspaceId: string;
      ddExpirationDate?: string;
      closingDate?: string;
      projectName?: string;
    }) => {
      const response = await apiRequest('POST', `/api/workspaces/${workspaceId}/dd-project`, {
        ddExpirationDate, closingDate, projectName,
      });
      return response.json();
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['/api/workspaces'] });
      qc.invalidateQueries({ queryKey: ['/api/workspaces', v.workspaceId] });
      qc.invalidateQueries({ queryKey: ['/api/workspaces', v.workspaceId, 'overview'] });
    },
  });
}

// ─── Team ────────────────────────────────────────────────────────────────────

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery<WorkspaceMember[]>({
    queryKey: ['/api/workspaces', workspaceId, 'members'],
    queryFn: async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch members');
      return response.json();
    },
    enabled: !!workspaceId,
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, ...data }: {
      workspaceId: string; userId?: number; email?: string; displayName?: string;
      role?: string; vdrPermission?: string; ddPermission?: string;
    }) => {
      const response = await apiRequest('POST', `/api/workspaces/${workspaceId}/members/invite`, data);
      return response.json();
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['/api/workspaces', v.workspaceId, 'members'] });
    },
  });
}

export function useUpdateMemberPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, memberId, ...data }: {
      workspaceId: string; memberId: number;
      role?: string; vdrPermission?: string; ddPermission?: string;
    }) => {
      const response = await apiRequest('PATCH', `/api/workspaces/${workspaceId}/members/${memberId}/permissions`, data);
      return response.json();
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['/api/workspaces', v.workspaceId, 'members'] });
    },
  });
}

export function useRevokeMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, memberId }: { workspaceId: string; memberId: number }) => {
      const response = await apiRequest('POST', `/api/workspaces/${workspaceId}/members/${memberId}/revoke`);
      return response.json();
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['/api/workspaces', v.workspaceId, 'members'] });
    },
  });
}

// ─── Agreements ──────────────────────────────────────────────────────────────

export function useCurrentAgreement(workspaceId: string | undefined) {
  return useQuery<AgreementInfo>({
    queryKey: ['/api/workspaces', workspaceId, 'agreements'],
    queryFn: async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/agreements/current`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch agreement');
      return response.json();
    },
    enabled: !!workspaceId,
  });
}

export function useExecuteAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, notes }: { workspaceId: string; notes?: string }) => {
      const response = await apiRequest('POST', `/api/workspaces/${workspaceId}/agreements/execute`, { notes });
      return response.json();
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['/api/workspaces', v.workspaceId, 'agreements'] });
      qc.invalidateQueries({ queryKey: ['/api/workspaces', v.workspaceId, 'vdr'] });
    },
  });
}

// ─── VDR ─────────────────────────────────────────────────────────────────────

export function useVdrTree(workspaceId: string | undefined, enabled = true) {
  return useQuery<VdrTreeResponse>({
    queryKey: ['/api/workspaces', workspaceId, 'vdr', 'tree'],
    queryFn: async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/vdr/tree`, { credentials: 'include' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (body.code === 'CA_REQUIRED' || body.code === 'CA_PENDING_APPROVAL') {
          throw { ...body, isCAError: true };
        }
        throw new Error('Failed to fetch VDR tree');
      }
      return response.json();
    },
    enabled: !!workspaceId && enabled,
    retry: false,
  });
}

export function useCreateVdrFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, name, parentFolderId, securityLevel }: {
      workspaceId: string; name: string; parentFolderId?: number; securityLevel?: string;
    }) => {
      const response = await apiRequest('POST', `/api/workspaces/${workspaceId}/vdr/folders`, {
        name, parentFolderId, securityLevel,
      });
      return response.json();
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['/api/workspaces', v.workspaceId, 'vdr'] });
    },
  });
}

export function useUploadVdrDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, ...data }: {
      workspaceId: string; folderId: number; name: string;
      mimeType?: string; sizeBytes?: number; storagePath?: string;
    }) => {
      const response = await apiRequest('POST', `/api/workspaces/${workspaceId}/vdr/upload`, data);
      return response.json();
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['/api/workspaces', v.workspaceId, 'vdr'] });
    },
  });
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export function useWorkspaceTasks(workspaceId: string | undefined) {
  return useQuery<WorkspaceTask[]>({
    queryKey: ['/api/workspaces', workspaceId, 'tasks'],
    queryFn: async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/tasks`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    },
    enabled: !!workspaceId,
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, taskId, ...data }: {
      workspaceId: string; taskId: number; status?: string; assignedToMemberId?: number;
    }) => {
      const response = await apiRequest('PATCH', `/api/workspaces/${workspaceId}/tasks/${taskId}`, data);
      return response.json();
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['/api/workspaces', v.workspaceId, 'tasks'] });
      qc.invalidateQueries({ queryKey: ['/api/workspaces', v.workspaceId, 'overview'] });
    },
  });
}

// ─── Milestones ──────────────────────────────────────────────────────────────

export function useWorkspaceMilestones(workspaceId: string | undefined) {
  return useQuery<DdMilestone[]>({
    queryKey: ['/api/workspaces', workspaceId, 'milestones'],
    queryFn: async () => {
      const response = await fetch(`/api/workspaces/${workspaceId}/milestones`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch milestones');
      return response.json();
    },
    enabled: !!workspaceId,
  });
}

export function useCreateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ workspaceId, ...data }: {
      workspaceId: string; type?: string; title: string; dueDate: string; notes?: string;
    }) => {
      const response = await apiRequest('POST', `/api/workspaces/${workspaceId}/milestones`, data);
      return response.json();
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['/api/workspaces', v.workspaceId, 'milestones'] });
    },
  });
}

// ─── Convenience: create from deal ───────────────────────────────────────────

export function useCreateWorkspaceFromDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, role }: { dealId: string; role?: string }) => {
      const response = await apiRequest('POST', `/api/workspaces/from-deal/${dealId}`, { role });
      return response.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/api/workspaces'] }); },
  });
}
