import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search } from "lucide-react";

interface Unit {
  id: string;
  unitNumber: string;
  type: string;
  sqFt: number;
  status: "occupied" | "vacant" | "on_notice" | "down_for_turn";
  currentRent: number;
  marketRent: number;
  tenant?: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  occupied: { label: "Occupied", className: "border-green-500 text-green-700 bg-green-50" },
  vacant: { label: "Vacant", className: "border-red-500 text-red-700 bg-red-50" },
  on_notice: { label: "On Notice", className: "border-yellow-500 text-yellow-700 bg-yellow-50" },
  down_for_turn: { label: "Down for Turn", className: "border-gray-500 text-gray-700 bg-gray-50" },
};

const UNIT_TYPES = ["Studio", "1BR", "2BR", "3BR", "4BR", "Penthouse"];

export default function MultifamilyUnits() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: units, isLoading, isError } = useQuery<Unit[]>({
    queryKey: ["/api/multifamily-ops/units"],
    retry: false,
  });

  const filteredUnits = (units || []).filter((unit) => {
    const matchesSearch =
      unit.unitNumber.toLowerCase().includes(search.toLowerCase()) ||
      (unit.tenant || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || unit.status === statusFilter;
    const matchesType = typeFilter === "all" || unit.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search units or tenants..."
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
              <SelectItem value="occupied">Occupied</SelectItem>
              <SelectItem value="vacant">Vacant</SelectItem>
              <SelectItem value="on_notice">On Notice</SelectItem>
              <SelectItem value="down_for_turn">Down for Turn</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {UNIT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Unit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Unit</DialogTitle>
              <DialogDescription>Add a new unit to the property.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="unitNumber">Unit Number</Label>
                <Input id="unitNumber" placeholder="e.g., 101A" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unitType">Unit Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sqFt">Square Feet</Label>
                <Input id="sqFt" type="number" placeholder="e.g., 750" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="currentRent">Current Rent</Label>
                  <Input id="currentRent" type="number" placeholder="e.g., 1500" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="marketRent">Market Rent</Label>
                  <Input id="marketRent" type="number" placeholder="e.g., 1650" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setDialogOpen(false)}>Add Unit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isError || !units || units.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">No units yet</p>
              <p className="text-sm mt-1">Add units to start managing your multifamily property.</p>
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
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Sq Ft</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Current Rent</TableHead>
                  <TableHead className="text-right">Market Rent</TableHead>
                  <TableHead>Tenant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUnits.map((unit) => {
                  const badge = STATUS_BADGE[unit.status] || STATUS_BADGE.vacant;
                  const variance = unit.marketRent > 0
                    ? ((unit.marketRent - unit.currentRent) / unit.marketRent * 100)
                    : 0;
                  return (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.unitNumber}</TableCell>
                      <TableCell>{unit.type}</TableCell>
                      <TableCell className="text-right">{unit.sqFt.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">${unit.currentRent.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${unit.marketRent.toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {unit.tenant || "--"}
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
