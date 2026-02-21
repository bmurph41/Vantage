/**
 * BulkOperationsBar
 * 
 * Floating action bar that appears when 1+ deals are selected via checkboxes.
 * 
 * Actions:
 *   - Bulk Stage Move — advance/set pipeline stage for all selected
 *   - Bulk Assign — set owner/contact on all selected
 *   - Bulk Tag — add tags/labels to all selected
 *   - Bulk Export — download selected deals as Excel
 *   - Bulk Delete — remove selected deals (with confirmation)
 * 
 * Integration:
 *   Place at the bottom of any view with deal selection:
 *   
 *   const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
 *   
 *   <BulkOperationsBar
 *     selectedIds={selectedDealIds}
 *     onClearSelection={() => setSelectedDealIds(new Set())}
 *     deals={deals}
 *   />
 * 
 * The bar slides up when selectedIds.size > 0.
 */

import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight, Download, Tag, Trash2, UserPlus, X,
  Loader2, ChevronDown, Check, AlertTriangle, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Deal, PipelineStage, Contact } from "@shared/schema";

// ─── Props ────────────────────────────────────────────────────────

interface BulkOperationsBarProps {
  selectedIds: Set<string>;
  onClearSelection: () => void;
  deals: Deal[];
}

// ─── Component ────────────────────────────────────────────────────

