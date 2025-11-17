import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, Search, Calendar, User, FileText, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import type { AuditLog } from "@shared/schema";

export default function AuditPage() {
  const [entityType, setEntityType] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Build query params
  const queryParams = new URLSearchParams();
  if (entityType && entityType !== "all") queryParams.set("entityType", entityType);
  if (action && action !== "all") queryParams.set("action", action);
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);
  queryParams.set("limit", "1000");

  const queryString = queryParams.toString();
  const apiUrl = `/api/audit-logs${queryString ? `?${queryString}` : ''}`;

  const { data: logs = [], isLoading, refetch } = useQuery<AuditLog[]>({
    queryKey: [apiUrl],
  });

  // Filter logs by search term
  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return logs;
    
    const term = searchTerm.toLowerCase();
    return logs.filter(log => 
      (log.entityId ?? "").toLowerCase().includes(term) ||
      (log.entityType ?? "").toLowerCase().includes(term) ||
      (log.action ?? "").toLowerCase().includes(term) ||
      (log.userId ?? "").toLowerCase().includes(term) ||
      (log.ipAddress ?? "").toLowerCase().includes(term) ||
      (log.changedFields && log.changedFields.some(f => (f ?? "").toLowerCase().includes(term)))
    );
  }, [logs, searchTerm]);

  // Paginate filtered logs
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage]);

  // Reset to page 1 when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  // Clamp currentPage when data changes (e.g., after refresh or filter changes)
  useEffect(() => {
    if (totalPages === 0 && currentPage !== 1) {
      setCurrentPage(1);
    } else if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const getActionColor = (action: string) => {
    switch (action) {
      case "create": return "text-green-600 bg-green-50";
      case "update": return "text-blue-600 bg-blue-50";
      case "delete": return "text-red-600 bg-red-50";
      case "import": return "text-purple-600 bg-purple-50";
      case "export": return "text-orange-600 bg-orange-50";
      case "generate": return "text-indigo-600 bg-indigo-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  const getEntityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      scenarios: "Scenario",
      assumptions: "Assumptions",
      projections: "Projections",
      historical_data: "Historical Data",
      products: "Product",
      categories: "Category",
      transactions: "Transaction",
    };
    return labels[type] || type;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            Audit Trail & Compliance
          </h1>
          <p className="text-muted-foreground mt-1">
            Complete audit log of all system changes for compliance and tracking
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
          <CardDescription>Filter audit logs by entity type, action, or date range</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select value={entityType} onValueChange={(val) => { setEntityType(val); handleFilterChange(); }}>
                <SelectTrigger data-testid="filter-entity-type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="scenarios">Scenarios</SelectItem>
                  <SelectItem value="assumptions">Assumptions</SelectItem>
                  <SelectItem value="projections">Projections</SelectItem>
                  <SelectItem value="historical_data">Historical Data</SelectItem>
                  <SelectItem value="products">Products</SelectItem>
                  <SelectItem value="transactions">Transactions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={action} onValueChange={(val) => { setAction(val); handleFilterChange(); }}>
                <SelectTrigger data-testid="filter-action">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                  <SelectItem value="export">Export</SelectItem>
                  <SelectItem value="generate">Generate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); handleFilterChange(); }}
                data-testid="filter-start-date"
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); handleFilterChange(); }}
                data-testid="filter-end-date"
              />
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by entity ID, user, IP, field..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); handleFilterChange(); }}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setEntityType("all");
                  setAction("all");
                  setStartDate("");
                  setEndDate("");
                  setSearchTerm("");
                  setCurrentPage(1);
                }}
                data-testid="button-clear-filters"
              >
                Clear All
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Showing {paginatedLogs.length} of {filteredLogs.length} audit logs
              {searchTerm && ` (filtered from ${logs.length} total)`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Audit Log Entries</CardTitle>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading audit logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              {searchTerm || entityType || action || startDate || endDate 
                ? "No audit logs found matching your search and filters" 
                : "No audit logs found"}
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedLogs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedLog(log)}
                  data-testid={`audit-log-${log.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                          {log.action.toUpperCase()}
                        </span>
                        <span className="text-sm font-medium">{getEntityTypeLabel(log.entityType)}</span>
                        <span className="text-xs text-muted-foreground">ID: {log.entityId}</span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {log.createdAt ? format(new Date(log.createdAt), "PPp") : "N/A"}
                        </div>
                        {log.userId && (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            User: {log.userId.substring(0, 8)}
                          </div>
                        )}
                        {log.ipAddress && (
                          <div className="text-xs">
                            IP: {log.ipAddress}
                          </div>
                        )}
                      </div>

                      {log.changedFields && log.changedFields.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Changed fields: {log.changedFields.join(", ")}
                        </div>
                      )}

                      {log.metadata && log.metadata.recordCount && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Records: {log.metadata.recordCount}
                        </div>
                      )}
                    </div>

                    <Button variant="ghost" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedLog(null)}
        >
          <Card className="max-w-3xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Audit Log Details</CardTitle>
              <CardDescription>
                {getEntityTypeLabel(selectedLog.entityType)} - {selectedLog.action.toUpperCase()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Entity Type</Label>
                  <p className="font-medium">{getEntityTypeLabel(selectedLog.entityType)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Action</Label>
                  <p className={`font-medium ${getActionColor(selectedLog.action)}`}>
                    {selectedLog.action.toUpperCase()}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Entity ID</Label>
                  <p className="font-mono text-xs">{selectedLog.entityId}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Timestamp</Label>
                  <p>{selectedLog.createdAt ? format(new Date(selectedLog.createdAt), "PPpp") : "N/A"}</p>
                </div>
                {selectedLog.userId && (
                  <div>
                    <Label className="text-muted-foreground">User ID</Label>
                    <p className="font-mono text-xs">{selectedLog.userId}</p>
                  </div>
                )}
                {selectedLog.ipAddress && (
                  <div>
                    <Label className="text-muted-foreground">IP Address</Label>
                    <p>{selectedLog.ipAddress}</p>
                  </div>
                )}
              </div>

              {selectedLog.changedFields && selectedLog.changedFields.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Changed Fields</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedLog.changedFields.map((field) => (
                      <span
                        key={field}
                        className="px-2 py-1 bg-muted rounded text-xs font-mono"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedLog.beforeData && (
                <div>
                  <Label className="text-muted-foreground">Before Data</Label>
                  <pre className="mt-2 p-4 bg-muted rounded text-xs overflow-x-auto">
                    {String(JSON.stringify(selectedLog.beforeData, null, 2))}
                  </pre>
                </div>
              )}

              {selectedLog.afterData && (
                <div>
                  <Label className="text-muted-foreground">After Data</Label>
                  <pre className="mt-2 p-4 bg-muted rounded text-xs overflow-x-auto">
                    {String(JSON.stringify(selectedLog.afterData, null, 2))}
                  </pre>
                </div>
              )}

              {selectedLog.metadata && (
                <div>
                  <Label className="text-muted-foreground">Metadata</Label>
                  <pre className="mt-2 p-4 bg-muted rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <Button onClick={() => setSelectedLog(null)} className="w-full">
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
