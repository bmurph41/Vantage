import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
import { Search } from "lucide-react";

interface Tenant {
  id: string;
  tenant: string;
  suite: string;
  sf: number;
  leaseStart: string;
  leaseEnd: string;
  baseRent: number;
  cam: number;
  totalRent: number;
  status: "active" | "expiring" | "expired" | "month_to_month";
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "border-green-500 text-green-700 bg-green-50" },
  expiring: { label: "Expiring", className: "border-yellow-500 text-yellow-700 bg-yellow-50" },
  expired: { label: "Expired", className: "border-red-500 text-red-700 bg-red-50" },
  month_to_month: { label: "MTM", className: "border-blue-500 text-blue-700 bg-blue-50" },
};

export default function RetailOfficeTenants() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: tenants, isLoading, isError } = useQuery<Tenant[]>({
    queryKey: ["/api/retail-office-ops/tenants"],
    retry: false,
  });

  const filteredTenants = (tenants || []).filter((t) => {
    const matchesSearch =
      t.tenant.toLowerCase().includes(search.toLowerCase()) ||
      t.suite.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tenants or suites..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expiring">Expiring</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="month_to_month">Month-to-Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isError || !tenants || tenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">No tenants yet</p>
              <p className="text-sm mt-1">Add commercial tenants to start tracking leases and revenue.</p>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">No matching tenants</p>
              <p className="text-sm mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Suite</TableHead>
                  <TableHead className="text-right">SF</TableHead>
                  <TableHead>Lease Start</TableHead>
                  <TableHead>Lease End</TableHead>
                  <TableHead className="text-right">Base Rent</TableHead>
                  <TableHead className="text-right">CAM</TableHead>
                  <TableHead className="text-right">Total Rent</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.map((t) => {
                  const badge = STATUS_BADGE[t.status] || STATUS_BADGE.active;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.tenant}</TableCell>
                      <TableCell>{t.suite}</TableCell>
                      <TableCell className="text-right">{t.sf.toLocaleString()}</TableCell>
                      <TableCell>{t.leaseStart}</TableCell>
                      <TableCell>{t.leaseEnd}</TableCell>
                      <TableCell className="text-right">${t.baseRent.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${t.cam.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium">${t.totalRent.toLocaleString()}</TableCell>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
