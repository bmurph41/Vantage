import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, ExternalLink, FileX } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  getRowLink?: (item: T) => string;
  emptyMessage?: string;
  isLoading?: boolean;
}

export function DataTable<T extends { id?: string | number }>({
  data,
  columns,
  onRowClick,
  getRowLink,
  emptyMessage = "No data available",
  isLoading = false,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide",
                    column.className
                  )}
                >
                  {column.header}
                </th>
              ))}
              {getRowLink && <th className="w-12 px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <Skeleton className="h-4 w-full max-w-[150px]" />
                  </td>
                ))}
                {getRowLink && (
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-4" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const safeData = Array.isArray(data) ? data : [];

  if (safeData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 border border-gray-200 rounded-lg bg-gray-50">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <FileX className="h-6 w-6 text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide",
                  column.className
                )}
              >
                <div className="flex items-center gap-1">
                  {column.header}
                  {column.sortable && (
                    <ArrowUpDown className="h-3 w-3 text-gray-400" />
                  )}
                </div>
              </th>
            ))}
            {getRowLink && <th className="w-12 px-4 py-3"></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {safeData.map((item, index) => {
            const rowLink = getRowLink?.(item);
            const clickable = onRowClick || rowLink;

            return (
              <tr
                key={item.id || index}
                className={cn(
                  "bg-white transition-colors",
                  clickable && "cursor-pointer hover:bg-gray-50"
                )}
                onClick={() => onRowClick?.(item)}
                data-testid={`table-row-${item.id || index}`}
              >
                {columns.map((column) => (
                  <td 
                    key={column.key} 
                    className={cn("px-4 py-3 text-sm", column.className)}
                  >
                    {column.render(item)}
                  </td>
                ))}
                {rowLink && (
                  <td className="px-4 py-3">
                    <Link href={rowLink}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`link-row-${item.id}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
