import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft, ChevronRight, Shield, Clock, Layers, Building2,
} from "lucide-react";

// ─── Shared types ────────────────────────────────────────────────────────────

interface Pagination {
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
}

function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

function PaginationBar({
  pagination,
  onPrev,
  onNext,
}: {
  pagination: Pagination;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (pagination.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t px-4 py-3">
      <span className="text-sm text-muted-foreground">
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pagination.page <= 1}
          onClick={onPrev}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pagination.page >= pagination.totalPages}
          onClick={onNext}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ─── All-activity tab ────────────────────────────────────────────────────────

interface AuditRow {
  id: string;
  action: string;
  metadata_json: Record<string, any> | null;
  created_at: string;
  admin_user_id: string;
  admin_name: string | null;
  admin_email: string | null;
  target_user_id: string | null;
  target_name: string | null;
  target_email: string | null;
}

interface AuditTrailResponse {
  rows: AuditRow[];
  pagination: Pagination;
}

const ACTION_OPTIONS = [
  { value: "all", label: "All Actions" },
  { value: "asset_classes_updated", label: "Asset Classes Updated" },
  { value: "user_status_change", label: "User Status Change" },
  { value: "subscription_canceled", label: "Subscription Canceled" },
  { value: "subscription_reactivated", label: "Subscription Reactivated" },
  { value: "trial_extended", label: "Trial Extended" },
  { value: "plan_changed", label: "Plan Changed" },
  { value: "customer_note_added", label: "Customer Note Added" },
  { value: "ownership_transferred", label: "Ownership Transferred" },
  { value: "pack_granted", label: "Pack Granted" },
  { value: "pack_revoked", label: "Pack Revoked" },
];

function formatActionLabel(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function getActionBadge(action: string) {
  const label = formatActionLabel(action);
  switch (action) {
    case "asset_classes_updated":
      return <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 border-0">{label}</Badge>;
    case "user_status_change":
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-0">{label}</Badge>;
    case "subscription_canceled":
      return <Badge variant="destructive">{label}</Badge>;
    case "subscription_reactivated":
      return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">{label}</Badge>;
    case "trial_extended":
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-0">{label}</Badge>;
    case "plan_changed":
      return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-0">{label}</Badge>;
    case "customer_note_added":
      return <Badge variant="secondary">{label}</Badge>;
    case "ownership_transferred":
      return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-0">{label}</Badge>;
    case "pack_granted":
      return <Badge className="bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border-0">{label}</Badge>;
    case "pack_revoked":
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-0">{label}</Badge>;
    default:
      return <Badge variant="outline">{label}</Badge>;
  }
}

function renderMetadata(action: string, metadata: Record<string, any> | null): string {
  if (!metadata || Object.keys(metadata).length === 0) return "—";
  if (action === "asset_classes_updated") {
    const prev: string[] = metadata.previousClasses ?? [];
    const next: string[] = metadata.newClasses ?? [];
    const tier: string = metadata.newTierName ?? metadata.newTier ?? "";
    const prevStr = prev.length ? prev.join(", ") : "(none)";
    const nextStr = next.length ? next.join(", ") : "(none)";
    return `${prevStr} → ${nextStr}${tier ? ` · ${tier}` : ""}`;
  }
  const parts: string[] = [];
  if (metadata.previousStatus && metadata.newStatus) parts.push(`${metadata.previousStatus} → ${metadata.newStatus}`);
  if (metadata.daysAdded) parts.push(`+${metadata.daysAdded} days`);
  if (metadata.oldPlan && metadata.newPlan) parts.push(`${metadata.oldPlan.planName || metadata.oldPlan.planKey} → ${metadata.newPlan.planName || metadata.newPlan.planKey}`);
  if (metadata.noteId) parts.push(`Note #${metadata.noteId.slice(0, 8)}`);
  if (metadata.packType) parts.push(`Pack: ${metadata.packType}`);
  if (metadata.newPeriodEnd) parts.push(`Until: ${new Date(metadata.newPeriodEnd).toLocaleDateString()}`);
  if (parts.length === 0) return JSON.stringify(metadata).slice(0, 80);
  return parts.join(" · ");
}

function AllActivityTab() {
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => { setPage(1); }, [action]);

  const buildQs = useCallback(() => {
    const p = new URLSearchParams();
    if (action !== "all") p.set("action", action);
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    return p.toString();
  }, [action, page]);

  const { data, isLoading } = useQuery<AuditTrailResponse>({
    queryKey: [`/api/admin/customers/audit-trail?${buildQs()}`],
  });

  const rows = data?.rows ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-[230px]">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pagination && (
          <span className="text-sm text-muted-foreground ml-auto">
            {pagination.total} total entries
          </span>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target User</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No audit log entries found
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
                        {formatTimestamp(row.created_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">{row.admin_name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{row.admin_email || "—"}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getActionBadge(row.action)}</TableCell>
                    <TableCell>
                      {row.target_user_id ? (
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white text-sm">{row.target_name || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{row.target_email || "—"}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                      {renderMetadata(row.action, row.metadata_json)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {pagination && <PaginationBar pagination={pagination} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => p + 1)} />}
      </div>
    </div>
  );
}

// ─── Asset class changes tab ─────────────────────────────────────────────────

interface AssetClassAuditRow {
  id: string;
  created_at: string;
  admin_user_id: string;
  user_name: string | null;
  user_email: string | null;
  metadata_json: {
    orgId?: string;
    previousClasses?: string[];
    newClasses?: string[];
    newTier?: string;
    newTierName?: string;
  } | null;
  org_id: string | null;
  org_name: string | null;
}

interface AssetClassAuditResponse {
  rows: AssetClassAuditRow[];
  pagination: Pagination;
}

function ClassList({ classes }: { classes: string[] | null | undefined }) {
  if (!classes || classes.length === 0) return <span className="text-muted-foreground text-xs italic">none</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {classes.map((c) => (
        <Badge key={c} variant="secondary" className="text-xs font-normal capitalize">
          {c.replace(/_/g, " ")}
        </Badge>
      ))}
    </div>
  );
}

function AssetClassChangesTab() {
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const buildQs = useCallback(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    return p.toString();
  }, [page]);

  const { data, isLoading } = useQuery<AssetClassAuditResponse>({
    queryKey: [`/api/admin/organizations/asset-class-audit?${buildQs()}`],
  });

  const rows = data?.rows ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      {pagination && (
        <div className="flex justify-end">
          <span className="text-sm text-muted-foreground">{pagination.total} total changes</span>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Org</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Previous Classes</TableHead>
                <TableHead>New Classes</TableHead>
                <TableHead>Tier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No asset class changes recorded yet
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const meta = row.metadata_json ?? {};
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
                          {formatTimestamp(row.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white text-sm">
                              {row.org_name || "Unknown org"}
                            </div>
                            {row.org_id && (
                              <div className="text-xs text-muted-foreground font-mono">
                                {row.org_id.slice(0, 8)}…
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white text-sm">
                            {row.user_name || "Unknown"}
                          </div>
                          <div className="text-xs text-muted-foreground">{row.user_email || "—"}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <ClassList classes={meta.previousClasses} />
                      </TableCell>
                      <TableCell>
                        <ClassList classes={meta.newClasses} />
                      </TableCell>
                      <TableCell>
                        {meta.newTierName ? (
                          <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 border-0 text-xs">
                            {meta.newTierName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {pagination && <PaginationBar pagination={pagination} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => p + 1)} />}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminAuditTrailPage() {
  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Activity Log</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Complete audit trail of administrative actions</p>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Activity</TabsTrigger>
          <TabsTrigger value="asset-classes" className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Asset Class Changes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <AllActivityTab />
        </TabsContent>

        <TabsContent value="asset-classes" className="mt-4">
          <AssetClassChangesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
