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
import { Plus, Trash2, Ship, Clock, DollarSign, Download } from "lucide-react";
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
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
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
                      <TableCell>{format(new Date(rental.rentalDate), "MMM d, yyyy")}</TableCell>
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
          )}
        </CardContent>
      </Card>

      <ImportFromActualsModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        projectId={projectId}
        dataTypes={["rentals"]}
      />
    </div>
  );
}
