import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Plus, Target, Edit, Trash2, RefreshCw, MapPin, DollarSign, Building, Anchor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";

type InvestmentMandate = {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;
  fundId?: string;
  targetStates?: string[];
  targetRegions?: string[];
  marinaTypes?: string[];
  minSlips?: number;
  maxSlips?: number;
  minPrice?: string;
  maxPrice?: string;
  minCapRate?: string;
  maxCapRate?: string;
  minRevenue?: string;
  maxRevenue?: string;
  requiredAmenities?: string[];
  excludedAmenities?: string[];
  scoringWeights?: Record<string, number>;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const MARINA_TYPES = [
  { value: "full_service", label: "Full Service" },
  { value: "dry_stack", label: "Dry Stack" },
  { value: "wet_slip", label: "Wet Slip Only" },
  { value: "mixed", label: "Mixed Use" },
  { value: "yacht_club", label: "Yacht Club" },
  { value: "boatyard", label: "Boatyard" },
];

export function MandatesTab() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingMandate, setEditingMandate] = useState<InvestmentMandate | null>(null);
  const { toast } = useToast();

  const { data: mandates, isLoading } = useQuery<InvestmentMandate[]>({
    queryKey: ["/api/vantage/investment-mandates"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<InvestmentMandate>) => {
      return apiRequest("POST", "/api/vantage/investment-mandates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vantage/investment-mandates"] });
      setCreateDialogOpen(false);
      toast({ title: "Success", description: "Investment criteria created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InvestmentMandate> }) => {
      return apiRequest("PATCH", `/api/vantage/investment-mandates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vantage/investment-mandates"] });
      setEditingMandate(null);
      toast({ title: "Success", description: "Investment criteria updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/vantage/investment-mandates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vantage/investment-mandates"] });
      toast({ title: "Success", description: "Investment criteria deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const formatCurrencyValue = (value: string | undefined) => {
    if (!value) return null;
    return formatCurrency(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Investment Mandates</h2>
          <p className="text-sm text-muted-foreground">
            Define investment criteria to automatically score incoming deals
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="btn-add-criteria">
              <Plus className="h-4 w-4 mr-2" />
              Add Criteria
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Investment Criteria</DialogTitle>
              <DialogDescription>
                Define investment criteria to automatically score and filter incoming deals
              </DialogDescription>
            </DialogHeader>
            <MandateForm
              onSubmit={(data) => createMutation.mutate(data)}
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : mandates?.length ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {mandates.map((mandate) => (
            <Card key={mandate.id} className={!mandate.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Target className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base" data-testid={`mandate-name-${mandate.id}`}>
                        {mandate.name}
                      </CardTitle>
                      <CardDescription>Priority: {mandate.priority}</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={mandate.isActive}
                    onCheckedChange={(checked) => 
                      updateMutation.mutate({ id: mandate.id, data: { isActive: checked } })
                    }
                    data-testid={`switch-mandate-${mandate.id}`}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {mandate.description && (
                  <p className="text-sm text-muted-foreground">{mandate.description}</p>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {(mandate.minPrice || mandate.maxPrice) && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {formatCurrencyValue(mandate.minPrice)} - {formatCurrencyValue(mandate.maxPrice)}
                      </span>
                    </div>
                  )}
                  
                  {(mandate.minSlips || mandate.maxSlips) && (
                    <div className="flex items-center gap-2">
                      <Anchor className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {mandate.minSlips || 0} - {mandate.maxSlips || "∞"} slips
                      </span>
                    </div>
                  )}
                  
                  {mandate.targetStates && mandate.targetStates.length > 0 && (
                    <div className="flex items-center gap-2 col-span-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-wrap gap-1">
                        {mandate.targetStates.slice(0, 5).map((state) => (
                          <Badge key={state} variant="secondary" className="text-xs">
                            {state}
                          </Badge>
                        ))}
                        {mandate.targetStates.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{mandate.targetStates.length - 5} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {mandate.marinaTypes && mandate.marinaTypes.length > 0 && (
                    <div className="flex items-center gap-2 col-span-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-wrap gap-1">
                        {mandate.marinaTypes.map((type) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {MARINA_TYPES.find(t => t.value === type)?.label || type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingMandate(mandate)}
                    data-testid={`btn-edit-mandate-${mandate.id}`}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteMutation.mutate(mandate.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`btn-delete-mandate-${mandate.id}`}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Investment Mandates</h3>
            <p className="text-muted-foreground mb-4">
              Create investment mandates to automatically score deals against your criteria
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Criteria
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingMandate} onOpenChange={(open) => !open && setEditingMandate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Investment Criteria</DialogTitle>
            <DialogDescription>
              Update the criteria for this investment profile
            </DialogDescription>
          </DialogHeader>
          {editingMandate && (
            <MandateForm
              initialData={editingMandate}
              onSubmit={(data) => updateMutation.mutate({ id: editingMandate.id, data })}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MandateForm({
  initialData,
  onSubmit,
  isLoading,
}: {
  initialData?: Partial<InvestmentMandate>;
  onSubmit: (data: Partial<InvestmentMandate>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
    priority: initialData?.priority || 1,
    isActive: initialData?.isActive ?? true,
    targetStates: initialData?.targetStates || [],
    marinaTypes: initialData?.marinaTypes || [],
    minSlips: initialData?.minSlips?.toString() || "",
    maxSlips: initialData?.maxSlips?.toString() || "",
    minPrice: initialData?.minPrice || "",
    maxPrice: initialData?.maxPrice || "",
    minCapRate: initialData?.minCapRate || "",
    maxCapRate: initialData?.maxCapRate || "",
    minRevenue: initialData?.minRevenue || "",
    maxRevenue: initialData?.maxRevenue || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: formData.name,
      description: formData.description || undefined,
      priority: formData.priority,
      isActive: formData.isActive,
      targetStates: formData.targetStates.length > 0 ? formData.targetStates : undefined,
      marinaTypes: formData.marinaTypes.length > 0 ? formData.marinaTypes : undefined,
      minSlips: formData.minSlips ? parseInt(formData.minSlips) : undefined,
      maxSlips: formData.maxSlips ? parseInt(formData.maxSlips) : undefined,
      minPrice: formData.minPrice || undefined,
      maxPrice: formData.maxPrice || undefined,
      minCapRate: formData.minCapRate || undefined,
      maxCapRate: formData.maxCapRate || undefined,
      minRevenue: formData.minRevenue || undefined,
      maxRevenue: formData.maxRevenue || undefined,
    });
  };

  const toggleState = (state: string) => {
    setFormData(prev => ({
      ...prev,
      targetStates: prev.targetStates.includes(state)
        ? prev.targetStates.filter(s => s !== state)
        : [...prev.targetStates, state]
    }));
  };

  const toggleMarinaType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      marinaTypes: prev.marinaTypes.includes(type)
        ? prev.marinaTypes.filter(t => t !== type)
        : [...prev.marinaTypes, type]
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Mandate Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Southeast Full-Service Marinas"
            required
            data-testid="input-mandate-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select
            value={formData.priority.toString()}
            onValueChange={(value) => setFormData({ ...formData, priority: parseInt(value) })}
          >
            <SelectTrigger data-testid="select-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 - Highest</SelectItem>
              <SelectItem value="2">2 - High</SelectItem>
              <SelectItem value="3">3 - Medium</SelectItem>
              <SelectItem value="4">4 - Low</SelectItem>
              <SelectItem value="5">5 - Lowest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe the investment thesis for this mandate..."
          rows={2}
          data-testid="textarea-description"
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <Label>Target States</Label>
        <div className="flex flex-wrap gap-1.5">
          {US_STATES.map((state) => (
            <Badge
              key={state}
              variant={formData.targetStates.includes(state) ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => toggleState(state)}
              data-testid={`badge-state-${state}`}
            >
              {state}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Marina Types</Label>
        <div className="flex flex-wrap gap-2">
          {MARINA_TYPES.map((type) => (
            <Badge
              key={type.value}
              variant={formData.marinaTypes.includes(type.value) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleMarinaType(type.value)}
              data-testid={`badge-type-${type.value}`}
            >
              {type.label}
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="minPrice">Min Price ($)</Label>
          <Input
            id="minPrice"
            type="number"
            value={formData.minPrice}
            onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })}
            placeholder="1000000"
            data-testid="input-min-price"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxPrice">Max Price ($)</Label>
          <Input
            id="maxPrice"
            type="number"
            value={formData.maxPrice}
            onChange={(e) => setFormData({ ...formData, maxPrice: e.target.value })}
            placeholder="50000000"
            data-testid="input-max-price"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="minSlips">Min Slips</Label>
          <Input
            id="minSlips"
            type="number"
            value={formData.minSlips}
            onChange={(e) => setFormData({ ...formData, minSlips: e.target.value })}
            placeholder="50"
            data-testid="input-min-slips"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxSlips">Max Slips</Label>
          <Input
            id="maxSlips"
            type="number"
            value={formData.maxSlips}
            onChange={(e) => setFormData({ ...formData, maxSlips: e.target.value })}
            placeholder="500"
            data-testid="input-max-slips"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="minCapRate">Min Cap Rate (%)</Label>
          <Input
            id="minCapRate"
            type="number"
            step="0.1"
            value={formData.minCapRate}
            onChange={(e) => setFormData({ ...formData, minCapRate: e.target.value })}
            placeholder="5.0"
            data-testid="input-min-cap-rate"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxCapRate">Max Cap Rate (%)</Label>
          <Input
            id="maxCapRate"
            type="number"
            step="0.1"
            value={formData.maxCapRate}
            onChange={(e) => setFormData({ ...formData, maxCapRate: e.target.value })}
            placeholder="10.0"
            data-testid="input-max-cap-rate"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="minRevenue">Min Revenue ($)</Label>
          <Input
            id="minRevenue"
            type="number"
            value={formData.minRevenue}
            onChange={(e) => setFormData({ ...formData, minRevenue: e.target.value })}
            placeholder="500000"
            data-testid="input-min-revenue"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxRevenue">Max Revenue ($)</Label>
          <Input
            id="maxRevenue"
            type="number"
            value={formData.maxRevenue}
            onChange={(e) => setFormData({ ...formData, maxRevenue: e.target.value })}
            placeholder="5000000"
            data-testid="input-max-revenue"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
          data-testid="switch-mandate-active"
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} data-testid="btn-save-criteria">
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Criteria"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
