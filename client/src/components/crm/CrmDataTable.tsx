import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { FileX, ArrowUp, ArrowDown, ArrowUpDown, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export interface CrmColumn<T> {
  key: string;
  header: string;
  width?: string;
  render: (item: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (item: T) => string | number | Date | null | undefined;
  defaultVisible?: boolean;
}

export type SortDirection = "asc" | "desc" | null;

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
    action?: {
      label: string;
      onClick: () => void;
    };
  };
  className?: string;
  enableColumnToggle?: boolean;
}

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
}: CrmDataTableProps<T>) {
  const showCheckboxes = selectedIds !== undefined && onSelectionChange !== undefined;
  const [sort, setSort] = useState<SortState>({ key: "", direction: null });
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    const hidden = new Set<string>();
    columns.forEach(col => {
      if (col.defaultVisible === false) hidden.add(col.key);
    });
    return hidden;
  });
  
  const allSelected = data.length > 0 && data.every(item => selectedIds?.has(getRowId(item)));
  const someSelected = data.some(item => selectedIds?.has(getRowId(item)));

  const visibleColumns = useMemo(
    () => columns.filter(col => !hiddenColumns.has(col.key)),
    [columns, hiddenColumns]
  );

  const handleSort = useCallback((key: string, sortable?: boolean) => {
    if (!sortable) return;
    setSort(prev => {
      if (prev.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" };
        if (prev.direction === "desc") return { key: "", direction: null };
      }
      return { key, direction: "asc" };
    });
  }, []);

  const sortedData = useMemo(() => {
    if (!sort.key || !sort.direction) return data;
    const col = columns.find(c => c.key === sort.key);
    if (!col) return data;

    return [...data].sort((a, b) => {
      let aVal: any, bVal: any;
      if (col.sortValue) {
        aVal = col.sortValue(a);
        bVal = col.sortValue(b);
      } else {
        const aRendered = col.render(a);
        const bRendered = col.render(b);
        aVal = typeof aRendered === 'object' ? '' : aRendered;
        bVal = typeof bRendered === 'object' ? '' : bRendered;
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

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const cmp = aStr.localeCompare(bStr);
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [data, sort, columns]);

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    if (!onSelectionChange) return;
    if (checked === true) {
      onSelectionChange(new Set(data.map(getRowId)));
    } else {
      onSelectionChange(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean | "indeterminate") => {
    if (!onSelectionChange || !selectedIds) return;
    const newSet = new Set(selectedIds);
    if (checked === true) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    onSelectionChange(newSet);
  };

  const toggleColumn = (key: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (visibleColumns.length <= 2) return prev;
        next.add(key);
      }
      return next;
    });
  };

  const SortIcon = ({ columnKey, sortable }: { columnKey: string; sortable?: boolean }) => {
    if (!sortable) return null;
    if (sort.key === columnKey && sort.direction === "asc") {
      return <ArrowUp className="h-3.5 w-3.5 ml-1 inline-block text-foreground" />;
    }
    if (sort.key === columnKey && sort.direction === "desc") {
      return <ArrowDown className="h-3.5 w-3.5 ml-1 inline-block text-foreground" />;
    }
    return <ArrowUpDown className="h-3 w-3 ml-1 inline-block opacity-0 group-hover:opacity-40 transition-opacity" />;
  };

  if (isLoading) {
    return (
      <div className={cn("bg-white dark:bg-gray-950", className)}>
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <tr>
              {showCheckboxes && <th className="w-12 px-4 py-3"></th>}
              {visibleColumns.map((col) => (
                <th 
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide",
                    col.width
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {showCheckboxes && (
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-4" />
                  </td>
                )}
                {visibleColumns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <Skeleton className="h-4 w-full max-w-[200px]" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-16 px-4", className)}>
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <FileX className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">{emptyState.title}</h3>
        {emptyState.description && (
          <p className="text-sm text-gray-500 text-center max-w-sm mb-4">{emptyState.description}</p>
        )}
        {emptyState.action && (
          <Button onClick={emptyState.action.onClick} size="sm">
            {emptyState.action.label}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn("bg-white dark:bg-gray-950 overflow-x-auto", className)}>
      {enableColumnToggle && (
        <div className="flex justify-end px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground">
                <Columns3 className="h-3.5 w-3.5" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((col) => (
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
        </div>
      )}
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <tr>
            {showCheckboxes && (
              <th className="w-12 px-4 py-3">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                  className={cn(someSelected && !allSelected && "data-[state=checked]:bg-gray-400")}
                />
              </th>
            )}
            {visibleColumns.map((col) => (
              <th 
                key={col.key}
                className={cn(
                  "px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide group",
                  col.width,
                  col.sortable && "cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
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
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {sortedData.map((item) => {
            const id = getRowId(item);
            const isSelected = selectedId === id;
            const isChecked = selectedIds?.has(id) ?? false;
            
            return (
              <tr
                key={id}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  "transition-colors cursor-pointer",
                  isSelected 
                    ? "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900" 
                    : "hover:bg-gray-50 dark:hover:bg-gray-900",
                  isChecked && "bg-blue-50/50 dark:bg-blue-950/50"
                )}
              >
                {showCheckboxes && (
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => handleSelectRow(id, checked === true)}
                      aria-label={`Select row ${id}`}
                    />
                  </td>
                )}
                {visibleColumns.map((col) => (
                  <td key={col.key} className={cn("px-4 py-3 text-sm", col.width)}>
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
