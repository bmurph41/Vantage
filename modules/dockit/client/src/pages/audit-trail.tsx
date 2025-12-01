import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { 
  History, 
  Download, 
  Filter,
  Search,
  User,
  Activity,
  FileText,
  Eye,
  Clock,
  Globe,
  Monitor,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import type { AuditLog, User as UserType, Marina } from "@shared/schema";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE_RESERVATION: { label: "Create Reservation", color: "bg-green-500" },
  UPDATE_RESERVATION: { label: "Update Reservation", color: "bg-blue-500" },
  CANCEL_RESERVATION: { label: "Cancel Reservation", color: "bg-red-500" },
  ASSIGN_SLIP: { label: "Assign Slip", color: "bg-purple-500" },
  PROCESS_PAYMENT: { label: "Process Payment", color: "bg-green-600" },
  REFUND_PAYMENT: { label: "Refund Payment", color: "bg-orange-500" },
  CREATE_CUSTOMER: { label: "Create Customer", color: "bg-blue-600" },
  UPDATE_CUSTOMER: { label: "Update Customer", color: "bg-blue-400" },
  CREATE_LAUNCH: { label: "Create Launch", color: "bg-teal-500" },
  UPDATE_LAUNCH: { label: "Update Launch", color: "bg-teal-400" },
  CANCEL_LAUNCH: { label: "Cancel Launch", color: "bg-red-400" },
  SIGN_CONTRACT: { label: "Sign Contract", color: "bg-green-500" },
  SEND_CONTRACT: { label: "Send Contract", color: "bg-blue-500" },
  USER_LOGIN: { label: "User Login", color: "bg-gray-500" },
  USER_LOGOUT: { label: "User Logout", color: "bg-gray-400" },
  SETTINGS_CHANGE: { label: "Settings Change", color: "bg-yellow-500" },
};

const ENTITY_ICONS: Record<string, any> = {
  reservation: FileText,
  payment: Activity,
  customer: User,
  launch: Clock,
  contract: FileText,
  slip: Activity,
  user: User,
};

