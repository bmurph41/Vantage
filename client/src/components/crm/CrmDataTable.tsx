import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { FileX } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface CrmColumn<T> {
  key: string;
  header: string;
  width?: string;
  render: (item: T) => React.ReactNode;
  sortable?: boolean;
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
}: CrmDataTableProps<T>) {
  const showCheckboxes = selectedIds !== undefined && onSelectionChange !== undefined;
  
  const allSelected = data.length > 0 && data.every(item => selectedIds?.has(getRowId(item)));
  const someSelected = data.some(item => selectedIds?.has(getRowId(item)));

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

  if (isLoading) {
    return (
      <div className={cn("bg-white", className)}>
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
            <tr>
              {showCheckboxes && <th className="w-12 px-4 py-3"></th>}
              {columns.map((col) => (
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
          <tbody className="divide-y divide-gray-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {showCheckboxes && (
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-4" />
                  </td>
                )}
                {columns.map((col) => (
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
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <FileX className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">{emptyState.title}</h3>
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
    <div className={cn("bg-white overflow-x-auto", className)}>
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
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
            {columns.map((col) => (
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
        <tbody className="divide-y divide-gray-100">
          {data.map((item) => {
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
                    ? "bg-blue-50 hover:bg-blue-100" 
                    : "hover:bg-gray-50",
                  isChecked && "bg-blue-50/50"
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
                {columns.map((col) => (
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
