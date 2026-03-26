import { apiRequest } from "@/lib/queryClient";
import type {
  LeaseWithTenant,
  CreateLeaseWithTenant,
  MonthlySummary,
  MoveEvent,
  AddressHeatMapItem,
} from "@shared/schema";

// ============================================================================
// LEASES API
// ============================================================================

export interface GetLeasesParams {
  state?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  locationId?: string;
}

export interface GetLeasesResponse {
  leases: LeaseWithTenant[];
  total: number;
}

export async function getLease(id: string): Promise<LeaseWithTenant> {
  const res = await fetch(`/api/rent-roll/leases/${id}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch lease");
  }
  return res.json();
}

export async function getLeases(params?: GetLeasesParams): Promise<GetLeasesResponse> {
  const query = new URLSearchParams();
  if (params?.state) query.set("state", params.state);
  if (params?.isActive !== undefined) query.set("isActive", params.isActive.toString());
  if (params?.page) query.set("page", params.page.toString());
  if (params?.pageSize) query.set("pageSize", params.pageSize.toString());
  if (params?.locationId) query.set("locationId", params.locationId);
  
  const url = `/api/rent-roll/leases${query.toString() ? `?${query.toString()}` : ""}`;
  return await fetch(url).then(res => res.json());
}

export async function createLease(data: CreateLeaseWithTenant): Promise<LeaseWithTenant> {
  const res = await apiRequest("POST", "/api/rent-roll/leases", data);
  return res.json();
}

export async function updateLease(
  id: string,
  data: { tenant?: Partial<CreateLeaseWithTenant["tenant"]>; lease?: Partial<CreateLeaseWithTenant["lease"]> }
): Promise<LeaseWithTenant> {
  const res = await apiRequest("PATCH", `/api/rent-roll/leases/${id}`, data);
  return res.json();
}

export async function deleteLease(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/rent-roll/leases/${id}`);
}

export async function bulkDeleteLeases(leaseIds: string[]): Promise<{ deletedCount: number }> {
  const res = await apiRequest("POST", "/api/rent-roll/leases/bulk-delete", { leaseIds });
  return res.json();
}

export interface BulkUpdateLeaseData {
  // Location
  unitLocation?: string;
  unitNumber?: string;
  // Financial
  leaseAmount?: number;
  baseRent2?: number;
  baseRent3?: number;
  additionalCharge1?: number;
  additionalCharge2?: number;
  additionalCharge3?: number;
  // Dates
  commencementDate?: string;
  expirationDate?: string;
  // Slip dimensions
  slipLength?: number;
  slipWidth?: number;
  // Classification
  storageType?: string;
  slipStatus?: string;
  rateType?: string;
  contractTerm?: string;
  boatType?: string;
  // Documentation
  leaseOnFile?: boolean;
  coiOnFile?: boolean;
  coiExpiration?: string;
  // Discount
  hasDiscount?: boolean;
  discountType?: "PERCENT_OFF" | "FLAT_RATE" | "AMOUNT_OFF";
  discountValue?: string;
}

export async function bulkUpdateLeases(
  leaseIds: string[], 
  updates: BulkUpdateLeaseData
): Promise<{ updatedCount: number }> {
  const res = await apiRequest("POST", "/api/rent-roll/leases/bulk-update", { leaseIds, updates });
  return res.json();
}

export interface RegenerateCashFlowsResult {
  processedCount: number;
  generatedCount: number;
  errors: string[];
}

export async function regenerateCashFlows(locationId: string): Promise<RegenerateCashFlowsResult> {
  const res = await apiRequest("POST", `/api/rent-roll/locations/${locationId}/regenerate-cashflows`);
  return res.json();
}

// ============================================================================
// MONTHLY SUMMARY API
// ============================================================================

export interface GetMonthlySummaryParams {
  from?: string; // YYYY-MM
  to?: string; // YYYY-MM
  locationId?: string; // Added locationId support to old interface
}

