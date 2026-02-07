/**
 * Lease List Page
 * ===============
 * Displays commercial leases with server-side pagination, search, sort, and filtering.
 * KPIs come from a dedicated stats endpoint (accurate regardless of current page).
 * Scales to 200+ tenants without loading all rows.
 *
 * Usage:
 *   <LeaseListPage projectId={currentProject.id} />
 */

import React, { useState, useEffect } from "react";
import { UnifiedTenantFormDialog } from "@/components/commercial-tenants/UnifiedTenantFormDialog";
import { TenantDetailSheet } from "@/components/commercial-tenants/TenantDetailSheet";
import { useLeases, useProjectLeaseStats, useLeaseMutations } from "@/hooks/use-leases";
import type { CommercialLease, LeaseType } from "@shared/commercial-lease-types";

// ─── Formatting helpers ──────────────────────────────────────────────────────

function formatCurrency(val: string | number | null): string {
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (num == null || isNaN(num)) return "$0";
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(val: string | null): string {
  if (!val) return "—";
  return new Date(val + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const LEASE_TYPE_LABELS: Record<LeaseType, string> = {
  retail: "Retail",
  office: "Office",
  industrial: "Industrial",
  other: "Other",
};

const LEASE_TYPE_COLORS: Record<LeaseType, string> = {
  retail: "bg-blue-100 text-blue-800",
  office: "bg-purple-100 text-purple-800",
  industrial: "bg-amber-100 text-amber-800",
  other: "bg-gray-100 text-gray-800",
};

const PAGE_SIZE = 25;

// ─── Debounce hook ───────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface LeaseListPageProps {
  projectId: string;
  onSelectLease?: (leaseId: string) => void;
}

type SortColumn = 'tenantName' | 'leaseType' | 'sf' | 'commencementDate' | 'expirationDate';

export default function LeaseListPage({ projectId, onSelectLease }: LeaseListPageProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [showInactive, setShowInactive] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLease, setSelectedLease] = useState<any | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [editLease, setEditLease] = useState<any | null>(null);
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortColumn>("tenantName");
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const debouncedSearch = useDebounce(search, 300);

  // Reset to page 0 when filters change
  useEffect(() => { setPage(0); }, [debouncedSearch, typeFilter, showInactive, sortBy, sortDir]);

  const { leases, total, hasMore, loading, error, refetch } = useLeases(projectId, {
    search: debouncedSearch || undefined,
    leaseType: typeFilter || undefined,
    active: showInactive ? undefined : true,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    sortBy,
    sortDir,
  });

  const { stats, refetch: refetchStats } = useProjectLeaseStats(projectId);
  const { createLease, saving } = useLeaseMutations(() => { refetch(); refetchStats(); });

  // ─── Sort handler ──────────────────────────────────────────────
  const handleSort = (col: SortColumn) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortBy !== col) return <span className="ml-1 text-gray-300">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // ─── Create Lease Form ──────────────────────────────────────────

  const [newLease, setNewLease] = useState({
    tenantName: "",
    leaseType: "retail" as LeaseType,
    suite: "",
    sf: "",
    commencementDate: "",
    expirationDate: "",
    securityDeposit: "",
    notes: "",
  });

  const handleCreate = async () => {
    if (!newLease.tenantName || !newLease.commencementDate || !newLease.expirationDate) return;
    await createLease(projectId, {
      ...newLease,
      sf: newLease.sf || "0",
      units: 1,
    });
    setShowCreateModal(false);
    setNewLease({
      tenantName: "",
      leaseType: "retail",
      suite: "",
      sf: "",
      commencementDate: "",
      expirationDate: "",
      securityDeposit: "",
      notes: "",
    });
  };

  // ─── Pagination ──────────────────────────────────────────────

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const startRow = page * PAGE_SIZE + 1;
  const endRow = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      {/* Header + KPIs from server-side stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commercial Leases</h1>
          {stats && (
            <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
              <span>{stats.activeLeases} active leases</span>
              <span className="text-gray-300">·</span>
              <span>{stats.totalSf.toLocaleString()} SF</span>
              {stats.avgRentPerSf > 0 && (
                <>
                  <span className="text-gray-300">·</span>
                  <span>{formatCurrency(stats.avgRentPerSf)}/SF/yr avg</span>
                </>
              )}
              {stats.expiringWithin12Months > 0 && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-amber-600 font-medium">
                    {stats.expiringWithin12Months} expiring within 12 mo
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Lease
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenants or suites..."
            className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Types</option>
          <option value="retail">Retail</option>
          <option value="office">Office</option>
          <option value="industrial">Industrial</option>
          <option value="other">Other</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded"
          />
          Show Inactive
        </label>
        {total > 0 && (
          <span className="text-sm text-gray-400 ml-auto">
            {total.toLocaleString()} {total === 1 ? 'lease' : 'leases'} found
          </span>
        )}
      </div>

      {/* Table */}
      {loading && leases.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Loading leases...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">Error: {error}</div>
      ) : leases.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {debouncedSearch || typeFilter
            ? "No leases match your filters."
            : 'No leases found. Click "Add Lease" to create one.'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th onClick={() => handleSort('tenantName')} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none">
                    Tenant<SortIcon col="tenantName" />
                  </th>
                  <th onClick={() => handleSort('leaseType')} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none">
                    Type<SortIcon col="leaseType" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Suite</th>
                  <th onClick={() => handleSort('sf')} className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none">
                    SF<SortIcon col="sf" />
                  </th>
                  <th onClick={() => handleSort('commencementDate')} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none">
                    Start<SortIcon col="commencementDate" />
                  </th>
                  <th onClick={() => handleSort('expirationDate')} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none">
                    Expiration<SortIcon col="expirationDate" />
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Deposit</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leases.map((lease) => (
                  <tr
                    key={lease.id}
                    onClick={() => { setSelectedLease(lease); setShowDetail(true); onSelectLease?.(lease.id); }}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {lease.tenantName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          LEASE_TYPE_COLORS[lease.leaseType]
                        }`}
                      >
                        {LEASE_TYPE_LABELS[lease.leaseType]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{lease.suite || "—"}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {parseFloat(lease.sf).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(lease.commencementDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(lease.expirationDate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {formatCurrency(lease.securityDeposit)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          lease.active
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {lease.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-gray-500">
                Showing {startRow}–{endRow} of {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(0)}
                  disabled={page === 0}
                  className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  title="First page"
                >
                  ««
                </button>
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-sm text-gray-600 border rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 px-2">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!hasMore}
                  className="px-3 py-1.5 text-sm text-gray-600 border rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                <button
                  onClick={() => setPage(totalPages - 1)}
                  disabled={!hasMore}
                  className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Last page"
                >
                  »»
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      <UnifiedTenantFormDialog
        open={showCreateModal}
        onOpenChange={(open) => {
          setShowCreateModal(open);
          if (!open) { refetch(); refetchStats(); }
        }}
        context="valuator"
        projectId={projectId}
      />

      <TenantDetailSheet
        open={showDetail}
        onOpenChange={setShowDetail}
        tenant={selectedLease}
        onEdit={(tenant) => {
          setShowDetail(false);
          setEditLease(tenant);
        }}
        context="valuator"
        projectId={projectId}
      />

      {editLease && (
        <UnifiedTenantFormDialog
          open={!!editLease}
          onOpenChange={(open) => {
            if (!open) { setEditLease(null); refetch(); refetchStats(); }
          }}
          context="valuator"
          projectId={projectId}
          tenant={editLease}
        />
      )}
    </div>
  );
}
