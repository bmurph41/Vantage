import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, Calendar, DollarSign, Target, FileText } from "lucide-react";

interface MarinaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marina?: any;
  mode: "create" | "edit";
}

interface AvailableProperty {
  id: string;
  title: string;
  address: string;
  city: string;
  state: string;
  slips: number;
}

export function MarinaModal({ open, onOpenChange, marina, mode }: MarinaModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    propertyId: "",
    acquisitionDate: "",
    acquisitionPrice: "",
    status: "under_management",
    holdStrategy: "",
    exitTargetDate: "",
    notes: "",
    keyMetrics: {
      currentValue: "",
      annualRevenue: "",
      annualEbitda: "",
      occupancy: "",
      slips: "",
    },
  });

  const { data: availableProperties, isLoading: loadingProperties } = useQuery<AvailableProperty[]>({
    queryKey: ["/api/portfolio/available-properties"],
    enabled: mode === "create" && open,
  });

  useEffect(() => {
    if (marina && mode === "edit") {
      setFormData({
        propertyId: marina.propertyId || "",
        acquisitionDate: marina.acquisitionDate ? marina.acquisitionDate.split("T")[0] : "",
        acquisitionPrice: marina.acquisitionPrice?.toString() || "",
        status: marina.status || "under_management",
        holdStrategy: marina.holdStrategy || "",
        exitTargetDate: marina.exitTargetDate ? marina.exitTargetDate.split("T")[0] : "",
        notes: marina.notes || "",
        keyMetrics: {
          currentValue: marina.keyMetrics?.currentValue?.toString() || marina.currentValue?.toString() || "",
          annualRevenue: marina.keyMetrics?.annualRevenue?.toString() || marina.annualRevenue?.toString() || "",
          annualEbitda: marina.keyMetrics?.annualEbitda?.toString() || marina.annualEbitda?.toString() || "",
          occupancy: marina.keyMetrics?.occupancy?.toString() || marina.occupancy?.toString() || "",
          slips: marina.keyMetrics?.slips?.toString() || marina.slips?.toString() || "",
        },
      });
    } else if (mode === "create") {
      setFormData({
        propertyId: "",
        acquisitionDate: "",
        acquisitionPrice: "",
        status: "under_management",
        holdStrategy: "",
        exitTargetDate: "",
        notes: "",
        keyMetrics: {
          currentValue: "",
          annualRevenue: "",
          annualEbitda: "",
          occupancy: "",
          slips: "",
        },
      });
    }
  }, [marina, mode, open]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/portfolio/marinas", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/marinas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/available-properties"] });
      toast({ title: "Marina added to portfolio successfully" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to add marina", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/portfolio/marinas/${marina.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/marinas"] });
      toast({ title: "Marina updated successfully" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update marina", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const keyMetrics: Record<string, number> = {};
    if (formData.keyMetrics.currentValue) keyMetrics.currentValue = parseFloat(formData.keyMetrics.currentValue);
    if (formData.keyMetrics.annualRevenue) keyMetrics.annualRevenue = parseFloat(formData.keyMetrics.annualRevenue);
    if (formData.keyMetrics.annualEbitda) keyMetrics.annualEbitda = parseFloat(formData.keyMetrics.annualEbitda);
    if (formData.keyMetrics.occupancy) keyMetrics.occupancy = parseFloat(formData.keyMetrics.occupancy);
    if (formData.keyMetrics.slips) keyMetrics.slips = parseFloat(formData.keyMetrics.slips);

    const payload = {
      propertyId: formData.propertyId || undefined,
      acquisitionDate: formData.acquisitionDate || undefined,
      acquisitionPrice: formData.acquisitionPrice || undefined,
      status: formData.status || undefined,
      holdStrategy: formData.holdStrategy || null,
      exitTargetDate: formData.exitTargetDate || null,
      notes: formData.notes || null,
      keyMetrics: Object.keys(keyMetrics).length > 0 ? keyMetrics : undefined,
    };

    if (mode === "create") {
      if (!payload.propertyId || !payload.acquisitionDate) {
        toast({ title: "Please select a property and enter acquisition date", variant: "destructive" });
        return;
      }
      createMutation.mutate(payload);
    } else {
      updateMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {mode === "create" ? "Add Marina to Portfolio" : "Edit Marina"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create" 
              ? "Select a property from your CRM to add to your portfolio"
              : "Update marina details and financial metrics"
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {mode === "create" && (
            <div className="space-y-2">
              <Label htmlFor="propertyId">Select Property *</Label>
              {loadingProperties ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading properties...
                </div>
              ) : availableProperties && availableProperties.length > 0 ? (
                <Select
                  value={formData.propertyId}
                  onValueChange={(value) => setFormData({ ...formData, propertyId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a property" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProperties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{property.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {property.city}, {property.state} • {property.slips || 0} slips
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                  No available properties. Add properties in the CRM first, or all properties are already in your portfolio.
                </div>
              )}
            </div>
          )}

          {mode === "edit" && marina && (
            <div className="p-3 bg-muted rounded-md">
              <div className="font-medium">{marina.name}</div>
              <div className="text-sm text-muted-foreground">
                {marina.address || `${marina.location}, ${marina.state}`}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="acquisitionDate" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Acquisition Date *
              </Label>
              <Input
                id="acquisitionDate"
                type="date"
                value={formData.acquisitionDate}
                onChange={(e) => setFormData({ ...formData, acquisitionDate: e.target.value })}
                required={mode === "create"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="acquisitionPrice" className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Acquisition Price
              </Label>
              <Input
                id="acquisitionPrice"
                type="number"
                placeholder="e.g. 5000000"
                value={formData.acquisitionPrice}
                onChange={(e) => setFormData({ ...formData, acquisitionPrice: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="under_management">Under Management</SelectItem>
                  <SelectItem value="pending_acquisition">Pending Acquisition</SelectItem>
                  <SelectItem value="disposed">Disposed</SelectItem>
                  <SelectItem value="under_contract">Under Contract</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="holdStrategy" className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                Hold Strategy
              </Label>
              <Select
                value={formData.holdStrategy}
                onValueChange={(value) => setFormData({ ...formData, holdStrategy: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="core">Core (Long-term Hold)</SelectItem>
                  <SelectItem value="value_add">Value-Add</SelectItem>
                  <SelectItem value="opportunistic">Opportunistic</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exitTargetDate">Exit Target Date</Label>
            <Input
              id="exitTargetDate"
              type="date"
              value={formData.exitTargetDate}
              onChange={(e) => setFormData({ ...formData, exitTargetDate: e.target.value })}
            />
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Financial Metrics
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentValue">Current Value</Label>
                <Input
                  id="currentValue"
                  type="number"
                  placeholder="e.g. 6000000"
                  value={formData.keyMetrics.currentValue}
                  onChange={(e) => setFormData({
                    ...formData,
                    keyMetrics: { ...formData.keyMetrics, currentValue: e.target.value }
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="annualRevenue">Annual Revenue</Label>
                <Input
                  id="annualRevenue"
                  type="number"
                  placeholder="e.g. 1200000"
                  value={formData.keyMetrics.annualRevenue}
                  onChange={(e) => setFormData({
                    ...formData,
                    keyMetrics: { ...formData.keyMetrics, annualRevenue: e.target.value }
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="annualEbitda">Annual EBITDA</Label>
                <Input
                  id="annualEbitda"
                  type="number"
                  placeholder="e.g. 400000"
                  value={formData.keyMetrics.annualEbitda}
                  onChange={(e) => setFormData({
                    ...formData,
                    keyMetrics: { ...formData.keyMetrics, annualEbitda: e.target.value }
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="occupancy">Occupancy (%)</Label>
                <Input
                  id="occupancy"
                  type="number"
                  placeholder="e.g. 85"
                  min="0"
                  max="100"
                  value={formData.keyMetrics.occupancy}
                  onChange={(e) => setFormData({
                    ...formData,
                    keyMetrics: { ...formData.keyMetrics, occupancy: e.target.value }
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slips">Total Slips</Label>
                <Input
                  id="slips"
                  type="number"
                  placeholder="e.g. 150"
                  value={formData.keyMetrics.slips}
                  onChange={(e) => setFormData({
                    ...formData,
                    keyMetrics: { ...formData.keyMetrics, slips: e.target.value }
                  })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Notes
            </Label>
            <Textarea
              id="notes"
              placeholder="Additional notes about this asset..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === "create" ? "Add to Portfolio" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
