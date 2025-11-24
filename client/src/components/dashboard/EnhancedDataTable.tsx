import { ReactNode, useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUp, ArrowDown, ArrowUpDown, ExternalLink, Search, X } from "lucide-react";
import { Link } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  filterKey?: string; // Key to use for filtering (defaults to 'key')
  className?: string;
}

export interface Filter {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface EnhancedDataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  getRowLink?: (item: T) => string;
  emptyMessage?: string;
  isLoading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  filters?: Filter[];
  pageSize?: number;
}

type SortConfig<T> = {
  key: string;
  direction: 'asc' | 'desc';
} | null;

export function EnhancedDataTable<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  getRowLink,
  emptyMessage = "No data available",
  isLoading = false,
  searchable = false,
  searchPlaceholder = "Search...",
  filters = [],
  pageSize = 50,
}: EnhancedDataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);

  // Sorting logic
  const handleSort = (columnKey: string) => {
    setSortConfig((current) => {
      if (current?.key === columnKey) {
        if (current.direction === 'asc') {
          return { key: columnKey, direction: 'desc' };
        }
        return null; // Remove sort
      }
      return { key: columnKey, direction: 'asc' };
    });
  };

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = [...data];

    // Apply search
    if (searchable && searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(query)
        )
      );
    }

    // Apply filters
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        filtered = filtered.filter((item) => String(item[key]) === value);
      }
    });

    // Apply sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal === bVal) return 0;
        
        const comparison = aVal < bVal ? -1 : 1;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [data, searchQuery, activeFilters, sortConfig, searchable]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize);
  const paginatedData = processedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Reset page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, activeFilters]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      {(searchable || filters.length > 0) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {searchable && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9 pr-9"
                data-testid="input-search"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  data-testid="button-clear-search"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}

          {filters.map((filter) => (
            <Select
              key={filter.key}
              value={activeFilters[filter.key] || 'all'}
              onValueChange={(value) =>
                setActiveFilters((prev) => ({ ...prev, [filter.key]: value }))
              }
            >
              <SelectTrigger className="w-full sm:w-[180px]" data-testid={`select-${filter.key}`}>
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {filter.label}</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-gray-600">
        {processedData.length === data.length ? (
          <span>{data.length} total records</span>
        ) : (
          <span>
            {processedData.length} of {data.length} records
          </span>
        )}
      </div>

      {/* Table */}
      {processedData.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border rounded-lg">
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead key={column.key} className={column.className}>
                      {column.sortable ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort(column.key)}
                          className="-ml-3 h-8 data-[state=open]:bg-accent"
                          data-testid={`sort-${column.key}`}
                        >
                          {column.header}
                          {sortConfig?.key === column.key ? (
                            sortConfig.direction === 'asc' ? (
                              <ArrowUp className="ml-2 h-3 w-3" />
                            ) : (
                              <ArrowDown className="ml-2 h-3 w-3" />
                            )
                          ) : (
                            <ArrowUpDown className="ml-2 h-3 w-3" />
                          )}
                        </Button>
                      ) : (
                        <span>{column.header}</span>
                      )}
                    </TableHead>
                  ))}
                  {getRowLink && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((item, index) => {
                  const rowLink = getRowLink?.(item);
                  const clickable = onRowClick || rowLink;

                  return (
                    <TableRow
                      key={item.id || index}
                      className={clickable ? "cursor-pointer hover:bg-gray-50" : ""}
                      onClick={() => onRowClick?.(item)}
                      data-testid={`table-row-${item.id || index}`}
                    >
                      {columns.map((column) => (
                        <TableCell key={column.key} className={column.className}>
                          {column.render(item)}
                        </TableCell>
                      ))}
                      {rowLink && (
                        <TableCell>
                          <Link href={rowLink}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`link-row-${item.id}`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