export default function AuditTrail() {
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({
    marinaId: "",
    userId: "",
    entityType: "",
    action: "",
    startDate: "",
    endDate: "",
  });
  const pageSize = 50;

  const queryParams = new URLSearchParams({
    limit: String(pageSize),
    offset: String(page * pageSize),
    ...(filters.marinaId && { marinaId: filters.marinaId }),
    ...(filters.userId && { userId: filters.userId }),
    ...(filters.entityType && { entityType: filters.entityType }),
    ...(filters.action && { action: filters.action }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate }),
  });

  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs", queryParams.toString()],
  });

  const { data: stats } = useQuery<{
    totalLogs: number;
    actionCounts: Record<string, number>;
    entityCounts: Record<string, number>;
    userCounts: Record<string, number>;
  }>({
    queryKey: ["/api/audit-logs/stats"],
  });

  const { data: users } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const { data: marinas } = useQuery<Marina[]>({
    queryKey: ["/api/marinas"],
  });

  const getActionBadge = (action: string) => {
    const config = ACTION_LABELS[action] || { label: action, color: "bg-gray-500" };
    return (
      <Badge className={`${config.color} text-white`}>
        {config.label}
      </Badge>
    );
  };

  const getEntityIcon = (entityType: string | null) => {
    const Icon = entityType ? ENTITY_ICONS[entityType] || Activity : Activity;
    return <Icon className="h-4 w-4" />;
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return "System";
    const user = users?.find(u => u.id === userId);
    return user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : userId;
  };

  const getMarinaName = (marinaId: string | null) => {
    if (!marinaId) return "-";
    const marina = marinas?.find(m => m.id === marinaId);
    return marina?.name || marinaId;
  };

  const handleExport = async (format: 'csv' | 'json') => {
    const exportParams = new URLSearchParams({
      format,
      ...(filters.marinaId && { marinaId: filters.marinaId }),
      ...(filters.startDate && { startDate: filters.startDate }),
      ...(filters.endDate && { endDate: filters.endDate }),
    });
    
    window.open(`/api/audit-logs/export?${exportParams.toString()}`, '_blank');
  };

  const topActions = Object.entries(stats?.actionCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topEntities = Object.entries(stats?.entityCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Audit Trail</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              View system activity, change history, and compliance logs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => handleExport('csv')}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleExport('json')}
              data-testid="button-export-json"
            >
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <History className="h-8 w-8 text-blue-500" />
                <span className="text-3xl font-bold" data-testid="text-total-events">
                  {stats?.totalLogs || 0}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <User className="h-8 w-8 text-green-500" />
                <span className="text-3xl font-bold" data-testid="text-active-users">
                  {Object.keys(stats?.userCounts || {}).length}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Action Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Activity className="h-8 w-8 text-purple-500" />
                <span className="text-3xl font-bold" data-testid="text-action-types">
                  {Object.keys(stats?.actionCounts || {}).length}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Entity Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="h-8 w-8 text-orange-500" />
                <span className="text-3xl font-bold" data-testid="text-entity-types">
                  {Object.keys(stats?.entityCounts || {}).length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topActions.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No activity yet</p>
                ) : (
                  topActions.map(([action, count]) => (
                    <div key={action} className="flex items-center justify-between">
                      {getActionBadge(action)}
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Entities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topEntities.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No activity yet</p>
                ) : (
                  topEntities.map(([entity, count]) => (
                    <div key={entity} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getEntityIcon(entity)}
                        <span className="capitalize">{entity}</span>
                      </div>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label>Marina</Label>
                <Select 
                  value={filters.marinaId} 
                  onValueChange={(value) => setFilters({...filters, marinaId: value === "all" ? "" : value})}
                >
                  <SelectTrigger data-testid="select-marina">
                    <SelectValue placeholder="All marinas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All marinas</SelectItem>
                    {marinas?.map((marina) => (
                      <SelectItem key={marina.id} value={marina.id}>
                        {marina.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>User</Label>
                <Select 
                  value={filters.userId} 
                  onValueChange={(value) => setFilters({...filters, userId: value === "all" ? "" : value})}
                >
                  <SelectTrigger data-testid="select-user">
                    <SelectValue placeholder="All users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    {users?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Entity Type</Label>
                <Select 
                  value={filters.entityType} 
                  onValueChange={(value) => setFilters({...filters, entityType: value === "all" ? "" : value})}
                >
                  <SelectTrigger data-testid="select-entity-type">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="reservation">Reservation</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="launch">Launch</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="slip">Slip</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input 
                  type="date" 
                  value={filters.startDate}
                  onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input 
                  type="date" 
                  value={filters.endDate}
                  onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                  data-testid="input-end-date"
                />
              </div>
              <div className="space-y-2 flex items-end">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setFilters({
                    marinaId: "",
                    userId: "",
                    entityType: "",
                    action: "",
                    startDate: "",
                    endDate: "",
                  })}
                  data-testid="button-clear-filters"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription>View all system events and changes</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-slate-500">Loading audit logs...</div>
            ) : logs?.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No audit logs found matching your filters.</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Marina</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs?.map((log) => (
                      <TableRow key={log.id} data-testid={`row-audit-${log.id}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-slate-400" />
                            {log.timestamp ? format(new Date(log.timestamp), "MMM dd, yyyy HH:mm:ss") : "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400" />
                            {getUserName(log.userId)}
                          </div>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getEntityIcon(log.entityType)}
                            <span className="capitalize">{log.entityType || "-"}</span>
                            {log.entityId && (
                              <span className="text-xs text-slate-500">({log.entityId.slice(0, 8)}...)</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getMarinaName(log.marinaId)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLog(log);
                              setDetailsDialogOpen(true);
                            }}
                            data-testid={`button-view-${log.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-slate-500">
                    Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, stats?.totalLogs || 0)} of {stats?.totalLogs || 0}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">Page {page + 1}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={(logs?.length || 0) < pageSize}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Audit Log Details</DialogTitle>
              <DialogDescription>
                Complete information about this event
              </DialogDescription>
            </DialogHeader>
            {selectedLog && (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {getActionBadge(selectedLog.action)}
                    <span className="text-sm text-slate-500">
                      {selectedLog.timestamp ? format(new Date(selectedLog.timestamp), "MMM dd, yyyy 'at' h:mm:ss a") : "-"}
                    </span>
                  </div>
                  
                  <Separator />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500">User</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <User className="h-4 w-4 text-slate-400" />
                        <p className="font-medium">{getUserName(selectedLog.userId)}</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-500">Marina</Label>
                      <p className="font-medium mt-1">{getMarinaName(selectedLog.marinaId)}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500">Entity Type</Label>
                      <div className="flex items-center gap-2 mt-1">
                        {getEntityIcon(selectedLog.entityType)}
                        <p className="font-medium capitalize">{selectedLog.entityType || "-"}</p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-500">Entity ID</Label>
                      <p className="font-medium mt-1 font-mono text-sm">{selectedLog.entityId || "-"}</p>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500 flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        IP Address
                      </Label>
                      <p className="font-medium mt-1 font-mono text-sm">{selectedLog.ipAddress || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500 flex items-center gap-1">
                        <Monitor className="h-3 w-3" />
                        User Agent
                      </Label>
                      <p className="font-medium mt-1 text-sm truncate" title={selectedLog.userAgent || undefined}>
                        {selectedLog.userAgent || "-"}
                      </p>
                    </div>
                  </div>
                  
                  {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <Label className="text-slate-500">Additional Details</Label>
                        <pre className="mt-2 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm overflow-auto">
                          {JSON.stringify(selectedLog.details, null, 2)}
                        </pre>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
