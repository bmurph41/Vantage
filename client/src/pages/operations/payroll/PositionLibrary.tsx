import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePositions, useDepartments } from "@/hooks/use-payroll";
import { Plus, Users, Search } from "lucide-react";

const ROLE_GROUPS = [
  "Management",
  "Operations",
  "Maintenance",
  "Retail",
  "Service",
  "Admin",
  "Seasonal",
  "Other",
];

export default function PositionLibrary() {
  const { user } = useAuth();
  const { data: positions, isLoading } = usePositions(user?.orgId, true);
  const { data: departments } = useDepartments();
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState<string>("all");

  const getDeptName = (deptId: string) =>
    departments?.find((d: any) => d.id === deptId)?.name || "—";

  const filtered = (positions || []).filter((pos: any) => {
    const matchesSearch =
      !search ||
      pos.title.toLowerCase().includes(search.toLowerCase()) ||
      (pos.roleGroup || "").toLowerCase().includes(search.toLowerCase());
    const matchesGroup =
      filterGroup === "all" || pos.roleGroup === filterGroup;
    return matchesSearch && matchesGroup;
  });

  // Group by role group
  const grouped = filtered.reduce((acc: Record<string, any[]>, pos: any) => {
    const group = pos.roleGroup || "Other";
    if (!acc[group]) acc[group] = [];
    acc[group].push(pos);
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Position Library</h2>
          <p className="text-sm text-muted-foreground">
            Standard position templates used when adding lines to payroll plans
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search positions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterGroup} onValueChange={setFilterGroup}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            {ROLE_GROUPS.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Position Groups */}
      {Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="p-4 rounded-full bg-primary/10">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">No Positions Found</h3>
              <p className="text-sm text-muted-foreground">
                {search || filterGroup !== "all"
                  ? "Try adjusting your search or filter."
                  : "Position templates will appear here once seeded."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([group, groupPositions]) => (
            <Card key={group}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{group}</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {groupPositions.length}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Default Department</TableHead>
                      <TableHead>Asset Class</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupPositions.map((pos: any) => (
                      <TableRow key={pos.id}>
                        <TableCell className="font-medium">{pos.title}</TableCell>
                        <TableCell>{getDeptName(pos.defaultDepartmentId)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">
                            {pos.assetClass || "—"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
      )}

      <div className="text-xs text-muted-foreground text-center">
        {filtered.length} position{filtered.length !== 1 ? "s" : ""} total
      </div>
    </div>
  );
}
