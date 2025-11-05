import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => ReactNode);
  className?: string;
  mobileLabel?: string;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  className?: string;
  mobileCardClassName?: string;
}

export function ResponsiveTable<T>({
  data,
  columns,
  onRowClick,
  keyExtractor,
  emptyMessage = "No data available",
  className,
  mobileCardClassName,
}: ResponsiveTableProps<T>) {
  const getCellValue = (row: T, column: Column<T>) => {
    if (typeof column.accessor === "function") {
      return column.accessor(row);
    }
    return row[column.accessor] as ReactNode;
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className={cn("w-full", className)}>
          <thead className="bg-gray-50 border-b">
            <tr>
              {columns.map((column, idx) => (
                <th
                  key={idx}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                    column.className
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "hover:bg-gray-50 transition-colors",
                  onRowClick && "cursor-pointer"
                )}
              >
                {columns.map((column, idx) => (
                  <td
                    key={idx}
                    className={cn(
                      "px-4 py-4 whitespace-nowrap text-sm text-gray-900",
                      column.className
                    )}
                  >
                    {getCellValue(row, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {data.map((row) => (
          <Card
            key={keyExtractor(row)}
            onClick={() => onRowClick?.(row)}
            className={cn(
              "p-4",
              onRowClick && "cursor-pointer hover:bg-gray-50",
              mobileCardClassName
            )}
          >
            <div className="space-y-3">
              {columns.map((column, idx) => {
                const value = getCellValue(row, column);
                if (!value) return null;
                
                return (
                  <div key={idx} className="flex justify-between items-start">
                    <span className="text-sm font-medium text-gray-500 mr-2">
                      {column.mobileLabel || column.header}:
                    </span>
                    <span className="text-sm text-gray-900 text-right flex-1">
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
