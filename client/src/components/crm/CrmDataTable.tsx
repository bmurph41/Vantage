import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  FileX, ArrowUp, ArrowDown, ArrowUpDown, Columns3,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  AlignJustify, AlignLeft, Download, Trash2, Tag, MoreHorizontal,
  Search,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Types ───────────────────────────────────────────────────────────

export interface CrmColumn<T> {
  key: string;
  header: string;
  width?: string;
  render: (item: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (item: T) => string | number | Date | null | undefined;
  defaultVisible?: boolean;
  /** If true, show a text input when in inline-edit mode */
  editable?: boolean;
  editKey?: string;
  editType?: 'text' | 'number' | 'select';
  editOptions?: { value: string; label: string }[];
}

export type SortDirection = "asc" | "desc" | null;
type RowDensity = "compact" | "default" | "comfortable";

interface SortState {
  key: string;
  direction: SortDirection;
}

interface CrmDataTableProps<T> {
  data: T[];
  columns: CrmColumn<T>[];
  isLoading?: boolean;
  selectedId?: string | null;
  onRowClick?: (item: T) => void;
  getRowId: (item: T) => string;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  emptyState?: {
    title: string;
    description?: string;
    action?: { label: string; onClick: () => void };
  };
  className?: string;
  enableColumnToggle?: boolean;
  enablePagination?: boolean;
  enableDensityToggle?: boolean;
  enableSearch?: boolean;
  pageSize?: number;
  /** Called for bulk actions on selected rows */
  onBulkAction?: (action: string, ids: string[]) => void;
  /** Additional bulk action items */
  bulkActions?: { key: string; label: string; icon?: React.ReactNode; variant?: 'destructive' | 'default' }[];
}

// ─── Component ───────────────────────────────────────────────────────

export function CrmDataTable<T>({
  data,
  columns,
  isLoading,
  selectedId,
  onRowClick,
  getRowId,
  selectedIds,
  onSelectionChange,
  emptyState,
  className,
  enableColumnToggle = true,
  enablePagination = true,
  enableDensityToggle = true,
  enableSearch = false,
  pageSize: initialPageSize = 25,
  onBulkAction,
  bulkActions = [],
}: CrmDataTableProps<T>) {
  const showCheckboxes = selectedIds !== undefined && onSelectionChange !== undefined;
  const [sort, setSort] = useState<SortState>({ key: "", direction: null });
  const [density, setDensity] = useState<RowDensity>("default");
  const [page, setPage] = useState(0);
  const [pageSizeState, setPageSizeState] = useState(initialPageSize);
  const [searchTerm, setSearchTerm] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    const hidden = new Set<string>();
    columns.forEach(col => {
      if (col.defaultVisible === false) hidden.add(col.key);
    });
    return hidden;
  });

  const allSelected = data.length > 0 && data.every(item => selectedIds?.has(getRowId(item)));
  const someSelected = data.some(item => selectedIds?.has(getRowId(item)));
  const selectionCount = selectedIds?.size || 0;

  const visibleColumns = useMemo(
    () => columns.filter(col => !hiddenColumns.has(col.key)),
    [columns, hiddenColumns]
  );

  // ── Sort ──
  const handleSort = useCallback((key: string, sortable?: boolean) => {
    if (!sortable) return;
    setSort(prev => {
      if (prev.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" };
        if (prev.direction === "desc") return { key: "", direction: null };
      }
      return { key, direction: "asc" };
    });
    setPage(0);
  }, []);

  const sortedData = useMemo(() => {
    if (!sort.key || !sort.direction) return data;
    const col = columns.find(c => c.key === sort.key);
    if (!col) return data;
    return [...data].sort((a, b) => {
      let aVal: any, bVal: any;
      if (col.sortValue) { aVal = col.sortValue(a); bVal = col.sortValue(b); }
      else {
        const aR = col.render(a); const bR = col.render(b);
        aVal = typeof aR === 'object' ? '' : aR;
        bVal = typeof bR === 'object' ? '' : bR;
      }
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sort.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      if (aVal instanceof Date && bVal instanceof Date) {
        return sort.direction === "asc" ? aVal.getTime() - bVal.getTime() : bVal.getTime() - aVal.getTime();
      }
      const cmp = String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase());
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [data, sort, columns]);

  // ── Pagination ──
  const totalPages = enablePagination ? Math.ceil(sortedData.length / pageSizeState) : 1;
  const paginatedData = enablePagination
    ? sortedData.slice(page * pageSizeState, (page + 1) * pageSizeState)
    : sortedData;

  // ── Selection ──
  const handleSelectAll = (checked: boolean | "indeterminate") => {
    if (!onSelectionChange) return;
    if (checked === true) {
      onSelectionChange(new Set(paginatedData.map(getRowId)));
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean | "indeterminate") => {
    if (!onSelectionChange || !selectedIds) return;
    const newSet = new Set(selectedIds);
    if (checked === true) newSet.add(id); else newSet.delete(id);
    onSelectionChange(newSet);
  };

  const toggleColumn = (key: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else { if (visibleColumns.length <= 2) return prev; next.add(key); }
      return next;
    });
  };

  // ── Density ──
  const densityPy = density === "compact" ? "py-1.5" : density === "comfortable" ? "py-4" : "py-2.5";
  const densityText = density === "compact" ? "text-xs" : "text-sm";

  const SortIcon = ({ columnKey, sortable }: { columnKey: string; sortable?: boolean }) => {
    if (!sortable) return null;
    if (sort.key === columnKey && sort.direction === "asc") return <ArrowUp className="h-3 w-3 ml-1 inline-block text-foreground" />;
    if (sort.key === columnKey && sort.direction === "desc") return <ArrowDown className="h-3 w-3 ml-1 inline-block text-foreground" />;
    return <ArrowUpDown className="h-3 w-3 ml-1 inline-block opacity-0 group-hover:opacity-40 transition-opacity" />;
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className={cn("bg-white dark:bg-gray-950", className)}>
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b">
            <tr>
              {showCheckboxes && <th className="w-10 px-3 py-2.5" />}
              {visibleColumns.map(col => (
                <th key={col.key} className={cn("px-3 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wide", col.width)}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {showCheckboxes && <td className="px-3 py-2.5"><Skeleton className="h-4 w-4" /></td>}
                {visibleColumns.map(col => (
                  <td key={col.key} className="px-3 py-2.5"><Skeleton className="h-4 w-full max-w-[180px]" /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Empty ──
  if (data.length === 0 && emptyState) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-16 px-4", className)}>
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <FileX className="h-7 w-7 text-gray-400" />
        </div>
        <h3 className="text-base font-medium text-gray-900 mb-1">{emptyState.title}</h3>
        {emptyState.description && <p className="text-sm text-gray-500 text-center max-w-sm mb-3">{emptyState.description}</p>}
        {emptyState.action && <Button onClick={emptyState.action.onClick} size="sm">{emptyState.action.label}</Button>}
      </div>
    );
  }

  return (
    <div className={cn("bg-white dark:bg-gray-950 flex flex-col", className)}>
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Bulk action bar */}
          {selectionCount > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-1">
              <span className="text-xs font-medium text-blue-700">{selectionCount} selected</span>
              {onBulkAction && (
                <>
                  {bulkActions.map(action => (
                    <Button
                      key={action.key}
                      variant="ghost"
                      size="sm"
                      className={cn("h-6 text-[11px] px-2", action.variant === 'destructive' ? 'text-red-600 hover:bg-red-50' : 'text-blue-600')}
                      onClick={() => onBulkAction(action.key, Array.from(selectedIds || []))}
                    >
                      {action.icon}
                      {action.label}
                    </Button>
                  ))}
                </>
              )}
              <Button
                variant="ghost" size="sm"
                className="h-6 text-[11px] px-2 text-gray-500"
                onClick={() => onSelectionChange?.(new Set())}
              >
                Clear
              </Button>
            </div>
          )}

          {enableSearch && (
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <Input
                placeholder="Filter rows..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                className="h-7 text-xs pl-8"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Density toggle */}
          {enableDensityToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
                  <AlignJustify className="h-3.5 w-3.5" />
                  Density
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {(["compact", "default", "comfortable"] as RowDensity[]).map(d => (
                  <DropdownMenuItem key={d} onClick={() => setDensity(d)}
                    className={cn("text-xs capitalize", density === d && "bg-blue-50")}>
                    {d}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Column toggle */}
          {enableColumnToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
                  <Columns3 className="h-3.5 w-3.5" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-[10px]">Toggle columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.map(col => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={!hiddenColumns.has(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                    className="text-xs"
                  >
                    {col.header}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <tr>
              {showCheckboxes && (
                <th className="w-10 px-3 py-2">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </th>
              )}
              {visibleColumns.map(col => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-2 text-left text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide group",
                    col.width,
                    col.sortable && "cursor-pointer select-none hover:text-gray-700 transition-colors"
                  )}
                  onClick={() => handleSort(col.key, col.sortable)}
                >
                  <span className="inline-flex items-center">
                    {col.header}
                    <SortIcon columnKey={col.key} sortable={col.sortable} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
            {paginatedData.map(item => {
              const id = getRowId(item);
              const isSelected = selectedId === id;
              const isChecked = selectedIds?.has(id) ?? false;
              return (
                <tr
                  key={id}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    "transition-colors cursor-pointer",
                    isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-50",
                    isChecked && "bg-blue-50/50"
                  )}
                >
                  {showCheckboxes && (
                    <td className={cn("px-3", densityPy)} onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => handleSelectRow(id, checked === true)}
                      />
                    </td>
                  )}
                  {visibleColumns.map(col => (
                    <td key={col.key} className={cn("px-3", densityPy, densityText, col.width)}>
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {enablePagination && sortedData.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {page * pageSizeState + 1}–{Math.min((page + 1) * pageSizeState, sortedData.length)} of {sortedData.length}
            </span>
            <Select value={String(pageSizeState)} onValueChange={(v) => { setPageSizeState(Number(v)); setPage(0); }}>
              <SelectTrigger className="h-7 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map(ps => (
                  <SelectItem key={ps} value={String(ps)} className="text-xs">{ps} / page</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(0)}>
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-gray-600 px-2 min-w-[60px] text-center">
              Page {page + 1} of {totalPages}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
