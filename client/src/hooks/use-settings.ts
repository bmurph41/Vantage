import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  SettingsResponse,
  UserSettings,
  Session,
  PersonalAccessToken,
  AuditLogEntry,
  AppInfo,
} from '@/types/settings';

const API_BASE = '/api/settings';

// ============================================================================
// FETCH HELPERS
// ============================================================================
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// ============================================================================
// SETTINGS QUERIES
// ============================================================================
export function useSettings() {
  return useQuery<SettingsResponse>({
    queryKey: ['settings'],
    queryFn: () => fetchJson<SettingsResponse>(`${API_BASE}/me`),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSessions() {
  return useQuery<Session[]>({
    queryKey: ['settings', 'sessions'],
    queryFn: () => fetchJson<Session[]>(`${API_BASE}/sessions`),
  });
}

export function useTokens() {
  return useQuery<PersonalAccessToken[]>({
    queryKey: ['settings', 'tokens'],
    queryFn: () => fetchJson<PersonalAccessToken[]>(`${API_BASE}/tokens`),
  });
}

export function useAuditLog(limit = 50) {
  return useQuery<AuditLogEntry[]>({
    queryKey: ['settings', 'audit-log', limit],
    queryFn: () => fetchJson<AuditLogEntry[]>(`${API_BASE}/audit-log?limit=${limit}`),
  });
}

export function useAppInfo() {
  return useQuery<AppInfo>({
    queryKey: ['settings', 'app-info'],
    queryFn: () => fetchJson<AppInfo>(`${API_BASE}/app-info`),
    staleTime: Infinity, // Never refetch automatically
  });
}

// ============================================================================
// SETTINGS MUTATIONS
// ============================================================================
export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Partial<UserSettings>) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/me`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    onMutate: async (updates) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['settings'] });

      // Snapshot the previous value
      const previousSettings = queryClient.getQueryData<SettingsResponse>(['settings']);

      // Optimistically update
      if (previousSettings) {
        queryClient.setQueryData<SettingsResponse>(['settings'], {
          ...previousSettings,
          settings: { ...previousSettings.settings, ...updates },
        });
      }

      return { previousSettings };
    },
    onError: (_err, _updates, context) => {
      // Rollback on error
      if (context?.previousSettings) {
        queryClient.setQueryData(['settings'], context.previousSettings);
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/sessions/${sessionId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'sessions'] });
    },
  });
}

export function useRevokeAllSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchJson<{ success: boolean }>(`${API_BASE}/sessions/revoke-all`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'sessions'] });
    },
  });
}

export function useCreateToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; expiresInDays?: number }) =>
      fetchJson<{ token: string; message: string }>(`${API_BASE}/tokens`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'tokens'] });
    },
  });
}

export function useRevokeToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tokenId: string) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/tokens/${tokenId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'tokens'] });
    },
  });
}

export function useExportData() {
  return useMutation({
    mutationFn: () =>
      fetchJson<{ success: boolean; message: string }>(`${API_BASE}/export-data`, {
        method: 'POST',
      }),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () =>
      fetchJson<{ success: boolean; message: string }>(`${API_BASE}/delete-account`, {
        method: 'POST',
      }),
  });
}

// ============================================================================
// AUTH MUTATIONS
// ============================================================================
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchJson<{ success: boolean }>('/api/auth/logout', {
        method: 'POST',
      }),
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
      // Redirect to login
      window.location.href = '/login';
    },
  });
}