// PHASE 1: Extended options for as-of date & YTD support
export interface RentRollSummaryOptions {
  startDate?: string;   // "YYYY-MM-DD"
  endDate?: string;
  asOfDate?: string;
  mode?: "FULL_PERIOD" | "YTD";
  locationId?: string | null;
}

export async function getMonthlySummary(
  params?: GetMonthlySummaryParams | RentRollSummaryOptions
): Promise<MonthlySummary[]> {
  const query = new URLSearchParams();
  
  // Support both old params and new options
  if (params) {
    if ('from' in params || 'to' in params) {
      // Old params interface
      const oldParams = params as GetMonthlySummaryParams;
      if (oldParams.from) query.set("from", oldParams.from);
      if (oldParams.to) query.set("to", oldParams.to);
      // Also include locationId in old params interface
      if (oldParams.locationId) query.set("locationId", oldParams.locationId);
    } else {
      // New options interface
      const newOptions = params as RentRollSummaryOptions;
      if (newOptions.startDate) query.set("startDate", newOptions.startDate);
      if (newOptions.endDate) query.set("endDate", newOptions.endDate);
      if (newOptions.asOfDate) query.set("asOfDate", newOptions.asOfDate);
      if (newOptions.mode) query.set("mode", newOptions.mode);
      if (newOptions.locationId) query.set("locationId", newOptions.locationId);
    }
  }
  
  const url = `/api/rent-roll/monthly-summary${query.toString() ? `?${query.toString()}` : ""}`;
  return await fetch(url).then(res => res.json());
}

// ============================================================================
// P&L RACK REVENUE API
// ============================================================================

export interface PnlRevenueEntry {
  periodDate: string;
  amount: number;
}

export async function upsertPnlRackRevenue(data: PnlRevenueEntry[]): Promise<{ success: boolean }> {
  const res = await apiRequest("POST", "/api/rent-roll/pnl-rack-revenue", data);
  return res.json();
}

// ============================================================================
// MOVE EVENTS API
// ============================================================================

export interface GetMoveEventsParams {
  direction?: "IN" | "OUT";
  year?: number;
  locationId?: string;
  page?: number;
  pageSize?: number;
}

export interface MoveEventsSummary {
  totalMoveIns: number;
  totalMoveOuts: number;
  netChange: number;
  avgVesselSize: number | null;
  totalRevenue: number;
}

export interface GetMoveEventsResponse {
  events: MoveEvent[];
  total: number;
  summary: MoveEventsSummary;
}

export async function getMoveEvents(params?: GetMoveEventsParams): Promise<GetMoveEventsResponse> {
  const query = new URLSearchParams();
  if (params?.direction) query.set("direction", params.direction);
  if (params?.year) query.set("year", params.year.toString());
  if (params?.locationId) query.set("locationId", params.locationId);
  if (params?.page) query.set("page", params.page.toString());
  if (params?.pageSize) query.set("pageSize", params.pageSize.toString());
  
  const url = `/api/rent-roll/move-events${query.toString() ? `?${query.toString()}` : ""}`;
  return await fetch(url).then(res => res.json());
}

export interface CreateMoveEventData {
  direction: "IN" | "OUT";
  customerName: string;
  checkedAt: string;
  vesselLoa?: number;
  subtotal?: number;
  sourceSheet?: string;
}

export async function createMoveEvent(data: CreateMoveEventData): Promise<MoveEvent> {
  const res = await apiRequest("POST", "/api/rent-roll/move-events", data);
  return res.json();
}

export async function importMoveEvents(events: CreateMoveEventData[]): Promise<{ imported: number; events: MoveEvent[] }> {
  const res = await apiRequest("POST", "/api/rent-roll/move-events/import", { events });
  return res.json();
}

// ============================================================================
// ADDRESS HEAT MAP API
// ============================================================================

