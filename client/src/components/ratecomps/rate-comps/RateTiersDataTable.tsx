import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Trash2, Save, X, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { STORAGE_TYPE_LABELS, RATE_PERIOD_LABELS, RATE_UNIT_LABELS, formatRateDisplay } from "@shared/ratecomps-utils";
import type { RateTier } from "@shared/schema";

// TierRowData interface - exported for parent components
export interface TierRowData {
  id?: string;
  storageType: string;
  sizeBasis: string;
  loaMin: string;
  loaMax: string;
  rateUnit: string;
  ratePeriod: string;
  amountCents: string;
  rateYear: string;
  isCurrentRate: boolean;
  isEditing: boolean;
  isNew: boolean;
}

export const EMPTY_ROW: TierRowData = {
  storageType: 'wet_slip',
  sizeBasis: 'loa_range',
  loaMin: '',
  loaMax: '',
  rateUnit: 'per_foot',
  ratePeriod: 'monthly',
  amountCents: '',
  rateYear: new Date().getFullYear().toString(),
  isCurrentRate: true,
  isEditing: true,
  isNew: true,
};

export function rowDataToTier(data: TierRowData): any {
  return {
    storageType: data.storageType,
    sizeBasis: data.sizeBasis,
    loaMin: data.loaMin ? parseInt(data.loaMin) : null,
    loaMax: data.loaMax ? parseInt(data.loaMax) : null,
    rateUnit: data.rateUnit,
    ratePeriod: data.ratePeriod,
    amountCents: data.amountCents ? Math.round(parseFloat(data.amountCents) * 100) : 0,
    rateYear: data.rateYear ? parseInt(data.rateYear) : new Date().getFullYear(),
    isCurrentRate: data.isCurrentRate,
  };
}

interface RateTiersDataTableProps {
  rateCompId?: string; // Optional - if not provided, works in local-only mode
  marinaName: string;
  onTiersUpdated?: () => void;
  // For local mode (creation):
  localTiers?: TierRowData[];
  onLocalTiersChange?: (tiers: TierRowData[]) => void;
}

function tierToRowData(tier: RateTier): TierRowData {
  return {
    id: tier.id,
    storageType: tier.storageType || 'wet_slip',
    sizeBasis: tier.sizeBasis || 'loa_range',
    loaMin: tier.loaMin?.toString() || '',
    loaMax: tier.loaMax?.toString() || '',
    rateUnit: tier.rateUnit || 'per_foot',
    ratePeriod: tier.ratePeriod || 'monthly',
    amountCents: tier.amountCents ? (tier.amountCents / 100).toString() : '',
    rateYear: tier.rateYear?.toString() || new Date().getFullYear().toString(),
    isCurrentRate: tier.isCurrentRate ?? true,
    isEditing: false,
    isNew: false,
  };
}

