/**
 * Unified Lease Context — Shared Types
 * =====================================
 * Types used by both client and server to distinguish Operations vs Valuator context.
 */

// ─── Context Enum ─────────────────────────────────────────────────────────────

export type LeaseContextMode = 'operations' | 'valuator';

// ─── API Request/Response Types ───────────────────────────────────────────────

export interface OperationsLeaseListParams {
  propertyId?: string;
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface OperationsLeaseStats {
  totalLeases: number;
  activeLeases: number;
  totalSf: number;
  avgRentPerSf: number;
  totalMonthlyBaseRent: number;
  expiringWithin90Days: number;
  expiringWithin12Months: number;
  leaseTypeBreakdown: Record<string, number>;
}

export interface PropertyWithLeaseCount {
  propertyId: string;
  propertyName: string;
  leaseCount: number;
  activeLeasCount: number;
  totalSf: number;
}

// ─── Import / Connect Types ──────────────────────────────────────────────────

export type ImportMode = 'snapshot' | 'linked';

export interface ImportFromOperationsRequest {
  leaseIds: string[];
  mode: ImportMode;
}

export interface ImportFromOperationsResult {
  imported: number;
  failed: number;
  errors: string[];
  leases: Array<{ sourceId: string; newId: string; tenantName: string }>;
}

export interface AvailableOpsLease {
  id: string;
  tenantName: string;
  suite: string | null;
  sf: number;
  leaseType: string;
  commencementDate: string;
  expirationDate: string;
  active: boolean;
  alreadyImported: boolean;  // true if already connected to this project
  importedLeaseId?: string;  // the valuator lease id if already imported
}

export interface PushToOperationsResult {
  success: boolean;
  updatedFields: string[];
  sourceLeaseId: string;
}

// ─── Feature Flags (client-side) ─────────────────────────────────────────────

export interface LeaseContextFeatures {
  syncToProForma: boolean;
  connectFromOps: boolean;
  pushToOps: boolean;
  propertySelector: boolean;
  tenantHistory: boolean;
  leaseAlerts: boolean;
  bulkRecompute: boolean;
  cashflowExport: boolean;
}

export function getContextFeatures(mode: LeaseContextMode): LeaseContextFeatures {
  if (mode === 'operations') {
    return {
      syncToProForma: false,
      connectFromOps: false,
      pushToOps: false,
      propertySelector: true,
      tenantHistory: true,
      leaseAlerts: true,
      bulkRecompute: false,
      cashflowExport: false,
    };
  }
  // valuator
  return {
    syncToProForma: true,
    connectFromOps: true,
    pushToOps: true,
    propertySelector: false,
    tenantHistory: false,
    leaseAlerts: false,
    bulkRecompute: true,
    cashflowExport: true,
  };
}

// ─── Unified Lease Row (superset for UI display) ─────────────────────────────

export interface UnifiedLeaseRow {
  id: string;
  tenantName: string;
  suite: string | null;
  sf: number;
  leaseType: string;
  commencementDate: string;
  expirationDate: string;
  active: boolean;
  notes: string | null;
  
  // Context info
  leaseContext: LeaseContextMode;
  projectId: string | null;
  propertyId: string | null;
  sourceLeaseId: string | null;
  
  // Computed/joined for display
  monthlyBaseRent?: number;
  annualBaseRent?: number;
  rentPerSf?: number;
  escalationDisplay?: string;
  daysUntilExpiration?: number;
  termCount?: number;
  
  createdAt: string;
  updatedAt: string;
}
