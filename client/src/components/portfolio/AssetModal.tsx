import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, Calendar, DollarSign, Target, FileText, Link2, Pencil } from "lucide-react";
import { ASSET_REGISTRY, type AssetRegistryEntry } from "@/lib/asset-registry";

interface AssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: any;
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

interface AvailableModelingProject {
  id: string;
  name: string;
  assetClass: string;
  isLinkedToOwnedAsset: boolean;
}

type EntryMode = "linked" | "manual";

// Local currency input helper. Displays $X,XXX,XXX on blur, raw digits on focus.
// Stores plain numeric strings in parent state — formatting is presentation only.
function CurrencyInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const [focused, setFocused] = useState(false);
  const formatted =
    focused || !value
      ? value
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(Number(value));
  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      value={focused ? value : formatted}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
    />
  );
}

export function AssetModal({ open, onOpenChange, asset, mode }: AssetModalProps) {
  const { toast } = useToast();
  const [entryMode, setEntryMode] = useState<EntryMode>("manual");
  const [formData, setFormData] = useState({
    propertyId: "",
    modelingProjectId: "",
    assetClass: "marina",
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
      rev1: "",
      rev2: "",
      rev3: "",
    },
  });

  const { data: availableProperties, isLoading: loadingProperties } = useQuery<AvailableProperty[]>({
    queryKey: ["/api/portfolio/available-properties"],
    enabled: mode === "create" && open,
  });

  const { data: availableModelingProjects, isLoading: loadingModelingProjects } =
    useQuery<AvailableModelingProject[]>({
      queryKey: ["/api/portfolio/available-modeling-projects"],
      enabled: open,
    });

  // Group ASSET_REGISTRY entries by their `group` field for the manual-mode selector
  const assetClassGroups = useMemo(() => {
    const groups: Record<string, Array<[string, AssetRegistryEntry]>> = {};
    Object.entries(ASSET_REGISTRY).forEach(([key, entry]) => {
      if (!groups[entry.group]) groups[entry.group] = [];
      groups[entry.group].push([key, entry]);
    });
    return groups;
  }, []);

  // Resolve current registry entry for dynamic labels (defaults to marina if unknown)
  const registry: AssetRegistryEntry =
    ASSET_REGISTRY[formData.assetClass] || ASSET_REGISTRY["marina"];

  useEffect(() => {
    if (asset && mode === "edit") {
      setEntryMode(asset?.modelingProjectId ? "linked" : "manual");
      setFormData({
        propertyId: asset?.propertyId || "",
        modelingProjectId: asset?.modelingProjectId || "",
        assetClass: asset?.assetClass || "marina",
        acquisitionDate: asset?.acquisitionDate ? asset?.acquisitionDate.split("T")[0] : "",
        acquisitionPrice: asset?.acquisitionPrice?.toString() || "",
        status: asset?.status || "under_management",
        holdStrategy: asset?.holdStrategy || "",
        exitTargetDate: asset?.exitTargetDate ? asset?.exitTargetDate.split("T")[0] : "",
        notes: asset?.notes || "",
        keyMetrics: {
          currentValue: asset?.keyMetrics?.currentValue?.toString() || asset?.currentValue?.toString() || "",
          annualRevenue: asset?.keyMetrics?.annualRevenue?.toString() || asset?.annualRevenue?.toString() || "",
          annualEbitda: asset?.keyMetrics?.annualEbitda?.toString() || asset?.annualEbitda?.toString() || "",
          occupancy: asset?.keyMetrics?.occupancy?.toString() || asset?.occupancy?.toString() || "",
          slips: asset?.keyMetrics?.slips?.toString() || asset?.slips?.toString() || "",
          // Prefer split rev streams; fall back to legacy lump-sum annualRevenue in rev1
          rev1:
            asset?.keyMetrics?.revenueStreams?.rev1?.toString() ||
            (asset?.keyMetrics?.revenueStreams ? "" : asset?.keyMetrics?.annualRevenue?.toString() || asset?.annualRevenue?.toString() || ""),
          rev2: asset?.keyMetrics?.revenueStreams?.rev2?.toString() || "",
          rev3: asset?.keyMetrics?.revenueStreams?.rev3?.toString() || "",
        },
      });
    } else if (mode === "create") {
      setEntryMode("manual");
      setFormData({
        propertyId: "",
        modelingProjectId: "",
        assetClass: "marina",
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
  }, [asset, mode, open]);

  // When the user picks a modeling project in linked mode, copy its assetClass
  // into formData (server is authoritative on create; this keeps the UI honest).
  useEffect(() => {
    if (entryMode !== "linked" || !formData.modelingProjectId || !availableModelingProjects) return;
    const mp = availableModelingProjects.find(p => p.id === formData.modelingProjectId);
    if (mp && mp.assetClass && mp.assetClass !== formData.assetClass) {
      setFormData(prev => ({ ...prev, assetClass: mp.assetClass }));
    }
  }, [entryMode, formData.modelingProjectId, availableModelingProjects]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/portfolio/marinas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/marinas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/available-properties"] });
      toast({ title: "Asset added to portfolio successfully" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to add asset", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/portfolio/marinas/${asset?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/marinas"] });
      toast({ title: "Asset updated successfully" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update asset", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const keyMetrics: Record<string, any> = {};
    if (formData.keyMetrics.currentValue) keyMetrics.currentValue = parseFloat(formData.keyMetrics.currentValue);
    if (formData.keyMetrics.annualEbitda) keyMetrics.annualEbitda = parseFloat(formData.keyMetrics.annualEbitda);
    if (formData.keyMetrics.occupancy) keyMetrics.occupancy = parseFloat(formData.keyMetrics.occupancy);
    if (formData.keyMetrics.slips) keyMetrics.slips = parseFloat(formData.keyMetrics.slips);

    // Revenue streams: store split values + a derived total in annualRevenue for back-compat
    const r1 = formData.keyMetrics.rev1 ? parseFloat(formData.keyMetrics.rev1) : 0;
    const r2 = formData.keyMetrics.rev2 ? parseFloat(formData.keyMetrics.rev2) : 0;
    const r3 = formData.keyMetrics.rev3 ? parseFloat(formData.keyMetrics.rev3) : 0;
    const hasAnyStream =
      !!formData.keyMetrics.rev1 || !!formData.keyMetrics.rev2 || !!formData.keyMetrics.rev3;
    if (hasAnyStream) {
      keyMetrics.revenueStreams = { rev1: r1, rev2: r2, rev3: r3 };
      keyMetrics.annualRevenue = r1 + r2 + r3;
    }

    const payload = {
      propertyId: formData.propertyId || undefined,
      modelingProjectId: entryMode === "linked" ? (formData.modelingProjectId || null) : null,
      assetClass: formData.assetClass || undefined,
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
            {mode === "create" ? "Add Asset to Portfolio" : `Edit ${registry.label}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Link an existing modeling project or manually add an asset to your portfolio"
              : "Update asset details and financial metrics"
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mode toggle: linked modeling project vs manual entry */}
          <div className="space-y-2">
            <Label>Entry Mode</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={entryMode === "linked" ? "default" : "outline"}
                onClick={() => setEntryMode("linked")}
                className="justify-start gap-2"
                data-testid="entry-mode-linked"
              >
                <Link2 className="h-4 w-4" />
                Link Modeling Project
              </Button>
              <Button
                type="button"
                variant={entryMode === "manual" ? "default" : "outline"}
                onClick={() => setEntryMode("manual")}
                className="justify-start gap-2"
                data-testid="entry-mode-manual"
              >
                <Pencil className="h-4 w-4" />
                Manual Entry
              </Button>
            </div>
          </div>

          {/* Linked mode: choose a modeling project */}
          {entryMode === "linked" && (
            <div className="space-y-2">
              <Label htmlFor="modelingProjectId">Modeling Project {mode === "create" ? "*" : ""}</Label>
              {loadingModelingProjects ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading modeling projects...
                </div>
              ) : availableModelingProjects && availableModelingProjects.length > 0 ? (
                <Select
                  value={formData.modelingProjectId}
                  onValueChange={(value) => setFormData({ ...formData, modelingProjectId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a modeling project" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModelingProjects.map((project) => {
                      const ac = ASSET_REGISTRY[project.assetClass];
                      const acLabel = ac?.label || project.assetClass;
                      const inPortfolio = project.isLinkedToOwnedAsset && project.id !== formData.modelingProjectId;
                      return (
                        <SelectItem
                          key={project.id}
                          value={project.id}
                          className={inPortfolio ? "opacity-60" : ""}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {project.name} — {acLabel}
                              {inPortfolio && (
                                <span className="ml-1 text-xs text-muted-foreground">(in portfolio)</span>
                              )}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                  No modeling projects exist for this org. Switch to Manual Entry to add an asset directly.
                </div>
              )}
              {mode === "edit" && (
                <p className="text-xs text-muted-foreground">
                  Asset class is set at creation and does not change with project link.
                </p>
              )}
            </div>
          )}

          {/* Manual mode: pick asset class directly */}
          {entryMode === "manual" && (
            <div className="space-y-2">
              <Label htmlFor="assetClass">Asset Class *</Label>
              <Select
                value={formData.assetClass}
                onValueChange={(value) => setFormData({ ...formData, assetClass: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an asset class" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(assetClassGroups).map(([groupName, entries]) => (
                    <SelectGroup key={groupName}>
                      <SelectLabel>{groupName}</SelectLabel>
                      {entries.map(([key, entry]) => (
                        <SelectItem key={key} value={key}>
                          <span>{entry.icon} {entry.label}</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {mode === "edit" && asset?.modelingProjectId && (
                <p className="text-xs text-muted-foreground">
                  Changing asset class does not update the linked modeling project.
                </p>
              )}
            </div>
          )}

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

          {mode === "edit" && asset && (
            <div className="p-3 bg-muted rounded-md">
              <div className="font-medium">{asset?.name}</div>
              <div className="text-sm text-muted-foreground">
                {asset?.address || `${asset?.location}, ${asset?.state}`}
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
              <CurrencyInput
                id="acquisitionPrice"
                value={formData.acquisitionPrice}
                onChange={(v) => setFormData({ ...formData, acquisitionPrice: v })}
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
                  <SelectItem value="pending_acquisition">Pending Acquisition</SelectItem>
                  <SelectItem value="under_contract">Under Contract</SelectItem>
                  <SelectItem value="under_management">Under Management</SelectItem>
                  <SelectItem value="stabilizing">Stabilizing</SelectItem>
                  <SelectItem value="value_add">Value-Add</SelectItem>
                  <SelectItem value="optimization">Optimization</SelectItem>
                  <SelectItem value="disposition">Disposition</SelectItem>
                  <SelectItem value="disposed">Disposed</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
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
                  <SelectItem value="core_plus">Core Plus</SelectItem>
                  <SelectItem value="value_add">Value-Add</SelectItem>
                  <SelectItem value="opportunistic">Opportunistic</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="distressed">Distressed</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
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
                <CurrencyInput
                  id="currentValue"
                  value={formData.keyMetrics.currentValue}
                  onChange={(v) => setFormData({
                    ...formData,
                    keyMetrics: { ...formData.keyMetrics, currentValue: v }
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="annualEbitda">Annual EBITDA</Label>
                <CurrencyInput
                  id="annualEbitda"
                  value={formData.keyMetrics.annualEbitda}
                  onChange={(v) => setFormData({
                    ...formData,
                    keyMetrics: { ...formData.keyMetrics, annualEbitda: v }
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="occupancy">{registry.occLabel}</Label>
                <Input
                  id="occupancy"
                  type="number"
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
                <Label htmlFor="slips">Total {registry.sizeLabel}</Label>
                <Input
                  id="slips"
                  type="number"
                  value={formData.keyMetrics.slips}
                  onChange={(e) => setFormData({
                    ...formData,
                    keyMetrics: { ...formData.keyMetrics, slips: e.target.value }
                  })}
                />
              </div>
            </div>

            {/* Revenue stream breakdown — labels driven by ASSET_REGISTRY */}
            <div className="mt-4 space-y-3">
              <Label className="text-sm font-medium">Revenue Streams</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => {
                  const key = (`rev${i + 1}`) as "rev1" | "rev2" | "rev3";
                  return (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={key}>{registry.rev[i]}</Label>
                      <CurrencyInput
                        id={key}
                        value={formData.keyMetrics[key]}
                        onChange={(v) => setFormData({
                          ...formData,
                          keyMetrics: { ...formData.keyMetrics, [key]: v }
                        })}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between border-t pt-2 text-sm">
                <span className="text-muted-foreground">Total Annual Revenue</span>
                <span className="font-medium font-mono">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  }).format(
                    (Number(formData.keyMetrics.rev1) || 0) +
                    (Number(formData.keyMetrics.rev2) || 0) +
                    (Number(formData.keyMetrics.rev3) || 0)
                  )}
                </span>
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
