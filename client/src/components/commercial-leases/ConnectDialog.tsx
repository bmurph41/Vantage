/**
 * ConnectDialog
 * =============
 * Lets a Valuator user select Operations leases to import.
 * Supports "snapshot" (independent copy) and "linked" (can sync back) modes.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Link2, Copy, Check, AlertCircle, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  useAvailableOpsLeases,
  useImportFromOperations,
} from "@/hooks/use-unified-leases";
import type { ImportMode, AvailableOpsLease } from "@shared/lease-context-types";

const fmtDate = (d: string) => {
  try {
    return format(parseISO(d), "MMM yyyy");
  } catch {
    return d;
  }
};

interface ConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId?: string;
}

export function ConnectDialog({
  open,
  onOpenChange,
  propertyId,
}: ConnectDialogProps) {
  const { toast } = useToast();
  const { availableLeases, loading } = useAvailableOpsLeases(propertyId);
  const importMutation = useImportFromOperations();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<ImportMode>("linked");

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    const importable = availableLeases.filter((l) => !l.alreadyImported);
    if (selected.size === importable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(importable.map((l) => l.id)));
    }
  };

  const handleImport = () => {
    if (selected.size === 0) {
      toast({
        title: "No leases selected",
        variant: "destructive",
      });
      return;
    }

    importMutation.mutate(
      { leaseIds: Array.from(selected), mode },
      {
        onSuccess: (result) => {
          toast({
            title: "Import Complete",
            description: `${result.imported} lease(s) imported${
              result.failed > 0 ? `, ${result.failed} failed` : ""
            }`,
          });
          setSelected(new Set());
          onOpenChange(false);
        },
        onError: (err) =>
          toast({
            title: "Import failed",
            description: err.message,
            variant: "destructive",
          }),
      }
    );
  };

  const importableCount = availableLeases.filter(
    (l) => !l.alreadyImported
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from Operations</DialogTitle>
          <DialogDescription>
            Select leases from your Operations portfolio to import into this
            model.
          </DialogDescription>
        </DialogHeader>

        {/* Import Mode Selector */}
        <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
          <Label className="text-sm font-medium">Import Mode:</Label>
          <Select
            value={mode}
            onValueChange={(v: ImportMode) => setMode(v)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linked">
                <div className="flex items-center gap-2">
                  <Link2 className="h-3 w-3" />
                  Linked (can sync back)
                </div>
              </SelectItem>
              <SelectItem value="snapshot">
                <div className="flex items-center gap-2">
                  <Copy className="h-3 w-3" />
                  Snapshot (independent copy)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground flex-1">
            {mode === "linked"
              ? "Changes in this model can be pushed back to Operations"
              : "Creates an independent copy — changes don't affect Operations"}
          </p>
        </div>

        {/* Lease Table */}
        {loading ? (
          <div className="space-y-2 py-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : availableLeases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>No Operations leases found</p>
            <p className="text-xs">
              Add leases in Operations → Commercial Tenants first
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={
                      importableCount > 0 && selected.size === importableCount
                    }
                    onCheckedChange={toggleAll}
                    disabled={importableCount === 0}
                  />
                </TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Suite</TableHead>
                <TableHead className="text-right">SF</TableHead>
                <TableHead>Lease Type</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {availableLeases.map((lease: AvailableOpsLease) => (
                <TableRow
                  key={lease.id}
                  className={
                    lease.alreadyImported ? "opacity-50" : "cursor-pointer"
                  }
                  onClick={() =>
                    !lease.alreadyImported && toggleSelect(lease.id)
                  }
                >
                  <TableCell>
                    {lease.alreadyImported ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Checkbox
                        checked={selected.has(lease.id)}
                        onCheckedChange={() => toggleSelect(lease.id)}
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {lease.tenantName}
                  </TableCell>
                  <TableCell>{lease.suite || "-"}</TableCell>
                  <TableCell className="text-right">
                    {lease.sf.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{lease.leaseType}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {fmtDate(lease.commencementDate)} –{" "}
                    {fmtDate(lease.expirationDate)}
                  </TableCell>
                  <TableCell>
                    {lease.alreadyImported ? (
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-300 bg-green-50"
                      >
                        Already Imported
                      </Badge>
                    ) : (
                      <Badge
                        variant={lease.active ? "default" : "secondary"}
                      >
                        {lease.active ? "Active" : "Inactive"}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-muted-foreground">
              {selected.size} of {importableCount} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={selected.size === 0 || importMutation.isPending}
              >
                {importMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Import {selected.size} Lease{selected.size !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
