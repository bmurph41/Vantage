import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit, Wrench, DollarSign, TrendingUp, Download } from "lucide-react";
import { format, subMonths } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/formatUtils";
import ImportFromActualsModal from "@/components/operations/ImportFromActualsModal";

interface ServiceWorkOrder {
  id: string;
  openDate: string;
  closeDate?: string | null;
  laborRevenue: string;
  partsRevenue: string;
  cogs: string;
  status: string;
  source: string;
  notes?: string | null;
}

interface ServiceSummary {
  totalLaborRevenue: number;
  totalPartsRevenue: number;
  totalRevenue: number;
  totalCogs: number;
  grossMargin: number;
  marginPercent: number;
  orderCount: string;
}

interface ValuatorServiceDeptProps {
  projectId: string;
  projectName: string;
}

export default function ValuatorServiceDeptTab({ projectId, projectName }: ValuatorServiceDeptProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ServiceWorkOrder | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [period, setPeriod] = useState<"ytd" | "12m" | "all">("12m");
  
  const [formData, setFormData] = useState({
    openDate: format(new Date(), "yyyy-MM-dd"),
    closeDate: "",
    laborRevenue: "",
    partsRevenue: "",
    cogs: "",
    status: "closed",
    notes: "",
  });

  const getDateRange = () => {
    const now = new Date();
    if (period === "ytd") {
      return {
        startDate: format(new Date(now.getFullYear(), 0, 1), "yyyy-MM-dd"),
        endDate: format(now, "yyyy-MM-dd"),
      };
    } else if (period === "12m") {
      return {
        startDate: format(subMonths(now, 12), "yyyy-MM-dd"),
        endDate: format(now, "yyyy-MM-dd"),
      };
    }
    return {
      startDate: "2000-01-01",
      endDate: format(now, "yyyy-MM-dd"),
    };
  };
  
  const dateRange = getDateRange();

  const { data: workOrders = [], isLoading } = useQuery<ServiceWorkOrder[]>({
    queryKey: ["/api/operations-context/projects", projectId, "ops/service", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const res = await fetch(`/api/operations-context/projects/${projectId}/ops/service?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch service work orders");
      const data = await res.json();
      return data.data || [];
    },
  });

  const { data: summary } = useQuery<ServiceSummary>({
    queryKey: ["/api/operations-context/projects", projectId, "ops/service/summary", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const res = await fetch(`/api/operations-context/projects/${projectId}/ops/service/summary?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch summary");
      const data = await res.json();
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<ServiceWorkOrder>) => {
      return apiRequest(`/api/operations-context/projects/${projectId}/ops/service`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/projects", projectId] });
      toast({ title: "Success", description: "Service work order added" });
      setShowAddDialog(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add work order", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return apiRequest(`/api/operations-context/projects/${projectId}/ops/service/${orderId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/projects", projectId] });
      toast({ title: "Success", description: "Work order deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete work order", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ServiceWorkOrder> }) => {
      return apiRequest(`/api/operations-context/projects/${projectId}/ops/service/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/projects", projectId] });
      toast({ title: "Success", description: "Work order updated" });
      setEditingOrder(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update work order", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      openDate: format(new Date(), "yyyy-MM-dd"),
      closeDate: "",
      laborRevenue: "",
      partsRevenue: "",
      cogs: "",
      status: "closed",
      notes: "",
    });
  };

  const handleSubmit = () => {
    if (!formData.openDate || !formData.laborRevenue) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      openDate: formData.openDate,
      closeDate: formData.closeDate || null,
      laborRevenue: formData.laborRevenue,
      partsRevenue: formData.partsRevenue || "0",
      cogs: formData.cogs || "0",
      status: formData.status,
      notes: formData.notes || null,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Service Department
          </h3>
          <p className="text-sm text-muted-foreground">
            Track labor and parts revenue for {projectName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v: "ytd" | "12m" | "all") => setPeriod(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ytd">YTD</SelectItem>
              <SelectItem value="12m">Last 12M</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
            <Download className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Work Order
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Service Work Order</DialogTitle>
                <DialogDescription>Record a service department transaction</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Open Date *</Label>
                    <Input
                      type="date"
                      value={formData.openDate}
                      onChange={(e) => setFormData({ ...formData, openDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Close Date</Label>
                    <Input
                      type="date"
                      value={formData.closeDate}
                      onChange={(e) => setFormData({ ...formData, closeDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Labor Revenue *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.laborRevenue}
                      onChange={(e) => setFormData({ ...formData, laborRevenue: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Parts Revenue</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.partsRevenue}
                      onChange={(e) => setFormData({ ...formData, partsRevenue: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>COGS</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.cogs}
                      onChange={(e) => setFormData({ ...formData, cogs: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Optional notes..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Adding..." : "Add Work Order"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary?.totalRevenue || 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Labor Revenue</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary?.totalLaborRevenue || 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Parts Revenue</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary?.totalPartsRevenue || 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gross Margin</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(summary?.grossMargin || 0)}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({(summary?.marginPercent || 0).toFixed(1)}%)
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Work Orders ({workOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {workOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No service work orders recorded yet</p>
              <p className="text-sm">Add work orders manually or import from actuals</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Open Date</TableHead>
                  <TableHead>Close Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Labor</TableHead>
                  <TableHead className="text-right">Parts</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workOrders.map((order) => {
                  const labor = parseFloat(order.laborRevenue) || 0;
                  const parts = parseFloat(order.partsRevenue) || 0;
                  const cogs = parseFloat(order.cogs) || 0;
                  const margin = labor + parts - cogs;
                  return (
                    <TableRow key={order.id}>
                      <TableCell>{format(new Date(order.openDate), "MM/dd/yyyy")}</TableCell>
                      <TableCell>{order.closeDate ? format(new Date(order.closeDate), "MM/dd/yyyy") : "-"}</TableCell>
                      <TableCell>
                        <Badge variant={order.status === "closed" ? "default" : "secondary"}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(labor)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(parts)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(cogs)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(margin)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{order.source}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingOrder(order)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(order.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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

      <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
        <DialogContent key={editingOrder?.id}>
          <DialogHeader>
            <DialogTitle>Edit Work Order</DialogTitle>
            <DialogDescription>Update service work order details</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!editingOrder) return;
            const fd = new FormData(e.currentTarget);
            updateMutation.mutate({
              id: editingOrder.id,
              data: {
                openDate: fd.get("editOpenDate") as string,
                closeDate: (fd.get("editCloseDate") as string) || null,
                laborRevenue: fd.get("editLaborRevenue") as string,
                partsRevenue: (fd.get("editPartsRevenue") as string) || "0",
                cogs: (fd.get("editCogs") as string) || "0",
                status: fd.get("editStatus") as string,
                notes: (fd.get("editNotes") as string) || null,
              },
            });
          }}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Open Date</Label>
                  <Input type="date" name="editOpenDate" defaultValue={editingOrder?.openDate?.split('T')[0]} />
                </div>
                <div className="space-y-2">
                  <Label>Close Date</Label>
                  <Input type="date" name="editCloseDate" defaultValue={editingOrder?.closeDate?.split('T')[0] || ''} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Labor Revenue</Label>
                  <Input type="number" step="0.01" name="editLaborRevenue" defaultValue={editingOrder?.laborRevenue} />
                </div>
                <div className="space-y-2">
                  <Label>Parts Revenue</Label>
                  <Input type="number" step="0.01" name="editPartsRevenue" defaultValue={editingOrder?.partsRevenue} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>COGS</Label>
                  <Input type="number" step="0.01" name="editCogs" defaultValue={editingOrder?.cogs} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select name="editStatus" defaultValue={editingOrder?.status} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input name="editNotes" defaultValue={editingOrder?.notes || ''} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingOrder(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ImportFromActualsModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        projectId={projectId}
        dataTypes={["service"]}
      />
    </div>
  );
}