export default function RateTiersDataTable({ 
  rateCompId, 
  marinaName, 
  onTiersUpdated,
  localTiers,
  onLocalTiersChange 
}: RateTiersDataTableProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  
  // Determine if we're in local mode (no rateCompId) or API mode
  const isLocalMode = !rateCompId;
  
  // Internal state for API mode
  const [apiRows, setApiRows] = useState<TierRowData[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Use localTiers if in local mode, otherwise use apiRows
  const rows = isLocalMode ? (localTiers || []) : apiRows;
  const setRows = isLocalMode 
    ? (newRows: TierRowData[] | ((prev: TierRowData[]) => TierRowData[])) => {
        const resolvedRows = typeof newRows === 'function' ? newRows(localTiers || []) : newRows;
        onLocalTiersChange?.(resolvedRows);
      }
    : setApiRows;

  // Only fetch tiers from API when we have a rateCompId
  const { data: tiers, isLoading } = useQuery<RateTier[]>({
    queryKey: [`/api/rate-comps/${rateCompId}/tiers`],
    enabled: !!rateCompId, // Only run query when rateCompId exists
  });

  useEffect(() => {
    if (tiers && !isLocalMode) {
      setApiRows(tiers.map(tierToRowData));
    }
  }, [tiers, isLocalMode]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/rate-comps/${rateCompId}/tiers`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: "Rate tier created" });
      qc.invalidateQueries({ queryKey: [`/api/rate-comps/${rateCompId}/tiers`] });
      onTiersUpdated?.();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest(`/api/rate-tiers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      toast({ title: "Rate tier updated" });
      qc.invalidateQueries({ queryKey: [`/api/rate-comps/${rateCompId}/tiers`] });
      onTiersUpdated?.();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/rate-tiers/${id}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      toast({ title: "Rate tier deleted" });
      qc.invalidateQueries({ queryKey: [`/api/rate-comps/${rateCompId}/tiers`] });
      onTiersUpdated?.();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleAddRow = () => {
    setRows([...rows, { ...EMPTY_ROW }]);
  };

  const handleRowChange = (index: number, field: keyof TierRowData, value: any) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };
    setRows(newRows);
  };

  const handleSaveRow = async (index: number) => {
    const row = rows[index];
    const tierData = rowDataToTier(row);
    
    if (!tierData.amountCents || tierData.amountCents <= 0) {
      toast({ title: "Error", description: "Rate amount is required", variant: "destructive" });
      return;
    }

    if (isLocalMode) {
      // In local mode, just mark the row as saved (not editing/new)
      const newRows = [...rows];
      newRows[index] = { ...newRows[index], isEditing: false, isNew: false };
      setRows(newRows);
      setEditingId(null);
      toast({ title: "Rate tier added", description: "Will be saved when you save the rate comp" });
    } else {
      // In API mode, make the API call
      if (row.isNew) {
        await createMutation.mutateAsync(tierData);
      } else if (row.id) {
        await updateMutation.mutateAsync({ id: row.id, data: tierData });
      }
      
      const newRows = [...rows];
      newRows[index] = { ...newRows[index], isEditing: false, isNew: false };
      setRows(newRows);
      setEditingId(null);
    }
  };

  const handleCancelEdit = (index: number) => {
    const row = rows[index];
    if (row.isNew) {
      // Remove new unsaved rows
      setRows(rows.filter((_, i) => i !== index));
    } else if (isLocalMode) {
      // In local mode, just exit editing (can't revert since no original stored)
      const newRows = [...rows];
      newRows[index] = { ...newRows[index], isEditing: false };
      setRows(newRows);
    } else {
      // In API mode, restore from fetched tiers
      const original = tiers?.find(t => t.id === row.id);
      if (original) {
        const newRows = [...rows];
        newRows[index] = tierToRowData(original);
        setRows(newRows);
      }
    }
    setEditingId(null);
  };

  const handleEditRow = (index: number) => {
    const row = rows[index];
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], isEditing: true };
    setRows(newRows);
    setEditingId(row.id || null);
  };

  const handleDeleteRow = async (index: number) => {
    const row = rows[index];
    if (isLocalMode) {
      // In local mode, just remove from state
      setRows(rows.filter((_, i) => i !== index));
    } else if (row.id) {
      // In API mode, make the delete API call
      await deleteMutation.mutateAsync(row.id);
    }
  };

  const formatSizeDisplay = (row: TierRowData) => {
    if (row.sizeBasis === 'loa_range') {
      if (row.loaMin && row.loaMax) return `${row.loaMin}'-${row.loaMax}'`;
      if (row.loaMin) return `${row.loaMin}'+`;
      if (row.loaMax) return `Up to ${row.loaMax}'`;
      return '-';
    }
    if (row.loaMin) return `${row.loaMin}'`;
    return '-';
  };

  // Only show loading for API mode
  if (isLoading && !isLocalMode) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Rate Tiers</h3>
          <p className="text-sm text-muted-foreground">
            {isLocalMode 
              ? "Add pricing tiers (will be saved with the rate comp)"
              : `Manage pricing tiers for ${marinaName}`
            }
          </p>
        </div>
        <Button onClick={handleAddRow} size="sm" data-testid="button-add-tier">
          <Plus className="h-4 w-4 mr-1" />
          Add Rate
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Storage Type</TableHead>
              <TableHead className="w-[100px]">Size Basis</TableHead>
              <TableHead className="w-[120px]">Boat Size</TableHead>
              <TableHead className="w-[120px]">Rate Type</TableHead>
              <TableHead className="w-[100px]">Rate</TableHead>
              <TableHead className="w-[80px]">Year</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No rate tiers yet. Click "Add Rate" to create one.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={row.id || `new-${index}`} data-testid={`tier-row-${row.id || index}`}>
                  {row.isEditing ? (
                    <>
                      <TableCell>
                        <Select
                          value={row.storageType}
                          onValueChange={(v) => handleRowChange(index, 'storageType', v)}
                        >
                          <SelectTrigger className="h-8" data-testid={`select-storage-type-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STORAGE_TYPE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.sizeBasis}
                          onValueChange={(v) => handleRowChange(index, 'sizeBasis', v)}
                        >
                          <SelectTrigger className="h-8" data-testid={`select-size-basis-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="loa_range">LOA Range</SelectItem>
                            <SelectItem value="exact_loa">Exact LOA</SelectItem>
                            <SelectItem value="any">Any Size</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            value={row.loaMin}
                            onChange={(e) => handleRowChange(index, 'loaMin', e.target.value)}
                            placeholder="Min"
                            className="h-8 w-14"
                            data-testid={`input-loa-min-${index}`}
                          />
                          {row.sizeBasis === 'loa_range' && (
                            <Input
                              type="number"
                              value={row.loaMax}
                              onChange={(e) => handleRowChange(index, 'loaMax', e.target.value)}
                              placeholder="Max"
                              className="h-8 w-14"
                              data-testid={`input-loa-max-${index}`}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Select
                            value={row.rateUnit}
                            onValueChange={(v) => handleRowChange(index, 'rateUnit', v)}
                          >
                            <SelectTrigger className="h-8 w-20" data-testid={`select-rate-unit-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(RATE_UNIT_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={row.ratePeriod}
                            onValueChange={(v) => handleRowChange(index, 'ratePeriod', v)}
                          >
                            <SelectTrigger className="h-8 w-20" data-testid={`select-rate-period-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(RATE_PERIOD_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={row.amountCents}
                          onChange={(e) => handleRowChange(index, 'amountCents', e.target.value)}
                          placeholder="$0.00"
                          className="h-8 w-20"
                          data-testid={`input-amount-${index}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.rateYear}
                          onChange={(e) => handleRowChange(index, 'rateYear', e.target.value)}
                          placeholder={new Date().getFullYear().toString()}
                          className="h-8 w-16"
                          data-testid={`input-year-${index}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.isCurrentRate ? 'current' : 'historical'}
                          onValueChange={(v) => handleRowChange(index, 'isCurrentRate', v === 'current')}
                        >
                          <SelectTrigger className="h-8 w-20" data-testid={`select-status-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="current">Current</SelectItem>
                            <SelectItem value="historical">Historical</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSaveRow(index)}
                            disabled={isPending}
                            data-testid={`button-save-tier-${index}`}
                          >
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelEdit(index)}
                            data-testid={`button-cancel-tier-${index}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>
                        <Badge variant="outline">
                          {STORAGE_TYPE_LABELS[row.storageType] || row.storageType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.sizeBasis === 'loa_range' ? 'Range' : row.sizeBasis === 'exact_loa' ? 'LOA' : 'Any'}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {formatSizeDisplay(row)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {RATE_UNIT_LABELS[row.rateUnit]} / {RATE_PERIOD_LABELS[row.ratePeriod]}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {row.amountCents ? formatRateDisplay(parseFloat(row.amountCents) * 100, row.rateUnit, row.ratePeriod) : '-'}
                      </TableCell>
                      <TableCell className="text-sm">{row.rateYear || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={row.isCurrentRate ? "default" : "secondary"}>
                          {row.isCurrentRate ? 'Current' : 'Historical'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRow(index)}
                            disabled={editingId !== null}
                            data-testid={`button-edit-tier-${index}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isPending}
                                data-testid={`button-delete-tier-${index}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Rate Tier</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this rate tier? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteRow(index)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {rows.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {rows.filter(r => r.isCurrentRate && !r.isNew).length} current rate(s), {rows.filter(r => !r.isCurrentRate && !r.isNew).length} historical rate(s)
        </p>
      )}
    </div>
  );
}
