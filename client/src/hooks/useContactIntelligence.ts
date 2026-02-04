import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ContactMetrics,
  LeaderboardResponse,
  LeaderboardFilters,
  LeaderboardSortField,
  MetricsTimeframe,
  ContactRelationshipUpdate,
  FinancialEvent,
} from '@/types/contact-intelligence';

const API_BASE = '/api/crm';

export function useContactMetrics(contactId: string, timeframe: MetricsTimeframe = 'all') {
  return useQuery({
    queryKey: ['contact-metrics', contactId, timeframe],
    queryFn: async (): Promise<ContactMetrics> => {
      const res = await fetch(`${API_BASE}/contacts/${contactId}/metrics?timeframe=${timeframe}`);
      if (!res.ok) throw new Error('Failed to fetch contact metrics');
      return res.json();
    },
    enabled: !!contactId,
  });
}

export function useLeaderboard(options: { filters?: LeaderboardFilters; sort?: LeaderboardSortField; sortDirection?: 'asc' | 'desc'; page?: number; pageSize?: number } = {}) {
  const { filters = {}, sort = 'score', sortDirection = 'desc', page = 1, pageSize = 20 } = options;
  return useQuery({
    queryKey: ['leaderboard', filters, sort, sortDirection, page, pageSize],
    queryFn: async (): Promise<LeaderboardResponse> => {
      const params = new URLSearchParams();
      if (filters.role) params.set('role', filters.role);
      if (filters.relationshipStatus) params.set('status', filters.relationshipStatus.join(','));
      if (filters.timeframe) params.set('timeframe', filters.timeframe);
      if (filters.minDeals) params.set('minDeals', String(filters.minDeals));
      if (filters.minVolume) params.set('minVolume', String(filters.minVolume));
      if (filters.minFeesWaived) params.set('minFeesWaived', String(filters.minFeesWaived));
      if (filters.regions) params.set('regions', filters.regions.join(','));
      if (filters.search) params.set('search', filters.search);
      params.set('sort', sort);
      params.set('sortDirection', sortDirection);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      const res = await fetch(`${API_BASE}/contacts/leaderboard?${params}`);
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      return res.json();
    },
  });
}

export function useUpdateContactRelationship() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, data }: { contactId: string; data: ContactRelationshipUpdate }) => {
      const res = await fetch(`${API_BASE}/contacts/${contactId}/relationship`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const error = await res.json(); throw new Error(error.error || 'Failed to update relationship'); }
      return res.json();
    },
    onSuccess: (_, { contactId }) => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      queryClient.invalidateQueries({ queryKey: ['contact-metrics', contactId] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

export function useDealContacts(dealId: string) {
  return useQuery({
    queryKey: ['deal-contacts', dealId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/deals/${dealId}/contacts`);
      if (!res.ok) throw new Error('Failed to fetch deal contacts');
      return res.json();
    },
    enabled: !!dealId,
  });
}

export function useLinkContactToDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, data }: { dealId: string; data: { contactId: string; roleOnDeal?: string; dealSide?: string; isPrimaryForDeal?: boolean } }) => {
      const res = await fetch(`${API_BASE}/deals/${dealId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const error = await res.json(); throw new Error(error.error || 'Failed to link contact'); }
      return res.json();
    },
    onSuccess: (_, { dealId, data }) => {
      queryClient.invalidateQueries({ queryKey: ['deal-contacts', dealId] });
      queryClient.invalidateQueries({ queryKey: ['contact-metrics', data.contactId] });
    },
  });
}

export function useRemoveContactFromDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, contactId }: { dealId: string; contactId: string }) => {
      const res = await fetch(`${API_BASE}/deals/${dealId}/contacts/${contactId}`, { method: 'DELETE' });
      if (!res.ok) { const error = await res.json(); throw new Error(error.error || 'Failed to remove contact'); }
      return res.json();
    },
    onSuccess: (_, { dealId, contactId }) => {
      queryClient.invalidateQueries({ queryKey: ['deal-contacts', dealId] });
      queryClient.invalidateQueries({ queryKey: ['contact-metrics', contactId] });
    },
  });
}

export function useDealFinancialEvents(dealId: string) {
  return useQuery({
    queryKey: ['deal-financial-events', dealId],
    queryFn: async (): Promise<FinancialEvent[]> => {
      const res = await fetch(`${API_BASE}/deals/${dealId}/financial-events`);
      if (!res.ok) throw new Error('Failed to fetch financial events');
      return res.json();
    },
    enabled: !!dealId,
  });
}

export function useContactFinancialEvents(contactId: string) {
  return useQuery({
    queryKey: ['contact-financial-events', contactId],
    queryFn: async (): Promise<FinancialEvent[]> => {
      const res = await fetch(`${API_BASE}/contacts/${contactId}/financial-events`);
      if (!res.ok) throw new Error('Failed to fetch financial events');
      return res.json();
    },
    enabled: !!contactId,
  });
}

export function useCreateFinancialEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, data }: { dealId: string; data: { eventType: string; amount: number; direction: string; appliesToContactId?: string; notes?: string; eventDate: string } }) => {
      const res = await fetch(`${API_BASE}/deals/${dealId}/financial-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const error = await res.json(); throw new Error(error.error || 'Failed to create financial event'); }
      return res.json();
    },
    onSuccess: (_, { dealId, data }) => {
      queryClient.invalidateQueries({ queryKey: ['deal-financial-events', dealId] });
      if (data.appliesToContactId) {
        queryClient.invalidateQueries({ queryKey: ['contact-financial-events', data.appliesToContactId] });
        queryClient.invalidateQueries({ queryKey: ['contact-metrics', data.appliesToContactId] });
      }
    },
  });
}