export function BulkOperationsBar({
  selectedIds,
  onClearSelection,
  deals,
}: BulkOperationsBarProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [targetStage, setTargetStage] = useState("");
  const [targetContact, setTargetContact] = useState("");
  const [tagInput, setTagInput] = useState("");

  const count = selectedIds.size;
  const isVisible = count > 0;

  // Selected deal objects
  const selectedDeals = useMemo(
    () => deals.filter((d) => selectedIds.has(String(d.id))),
    [deals, selectedIds]
  );

  const totalValue = useMemo(
    () => selectedDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0),
    [selectedDeals]
  );

  // Fetch pipeline stages
  const { data: stages = [] } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
    enabled: stageDialogOpen,
  });

  // Fallback stages
  const stageOptions = useMemo(() => {
    if (stages.length > 0) {
      return [...stages]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((s) => ({ value: (s as any).slug || s.name?.toLowerCase().replace(/\s+/g, "_") || s.id, label: s.name || s.id }));
    }
    return [
      { value: "lead", label: "Lead" },
      { value: "qualified", label: "Qualified" },
      { value: "loi", label: "LOI" },
      { value: "due_diligence", label: "Due Diligence" },
      { value: "under_contract", label: "Under Contract" },
      { value: "closing", label: "Closing" },
    ];
  }, [stages]);

  // Fetch contacts for assignment
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    enabled: assignDialogOpen,
  });

  // ─── Mutations ──────────────────────────────────────────────────

  const bulkUpdateMutation = useMutation({
    mutationFn: async (updates: { ids: string[]; data: Record<string, any> }) => {
      // Try bulk endpoint first, fall back to individual updates
      try {
        const response = await apiRequest("POST", "/api/crm/bulk/deals", updates);
        return response.json();
      } catch {
        // Fallback: update individually
        const results = await Promise.allSettled(
          updates.ids.map((id) =>
            apiRequest("PUT", `/api/deals/${id}`, updates.data).then((r) => r.json())
          )
        );
        const succeeded = results.filter((r) => r.status === "fulfilled").length;
        const failed = results.filter((r) => r.status === "rejected").length;
        return { succeeded, failed, total: updates.ids.length };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      const msg = result?.succeeded != null
        ? `${result.succeeded} of ${result.total} deals updated`
        : `${count} deals updated`;
      toast({ title: "Bulk Update Complete", description: msg });
      onClearSelection();
    },
    onError: (error: Error) => {
      toast({ title: "Bulk update failed", description: error.message, variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      try {
        const response = await apiRequest("POST", "/api/crm/bulk/delete", { ids, entityType: "deal" });
        return response.json();
      } catch {
        // Fallback: delete individually
        const results = await Promise.allSettled(
          ids.map((id) => apiRequest("DELETE", `/api/deals/${id}`).then((r) => r.json()))
        );
        const succeeded = results.filter((r) => r.status === "fulfilled").length;
        return { succeeded, total: ids.length };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({ title: "Deals Deleted", description: `${result?.succeeded || count} deals removed.` });
      onClearSelection();
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const isPending = bulkUpdateMutation.isPending || bulkDeleteMutation.isPending;

  // ─── Handlers ───────────────────────────────────────────────────

  const handleBulkStageMove = () => {
    if (!targetStage) return;
    bulkUpdateMutation.mutate({
      ids: Array.from(selectedIds),
      data: { pipelineStage: targetStage, stageChangedAt: new Date().toISOString() },
    });
    setStageDialogOpen(false);
    setTargetStage("");
  };

  const handleBulkAssign = () => {
    if (!targetContact) return;
    bulkUpdateMutation.mutate({
      ids: Array.from(selectedIds),
      data: { primaryContactId: targetContact },
    });
    setAssignDialogOpen(false);
    setTargetContact("");
  };

  const handleBulkTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    // Add tag to each deal's existing tags
    const updates = Array.from(selectedIds).map((id) => {
      const deal = deals.find((d) => String(d.id) === id) as any;
      const existingTags = Array.isArray(deal?.tags) ? deal.tags : [];
      return { id, tags: [...new Set([...existingTags, tag])] };
    });
    // Update each deal individually for tags (since they're per-deal)
    Promise.allSettled(
      updates.map(({ id, tags }) =>
        apiRequest("PUT", `/api/deals/${id}`, { tags })
      )
    ).then((results) => {
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({ title: "Tags Applied", description: `"${tag}" added to ${succeeded} deals.` });
      onClearSelection();
    });
    setTagDialogOpen(false);
    setTagInput("");
  };

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedIds));
    setDeleteDialogOpen(false);
  };

  const handleExport = async () => {
    try {
      // Try dedicated bulk export endpoint
      const response = await fetch("/api/crm/bulk/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          entityType: "deal",
          format: "xlsx",
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `deals-export-${new Date().toISOString().split("T")[0]}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Export Downloaded" });
      } else {
        // Fallback: build CSV client-side
        exportCSV(selectedDeals);
        toast({ title: "CSV Exported", description: "Downloaded as CSV (Excel endpoint not available)." });
      }
    } catch {
      exportCSV(selectedDeals);
      toast({ title: "CSV Exported", description: "Downloaded as CSV." });
    }
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <>
      {/* Floating Bar */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300",
          isVisible ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="mx-auto max-w-4xl px-4 pb-4">
          <div className="bg-slate-900 dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-700 px-4 py-3 flex items-center gap-3">
            {/* Count Badge */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge className="bg-blue-600 text-white text-xs tabular-nums h-6 min-w-[24px] justify-center">
                {count}
              </Badge>
              <div className="text-white text-xs">
                <span className="font-medium">deal{count !== 1 ? "s" : ""} selected</span>
                {totalValue > 0 && (
                  <span className="text-slate-400 ml-1.5">
                    · {formatCurrency(totalValue)}
                  </span>
                )}
              </div>
            </div>

            <Separator orientation="vertical" className="h-6 bg-slate-600" />

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-slate-200 hover:text-white hover:bg-slate-700 gap-1.5"
                onClick={() => setStageDialogOpen(true)}
                disabled={isPending}
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Move Stage
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-slate-200 hover:text-white hover:bg-slate-700 gap-1.5"
                onClick={() => setAssignDialogOpen(true)}
                disabled={isPending}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Assign
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-slate-200 hover:text-white hover:bg-slate-700 gap-1.5"
                onClick={() => setTagDialogOpen(true)}
                disabled={isPending}
              >
                <Tag className="h-3.5 w-3.5" />
                Tag
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-slate-200 hover:text-white hover:bg-slate-700 gap-1.5"
                onClick={handleExport}
                disabled={isPending}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/30 gap-1.5"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>

            {/* Close */}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
              onClick={onClearSelection}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stage Move Dialog ──────────────────────────────────── */}
      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Move {count} Deal{count !== 1 ? "s" : ""} to Stage
            </DialogTitle>
            <DialogDescription>
              All selected deals will be moved to the chosen pipeline stage.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="mb-2 block">Target Stage</Label>
            <Select value={targetStage} onValueChange={setTargetStage}>
              <SelectTrigger>
                <SelectValue placeholder="Select stage..." />
              </SelectTrigger>
              <SelectContent>
                {stageOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkStageMove} disabled={!targetStage || isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Move {count} Deal{count !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign Dialog ──────────────────────────────────────── */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Assign Contact to {count} Deal{count !== 1 ? "s" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label className="mb-2 block">Primary Contact</Label>
            <Select value={targetContact} onValueChange={setTargetContact}>
              <SelectTrigger>
                <SelectValue placeholder="Select contact..." />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || "Contact"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkAssign} disabled={!targetContact || isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Tag Dialog ─────────────────────────────────────────── */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tag {count} Deal{count !== 1 ? "s" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label className="mb-2 block">Tag Name</Label>
            <Input
              placeholder='e.g. "IC Review", "Q2 Priority"'
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleBulkTag(); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkTag} disabled={!tagInput.trim() || isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apply Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              Delete {count} Deal{count !== 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The following deals will be permanently removed:
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 max-h-[200px] overflow-auto">
            <div className="space-y-1">
              {selectedDeals.slice(0, 10).map((deal) => (
                <div key={deal.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-red-50 dark:bg-red-950/20">
                  <span className="font-medium truncate">{deal.name || "Untitled"}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {deal.amount ? formatCurrency(deal.amount) : "—"}
                  </span>
                </div>
              ))}
              {selectedDeals.length > 10 && (
                <p className="text-xs text-muted-foreground text-center py-1">
                  ...and {selectedDeals.length - 10} more
                </p>
              )}
            </div>
            {totalValue > 0 && (
              <div className="mt-3 text-xs font-medium text-red-600 text-center">
                Total pipeline value to be removed: {formatCurrency(totalValue)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete {count} Deal{count !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── CSV Fallback Export ──────────────────────────────────────────

function exportCSV(deals: Deal[]) {
  const headers = [
    "Name", "Amount", "Stage", "Status", "Asset Class",
    "Source", "Priority", "Close Date", "Created",
  ];

  const rows = deals.map((d) => {
    const deal = d as any;
    return [
      deal.name || "",
      deal.amount || "",
      deal.pipelineStage || deal.stage || "",
      deal.status || "open",
      deal.assetClass || deal.asset_class || "marina",
      deal.source || "",
      deal.priority || "",
      deal.closeDate ? new Date(deal.closeDate).toLocaleDateString() : "",
      deal.createdAt ? new Date(deal.createdAt).toLocaleDateString() : "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `deals-export-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Utility ──────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export default BulkOperationsBar;
