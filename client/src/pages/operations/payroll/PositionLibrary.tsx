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
import { usePositions, useDepartments, useCreatePosition } from "@/hooks/use-payroll";
import { Plus, Users, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ROLE_GROUPS = [
  { value: "MGMT", label: "Management" },
  { value: "OPS", label: "Operations" },
  { value: "MAINT", label: "Maintenance" },
  { value: "ADMIN", label: "Admin" },
  { value: "SEASONAL", label: "Seasonal" },
  { value: "OTHER", label: "Other" },
];

const ASSET_CLASSES = [
  { value: "marina", label: "Marina" },
  { value: "boatyard", label: "Boatyard" },
  { value: "rv_park", label: "RV Park" },
  { value: "campground", label: "Campground" },
  { value: "mixed_use", label: "Mixed Use" },
];

export default function PositionLibrary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: positionsData, isLoading } = usePositions(user?.orgId, true);
  const positions = positionsData?.positions || [];
  const { data: departmentsData } = useDepartments(user?.orgId);
  const departments = departmentsData?.departments || [];
  const createPosition = useCreatePosition();
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [newPosOpen, setNewPosOpen] = useState(false);

  const [posForm, setPosForm] = useState({
    title: "",
    roleGroup: "OPS",
    defaultDepartmentId: "",
    assetClass: "marina",
  });

  const handleCreatePosition = async () => {
    if (!posForm.title) return;
    try {
      await createPosition.mutateAsync({
        orgId: user?.orgId,
        title: posForm.title,
        roleGroup: posForm.roleGroup,
        defaultDepartmentId: posForm.defaultDepartmentId && posForm.defaultDepartmentId !== "none" ? posForm.defaultDepartmentId : null,
        assetClass: posForm.assetClass,
        isTemplate: true,
      });
      toast({ title: "Position created", description: `"${posForm.title}" added to the library.` });
      setPosForm({ title: "", roleGroup: "OPS", defaultDepartmentId: "", assetClass: "marina" });
      setNewPosOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getDeptName = (deptId: string) =>
    departments?.find((d: any) => d.id === deptId)?.name || "—";

  const getRoleLabel = (value: string) =>
    ROLE_GROUPS.find((g) => g.value === value)?.label || value;

  const filtered = positions.filter((pos: any) => {
    const roleLabel = getRoleLabel(pos.roleGroup || "");
    const matchesSearch =
      !search ||
      pos.title.toLowerCase().includes(search.toLowerCase()) ||
      roleLabel.toLowerCase().includes(search.toLowerCase());
    const matchesGroup =
      filterGroup === "all" || pos.roleGroup === filterGroup;
    return matchesSearch && matchesGroup;
  });

  const grouped = filtered.reduce((acc: Record<string, any[]>, pos: any) => {
    const group = getRoleLabel(pos.roleGroup || "OTHER");
    if (!acc[group]) acc[group] = [];
    acc[group].push(pos);
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Position Library</h2>
          <p className="text-sm text-muted-foreground">
            Standard position templates used when adding lines to payroll plans
          </p>
        </div>
        <Dialog open={newPosOpen} onOpenChange={setNewPosOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Position
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Position Template</DialogTitle>
              <DialogDescription>
                Add a reusable position template to your library
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Position Title <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g., Dockmaster, Marina Manager, Fuel Attendant"
                  value={posForm.title}
                  onChange={(e) => setPosForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role Group</Label>
                  <Select
                    value={posForm.roleGroup}
                    onValueChange={(v) => setPosForm((prev) => ({ ...prev, roleGroup: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_GROUPS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Asset Class</Label>
                  <Select
                    value={posForm.assetClass}
                    onValueChange={(v) => setPosForm((prev) => ({ ...prev, assetClass: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSET_CLASSES.map((ac) => (
                        <SelectItem key={ac.value} value={ac.value}>{ac.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Default Department</Label>
                <Select
                  value={posForm.defaultDepartmentId}
                  onValueChange={(v) => setPosForm((prev) => ({ ...prev, defaultDepartmentId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a department (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departments.map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewPosOpen(false)}>Cancel</Button>
              <Button
                onClick={handleCreatePosition}
                disabled={!posForm.title || createPosition.isPending}
              >
                {createPosition.isPending ? "Creating..." : "Create Position"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
              <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
                  : "Click \"New Position\" to create your first position template."}
              </p>
            </div>
            {!search && filterGroup === "all" && (
              <Button onClick={() => setNewPosOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Position
              </Button>
            )}
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
                <div className="overflow-x-auto w-full">
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
                </div>
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
