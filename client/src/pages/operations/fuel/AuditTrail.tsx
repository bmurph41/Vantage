import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Filter, Eye, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  username: string | null;
  userEmail: string | null;
  beforeState: any;
  afterState: any;
  metadata: any;
  ipAddress: string | null;
  timestamp: Date;
}

interface OrgUser {
  id: string;
  username: string;
  email: string;
}

export default function AuditTrail() {
  const [entityType, setEntityType] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Fetch users for filter dropdown
  const { data: usersData } = useQuery<OrgUser[]>({
    queryKey: ["/api/operations/fuel/users"],
  });

  const { data, isLoading } = useQuery<{
    logs: AuditLog[];
    total: number;
    limit: number;
    offset: number;
  }>({
    queryKey: [
      "/api/operations/fuel/audit-logs",
      entityType,
      userId,
      action,
      startDate,
      endDate,
      currentPage,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: ((currentPage - 1) * pageSize).toString(),
      });

      if (entityType) params.append("entityType", entityType);
      if (userId) params.append("userId", userId);
      if (action) params.append("action", action);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const response = await fetch(`/api/operations/fuel/audit-logs?${params}`);
      if (!response.ok) throw new Error("Failed to fetch audit logs");
      return response.json();
    },
  });

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0;

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "create":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "update":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "delete":
      case "bulk_delete":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "import":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "export":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "role_change":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const formatEntityType = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const handleReset = () => {
    setEntityType("");
    setUserId("");
    setAction("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="heading-audit-trail">
          Audit Trail
        </h1>
        <p className="text-muted-foreground">
          Complete history of all changes made to fuel operations data
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
          <CardDescription>Filter audit logs by entity type, user, action, or date range</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Entity Type</label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger data-testid="select-entity-type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  <SelectItem value="fuel_transaction">Fuel Transaction</SelectItem>
                  <SelectItem value="fuel_tank">Fuel Tank</SelectItem>
                  <SelectItem value="fuel_projection">Fuel Projection</SelectItem>
                  <SelectItem value="integration_settings">Integration Settings</SelectItem>
                  <SelectItem value="import_record">Import Record</SelectItem>
                  <SelectItem value="user">User Role</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">User</label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger data-testid="select-user">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All users</SelectItem>
                  {usersData?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.username} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Action</label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger data-testid="select-action">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="bulk_delete">Bulk Delete</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                  <SelectItem value="export">Export</SelectItem>
                  <SelectItem value="role_change">Role Change</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={handleReset} data-testid="button-reset-filters">
              Reset Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Audit Logs
          </CardTitle>
          <CardDescription>
            {data?.total || 0} total records
            {(entityType || userId || action || startDate || endDate) && " (filtered)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading audit logs...</div>
          ) : !data || data.logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No audit logs found matching the selected filters.
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity Type</TableHead>
                      <TableHead>Entity ID</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.logs.map((log) => (
                      <TableRow key={log.id} data-testid={`audit-log-${log.id}`}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(log.timestamp), "MMM dd, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{log.username || "Unknown"}</div>
                            <div className="text-sm text-muted-foreground">{log.userEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getActionBadgeColor(log.action)}>
                            {log.action.replace("_", " ").toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatEntityType(log.entityType)}</TableCell>
                        <TableCell className="font-mono text-xs">{log.entityId.substring(0, 8)}...</TableCell>
                        <TableCell className="font-mono text-xs">{log.ipAddress || "N/A"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            data-testid={`button-view-details-${log.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
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
                      <ChevronLeft className="w-4 h-4" />
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
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedLog && (
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Audit Log Details</DialogTitle>
              <DialogDescription>
                {formatEntityType(selectedLog.entityType)} - {selectedLog.action.toUpperCase()}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Timestamp</div>
                  <div className="font-mono">
                    {format(new Date(selectedLog.timestamp), "MMM dd, yyyy HH:mm:ss")}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">User</div>
                  <div>{selectedLog.username || "Unknown"}</div>
                  <div className="text-sm text-muted-foreground">{selectedLog.userEmail}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Entity Type</div>
                  <div>{formatEntityType(selectedLog.entityType)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Entity ID</div>
                  <div className="font-mono text-sm">{selectedLog.entityId}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Action</div>
                  <Badge className={getActionBadgeColor(selectedLog.action)}>
                    {selectedLog.action.replace("_", " ").toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">IP Address</div>
                  <div className="font-mono text-sm">{selectedLog.ipAddress || "N/A"}</div>
                </div>
              </div>

              {selectedLog.beforeState && (
                <div>
                  <div className="text-sm font-medium mb-2">Before State</div>
                  <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs">
                    {JSON.stringify(selectedLog.beforeState, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.afterState && (
                <div>
                  <div className="text-sm font-medium mb-2">After State</div>
                  <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs">
                    {JSON.stringify(selectedLog.afterState, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Additional Metadata</div>
                  <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
