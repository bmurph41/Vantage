import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Link } from "wouter";
import { DollarSign, Users, TrendingUp, TrendingDown, AlertCircle, ArrowUpRight } from "lucide-react";

interface LeaseData {
  id: string;
  customerName: string;
  vesselName: string | null;
  unitLocation: string | null;
  storageType: string | null;
  leaseAmount: string | null;
  rateType: string | null;
  contractTerm: string | null;
  commencementDate: string | null;
  expirationDate: string | null;
  locationId: string;
  locationName: string;
}

interface MoveEventData {
  id: string;
  customerName: string;
  vesselName: string | null;
  unitLocation: string | null;
  storageType: string | null;
  leaseAmount: string | null;
  eventDate: string;
  eventType: "move-in" | "move-out";
  locationId: string;
  locationName: string;
}

interface RevenueByStorageType {
  storageType: string;
  revenue: number;
  leaseCount: number;
  percentage: number;
}

interface RevenueByProject {
  projectId: string;
  projectName: string;
  revenue: number;
  leaseCount: number;
  percentage: number;
}

const formatCurrency = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "$0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

interface RentRollCountModalProps {
  open: boolean;
  onClose: () => void;
  currentMonth: string;
  count: number;
}

export function RentRollCountModal({ open, onClose, currentMonth, count }: RentRollCountModalProps) {
  const { data: leases, isLoading } = useQuery<LeaseData[]>({
    queryKey: ["/api/rent-roll/summary-drilldown/active-leases", currentMonth],
    queryFn: async () => {
      const response = await fetch(`/api/rent-roll/summary-drilldown/active-leases?month=${currentMonth}`);
      if (!response.ok) throw new Error("Failed to fetch active leases");
      return response.json();
    },
    enabled: open,
  });

  const groupedByProject = useMemo(() => {
    if (!leases) return [];
    const grouped = leases.reduce((acc, lease) => {
      const key = lease.locationId;
      if (!acc[key]) {
        acc[key] = { projectId: key, projectName: lease.locationName, leases: [] };
      }
      acc[key].leases.push(lease);
      return acc;
    }, {} as Record<string, { projectId: string; projectName: string; leases: LeaseData[] }>);
    return Object.values(grouped).sort((a, b) => b.leases.length - a.leases.length);
  }, [leases]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0" data-testid="modal-rent-roll-count">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Active Leases Breakdown
          </DialogTitle>
          <DialogDescription>
            {count} active leases across all projects for {format(new Date(currentMonth + "-01"), "MMMM yyyy")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden px-6 py-4">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {groupedByProject.map((group) => (
                  <div key={group.projectId} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{group.projectName}</h3>
                      <Badge variant="secondary">{group.leases.length} leases</Badge>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Vessel</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Storage Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.leases.slice(0, 10).map((lease) => (
                          <TableRow key={lease.id} data-testid={`row-lease-${lease.id}`}>
                            <TableCell className="font-medium">{lease.customerName}</TableCell>
                            <TableCell>{lease.vesselName || "-"}</TableCell>
                            <TableCell>{lease.unitLocation || "-"}</TableCell>
                            <TableCell>
                              {lease.storageType && (
                                <Badge variant="outline">{lease.storageType}</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(lease.leaseAmount)}
                              {lease.rateType && (
                                <span className="text-xs text-muted-foreground ml-1">/{lease.rateType}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Link href={`/rent-roll/${group.projectId}?lease=${lease.id}`}>
                                <Button size="icon" variant="ghost">
                                  <ArrowUpRight className="h-4 w-4" />
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                        {group.leases.length > 10 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                              <Link href={`/rent-roll/${group.projectId}`}>
                                <Button variant="ghost" className="text-primary">
                                  View all {group.leases.length} leases
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose} data-testid="button-close-modal">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface MonthlyRevenueModalProps {
  open: boolean;
  onClose: () => void;
  currentMonth: string;
  totalRevenue: string;
}

export function MonthlyRevenueModal({ open, onClose, currentMonth, totalRevenue }: MonthlyRevenueModalProps) {
  const [activeTab, setActiveTab] = useState<"storage" | "project">("project");

  const { data: byProject, isLoading: projectLoading } = useQuery<RevenueByProject[]>({
    queryKey: ["/api/rent-roll/summary-drilldown/revenue-by-project", currentMonth],
    queryFn: async () => {
      const response = await fetch(`/api/rent-roll/summary-drilldown/revenue-by-project?month=${currentMonth}`);
      if (!response.ok) throw new Error("Failed to fetch revenue by project");
      return response.json();
    },
    enabled: open,
  });

  const { data: byStorageType, isLoading: storageLoading } = useQuery<RevenueByStorageType[]>({
    queryKey: ["/api/rent-roll/summary-drilldown/revenue-by-storage-type", currentMonth],
    queryFn: async () => {
      const response = await fetch(`/api/rent-roll/summary-drilldown/revenue-by-storage-type?month=${currentMonth}`);
      if (!response.ok) throw new Error("Failed to fetch revenue by storage type");
      return response.json();
    },
    enabled: open,
  });

  const isLoading = activeTab === "project" ? projectLoading : storageLoading;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0" data-testid="modal-monthly-revenue">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Monthly Revenue Breakdown
          </DialogTitle>
          <DialogDescription>
            {formatCurrency(totalRevenue)} total contracted revenue for {format(new Date(currentMonth + "-01"), "MMMM yyyy")}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "storage" | "project")} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-3">
            <TabsList>
              <TabsTrigger value="project" data-testid="tab-by-project">By Project</TabsTrigger>
              <TabsTrigger value="storage" data-testid="tab-by-storage">By Storage Type</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden px-6 py-4">
            <ScrollArea className="h-full">
              <TabsContent value="project" className="mt-0">
                {projectLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Leases</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byProject?.map((project) => (
                        <TableRow key={project.projectId} data-testid={`row-project-${project.projectId}`}>
                          <TableCell className="font-medium">{project.projectName}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(project.revenue)}</TableCell>
                          <TableCell className="text-right tabular-nums">{project.leaseCount}</TableCell>
                          <TableCell className="text-right tabular-nums">{project.percentage.toFixed(1)}%</TableCell>
                          <TableCell>
                            <Link href={`/rent-roll/${project.projectId}`}>
                              <Button size="icon" variant="ghost">
                                <ArrowUpRight className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              <TabsContent value="storage" className="mt-0">
                {storageLoading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Storage Type</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Leases</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byStorageType?.map((row) => (
                        <TableRow key={row.storageType} data-testid={`row-storage-${row.storageType}`}>
                          <TableCell className="font-medium">
                            <Badge variant="outline">{row.storageType || "Unspecified"}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(row.revenue)}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.leaseCount}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.percentage.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </ScrollArea>
          </div>
        </Tabs>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose} data-testid="button-close-modal">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface NetMovesModalProps {
  open: boolean;
  onClose: () => void;
  currentMonth: string;
  netMoves: number;
}

export function NetMovesModal({ open, onClose, currentMonth, netMoves }: NetMovesModalProps) {
  const [activeTab, setActiveTab] = useState<"move-in" | "move-out">("move-in");

  const { data: moveEvents, isLoading } = useQuery<MoveEventData[]>({
    queryKey: ["/api/rent-roll/summary-drilldown/move-events", currentMonth],
    queryFn: async () => {
      const response = await fetch(`/api/rent-roll/summary-drilldown/move-events?month=${currentMonth}`);
      if (!response.ok) throw new Error("Failed to fetch move events");
      return response.json();
    },
    enabled: open,
  });

  const moveIns = useMemo(() => moveEvents?.filter(e => e.eventType === "move-in") || [], [moveEvents]);
  const moveOuts = useMemo(() => moveEvents?.filter(e => e.eventType === "move-out") || [], [moveEvents]);

  const currentEvents = activeTab === "move-in" ? moveIns : moveOuts;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0" data-testid="modal-net-moves">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            {netMoves >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
            Net Moves Breakdown
          </DialogTitle>
          <DialogDescription>
            {moveIns.length} move-ins, {moveOuts.length} move-outs ({netMoves >= 0 ? "+" : ""}{netMoves} net) for {format(new Date(currentMonth + "-01"), "MMMM yyyy")}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "move-in" | "move-out")} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-3">
            <TabsList>
              <TabsTrigger value="move-in" data-testid="tab-move-ins" className="gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Move-Ins ({moveIns.length})
              </TabsTrigger>
              <TabsTrigger value="move-out" data-testid="tab-move-outs" className="gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Move-Outs ({moveOuts.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden px-6 py-4">
            <ScrollArea className="h-full">
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Vessel</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Storage Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No {activeTab === "move-in" ? "move-ins" : "move-outs"} this month
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentEvents.map((event) => (
                        <TableRow key={event.id} data-testid={`row-event-${event.id}`}>
                          <TableCell className="tabular-nums">{format(new Date(event.eventDate), "MMM d")}</TableCell>
                          <TableCell className="font-medium">{event.customerName}</TableCell>
                          <TableCell>{event.vesselName || "-"}</TableCell>
                          <TableCell>{event.locationName}</TableCell>
                          <TableCell>{event.unitLocation || "-"}</TableCell>
                          <TableCell>
                            {event.storageType && <Badge variant="outline">{event.storageType}</Badge>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(event.leaseAmount)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </div>
        </Tabs>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose} data-testid="button-close-modal">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DiscrepancyIssue {
  type: "missing_cash_flow" | "missing_dates" | "missing_amount" | "duplicate_slip";
  description: string;
  leaseId: string;
  customerName: string;
  projectName: string;
  projectId: string;
}

interface DiscrepancyModalProps {
  open: boolean;
  onClose: () => void;
  currentMonth: string;
  discrepancyCount: number;
}

export function DiscrepancyModal({ open, onClose, currentMonth, discrepancyCount }: DiscrepancyModalProps) {
  const { data: issues, isLoading } = useQuery<DiscrepancyIssue[]>({
    queryKey: ["/api/rent-roll/summary-drilldown/discrepancies", currentMonth],
    queryFn: async () => {
      const response = await fetch(`/api/rent-roll/summary-drilldown/discrepancies?month=${currentMonth}`);
      if (!response.ok) throw new Error("Failed to fetch discrepancies");
      return response.json();
    },
    enabled: open,
  });

  const groupedByType = useMemo(() => {
    if (!issues) return {};
    return issues.reduce((acc, issue) => {
      if (!acc[issue.type]) acc[issue.type] = [];
      acc[issue.type].push(issue);
      return acc;
    }, {} as Record<string, DiscrepancyIssue[]>);
  }, [issues]);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "missing_cash_flow": return "Missing Cash Flows";
      case "missing_dates": return "Missing Dates";
      case "missing_amount": return "Missing Amounts";
      case "duplicate_slip": return "Duplicate Slip Assignments";
      default: return type;
    }
  };

  const getTypeBadgeVariant = (type: string): "destructive" | "secondary" | "outline" => {
    switch (type) {
      case "missing_cash_flow": return "destructive";
      case "missing_dates": return "secondary";
      case "missing_amount": return "destructive";
      case "duplicate_slip": return "secondary";
      default: return "outline";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0" data-testid="modal-discrepancy">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Data Quality Issues
          </DialogTitle>
          <DialogDescription>
            {discrepancyCount} issues found for {format(new Date(currentMonth + "-01"), "MMMM yyyy")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden px-6 py-4">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : issues && issues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mb-4 text-green-500" />
                <p className="text-lg font-medium">No data quality issues found</p>
                <p className="text-sm">All leases have complete data</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedByType).map(([type, typeIssues]) => (
                  <div key={type} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{getTypeLabel(type)}</h3>
                      <Badge variant={getTypeBadgeVariant(type)}>{typeIssues.length}</Badge>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Issue</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {typeIssues.slice(0, 10).map((issue) => (
                          <TableRow key={issue.leaseId} data-testid={`row-issue-${issue.leaseId}`}>
                            <TableCell className="font-medium">{issue.customerName}</TableCell>
                            <TableCell>{issue.projectName}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{issue.description}</TableCell>
                            <TableCell>
                              <Link href={`/rent-roll/${issue.projectId}?lease=${issue.leaseId}`}>
                                <Button size="icon" variant="ghost">
                                  <ArrowUpRight className="h-4 w-4" />
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                        {typeIssues.length > 10 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              And {typeIssues.length - 10} more issues...
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose} data-testid="button-close-modal">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
