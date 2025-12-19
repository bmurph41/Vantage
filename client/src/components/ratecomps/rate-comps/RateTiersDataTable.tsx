import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Trash2, Save, X, Edit2, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { STORAGE_TYPE_LABELS, RATE_PERIOD_LABELS, RATE_UNIT_LABELS, formatRateDisplay } from "@shared/ratecomps-utils";
import type { RateTier } from "@shared/schema";

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
  rateCompId?: string;
  marinaName: string;
  onTiersUpdated?: () => void;
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
  
  const isLocalMode = !rateCompId;
  
  const [apiRows, setApiRows] = useState<TierRowData[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const rows = isLocalMode ? (localTiers || []) : apiRows;
  const setRows = isLocalMode 
    ? (newRows: TierRowData[] | ((prev: TierRowData[]) => TierRowData[])) => {
        const resolvedRows = typeof newRows === 'function' ? newRows(localTiers || []) : newRows;
        onLocalTiersChange?.(resolvedRows);
      }
    : setApiRows;

  const { data: tiers, isLoading } = useQuery<RateTier[]>({
    queryKey: [`/api/rate-comps/${rateCompId}/tiers`],
    enabled: !!rateCompId,
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
      qc.invalidateQueries({ queryKey: [`/api/rate-comps/${rateCompId}/tiers`] });
      onTiersUpdated?.();
      toast({ title: "Rate tier created" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create rate tier", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ tierId, data }: { tierId: string; data: any }) => 
      apiRequest(`/api/rate-comps/${rateCompId}/tiers/${tierId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/rate-comps/${rateCompId}/tiers`] });
      onTiersUpdated?.();
      toast({ title: "Rate tier updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update rate tier", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (tierId: string) => 
      apiRequest(`/api/rate-comps/${rateCompId}/tiers/${tierId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/rate-comps/${rateCompId}/tiers`] });
      onTiersUpdated?.();
      toast({ title: "Rate tier deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete rate tier", description: error.message, variant: "destructive" });
    },
  });

  const handleAddRow = () => {
    const hasEditingRow = rows.some(r => r.isEditing);
    if (hasEditingRow) {
      toast({ title: "Please save or cancel the current edit first", variant: "destructive" });
      return;
    }
    setRows(prev => [{ ...EMPTY_ROW }, ...prev]);
  };

  const handleRowChange = (index: number, field: keyof TierRowData, value: any) => {
    setRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const handleSaveRow = async (index: number) => {
    const row = rows[index];
    const tierData = rowDataToTier(row);
    
    if (isLocalMode) {
      setRows(prev => prev.map((r, i) => 
        i === index ? { ...r, isEditing: false, isNew: false } : r
      ));
      return;
    }

    if (row.isNew) {
      await createMutation.mutateAsync(tierData);
    } else if (row.id) {
      await updateMutation.mutateAsync({ tierId: row.id, data: tierData });
    }
    setEditingId(null);
  };

  const handleCancelEdit = (index: number) => {
    const row = rows[index];
    if (row.isNew) {
      setRows(prev => prev.filter((_, i) => i !== index));
    } else {
      if (tiers && !isLocalMode) {
        const originalTier = tiers.find(t => t.id === row.id);
        if (originalTier) {
          setRows(prev => prev.map((r, i) => i === index ? tierToRowData(originalTier) : r));
        }
      }
    }
    setEditingId(null);
  };

  const handleEditRow = (index: number) => {
    const row = rows[index];
    if (row.id) setEditingId(row.id);
    setRows(prev => prev.map((r, i) => i === index ? { ...r, isEditing: true } : r));
  };

  const handleDeleteRow = async (index: number) => {
    const row = rows[index];
    if (isLocalMode) {
      setRows(prev => prev.filter((_, i) => i !== index));
      return;
    }
    if (row.id) {
      await deleteMutation.mutateAsync(row.id);
    }
  };

  const formatSizeDisplay = (row: TierRowData) => {
    if (row.sizeBasis === 'any') return 'Any size';
    if (row.loaMin && row.loaMax) return `${row.loaMin}' - ${row.loaMax}'`;
    if (row.loaMin) return `${row.loaMin}'+`;
    return '-';
  };

  if (isLoading && !isLocalMode) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;
  const currentRates = rows.filter(r => r.isCurrentRate && !r.isEditing);
  const historicalRates = rows.filter(r => !r.isCurrentRate && !r.isEditing);
  const editingRows = rows.filter(r => r.isEditing);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLocalMode 
            ? "Add pricing tiers (saved with comp)"
            : `${rows.length} rate${rows.length !== 1 ? 's' : ''} configured`
          }
        </p>
        <Button onClick={handleAddRow} size="sm" data-testid="button-add-tier">
          <Plus className="h-4 w-4 mr-1" />
          Add Rate
        </Button>
      </div>

      {/* Editing Form - Card Based */}
      {editingRows.map((row) => {
        const index = rows.findIndex(r => r === row);
        return (
          <Card key={row.id || `new-${index}`} className="border-primary/50 bg-muted/30" data-testid={`tier-edit-${index}`}>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Storage Type</Label>
                  <Select value={row.storageType} onValueChange={(v) => handleRowChange(index, 'storageType', v)}>
                    <SelectTrigger data-testid={`select-storage-type-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STORAGE_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Size Basis</Label>
                  <Select value={row.sizeBasis} onValueChange={(v) => handleRowChange(index, 'sizeBasis', v)}>
                    <SelectTrigger data-testid={`select-size-basis-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="loa_range">LOA Range</SelectItem>
                      <SelectItem value="exact_loa">Exact LOA</SelectItem>
                      <SelectItem value="any">Any Size</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {row.sizeBasis !== 'any' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">
                      {row.sizeBasis === 'loa_range' ? 'Min LOA (ft)' : 'LOA (ft)'}
                    </Label>
                    <Input
                      type="number"
                      value={row.loaMin}
                      onChange={(e) => handleRowChange(index, 'loaMin', e.target.value)}
                      placeholder="e.g., 20"
                      data-testid={`input-loa-min-${index}`}
                    />
                  </div>
                  {row.sizeBasis === 'loa_range' && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Max LOA (ft)</Label>
                      <Input
                        type="number"
                        value={row.loaMax}
                        onChange={(e) => handleRowChange(index, 'loaMax', e.target.value)}
                        placeholder="e.g., 40"
                        data-testid={`input-loa-max-${index}`}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Rate ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={row.amountCents}
                    onChange={(e) => handleRowChange(index, 'amountCents', e.target.value)}
                    placeholder="0.00"
                    data-testid={`input-amount-${index}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Unit</Label>
                  <Select value={row.rateUnit} onValueChange={(v) => handleRowChange(index, 'rateUnit', v)}>
                    <SelectTrigger data-testid={`select-rate-unit-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RATE_UNIT_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Period</Label>
                  <Select value={row.ratePeriod} onValueChange={(v) => handleRowChange(index, 'ratePeriod', v)}>
                    <SelectTrigger data-testid={`select-rate-period-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RATE_PERIOD_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Year</Label>
                  <Input
                    type="number"
                    value={row.rateYear}
                    onChange={(e) => handleRowChange(index, 'rateYear', e.target.value)}
                    placeholder={new Date().getFullYear().toString()}
                    data-testid={`input-year-${index}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                  <Select
                    value={row.isCurrentRate ? 'current' : 'historical'}
                    onValueChange={(v) => handleRowChange(index, 'isCurrentRate', v === 'current')}
                  >
                    <SelectTrigger data-testid={`select-status-${index}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Current Rate</SelectItem>
                      <SelectItem value="historical">Historical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancelEdit(index)}
                  data-testid={`button-cancel-tier-${index}`}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSaveRow(index)}
                  disabled={isPending}
                  data-testid={`button-save-tier-${index}`}
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Save Rate
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Display Current Rates */}
      {currentRates.length > 0 && (
        <div className="space-y-2">
          {editingRows.length > 0 && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Rates</p>}
          <div className="space-y-2">
            {currentRates.map((row) => {
              const index = rows.findIndex(r => r === row);
              return (
                <div
                  key={row.id || `row-${index}`}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  data-testid={`tier-row-${row.id || index}`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="outline" className="font-medium">
                        {STORAGE_TYPE_LABELS[row.storageType] || row.storageType}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatSizeDisplay(row)}
                    </div>
                    <div className="text-sm font-semibold">
                      {row.amountCents ? formatRateDisplay(parseFloat(row.amountCents) * 100, row.rateUnit, row.ratePeriod) : '-'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.rateYear}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
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
                        <Button variant="ghost" size="sm" disabled={isPending} data-testid={`button-delete-tier-${index}`}>
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
                          <AlertDialogAction onClick={() => handleDeleteRow(index)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Display Historical Rates */}
      {historicalRates.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Historical Rates</p>
          <div className="space-y-2">
            {historicalRates.map((row) => {
              const index = rows.findIndex(r => r === row);
              return (
                <div
                  key={row.id || `row-${index}`}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors opacity-75"
                  data-testid={`tier-row-${row.id || index}`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="secondary" className="font-medium">
                        {STORAGE_TYPE_LABELS[row.storageType] || row.storageType}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatSizeDisplay(row)}
                    </div>
                    <div className="text-sm font-medium">
                      {row.amountCents ? formatRateDisplay(parseFloat(row.amountCents) * 100, row.rateUnit, row.ratePeriod) : '-'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.rateYear}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
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
                        <Button variant="ghost" size="sm" disabled={isPending} data-testid={`button-delete-tier-${index}`}>
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
                          <AlertDialogAction onClick={() => handleDeleteRow(index)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {rows.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
          <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No rate tiers yet</p>
          <p className="text-xs">Click "Add Rate" to create your first pricing tier</p>
        </div>
      )}

      {/* Summary Footer */}
      {rows.length > 0 && !editingRows.length && (
        <p className="text-xs text-muted-foreground">
          {currentRates.length} current rate{currentRates.length !== 1 ? 's' : ''}
          {historicalRates.length > 0 && `, ${historicalRates.length} historical`}
        </p>
      )}
    </div>
  );
}