export async function getAddressHeatMap(group: "state" | "city", locationId: string | null): Promise<AddressHeatMapItem[]> {
  const query = new URLSearchParams();
  query.set("group", group);
  if (locationId) query.set("locationId", locationId);
  
  const url = `/api/rent-roll/address-heatmap?${query.toString()}`;
  return await fetch(url).then(res => res.json());
}

// ============================================================================
// REVENUE BY STORAGE TYPE API
// ============================================================================

export interface RevenueByStorageType {
  storageType: string;
  totalRevenue: string;
  leaseCount: number;
}

export async function getRevenueByStorageType(params: { 
  startDate: string; 
  endDate: string; 
  locationId?: string;
}): Promise<RevenueByStorageType[]> {
  const queryParams = new URLSearchParams({
    startDate: params.startDate,
    endDate: params.endDate,
  });
  
  if (params.locationId) {
    queryParams.append('locationId', params.locationId);
  }
  
  const url = `/api/rent-roll/revenue-by-storage-type?${queryParams.toString()}`;
  return await fetch(url).then(res => res.json());
}

// ============================================================================
// PHASE 1 - PER-LEASE CASH FLOW MATRIX API
// ============================================================================

export interface LeaseCashFlowMatrixRow {
  leaseId: string;
  tenantName: string;
  storageType: string | null;
  leaseCommencement: string;
  leaseExpiration: string | null;
  marinaLocationName: string | null;
  periodCashFlows: {
    periodId: string;
    periodLabel: string;
    periodDate: string;
    rentAmount: number;
    isActiveInPeriod: boolean;
  }[];
}

export interface LeaseCashFlowMatrixResponse {
  periods: {
    periodId: string;
    label: string;
    periodDate: string;
  }[];
  rows: LeaseCashFlowMatrixRow[];
}

export async function getLeaseCashFlowMatrix(options?: {
  startDate?: string;
  endDate?: string;
  locationId?: string | null;
}): Promise<LeaseCashFlowMatrixResponse> {
  const query = new URLSearchParams();
  if (options?.startDate) query.set("startDate", options.startDate);
  if (options?.endDate) query.set("endDate", options.endDate);
  if (options?.locationId) query.set("locationId", options.locationId);
  
  const url = `/api/rent-roll/lease-matrix${query.toString() ? `?${query.toString()}` : ""}`;
  return await fetch(url).then(res => res.json());
}

// ============================================================================
// PHASE 1 - DATA QUALITY VALIDATION API
// ============================================================================

export type DataQualitySeverity = "INFO" | "WARNING" | "ERROR";
export type DataQualityCategory =
  | "LEASE_DATES"
  | "COI"
  | "LEASE_AMOUNT"
  | "TENANT_DATA"
  | "OVERLAPPING_LEASES"
  | "MISC";

export interface DataQualityIssue {
  id: string;
  severity: DataQualitySeverity;
  category: DataQualityCategory;
  message: string;
  leaseId?: string;
  tenantId?: string;
  marinaLocationId?: string;
  metadata?: Record<string, string | number | null>;
}

export interface DataQualitySummary {
  issues: DataQualityIssue[];
  countsBySeverity: Record<DataQualitySeverity, number>;
  countsByCategory: Record<string, number>;
}

export async function getRentRollDataQuality(
  locationId?: string | null,
  asOfDate?: string
): Promise<DataQualitySummary> {
  const query = new URLSearchParams();
  if (locationId) query.set("locationId", locationId);
  if (asOfDate) query.set("asOfDate", asOfDate);
  
  const url = `/api/rent-roll/data-quality${query.toString() ? `?${query.toString()}` : ""}`;
  return await fetch(url).then(res => res.json());
}

// ============================================================================
// PROJECT RESET API
// ============================================================================

export interface ResetProjectResult {
  deletedLeases: number;
  deletedStorageLocations: number;
}

export async function resetProject(
  locationId: string,
  confirmationName: string
): Promise<ResetProjectResult> {
  const res = await apiRequest("POST", `/api/rent-roll/locations/${locationId}/reset`, {
    confirmationName,
  });
  return res.json();
}
