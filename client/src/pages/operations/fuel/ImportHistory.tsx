import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  useReactTable, 
  getCoreRowModel, 
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState
} from "@tanstack/react-table";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { Loader, Eye, Download, CheckCircle, XCircle, AlertCircle, Clock, Loader2 } from "lucide-react";
import type { FuelImportLog } from "@shared/schema";

type ImportStats = {
  totalImports: number;
  successRate: number;
  totalRecordsImported: number;
  latestSyncStatus: string | null;
  latestSyncTime: string | null;
};

const STATUS_CONFIG = {
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: CheckCircle },
  partial: { label: 'Partial', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: AlertCircle },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: XCircle },
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: Loader2 },
};

export default function ImportHistory() {
  const [selectedLog, setSelectedLog] = useState<FuelImportLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dateRange, setDateRange] = useState('30');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Calculate date range
  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    
    if (dateRange === '7') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (dateRange === '30') {
      startDate.setDate(startDate.getDate() - 30);
    } else if (dateRange === '90') {
      startDate.setDate(startDate.getDate() - 90);
    } else {
      return {};
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  };

  const queryParams = new URLSearchParams({
    ...getDateRange(),
    ...(sourceFilter !== 'all' && { source: sourceFilter }),
    ...(statusFilter !== 'all' && { status: statusFilter }),
    limit: '100',
  }).toString();

  const { data: logs = [], isLoading } = useQuery<FuelImportLog[]>({
    queryKey: ['/api/operations/fuel-import-logs', queryParams],
    queryFn: async () => {
      const response = await fetch(`/api/operations/fuel-import-logs?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch import logs');
      return response.json();
    },
  });

  const { data: stats } = useQuery<ImportStats>({
    queryKey: ['/api/operations/fuel-import-logs/stats'],
  });

  const handleViewDetails = async (log: FuelImportLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  const handleDownloadErrorLog = () => {
    if (!selectedLog || !selectedLog.errorLog) return;
    
    const errors = Array.isArray(selectedLog.errorLog) ? selectedLog.errorLog : [];
    const csv = ['Error'].concat(errors).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${selectedLog.id}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleClearFilters = () => {
    setDateRange('30');
    setSourceFilter('all');
    setStatusFilter('all');
  };

  const columns: ColumnDef<FuelImportLog>[] = [
    {
      accessorKey: 'startedAt',
      header: 'Timestamp',
      cell: ({ row }) => (
        <span className="text-sm" data-testid={`log-timestamp-${row.index}`}>
          {format(new Date(row.original.startedAt), "MMM dd, yyyy h:mm a")}
        </span>
      ),
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) => (
        <span className="text-sm font-medium" data-testid={`log-source-${row.index}`}>
          {row.original.source}
        </span>
      ),
    },
    {
      accessorKey: 'importType',
      header: 'Import Type',
      cell: ({ row }) => (
        <span className="text-sm" data-testid={`log-type-${row.index}`}>
          {row.original.importType}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status as keyof typeof STATUS_CONFIG;
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
        const Icon = config.icon;
        
        return (
          <Badge className={config.color} data-testid={`log-status-${row.index}`}>
            <Icon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'recordsProcessed',
      header: 'Processed',
      cell: ({ row }) => (
        <span className="text-sm" data-testid={`log-processed-${row.index}`}>
          {row.original.recordsProcessed || 0}
        </span>
      ),
    },
    {
      accessorKey: 'recordsImported',
      header: 'Imported',
      cell: ({ row }) => (
        <span className="text-sm text-green-600 dark:text-green-400 font-medium" data-testid={`log-imported-${row.index}`}>
          {row.original.recordsImported || 0}
        </span>
      ),
    },
    {
      accessorKey: 'recordsSkipped',
      header: 'Skipped',
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400" data-testid={`log-skipped-${row.index}`}>
          {row.original.recordsSkipped || 0}
        </span>
      ),
    },
    {
      accessorKey: 'recordsFailed',
      header: 'Failed',
      cell: ({ row }) => (
        <span className="text-sm text-red-600 dark:text-red-400 font-medium" data-testid={`log-failed-${row.index}`}>
          {row.original.recordsFailed || 0}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleViewDetails(row.original)}
          data-testid={`button-view-details-${row.index}`}
        >
          <Eye className="w-4 h-4 mr-1" />
          View Details
        </Button>
      ),
    },
  ];

  const table = useReactTable({
    data: logs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
      pagination: {
        pageIndex: 0,
        pageSize: 20,
      },
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-8 h-8 animate-spin" data-testid="loading-spinner" />
      </div>
    );
  }

  const calculateDuration = (start: string, end: string | null) => {
    if (!end) return 'In progress';
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const durationMs = endTime - startTime;
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <>
      <Header 
        title="Import History"
        subtitle="Track all fuel sales import and sync operations"
      />

      <div className="p-6 space-y-6">
        {/* Summary Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Imports (30 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-imports">
                {stats?.totalImports || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-success-rate">
                {stats?.successRate || 0}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Records Imported
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-records">
                {stats?.totalRecordsImported || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Latest Sync Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.latestSyncStatus && (
                <Badge className={STATUS_CONFIG[stats.latestSyncStatus as keyof typeof STATUS_CONFIG]?.color || STATUS_CONFIG.pending.color} data-testid="stat-latest-status">
                  {STATUS_CONFIG[stats.latestSyncStatus as keyof typeof STATUS_CONFIG]?.label || stats.latestSyncStatus}
                </Badge>
              )}
              {!stats?.latestSyncStatus && (
                <span className="text-sm text-muted-foreground">No imports yet</span>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filters Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Date Range</label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger data-testid="select-date-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Source</label>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger data-testid="select-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="csv_upload">CSV Upload</SelectItem>
                    <SelectItem value="fuelcloud_api">FuelCloud API</SelectItem>
                    <SelectItem value="manual_entry">Manual Entry</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={handleClearFilters} data-testid="button-clear-filters">
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Import Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Import Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable 
              table={table} 
              columns={columns}
            />
          </CardContent>
        </Card>
      </div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Log Details</DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Source</label>
                  <p className="text-sm" data-testid="detail-source">{selectedLog.source}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Import Type</label>
                  <p className="text-sm" data-testid="detail-type">{selectedLog.importType}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div>
                    <Badge className={STATUS_CONFIG[selectedLog.status as keyof typeof STATUS_CONFIG]?.color || STATUS_CONFIG.pending.color} data-testid="detail-status">
                      {STATUS_CONFIG[selectedLog.status as keyof typeof STATUS_CONFIG]?.label || selectedLog.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Duration</label>
                  <p className="text-sm" data-testid="detail-duration">
                    {calculateDuration(selectedLog.startedAt, selectedLog.completedAt)}
                  </p>
                </div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Started At</label>
                  <p className="text-sm" data-testid="detail-started">
                    {format(new Date(selectedLog.startedAt), "MMM dd, yyyy h:mm:ss a")}
                  </p>
                </div>
                {selectedLog.completedAt && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Completed At</label>
                    <p className="text-sm" data-testid="detail-completed">
                      {format(new Date(selectedLog.completedAt), "MMM dd, yyyy h:mm:ss a")}
                    </p>
                  </div>
                )}
              </div>

              {/* Record Counts */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Processed</label>
                  <p className="text-lg font-semibold" data-testid="detail-processed">
                    {selectedLog.recordsProcessed || 0}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Imported</label>
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400" data-testid="detail-imported">
                    {selectedLog.recordsImported || 0}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Skipped</label>
                  <p className="text-lg font-semibold text-gray-600 dark:text-gray-400" data-testid="detail-skipped">
                    {selectedLog.recordsSkipped || 0}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Failed</label>
                  <p className="text-lg font-semibold text-red-600 dark:text-red-400" data-testid="detail-failed">
                    {selectedLog.recordsFailed || 0}
                  </p>
                </div>
              </div>

              {/* Import Data Summary */}
              {selectedLog.importData && Object.keys(selectedLog.importData).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">Import Data Summary</label>
                  <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto" data-testid="detail-import-data">
                    {JSON.stringify(selectedLog.importData, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error Log */}
              {selectedLog.errorLog && Array.isArray(selectedLog.errorLog) && selectedLog.errorLog.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-muted-foreground">Error Log ({selectedLog.errorLog.length} errors)</label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadErrorLog}
                      data-testid="button-download-errors"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download CSV
                    </Button>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md p-4 max-h-60 overflow-y-auto">
                    <ul className="space-y-1 text-sm" data-testid="detail-error-list">
                      {selectedLog.errorLog.map((error, index) => (
                        <li key={index} className="text-red-800 dark:text-red-200">
                          • {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)} data-testid="button-close-dialog">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
