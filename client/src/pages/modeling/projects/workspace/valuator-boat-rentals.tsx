import { useState, useRef } from "react";
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
import { Plus, Trash2, Ship, Clock, DollarSign, Download, Edit, Upload } from "lucide-react";
import { format, subMonths } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/formatUtils";
import ImportFromActualsModal from "@/components/operations/ImportFromActualsModal";

interface BoatRental {
  id: string;
  rentalDate: string;
  hours: string;
  grossSales: string;
  channel?: string | null;
  boatType?: string | null;
  source: string;
  notes?: string | null;
}

interface RentalsSummary {
  totalRevenue: number;
  totalHours: number;
  averageRevenuePerHour: number;
  rentalCount: string;
}

interface ValuatorBoatRentalsProps {
  projectId: string;
  projectName: string;
}

export default function ValuatorBoatRentalsTab({ projectId, projectName }: ValuatorBoatRentalsProps) {
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingRental, setEditingRental] = useState<BoatRental | null>(null);
  const [period, setPeriod] = useState<"ytd" | "12m" | "all">("12m");
  
  const [formData, setFormData] = useState({
    rentalDate: format(new Date(), "yyyy-MM-dd"),
    hours: "",
    grossSales: "",
    channel: "walk-in",
    boatType: "",
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

  const { data: rentals = [], isLoading } = useQuery<BoatRental[]>({
    queryKey: ["/api/operations-context/projects", projectId, "ops/rentals", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const res = await fetch(`/api/operations-context/projects/${projectId}/ops/rentals?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch boat rentals");
      const data = await res.json();
      return data.data || [];
    },
  });

  const { data: summary } = useQuery<RentalsSummary>({
    queryKey: ["/api/operations-context/projects", projectId, "ops/rentals/summary", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const res = await fetch(`/api/operations-context/projects/${projectId}/ops/rentals/summary?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch summary");
      const data = await res.json();
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<BoatRental>) => {
      return apiRequest(`/api/operations-context/projects/${projectId}/ops/rentals`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/projects", projectId] });
      toast({ title: "Success", description: "Boat rental added" });
      setShowAddDialog(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add rental", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (rentalId: string) => {
      return apiRequest(`/api/operations-context/projects/${projectId}/ops/rentals/${rentalId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/projects", projectId] });
      toast({ title: "Success", description: "Rental deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete rental", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BoatRental> }) => {
      return apiRequest(`/api/operations-context/projects/${projectId}/ops/rentals/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/projects", projectId] });
      toast({ title: "Success", description: "Rental updated" });
      setEditingRental(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update rental", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      rentalDate: format(new Date(), "yyyy-MM-dd"),
      hours: "",
      grossSales: "",
      channel: "walk-in",
      boatType: "",
      notes: "",
    });
  };

  const handleSubmit = () => {
    if (!formData.rentalDate || !formData.hours || !formData.grossSales) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      rentalDate: formData.rentalDate,
      hours: formData.hours,
      grossSales: formData.grossSales,
      channel: formData.channel || null,
      boatType: formData.boatType || null,
      notes: formData.notes || null,
    });
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        toast({ title: "Error", description: "CSV file is empty or has no data rows", variant: "destructive" });
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const dateIdx = headers.findIndex((h) => h.includes("date"));
      const hoursIdx = headers.findIndex((h) => h.includes("hour"));
      const salesIdx = headers.findIndex((h) => h.includes("sales") || h.includes("revenue") || h.includes("gross"));
      const channelIdx = headers.findIndex((h) => h.includes("channel"));
      const boatTypeIdx = headers.findIndex((h) => h.includes("boat") || h.includes("type"));

      if (dateIdx === -1 || salesIdx === -1) {
        toast({ title: "Error", description: "CSV must have at least date and sales/revenue columns", variant: "destructive" });
        return;
      }

      let imported = 0;
      let failed = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        if (!cols[dateIdx]) continue;
        try {
          await apiRequest(`/api/operations-context/projects/${projectId}/ops/rentals`, {
            method: "POST",
            body: JSON.stringify({
              rentalDate: cols[dateIdx],
              hours: hoursIdx >= 0 ? cols[hoursIdx] || "0" : "0",
              grossSales: cols[salesIdx] || "0",
              channel: channelIdx >= 0 ? cols[channelIdx] || null : null,
              boatType: boatTypeIdx >= 0 ? cols[boatTypeIdx] || null : null,
              source: "CSV_IMPORT",
            }),
          });
          imported++;
        } catch {
          failed++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/projects", projectId] });
      toast({
        title: "Import Complete",
        description: `${imported} rows imported${failed > 0 ? `, ${failed} failed` : ""}`,
        variant: failed > 0 ? "destructive" : "default",
      });
    } catch {
      toast({ title: "Error", description: "Failed to parse CSV file", variant: "destructive" });
    }
  };

  const handleCsvExport = () => {
    const csvHeaders = ["Date", "Hours", "GrossSales", "Channel", "BoatType", "Source"];
    const csvRows = rentals.map((r) => [
      r.rentalDate,
      r.hours,
      r.grossSales,
      r.channel || "",
      r.boatType || "",
      r.source,
    ].join(","));
    const csvContent = [csvHeaders.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `boat-rentals-${projectId}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${rentals.length} rows exported to CSV` });
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
            <Ship className="h-5 w-5" />
            Boat Rentals
          </h3>
          <p className="text-sm text-muted-foreground">
            Track boat rental revenue for {projectName}
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
          <Button variant="outline" size="sm" onClick={() => csvInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleCsvExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Rental
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Boat Rental</DialogTitle>
                <DialogDescription>Record a boat rental transaction</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rental Date *</Label>
                    <Input
                      type="date"
                      value={formData.rentalDate}
                      onChange={(e) => setFormData({ ...formData, rentalDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hours *</Label>
                    <Input
                      type="number"
                      step="0.5"
                      placeholder="0"
                      value={formData.hours}
                      onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Gross Sales *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.grossSales}
                      onChange={(e) => setFormData({ ...formData, grossSales: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Channel</Label>
                    <Select value={formData.channel} onValueChange={(v) => setFormData({ ...formData, channel: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="walk-in">Walk-in</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Boat Type</Label>
                  <Input
                    placeholder="e.g., Pontoon, Kayak, Jet Ski"
                    value={formData.boatType}
                    onChange={(e) => setFormData({ ...formData, boatType: e.target.value })}
                  />
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
                  {createMutation.isPending ? "Adding..." : "Add Rental"}
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
            <CardDescription>Total Hours</CardDescription>
            <CardTitle className="text-2xl">{(summary?.totalHours || 0).toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg $/Hour</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(summary?.averageRevenuePerHour || 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rentals</CardDescription>
            <CardTitle className="text-2xl">{summary?.rentalCount || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rental Transactions ({rentals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {rentals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Ship className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No boat rentals recorded yet</p>
              <p className="text-sm">Add rentals manually or import from actuals</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Boat Type</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">$/Hour</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentals.map((rental) => {
                  const hours = parseFloat(rental.hours) || 0;
                  const revenue = parseFloat(rental.grossSales) || 0;
                  const perHour = hours > 0 ? revenue / hours : 0;
                  return (
                    <TableRow key={rental.id}>
                      <TableCell>{format(new Date(rental.rentalDate), "MM/dd/yyyy")}</TableCell>
                      <TableCell>{rental.boatType || "-"}</TableCell>
                      <TableCell className="text-right">{hours.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(revenue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(perHour)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{rental.channel || "N/A"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{rental.source}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingRental(rental)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(rental.id)}
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

      <Dialog open={!!editingRental} onOpenChange={(open) => !open && setEditingRental(null)}>
        <DialogContent key={editingRental?.id}>
          <DialogHeader>
            <DialogTitle>Edit Boat Rental</DialogTitle>
            <DialogDescription>Update rental details</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!editingRental) return;
            const fd = new FormData(e.currentTarget);
            updateMutation.mutate({
              id: editingRental.id,
              data: {
                rentalDate: fd.get("editRentalDate") as string,
                hours: fd.get("editHours") as string,
                grossSales: fd.get("editGrossSales") as string,
                channel: (fd.get("editChannel") as string) || null,
                boatType: (fd.get("editBoatType") as string) || null,
                notes: (fd.get("editNotes") as string) || null,
              },
            });
          }}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rental Date</Label>
                  <Input type="date" name="editRentalDate" defaultValue={editingRental?.rentalDate?.split('T')[0]} />
                </div>
                <div className="space-y-2">
                  <Label>Hours</Label>
                  <Input type="number" step="0.5" name="editHours" defaultValue={editingRental?.hours} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Gross Sales</Label>
                  <Input type="number" step="0.01" name="editGrossSales" defaultValue={editingRental?.grossSales} />
                </div>
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <select name="editChannel" defaultValue={editingRental?.channel || 'walk-in'} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="walk-in">Walk-in</option>
                    <option value="online">Online</option>
                    <option value="phone">Phone</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Boat Type</Label>
                <Input name="editBoatType" defaultValue={editingRental?.boatType || ''} placeholder="e.g., Pontoon, Kayak, Jet Ski" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input name="editNotes" defaultValue={editingRental?.notes || ''} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingRental(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />

      <ImportFromActualsModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        projectId={projectId}
        dataTypes={["rentals"]}
      />
    </div>
  );
}
