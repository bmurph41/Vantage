import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useEmployees, useCreateEmployee } from "@/hooks/use-payroll";
import { Plus, UserPlus, Search, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Employees() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: employeesData, isLoading } = useEmployees(user?.orgId);
  const { data: ownedAssetsData } = useQuery<any>({
    queryKey: ["/api/owned-assets"],
  });
  const createEmployee = useCreateEmployee();

  const employees = employeesData?.employees || employeesData || [];
  const ownedAssets = ownedAssetsData || [];

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterAsset, setFilterAsset] = useState<string>("all");
  const [newEmpOpen, setNewEmpOpen] = useState(false);

  const [empForm, setEmpForm] = useState({
    firstName: "",
    lastName: "",
    displayName: "",
    workerType: "W2",
    status: "ACTIVE",
    assetId: "",
  });

  const handleCreateEmployee = async () => {
    if (!empForm.firstName || !empForm.lastName) return;
    try {
      await createEmployee.mutateAsync({
        orgId: user?.orgId,
        firstName: empForm.firstName,
        lastName: empForm.lastName,
        displayName: empForm.displayName || `${empForm.firstName} ${empForm.lastName}`,
        workerType: empForm.workerType,
        status: empForm.status,
        assetId: empForm.assetId && empForm.assetId !== "none" ? empForm.assetId : null,
      });
      toast({ title: "Employee added", description: `${empForm.firstName} ${empForm.lastName} has been added.` });
      setEmpForm({ firstName: "", lastName: "", displayName: "", workerType: "W2", status: "ACTIVE", assetId: "" });
      setNewEmpOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getAssetName = (assetId: string | null) => {
    if (!assetId) return "—";
    const asset = ownedAssets.find((a: any) => a.id === assetId);
    return asset?.property?.name || asset?.propertyName || asset?.name || "Unknown Asset";
  };

  const filtered = employees.filter((emp: any) => {
    const name = `${emp.firstName} ${emp.lastName} ${emp.displayName || ""}`.toLowerCase();
    const matchesSearch = !search || name.includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || emp.status === filterStatus;
    const matchesAsset = filterAsset === "all" || emp.assetId === filterAsset;
    return matchesSearch && matchesStatus && matchesAsset;
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Employees</h2>
          <p className="text-sm text-muted-foreground">
            Manage employees and assign them to owned assets and payroll plans
          </p>
        </div>
        <Dialog open={newEmpOpen} onOpenChange={setNewEmpOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Employee</DialogTitle>
              <DialogDescription>
                Add a new employee to your organization. You can assign them to an owned asset and payroll plans.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="John"
                    value={empForm.firstName}
                    onChange={(e) => setEmpForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Doe"
                    value={empForm.lastName}
                    onChange={(e) => setEmpForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  placeholder="Optional — defaults to first + last"
                  value={empForm.displayName}
                  onChange={(e) => setEmpForm((prev) => ({ ...prev, displayName: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Worker Type</Label>
                  <Select
                    value={empForm.workerType}
                    onValueChange={(v) => setEmpForm((prev) => ({ ...prev, workerType: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="W2">W-2 Employee</SelectItem>
                      <SelectItem value="CONTRACTOR_1099">1099 Contractor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={empForm.status}
                    onValueChange={(v) => setEmpForm((prev) => ({ ...prev, status: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Assigned Asset</Label>
                <Select
                  value={empForm.assetId}
                  onValueChange={(v) => setEmpForm((prev) => ({ ...prev, assetId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an owned asset (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No asset assigned</SelectItem>
                    {ownedAssets.map((asset: any) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.property?.name || asset.propertyName || asset.name || `Asset ${asset.id.slice(0, 8)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Assign this employee to a specific marina or property you own
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewEmpOpen(false)}>Cancel</Button>
              <Button
                onClick={handleCreateEmployee}
                disabled={!empForm.firstName || !empForm.lastName || createEmployee.isPending}
              >
                {createEmployee.isPending ? "Adding..." : "Add Employee"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {ownedAssets.length > 0 && (
          <Select value={filterAsset} onValueChange={setFilterAsset}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Assets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assets</SelectItem>
              {ownedAssets.map((asset: any) => (
                <SelectItem key={asset.id} value={asset.id}>
                  {asset.property?.name || asset.propertyName || asset.name || `Asset ${asset.id.slice(0, 8)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="p-4 rounded-full bg-primary/10">
              <UserPlus className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">
                {search || filterStatus !== "all" || filterAsset !== "all"
                  ? "No Matching Employees"
                  : "No Employees Yet"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {search || filterStatus !== "all" || filterAsset !== "all"
                  ? "Try adjusting your search or filters."
                  : "Add employees to track them across payroll plans, assign them to owned assets, and manage compensation."}
              </p>
            </div>
            {!search && filterStatus === "all" && filterAsset === "all" && (
              <Button onClick={() => setNewEmpOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add First Employee
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Employee Roster</CardTitle>
                <CardDescription>{filtered.length} employee{filtered.length !== 1 ? "s" : ""}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Worker Type</TableHead>
                  <TableHead>Assigned Asset</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((emp: any) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {emp.displayName || `${emp.firstName} ${emp.lastName}`}
                        </div>
                        {emp.displayName && (
                          <div className="text-xs text-muted-foreground">
                            {emp.firstName} {emp.lastName}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={emp.workerType === "W2" ? "default" : "secondary"} className="text-xs">
                        {emp.workerType === "W2" ? "W-2" : "1099"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {emp.assetId ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{getAssetName(emp.assetId)}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={emp.status === "ACTIVE" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {emp.status === "ACTIVE" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {emp.createdAt ? new Date(emp.createdAt).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
