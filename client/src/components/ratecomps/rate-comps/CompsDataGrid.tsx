import { useState, useRef, useCallback, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronRight,
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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const toggleRowExpanded = useCallback((compId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(compId)) {
        next.delete(compId);
      } else {
        next.add(compId);
      }
      return next;
    });
  }, []);

  const defaultColumns = [
    { key: 'marina', label: 'Marina', width: 280, sortable: true },
    { key: 'location', label: 'Location', width: 180, sortable: true },
    { key: 'rateSummary', label: 'Rates', width: 400, sortable: false },
    { key: 'actions', label: '', width: 80, sortable: false },
  ];

  const getRowHeight = useCallback((index: number) => {
    const comp = data[index];
    if (!comp) return 52;
    if (expandedRows.has(comp.id)) {
      const tiers = (comp as any).tiers || [];
      const tiersByStorage: Record<string, any[]> = {};
      tiers.forEach((tier: any) => {
        const storageType = tier.storageType || 'unknown';
        if (!tiersByStorage[storageType]) tiersByStorage[storageType] = [];
        tiersByStorage[storageType].push(tier);
      });
      const storageTypeCount = Object.keys(tiersByStorage).length || 1;
      return 52 + (storageTypeCount * 24) + 16;
    }
    return 52;
  }, [data, expandedRows]);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: getRowHeight,
    overscan: 5,
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [expandedRows, rowVirtualizer]);

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
      if (comp.rateAmount || comp.storageType) {
        const storageType = comp.storageType || 'unknown';
        const rateAmount = comp.rateAmount ? Number(comp.rateAmount) / 100 : null;
        
        return {
          hasRates: !!rateAmount || !!storageType,
          totalStorageTypes: 1,
          totalRates: 1,
          overallMin: rateAmount,
          overallMax: rateAmount,
          hasUndated: true,
          years: [],
          storageGroups: [{
            storageType,
            label: STORAGE_TYPE_LABELS[storageType as keyof typeof STORAGE_TYPE_LABELS] || storageType,
            tierCount: 1,
            minRate: rateAmount,
            maxRate: rateAmount,
            rateText: rateAmount ? formatCurrency(rateAmount) : null,
          }],
        };
      }
      return { hasRates: false, totalStorageTypes: 0, totalRates: 0, overallMin: null, overallMax: null, hasUndated: false, years: [], storageGroups: [] };
    }

    const tiersByStorage: Record<string, any[]> = {};
    const allRates: number[] = [];
    const yearsSet = new Set<number>();
    let hasUndated = false;

    tiers.forEach((tier: any) => {
      const storageType = tier.storageType || 'unknown';
      if (!tiersByStorage[storageType]) {
        tiersByStorage[storageType] = [];
      }
      tiersByStorage[storageType].push(tier);

      // Track years
      if (tier.effectiveDate) {
        const year = new Date(tier.effectiveDate).getFullYear();
        if (!isNaN(year)) yearsSet.add(year);
      } else {
        hasUndated = true;
      }

      // Calculate normalized rate for overall range
      if (tier.amountCents) {
        let monthlyRate = tier.amountCents;
        if (tier.ratePeriod === 'annual') monthlyRate = tier.amountCents / 12;
        
        if (tier.rateUnit === 'per_foot') {
          allRates.push(monthlyRate / 100);
        } else if (tier.loaMax) {
          allRates.push((monthlyRate / tier.loaMax) / 100);
        } else {
          allRates.push(monthlyRate / 100);
        }
      }
    });

    const storageGroups = Object.entries(tiersByStorage).map(([storageType, storageTiers]) => {
      const rates = storageTiers.map((tier: any) => {
        if (!tier.amountCents) return null;
        let monthlyRate = tier.amountCents;
        if (tier.ratePeriod === 'annual') monthlyRate = tier.amountCents / 12;
        
        if (tier.rateUnit === 'per_foot') {
          return monthlyRate / 100;
        } else if (tier.loaMax) {
          return (monthlyRate / tier.loaMax) / 100;
        }
        return monthlyRate / 100;
      }).filter((r): r is number => r !== null);

      const minRate = rates.length > 0 ? Math.min(...rates) : null;
      const maxRate = rates.length > 0 ? Math.max(...rates) : null;
      
      let rateText = null;
      if (minRate !== null && maxRate !== null) {
        if (minRate === maxRate) {
          rateText = `$${minRate.toFixed(0)}`;
        } else {
          rateText = `$${minRate.toFixed(0)}-$${maxRate.toFixed(0)}`;
        }
      }

      return {
        storageType,
        label: STORAGE_TYPE_LABELS[storageType as keyof typeof STORAGE_TYPE_LABELS] || storageType,
        tierCount: storageTiers.length,
        minRate,
        maxRate,
        rateText,
      };
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);
    const overallMin = allRates.length > 0 ? Math.min(...allRates) : null;
    const overallMax = allRates.length > 0 ? Math.max(...allRates) : null;

    return { 
      hasRates: true, 
      totalStorageTypes: Object.keys(tiersByStorage).length,
      totalRates: tierCount,
      overallMin,
      overallMax,
      hasUndated,
      years,
      storageGroups,
    };
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
        const isExpanded = expandedRows.has(comp.id);
        
        if (!summary.hasRates) {
          return <span className="text-muted-foreground text-sm">No rates</span>;
        }

        // Build condensed summary text
        let rangeText = '';
        if (summary.overallMin !== null && summary.overallMax !== null) {
          if (summary.overallMin === summary.overallMax) {
            rangeText = `$${summary.overallMin.toFixed(0)}/ft/mo`;
          } else {
            rangeText = `$${summary.overallMin.toFixed(0)}-$${summary.overallMax.toFixed(0)}/ft/mo`;
          }
        }

        const canExpand = summary.totalRates > 0;

        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {canExpand && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleRowExpanded(comp.id);
                  }}
                  className="flex items-center justify-center w-5 h-5 rounded hover:bg-muted transition-colors"
                  data-testid={`expand-rates-${comp.id}`}
                >
                  <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {summary.totalStorageTypes} type{summary.totalStorageTypes !== 1 ? 's' : ''}
                </span>
                {rangeText && (
                  <>
                    <span className="text-border">•</span>
                    <span className="font-medium">{rangeText}</span>
                  </>
                )}
                {summary.years.length > 0 && (
                  <>
                    <span className="text-border">•</span>
                    <span className="text-muted-foreground text-xs">
                      {summary.years.length === 1 ? summary.years[0] : `${summary.years[summary.years.length - 1]}-${summary.years[0]}`}
                    </span>
                  </>
                )}
              </div>
            </div>
            
            {isExpanded && (
              <div className="pl-7 space-y-1 pb-1">
                {summary.storageGroups.map((group) => (
                  <div 
                    key={group.storageType}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                    <span className="font-medium text-foreground">{group.label}</span>
                    {group.tierCount > 1 && (
                      <span>({group.tierCount})</span>
                    )}
                    {group.rateText && (
                      <>
                        <span>•</span>
                        <span>{group.rateText}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
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
                            className={`${column.key === 'rateSummary' ? 'whitespace-normal py-2' : 'whitespace-nowrap'} ${
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
