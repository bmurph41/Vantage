import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { CalendarClock, AlertCircle } from "lucide-react";

interface LeaseRecord {
  id: string;
  unitNumber: string;
  tenant: string;
  leaseEnd: string;
  currentRent: number;
  marketRent: number;
  variancePct: number;
  renewalStatus: "pending" | "renewed" | "not_renewing" | "month_to_month";
  daysUntilExpiry: number;
}

const RENEWAL_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "border-yellow-500 text-yellow-700 bg-yellow-50" },
  renewed: { label: "Renewed", className: "border-green-500 text-green-700 bg-green-50" },
  not_renewing: { label: "Not Renewing", className: "border-red-500 text-red-700 bg-red-50" },
  month_to_month: { label: "Month-to-Month", className: "border-blue-500 text-blue-700 bg-blue-50" },
};

function getUrgencyClass(daysUntilExpiry: number): string {
  if (daysUntilExpiry <= 30) return "bg-red-50";
  if (daysUntilExpiry <= 60) return "bg-yellow-50";
  if (daysUntilExpiry <= 90) return "bg-orange-50";
  return "";
}

export default function MultifamilyLeaseExpiry() {
  const [renewalFilter, setRenewalFilter] = useState<string>("all");

  const { data: leases, isLoading, isError } = useQuery<LeaseRecord[]>({
    queryKey: ["/api/operations-context/multifamily/lease-expiry"],
    retry: false,
  });

  const filteredLeases = (leases || []).filter((lease) => {
    return renewalFilter === "all" || lease.renewalStatus === renewalFilter;
  });

  // Sort by days until expiry (soonest first)
  const sortedLeases = [...filteredLeases].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const urgentCount = (leases || []).filter((l) => l.daysUntilExpiry <= 30).length;
  const pendingCount = (leases || []).filter((l) => l.renewalStatus === "pending").length;

  return (
    <div className="p-6 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expiring Within 30 Days</p>
                <p className="text-2xl font-bold">{isError ? "--" : urgentCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-100">
                <CalendarClock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Renewal</p>
                <p className="text-2xl font-bold">{isError ? "--" : pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <CalendarClock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Tracked Leases</p>
                <p className="text-2xl font-bold">{isError ? "--" : (leases || []).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={renewalFilter} onValueChange={setRenewalFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="renewed">Renewed</SelectItem>
            <SelectItem value="not_renewing">Not Renewing</SelectItem>
            <SelectItem value="month_to_month">Month-to-Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lease Table */}
      <Card>
        <CardContent className="p-0">
          {isError || !leases || leases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">No lease data yet</p>
              <p className="text-sm mt-1">Add units and leases to track expirations and renewals.</p>
            </div>
          ) : sortedLeases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">No matching leases</p>
              <p className="text-sm mt-1">Try adjusting your filter.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Lease End</TableHead>
                  <TableHead>Days Left</TableHead>
                  <TableHead className="text-right">Current Rent</TableHead>
                  <TableHead className="text-right">Market Rent</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead>Renewal Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLeases.map((lease) => {
                  const badge = RENEWAL_BADGE[lease.renewalStatus] || RENEWAL_BADGE.pending;
                  const urgencyClass = getUrgencyClass(lease.daysUntilExpiry);
                  return (
                    <TableRow key={lease.id} className={urgencyClass}>
                      <TableCell className="font-medium">{lease.unitNumber}</TableCell>
                      <TableCell>{lease.tenant}</TableCell>
                      <TableCell>{lease.leaseEnd}</TableCell>
                      <TableCell>
                        <span className={lease.daysUntilExpiry <= 30 ? "text-red-600 font-semibold" : ""}>
                          {lease.daysUntilExpiry}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">${lease.currentRent.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${lease.marketRent.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <span className={lease.variancePct < 0 ? "text-red-600" : "text-green-600"}>
                          {lease.variancePct > 0 ? "+" : ""}{lease.variancePct.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
