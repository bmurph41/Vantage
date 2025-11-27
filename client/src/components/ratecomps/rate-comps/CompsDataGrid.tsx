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
  MoreHorizontal,
  Check,
  X
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatCurrency } from '@/lib/ratecomps/format';
import CreateEditCompDialog from "./CreateEditCompDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import type { RateComp } from "@shared/schema";

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

const STORAGE_TYPE_LABELS: Record<string, string> = {
  wet_slip: 'Wet Slip',
  dry_rack: 'Dry Rack',
  mooring: 'Mooring',
  anchorage: 'Anchorage',
  trailer: 'Trailer',
  covered: 'Covered',
  floating: 'Floating',
};

const RATE_UNIT_LABELS: Record<string, string> = {
  per_foot: '$/ft',
  per_foot_beam: '$/ft (beam)',
  flat: 'Flat',
};

const RATE_PERIOD_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  annually: 'Annual',
};

const PROTECTION_LABELS: Record<string, string> = {
  open: 'Open',
  partially_protected: 'Partial',
  fully_protected: 'Protected',
  covered: 'Covered',
};

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
    { key: 'marina', label: 'Marina', width: 250, sortable: true },
    { key: 'location', label: 'Location', width: 150, sortable: true },
    { key: 'storageType', label: 'Storage Type', width: 140, sortable: true },
    { key: 'boatSize', label: 'Boat Size', width: 130, sortable: true },
    { key: 'rateAmount', label: 'Rate', width: 120, sortable: true },
    { key: 'rateType', label: 'Rate Type', width: 120, sortable: true },
    { key: 'ratePeriod', label: 'Period', width: 100, sortable: true },
    { key: 'seasonality', label: 'Seasonality', width: 110, sortable: true },
    { key: 'electricIncluded', label: 'Electric', width: 90, sortable: true },
    { key: 'protectionLevel', label: 'Protection', width: 110, sortable: true },
    { key: 'effectiveDate', label: 'Effective Date', width: 130, sortable: true },
    { key: 'actions', label: 'Actions', width: 100, sortable: false },
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

  const formatCellValue = (comp: RateComp, column: string) => {
    switch (column) {
      case 'marina':
        return (
          <span 
            className="truncate font-medium text-primary cursor-pointer hover:underline"
            onClick={() => onCompClick?.(comp)}
          >
            {comp.marina || '—'}
          </span>
        );

      case 'location':
        const city = comp.city || '';
        const state = comp.state || '';
        const location = [city, state].filter(Boolean).join(', ');
        return <span className="truncate">{location || '—'}</span>;

      case 'storageType':
        const storageLabel = STORAGE_TYPE_LABELS[comp.storageType as string] || comp.storageType;
        return <span className="truncate">{storageLabel || '—'}</span>;

      case 'boatSize':
        const minSize = comp.boatLengthMin;
        const maxSize = comp.boatLengthMax;
        if (minSize && maxSize) {
          return <span>{minSize}-{maxSize} ft</span>;
        } else if (minSize) {
          return <span>{minSize}+ ft</span>;
        } else if (maxSize) {
          return <span>≤{maxSize} ft</span>;
        }
        return '—';

      case 'rateAmount':
        if (!comp.rateAmount) return '—';
        return formatCurrency(Number(comp.rateAmount) / 100);

      case 'rateType':
        const rateTypeLabel = RATE_UNIT_LABELS[comp.rateType as string] || comp.rateType;
        return <span>{rateTypeLabel || '—'}</span>;

      case 'ratePeriod':
        const periodLabel = RATE_PERIOD_LABELS[comp.ratePeriod as string] || comp.ratePeriod;
        return <span>{periodLabel || '—'}</span>;

      case 'seasonality':
        if (!comp.seasonality) return '—';
        return (
          <Badge variant={comp.seasonality === 'annual' ? 'default' : 'secondary'}>
            {comp.seasonality === 'annual' ? 'Annual' : comp.seasonality === 'seasonal' ? 'Seasonal' : comp.seasonality}
          </Badge>
        );

      case 'electricIncluded':
        return comp.electricIncluded ? (
          <Check className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground mx-auto" />
        );

      case 'protectionLevel':
        const protectionLabel = PROTECTION_LABELS[comp.protectionLevel as string] || comp.protectionLevel;
        return <span className="truncate">{protectionLabel || '—'}</span>;

      case 'effectiveDate':
        return <span>{comp.effectiveDate || '—'}</span>;
      
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
