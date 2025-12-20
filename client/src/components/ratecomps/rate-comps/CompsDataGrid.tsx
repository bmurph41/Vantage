import { useState, useEffect, useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronUp, 
  ChevronDown, 
  Eye, 
  Edit, 
  Trash2, 
  MoreHorizontal
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatCurrency } from '@/lib/ratecomps/format';
import CreateEditCompDialog from "./CreateEditCompDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import type { RateComp } from "@shared/schema";
import { STORAGE_TYPE_LABELS } from "@shared/ratecomps-utils";

interface CompsDataGridProps {
  data: RateComp[];
  loading: boolean;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  total: number;
  canDelete?: boolean;
  canAddToProject?: boolean;
  columnFilters: Record<string, string[]>;
  onColumnFilterChange: (column: string, excludedValues: string[]) => void;
  columnUniqueValues: Record<string, string[]>;
  isEditMode?: boolean;
  onCellChange?: (compId: string, field: string, value: any) => void;
  onCompUpdate?: (updatedComp: RateComp) => void;
  onCompClick?: (comp: RateComp) => void;
}


export default function CompsDataGrid({
  data,
  loading,
  sortBy,
  sortDir,
  onSort,
  selectedIds,
  onSelectionChange,
  total,
  canDelete = false,
  columnFilters,
  onColumnFilterChange,
  columnUniqueValues,
  onCompClick,
}: CompsDataGridProps) {
  const [editingComp, setEditingComp] = useState<RateComp | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const defaultColumns = [
    { key: 'marina', label: 'Marina', width: 280, sortable: true },
    { key: 'location', label: 'Location', width: 180, sortable: true },
    { key: 'rateSummary', label: 'Rates', width: 400, sortable: false },
    { key: 'actions', label: '', width: 80, sortable: false },
  ];

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 52,
    overscan: 5,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/rate-comps/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rate-comps'] });
      toast({ title: "Success", description: "Rate comp deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete rate comp", variant: "destructive" });
    },
  });

  const buildRateSummary = (comp: RateComp & { tiers?: any[]; tierCount?: number }) => {
    const tiers = (comp as any).tiers || [];
    const tierCount = (comp as any).tierCount || 0;
    
    // If no tiers, fall back to legacy comp fields
    if (tierCount === 0 && tiers.length === 0) {
      // Check for legacy rate fields
      if (comp.rateAmount || comp.storageType) {
        const storageType = comp.storageType || 'unknown';
        const rateAmount = comp.rateAmount ? Number(comp.rateAmount) / 100 : null;
        
        return {
          hasRates: !!rateAmount || !!storageType,
          storageGroups: [{
            storageType,
            label: STORAGE_TYPE_LABELS[storageType as keyof typeof STORAGE_TYPE_LABELS] || storageType,
            tierCount: 1,
            minPricePerFoot: null,
            maxPricePerFoot: null,
            minFlatRate: rateAmount,
            maxFlatRate: rateAmount,
            hasPerFoot: false,
            hasFlatRate: !!rateAmount,
          }],
        };
      }
      return { hasRates: false, storageGroups: [] };
    }

    const tiersByStorage: Record<string, any[]> = {};
    tiers.forEach((tier: any) => {
      const storageType = tier.storageType || 'unknown';
      if (!tiersByStorage[storageType]) {
        tiersByStorage[storageType] = [];
      }
      tiersByStorage[storageType].push(tier);
    });

    const storageGroups = Object.entries(tiersByStorage).map(([storageType, storageTiers]) => {
      const pricesPerFoot = storageTiers.map((tier: any) => {
        if (tier.rateUnit === 'per_foot' && tier.amountCents) {
          const monthlyAmount = tier.ratePeriod === 'annual' 
            ? tier.amountCents / 12 
            : tier.amountCents;
          return monthlyAmount / 100;
        }
        if (tier.amountCents && tier.loaMax) {
          const monthlyAmount = tier.ratePeriod === 'annual' 
            ? tier.amountCents / 12 
            : tier.amountCents;
          return monthlyAmount / 100 / tier.loaMax;
        }
        return null;
      }).filter((p: any) => p !== null) as number[];

      const minPrice = pricesPerFoot.length > 0 ? Math.min(...pricesPerFoot) : null;
      const maxPrice = pricesPerFoot.length > 0 ? Math.max(...pricesPerFoot) : null;
      
      const flatRates = storageTiers.filter((t: any) => t.rateUnit === 'flat').map((t: any) => (t.amountCents || 0) / 100);
      const minFlatRate = flatRates.length > 0 ? Math.min(...flatRates) : null;
      const maxFlatRate = flatRates.length > 0 ? Math.max(...flatRates) : null;

      return {
        storageType,
        label: STORAGE_TYPE_LABELS[storageType as keyof typeof STORAGE_TYPE_LABELS] || storageType,
        tierCount: storageTiers.length,
        minPricePerFoot: minPrice,
        maxPricePerFoot: maxPrice,
        minFlatRate,
        maxFlatRate,
        hasPerFoot: pricesPerFoot.length > 0,
        hasFlatRate: flatRates.length > 0,
      };
    });

    return { hasRates: true, storageGroups };
  };

  const formatCellValue = (comp: RateComp & { tiers?: any[]; tierCount?: number }, column: string) => {
    const tiers = (comp as any).tiers || [];
    const tierCount = (comp as any).tierCount || 0;

    switch (column) {
      case 'marina':
        return (
          <div className="flex items-center gap-2">
            <span 
              className="truncate font-medium text-primary cursor-pointer hover:underline"
              onClick={() => onCompClick?.(comp)}
              data-testid={`link-marina-${comp.id}`}
            >
              {comp.marina || '—'}
            </span>
            {tierCount > 0 && (
              <Badge variant="secondary" className="text-xs shrink-0">
                {tierCount} {tierCount === 1 ? 'rate' : 'rates'}
              </Badge>
            )}
          </div>
        );

      case 'location':
        const city = comp.city || '';
        const state = comp.state || '';
        const location = [city, state].filter(Boolean).join(', ');
        return <span className="truncate text-muted-foreground">{location || '—'}</span>;

      case 'rateSummary':
        const summary = buildRateSummary(comp);
        
        if (!summary.hasRates) {
          return <span className="text-muted-foreground text-sm">No rates</span>;
        }

        return (
          <div className="flex flex-wrap gap-1.5">
            {summary.storageGroups.map((group) => {
              let rateText = '';
              if (group.hasPerFoot && group.minPricePerFoot !== null) {
                if (group.minPricePerFoot === group.maxPricePerFoot) {
                  rateText = `$${group.minPricePerFoot.toFixed(2)}/ft/mo`;
                } else {
                  rateText = `$${group.minPricePerFoot!.toFixed(2)}-$${group.maxPricePerFoot!.toFixed(2)}/ft/mo`;
                }
              } else if (group.hasFlatRate && group.minFlatRate !== null) {
                if (group.minFlatRate === group.maxFlatRate) {
                  rateText = formatCurrency(group.minFlatRate);
                } else {
                  rateText = `${formatCurrency(group.minFlatRate!)}-${formatCurrency(group.maxFlatRate!)}`;
                }
              }

              return (
                <div 
                  key={group.storageType}
                  className="inline-flex items-center gap-1.5 bg-muted/60 rounded-md px-2 py-1 text-xs"
                >
                  <span className="font-medium">{group.label}</span>
                  {group.tierCount > 1 && (
                    <span className="text-muted-foreground">({group.tierCount})</span>
                  )}
                  {rateText && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-foreground">{rateText}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        );
      
      default:
        return '—';
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(data.map(comp => comp.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectRow = (compId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, compId]);
    } else {
      onSelectionChange(selectedIds.filter(id => id !== compId));
    }
  };

  const handleDelete = (comp: RateComp) => {
    if (window.confirm(`Are you sure you want to delete "${comp.marina}"?`)) {
      deleteMutation.mutate(comp.id);
    }
  };

  const totalWidth = defaultColumns.reduce((sum, col) => sum + col.width, 0) + 50;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div 
        ref={tableContainerRef}
        className="flex-1 overflow-auto"
      >
        <div style={{ minWidth: `${totalWidth}px` }}>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="w-[50px] bg-muted">
                  <Checkbox
                    checked={selectedIds.length === data.length && data.length > 0}
                    onCheckedChange={handleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                </TableHead>
                {defaultColumns.map((column) => (
                  <TableHead 
                    key={column.key}
                    className="bg-muted text-left"
                    style={{ 
                      width: `${column.width}px`,
                      minWidth: `${column.width}px`,
                    }}
                    data-testid={`header-${column.key}`}
                  >
                    {column.sortable ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => onSort(column.key)}
                        data-testid={`sort-${column.key}`}
                      >
                        <span className="truncate">{column.label}</span>
                        {sortBy === column.key && (
                          sortDir === 'asc' ? 
                          <ChevronUp className="ml-1 h-3 w-3 flex-shrink-0" /> :
                          <ChevronDown className="ml-1 h-3 w-3 flex-shrink-0" />
                        )}
                      </Button>
                    ) : (
                      <span className="font-semibold truncate">{column.label}</span>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={defaultColumns.length + 1} className="text-center py-8">
                    <div className="text-muted-foreground">
                      <p className="text-lg mb-2">No rate comps found</p>
                      <p className="text-sm">Try adjusting your filters or add some rate data to get started</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr style={{ height: `${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px` }} />
                  )}
                  
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const comp = data[virtualRow.index];
                    
                    return (
                      <TableRow 
                        key={comp.id}
                        className={`border-b border-border/50 hover:bg-muted/50 ${
                          selectedIds.includes(comp.id) ? 'bg-primary/10' : ''
                        }`}
                        data-testid={`row-comp-${comp.id}`}
                      >
                        <TableCell className="w-[50px]">
                          <Checkbox
                            checked={selectedIds.includes(comp.id)}
                            onCheckedChange={(checked) => handleSelectRow(comp.id, checked as boolean)}
                            data-testid={`checkbox-row-${comp.id}`}
                          />
                        </TableCell>
                        
                        {defaultColumns.map((column) => (
                          <TableCell 
                            key={column.key}
                            className={`whitespace-nowrap ${
                              column.key === 'electricIncluded' ? 'text-center' : 'text-left'
                            }`}
                            style={{ 
                              width: `${column.width}px`,
                              minWidth: `${column.width}px`,
                            }}
                            data-testid={`cell-${column.key}-${comp.id}`}
                          >
                            {column.key === 'actions' ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => onCompClick?.(comp)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setEditingComp(comp);
                                    setShowEditDialog(true);
                                  }}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  {canDelete && (
                                    <DropdownMenuItem 
                                      onClick={() => handleDelete(comp)}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              formatCellValue(comp, column.key)
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                  
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr style={{ 
                      height: `${rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end ?? 0)}px` 
                    }} />
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <CreateEditCompDialog
        open={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setEditingComp(null);
        }}
        comp={editingComp || undefined}
        onUpdate={() => {
          setShowEditDialog(false);
          setEditingComp(null);
          queryClient.invalidateQueries({ queryKey: ['/api/rate-comps'] });
        }}
      />
    </div>
  );
}
