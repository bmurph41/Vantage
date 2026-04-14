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

interface StorageUnit {
  id: string;
  unitNumber: string;
  size: string;
  unitType: string;
  status: "available" | "occupied" | "reserved" | "maintenance" | "delinquent";
  monthlyRate: string | null;
  tenantName: string | null;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  available: { label: "Available", className: "border-green-500 text-green-700 bg-green-50" },
  occupied: { label: "Occupied", className: "border-blue-500 text-blue-700 bg-blue-50" },
  reserved: { label: "Reserved", className: "border-purple-500 text-purple-700 bg-purple-50" },
  maintenance: { label: "Maintenance", className: "border-yellow-500 text-yellow-700 bg-yellow-50" },
};

const UNIT_SIZES = ["5x5", "5x10", "10x10", "10x15", "10x20", "10x30"];
const UNIT_TYPES = ["Standard", "Climate Controlled", "Drive-up"];

export default function SelfStorageUnits() {
  const [search, setSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: units, isLoading, isError } = useQuery<StorageUnit[]>({
    queryKey: ["/api/self-storage-ops/units"],
    retry: false,
  });

  const filteredUnits = (units || []).filter((unit) => {
    const matchesSearch =
      unit.unitNumber.toLowerCase().includes(search.toLowerCase()) ||
      (unit.tenantName || "").toLowerCase().includes(search.toLowerCase());
    const matchesSize = sizeFilter === "all" || unit.size === sizeFilter;
    const matchesType = typeFilter === "all" || unit.unitType === typeFilter;
    const matchesStatus = statusFilter === "all" || unit.status === statusFilter;
    return matchesSearch && matchesSize && matchesType && matchesStatus;
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
            placeholder="Search units or tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sizeFilter} onValueChange={setSizeFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="All sizes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sizes</SelectItem>
            {UNIT_SIZES.map((size) => (
              <SelectItem key={size} value={size}>{size}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {UNIT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="occupied">Occupied</SelectItem>
            <SelectItem value="reserved">Reserved</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isError || !units || units.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">No units yet</p>
              <p className="text-sm mt-1">Add storage units to start managing your facility.</p>
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">No matching units</p>
              <p className="text-sm mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit #</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Tenant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUnits.map((unit) => {
                  const badge = STATUS_BADGE[unit.status] || STATUS_BADGE.available;
                  return (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.unitNumber}</TableCell>
                      <TableCell>{unit.size}</TableCell>
                      <TableCell>{unit.unitType}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {unit.monthlyRate ? `$${parseFloat(unit.monthlyRate).toFixed(2)}` : "--"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {unit.tenantName || "--"}
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
