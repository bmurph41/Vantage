import { useState, useRef, useCallback, useEffect, Fragment, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SkeletonTableRows } from "@/components/ui/skeleton-variants";
import { EmptyState } from "@/components/ui/empty-state";
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronRight,
  Eye, 
  Edit, 
  Trash2, 
  MoreHorizontal,
  Ship
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatCurrency } from '@/lib/ratecomps/format';
import CreateEditCompDialog from "./CreateEditCompDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import type { RateComp } from "@shared/schema";
import { STORAGE_TYPE_LABELS } from "@shared/ratecomps-utils";

// Helper to get the period suffix for display
function getPeriodSuffix(ratePeriod: string): string {
  switch (ratePeriod) {
    case 'daily': return '/day';
    case 'weekly': return '/wk';
    case 'monthly': return '/mo';
    case 'seasonal': return '/season';
    case 'annual': return '/yr';
    default: return '/mo';
  }
}

// Helper to get the unit suffix for display
function getUnitSuffix(rateUnit: string): string {
  if (rateUnit === 'per_foot' || rateUnit === 'per_foot_loa') return '/ft';
  if (rateUnit === 'per_foot_beam') return '/ft';
  if (rateUnit === 'per_sf') return '/SF';
  return '';
}

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


interface MarinaGroup {
  id: string;
  marina: string;
  city: string;
  state: string;
  rates: RateComp[];
  primaryStorageType: string;
  primaryRate: string | null;
  primaryYear: number | null;
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

