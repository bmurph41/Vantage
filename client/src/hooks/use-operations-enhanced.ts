/**
 * React Query hooks for Enhanced Operations
 * Fuel, Ship Store, Hotel, Multifamily, Storage, Retail, Marina
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const opsKeys = {
  all: ['ops-enhanced'] as const,
  fuel: () => [...opsKeys.all, 'fuel'] as const,
  fuelOptimalPrice: (id: string) => [...opsKeys.fuel(), 'optimal-price', id] as const,
  fuelReorderAlerts: () => [...opsKeys.fuel(), 'reorder-alerts'] as const,
  fuelEnvironmental: () => [...opsKeys.fuel(), 'environmental'] as const,
  fuelProfitability: () => [...opsKeys.fuel(), 'profitability'] as const,
  shipStore: () => [...opsKeys.all, 'ship-store'] as const,
  lowStock: () => [...opsKeys.shipStore(), 'low-stock'] as const,
  hotel: () => [...opsKeys.all, 'hotel'] as const,
  dynamicRate: (roomType: string, date: string) => [...opsKeys.hotel(), 'rate', roomType, date] as const,
  housekeeping: (date: string) => [...opsKeys.hotel(), 'housekeeping', date] as const,
  multifamily: () => [...opsKeys.all, 'multifamily'] as const,
  renewalProb: (leaseId: string) => [...opsKeys.multifamily(), 'renewal', leaseId] as const,
  storage: () => [...opsKeys.all, 'storage'] as const,
  conversionRecs: () => [...opsKeys.storage(), 'conversions'] as const,
  retail: () => [...opsKeys.all, 'retail'] as const,
  pctRent: (tenantId: string) => [...opsKeys.retail(), 'pct-rent', tenantId] as const,
  marina: () => [...opsKeys.all, 'marina'] as const,
  membership: (id: string) => [...opsKeys.marina(), 'membership', id] as const,
};

// ─── Fuel ────────────────────────────────────────────────────────────────────

export function useFuelOptimalPrice(fuelTypeId: string | undefined) {
  return useQuery({
    queryKey: opsKeys.fuelOptimalPrice(fuelTypeId!),
    queryFn: () => fetchApi<any>(`/api/ops-engine/fuel/optimal-price/${fuelTypeId}`),
    enabled: !!fuelTypeId,
  });
}

export function useFuelReorderAlerts() {
  return useQuery({
    queryKey: opsKeys.fuelReorderAlerts(),
    queryFn: () => fetchApi<any>('/api/ops-engine/fuel/reorder-alerts'),
  });
}

export function useFuelEnvironmental() {
  return useQuery({
    queryKey: opsKeys.fuelEnvironmental(),
    queryFn: () => fetchApi<any>('/api/ops-engine/fuel/environmental'),
  });
}

export function useFuelProfitability() {
  return useQuery({
    queryKey: opsKeys.fuelProfitability(),
    queryFn: () => fetchApi<any>('/api/ops-engine/fuel/profitability'),
  });
}

export function useScheduleFuelDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/ops-engine/fuel/delivery', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: opsKeys.fuel() }); },
  });
}

export function useRecordSpillReport() {
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/ops-engine/fuel/spill-report', { method: 'POST', body: JSON.stringify(data) }),
  });
}

// ─── Ship Store ──────────────────────────────────────────────────────────────

export function useLowStockAlerts() {
  return useQuery({
    queryKey: opsKeys.lowStock(),
    queryFn: () => fetchApi<any>('/api/ops-engine/ship-store/low-stock'),
  });
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/ops-engine/ship-store/purchase-orders', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: opsKeys.shipStore() }); },
  });
}

export function useReceivePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ poId, ...data }: any) =>
      fetchApi(`/api/ops-engine/ship-store/purchase-orders/${poId}/receive`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: opsKeys.shipStore() }); },
  });
}

export function useCalculateSalesTax() {
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/ops-engine/ship-store/sales-tax', { method: 'POST', body: JSON.stringify(data) }),
  });
}

// ─── Hotel ───────────────────────────────────────────────────────────────────

export function useDynamicRate(roomType: string, date: string) {
  return useQuery({
    queryKey: opsKeys.dynamicRate(roomType, date),
    queryFn: () => fetchApi<any>(`/api/ops-engine/hotel/dynamic-rate?roomType=${roomType}&date=${date}`),
    enabled: !!roomType && !!date,
  });
}

export function useHousekeepingSchedule(date: string) {
  return useQuery({
    queryKey: opsKeys.housekeeping(date),
    queryFn: () => fetchApi<any>(`/api/ops-engine/hotel/housekeeping?date=${date}`),
    enabled: !!date,
  });
}

export function useProcessCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reservationId: string) =>
      fetchApi(`/api/ops-engine/hotel/check-in/${reservationId}`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: opsKeys.hotel() }); },
  });
}

export function useProcessCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reservationId: string) =>
      fetchApi(`/api/ops-engine/hotel/check-out/${reservationId}`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: opsKeys.hotel() }); },
  });
}

// ─── Multifamily ─────────────────────────────────────────────────────────────

export function useRenewalProbability(leaseId: string | undefined) {
  return useQuery({
    queryKey: opsKeys.renewalProb(leaseId!),
    queryFn: () => fetchApi<any>(`/api/ops-engine/multifamily/renewal-probability/${leaseId}`),
    enabled: !!leaseId,
  });
}

export function useTrackUnitTurn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/ops-engine/multifamily/unit-turn', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: opsKeys.multifamily() }); },
  });
}

export function useRUBSCalculation(propertyId: string, period: string) {
  return useQuery({
    queryKey: [...opsKeys.multifamily(), 'rubs', propertyId, period],
    queryFn: () => fetchApi<any>(`/api/ops-engine/multifamily/rubs/${propertyId}?period=${period}`),
    enabled: !!propertyId && !!period,
  });
}

// ─── Self-Storage ────────────────────────────────────────────────────────────

export function useConversionRecommendations() {
  return useQuery({
    queryKey: opsKeys.conversionRecs(),
    queryFn: () => fetchApi<any>('/api/ops-engine/storage/conversion-recommendations'),
  });
}

export function useManageLienProcess() {
  return useMutation({
    mutationFn: (unitId: string) =>
      fetchApi(`/api/ops-engine/storage/lien/${unitId}`, { method: 'POST' }),
  });
}

export function useProcessOnlineRental() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/ops-engine/storage/online-rental', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: opsKeys.storage() }); },
  });
}

// ─── Retail/Office ───────────────────────────────────────────────────────────

export function usePercentageRent(tenantId: string | undefined) {
  return useQuery({
    queryKey: opsKeys.pctRent(tenantId!),
    queryFn: () => fetchApi<any>(`/api/ops-engine/retail/percentage-rent/${tenantId}`),
    enabled: !!tenantId,
  });
}

export function useGenerateLeaseAbstract() {
  return useMutation({
    mutationFn: (leaseId: string) => fetchApi(`/api/ops-engine/retail/lease-abstract/${leaseId}`, { method: 'POST' }),
  });
}

export function useTIAmortization(leaseId: string | undefined) {
  return useQuery({
    queryKey: [...opsKeys.retail(), 'ti', leaseId],
    queryFn: () => fetchApi<any>(`/api/ops-engine/retail/ti-amortization/${leaseId}`),
    enabled: !!leaseId,
  });
}

// ─── Marina ──────────────────────────────────────────────────────────────────

export function useMembershipStatus(memberId: string | undefined) {
  return useQuery({
    queryKey: opsKeys.membership(memberId!),
    queryFn: () => fetchApi<any>(`/api/ops-engine/marina/membership/${memberId}`),
    enabled: !!memberId,
  });
}

export function useProcessSlipReservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/ops-engine/marina/slip-reservation', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: opsKeys.marina() }); },
  });
}

export function useManageWaitlist() {
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/ops-engine/marina/waitlist', { method: 'POST', body: JSON.stringify(data) }),
  });
}

export function useCreateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => fetchApi('/api/ops-engine/marina/work-order', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: opsKeys.marina() }); },
  });
}

export function useProcessSlipBilling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (period: string) => fetchApi('/api/ops-engine/marina/slip-billing', { method: 'POST', body: JSON.stringify({ period }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: opsKeys.marina() }); },
  });
}