  const groupedData = useMemo((): MarinaGroup[] => {
    const groups: Record<string, MarinaGroup> = {};
    
    data.forEach(comp => {
      const key = comp.marina?.toLowerCase().trim() || comp.id;
      
      if (!groups[key]) {
        const storageType = comp.storageType || 'unknown';
        const storageLabel = STORAGE_TYPE_LABELS[storageType as keyof typeof STORAGE_TYPE_LABELS] || storageType;
        
        let rateText: string | null = null;
        if (comp.rateAmount) {
          const amount = Number(comp.rateAmount) / 100;
          const unit = comp.rateUnit || 'flat';
          const period = comp.ratePeriod || 'monthly';
          rateText = `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}${getUnitSuffix(unit)}${getPeriodSuffix(period)}`;
        }
        
        let year: number | null = null;
        if (comp.effectiveDate) {
          const parsed = new Date(comp.effectiveDate).getFullYear();
          if (!isNaN(parsed)) year = parsed;
        }
        
        groups[key] = {
          id: key,
          marina: comp.marina || '',
          city: comp.city || '',
          state: comp.state || '',
          rates: [],
          primaryStorageType: storageLabel,
          primaryRate: rateText,
          primaryYear: year,
        };
      }
      
      groups[key].rates.push(comp);
    });
    
    return Object.values(groups);
  }, [data]);

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
    { key: 'marina', label: 'Marina', width: 260, sortable: true },
    { key: 'location', label: 'Location', width: 160, sortable: true },
    { key: 'storageType', label: 'Storage Type', width: 120, sortable: false },
    { key: 'rate', label: 'Rate', width: 140, sortable: false },
    { key: 'year', label: 'Year', width: 70, sortable: false },
    { key: 'expand', label: '', width: 50, sortable: false },
    { key: 'actions', label: '', width: 60, sortable: false },
  ];

  const getRowHeight = useCallback((index: number) => {
    const group = groupedData[index];
    if (!group) return 48;
    if (expandedRows.has(group.id)) {
      const rateCount = group.rates.length;
      return 48 + 32 + (rateCount * 36);
    }
    return 48;
  }, [groupedData, expandedRows]);

  const rowVirtualizer = useVirtualizer({
    count: groupedData.length,
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

  const formatRateValue = (value: number): string => {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

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
          rangeText: rateAmount ? `$${formatRateValue(rateAmount)}/mo` : null,
          hasUndated: true,
          years: [],
          storageGroups: [{
            storageType,
            label: STORAGE_TYPE_LABELS[storageType as keyof typeof STORAGE_TYPE_LABELS] || storageType,
            tierCount: 1,
            rateText: rateAmount ? `$${formatRateValue(rateAmount)}/mo` : null,
          }],
        };
      }
      return { hasRates: false, totalStorageTypes: 0, totalRates: 0, rangeText: null, hasUndated: false, years: [], storageGroups: [] };
    }

    const tiersByStorage: Record<string, any[]> = {};
    const yearsSet = new Set<number>();
    let hasUndated = false;
    
    // Group rates by period AND unit type for accurate display
    type RateGroup = { amounts: number[]; unit: string; period: string };
    const rateGroups: RateGroup[] = [];
    const rateGroupMap: Record<string, RateGroup> = {};
    
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

      // Group rates by unit type and period for accurate display
      if (tier.amountCents) {
        const unit = tier.rateUnit || 'flat';
        const period = tier.ratePeriod || 'monthly';
        const amount = tier.amountCents / 100;
        const key = `${unit}|${period}`;
        
        if (!rateGroupMap[key]) {
          const group = { amounts: [], unit, period };
          rateGroupMap[key] = group;
          rateGroups.push(group);
        }
        rateGroupMap[key].amounts.push(amount);
      }
    });

    const storageGroups = Object.entries(tiersByStorage).map(([storageType, storageTiers]) => {
      // Group rates by unit+period for accurate display within this storage type
      const groupRateMap: Record<string, { amounts: number[]; unit: string; period: string }> = {};
      
      storageTiers.forEach((tier: any) => {
        if (!tier.amountCents) return;
        const unit = tier.rateUnit || 'flat';
        const period = tier.ratePeriod || 'monthly';
        const amount = tier.amountCents / 100;
        const key = `${unit}|${period}`;
        
        if (!groupRateMap[key]) {
          groupRateMap[key] = { amounts: [], unit, period };
        }
        groupRateMap[key].amounts.push(amount);
      });

      // Build rate text with each unit+period group shown separately
      const parts: string[] = [];
      
      Object.values(groupRateMap).forEach(group => {
        const unitSuffix = getUnitSuffix(group.unit);
        const periodSuffix = getPeriodSuffix(group.period);
        const minRate = Math.min(...group.amounts);
        const maxRate = Math.max(...group.amounts);
        
        if (minRate === maxRate) {
          parts.push(`$${formatRateValue(minRate)}${unitSuffix}${periodSuffix}`);
        } else {
          parts.push(`$${formatRateValue(minRate)}-$${formatRateValue(maxRate)}${unitSuffix}${periodSuffix}`);
        }
      });
      
      const rateText = parts.length > 0 ? parts.join(', ') : null;

      return {
        storageType,
        label: STORAGE_TYPE_LABELS[storageType as keyof typeof STORAGE_TYPE_LABELS] || storageType,
        tierCount: storageTiers.length,
        rateText,
      };
    });

    // Build overall range text - group by unit+period for accuracy
    const rangeParts: string[] = [];
    
    rateGroups.forEach(group => {
      const unitSuffix = getUnitSuffix(group.unit);
      const periodSuffix = getPeriodSuffix(group.period);
      const minRate = Math.min(...group.amounts);
      const maxRate = Math.max(...group.amounts);
      
      if (minRate === maxRate) {
        rangeParts.push(`$${formatRateValue(minRate)}${unitSuffix}${periodSuffix}`);
      } else {
        rangeParts.push(`$${formatRateValue(minRate)}-$${formatRateValue(maxRate)}${unitSuffix}${periodSuffix}`);
      }
    });
    
    const rangeText = rangeParts.length > 0 ? rangeParts.join(', ') : null;

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    return { 
      hasRates: true, 
      totalStorageTypes: Object.keys(tiersByStorage).length,
      totalRates: tierCount,
      rangeText,
      hasUndated,
      years,
      storageGroups,
    };
  };

  const buildGroupedRates = (comp: RateComp & { tiers?: any[] }) => {
    const tiers = (comp as any).tiers || [];
    
    // Group by storage type, then by year
    const storageGroups: Record<string, {
      label: string;
      yearGroups: Record<number | 'undated', {
        year: number | 'undated';
        rates: Array<{
          amount: number;
          unit: string;
          period: string;
          electricIncluded?: boolean;
          seasonality?: string;
        }>;
      }>;
    }> = {};

    tiers.forEach((tier: any) => {
      const storageType = tier.storageType || 'unknown';
      const storageLabel = STORAGE_TYPE_LABELS[storageType as keyof typeof STORAGE_TYPE_LABELS] || storageType;
      
      if (!storageGroups[storageType]) {
        storageGroups[storageType] = {
          label: storageLabel,
          yearGroups: {},
        };
      }

      let year: number | 'undated' = 'undated';
      if (tier.effectiveDate) {
        const parsedYear = new Date(tier.effectiveDate).getFullYear();
        if (!isNaN(parsedYear)) year = parsedYear;
      }

      if (!storageGroups[storageType].yearGroups[year]) {
        storageGroups[storageType].yearGroups[year] = {
          year,
          rates: [],
        };
      }

      if (tier.amountCents) {
        storageGroups[storageType].yearGroups[year].rates.push({
          amount: tier.amountCents / 100,
          unit: tier.rateUnit || 'flat',
          period: tier.ratePeriod || 'monthly',
          electricIncluded: tier.electricIncluded,
          seasonality: tier.seasonality,
        });
      }
    });

    // Convert to sorted arrays
    return Object.entries(storageGroups).map(([storageType, group]) => ({
      storageType,
      label: group.label,
      yearGroups: Object.values(group.yearGroups)
        .sort((a, b) => {
          if (a.year === 'undated') return 1;
          if (b.year === 'undated') return -1;
          return (b.year as number) - (a.year as number);
        }),
    }));
  };

  const formatLastUpdated = (comp: RateComp & { tiers?: any[] }) => {
    const tiers = (comp as any).tiers || [];
    let latestDate: Date | null = null;
    
    tiers.forEach((tier: any) => {
      if (tier.effectiveDate) {
        const date = new Date(tier.effectiveDate);
        if (!latestDate || date > latestDate) {
          latestDate = date;
        }
      }
    });
    
    if (latestDate) {
      return latestDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    return null;
  };

  const formatCellValue = (comp: RateComp & { tiers?: any[]; tierCount?: number }, column: string) => {
    const tiers = (comp as any).tiers || [];
    const tierCount = (comp as any).tierCount || 0;
    const summary = buildRateSummary(comp);
    const isExpanded = expandedRows.has(comp.id);

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
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                {tierCount}
              </Badge>
            )}
          </div>
        );

      case 'location':
        const city = comp.city || '';
        const state = comp.state || '';
        const location = [city, state].filter(Boolean).join(', ');
        return <span className="truncate text-muted-foreground text-sm">{location || '—'}</span>;

      case 'storageType':
        if (!summary.hasRates || summary.totalStorageTypes === 0) {
          return <span className="text-muted-foreground text-sm">—</span>;
        }
        const primaryType = summary.storageGroups[0]?.label || '—';
        return <span className="text-sm">{primaryType}</span>;

      case 'rate':
        if (!summary.rangeText) {
          return <span className="text-muted-foreground text-sm">—</span>;
        }
        return (
          <span className="font-medium text-sm">{summary.rangeText}</span>
        );

      case 'year':
        const rateYear = summary.years?.[0];
        if (!rateYear) {
          return <span className="text-muted-foreground text-sm">—</span>;
        }
        return <span className="text-sm">{rateYear}</span>;

      case 'expand':
        const canExpand = summary.hasRates && summary.totalRates > 0;
        if (!canExpand) return null;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleRowExpanded(comp.id);
            }}
            className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted transition-colors"
            data-testid={`expand-rates-${comp.id}`}
            aria-expanded={isExpanded}
          >
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
          </button>
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
      <div className="p-6">
        <SkeletonTableRows rows={8} columns={6} />
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
              {groupedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={defaultColumns.length + 1} className="h-64">
                    <EmptyState
                      icon={Ship}
                      title="No rate comps found"
                      description="Try adjusting your filters or add some rate data to get started"
                      size="sm"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr style={{ height: `${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px` }} />
                  )}
                  
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const group = groupedData[virtualRow.index];
                    const isExpanded = expandedRows.has(group.id);
                    const hasMultipleRates = group.rates.length > 1;
                    const allRateIds = group.rates.map(r => r.id);
                    const isGroupSelected = allRateIds.every(id => selectedIds.includes(id));
                    
                    return (
                      <Fragment key={group.id}>
                        <TableRow
                          className={`border-b border-border/50 hover:bg-muted/50 ${
                            isGroupSelected ? 'bg-primary/10' : ''
                          } ${isExpanded ? 'border-b-0' : ''}`}
                          data-testid={`row-marina-${group.id}`}
                        >
                          <TableCell className="w-[50px]">
                            <Checkbox
                              checked={isGroupSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  onSelectionChange([...new Set([...selectedIds, ...allRateIds])]);
                                } else {
                                  onSelectionChange(selectedIds.filter(id => !allRateIds.includes(id)));
                                }
                              }}
                              data-testid={`checkbox-row-${group.id}`}
                            />
                          </TableCell>
                          
                          <TableCell style={{ width: '260px', minWidth: '260px' }}>
                            <div className="flex items-center gap-2">
                              <span 
                                className="truncate font-medium text-primary cursor-pointer hover:underline"
                                onClick={() => onCompClick?.(group.rates[0])}
                              >
                                {group.marina || '—'}
                              </span>
                              {hasMultipleRates && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                                  {group.rates.length}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          
                          <TableCell style={{ width: '160px', minWidth: '160px' }}>
                            <span className="truncate text-muted-foreground text-sm">
                              {[group.city, group.state].filter(Boolean).join(', ') || '—'}
                            </span>
                          </TableCell>
                          
                          <TableCell style={{ width: '120px', minWidth: '120px' }}>
                            <span className="text-sm">{group.primaryStorageType || '—'}</span>
                          </TableCell>
                          
                          <TableCell style={{ width: '140px', minWidth: '140px' }}>
                            <span className="font-medium text-sm">{group.primaryRate || '—'}</span>
                          </TableCell>
                          
                          <TableCell style={{ width: '70px', minWidth: '70px' }}>
                            <span className="text-sm">{group.primaryYear || '—'}</span>
                          </TableCell>
                          
                          <TableCell style={{ width: '50px', minWidth: '50px' }} className="text-center px-2">
                            {hasMultipleRates && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRowExpanded(group.id);
                                }}
                                className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted transition-colors"
                                aria-expanded={isExpanded}
                              >
                                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>
                            )}
                          </TableCell>
                          
                          <TableCell style={{ width: '60px', minWidth: '60px' }}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onCompClick?.(group.rates[0])}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setEditingComp(group.rates[0]);
                                  setShowEditDialog(true);
                                }}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                {canDelete && (
                                  <DropdownMenuItem 
                                    onClick={() => handleDelete(group.rates[0])}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {isExpanded && hasMultipleRates && (
                          <tr key={`${group.id}-expanded`}>
                            <td colSpan={defaultColumns.length + 1} className="bg-muted/30 border-b border-border/50 p-0">
                              <div className="py-2 px-4 pl-14">
                                <div className="space-y-1">
                                  {group.rates.map((rate) => {
                                    const storageType = rate.storageType || 'unknown';
                                    const storageLabel = STORAGE_TYPE_LABELS[storageType as keyof typeof STORAGE_TYPE_LABELS] || storageType;
                                    let rateText = '—';
                                    if (rate.rateAmount) {
                                      const amount = Number(rate.rateAmount) / 100;
                                      const unit = rate.rateUnit || 'flat';
                                      const period = rate.ratePeriod || 'monthly';
                                      rateText = `$${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}${getUnitSuffix(unit)}${getPeriodSuffix(period)}`;
                                    }
                                    let year: number | string = '—';
                                    if (rate.effectiveDate) {
                                      const parsed = new Date(rate.effectiveDate).getFullYear();
                                      if (!isNaN(parsed)) year = parsed;
                                    }
                                    
                                    return (
                                      <div 
                                        key={rate.id}
                                        className="flex items-center gap-4 py-1.5 px-2 rounded hover:bg-muted/50 text-sm"
                                      >
                                        <span className="w-24 text-muted-foreground">{storageLabel}</span>
                                        <span className="w-28 font-medium">{rateText}</span>
                                        <span className="w-16 text-muted-foreground">{year}</span>
                                        <button
                                          onClick={() => {
                                            setEditingComp(rate);
                                            setShowEditDialog(true);
                                          }}
                                          className="ml-auto text-xs text-primary hover:underline"
                                        >
                                          Edit
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
