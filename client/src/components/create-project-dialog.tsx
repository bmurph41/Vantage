import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Building2, Briefcase, Trash2, MapPin, Anchor, PlusCircle, Layers, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AddressAutocompleteInput, type NormalizedAddress } from "@/components/ui/address-autocomplete-input";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { ddClient } from "@/lib/ddClient";
import { apiRequest } from "@/lib/queryClient";
import { toStateAbbr } from "@/lib/state-utils";
import type { CrmDeal, CrmProperty } from "@shared/schema";
import DealFormModal from "@/components/modals/deal-form-modal";
import PropertyFormModal from "@/components/modals/property-form-modal";
import { AssetClassUpgradeModal } from "@/components/billing/AssetClassUpgradeModal";

interface PortfolioProperty {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  placeId: string;
  lat?: number;
  lng?: number;
  addressInputValue: string;
}

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  projectType: z.enum(["single", "portfolio"]).default("single"),
  linkedDealId: z.string().optional(),
  linkedPropertyId: z.string().optional(),
  marinaName: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  placeId: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

type CreateProjectFormValues = z.infer<typeof createProjectSchema>;

interface CreateProjectDialogProps {
  trigger?: React.ReactNode;
}

export function CreateProjectDialog({ trigger }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addressInputValue, setAddressInputValue] = useState("");
  const [portfolioProperties, setPortfolioProperties] = useState<PortfolioProperty[]>([]);
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [showCreateProperty, setShowCreateProperty] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalKey, setUpgradeModalKey] = useState<string>("");

  const generatePropertyId = () => `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addPortfolioProperty = () => {
    setPortfolioProperties(prev => [...prev, {
      id: generatePropertyId(),
      name: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      placeId: "",
      addressInputValue: "",
    }]);
  };

  const removePortfolioProperty = (id: string) => {
    setPortfolioProperties(prev => prev.filter(p => p.id !== id));
  };

  const updatePortfolioProperty = (id: string, updates: Partial<PortfolioProperty>) => {
    setPortfolioProperties(prev => prev.map(p => 
      p.id === id ? { ...p, ...updates } : p
    ));
  };

  const handlePortfolioAddressSelect = (id: string, addr: NormalizedAddress) => {
    updatePortfolioProperty(id, {
      address: addr.line1 || addr.formattedAddress || "",
      city: addr.city || "",
      state: addr.state || "",
      zipCode: addr.postalCode || "",
      placeId: addr.placeId || "",
      lat: addr.lat,
      lng: addr.lng,
      addressInputValue: addr.formattedAddress || "",
    });
  };

  const { data: dealsResponse } = useQuery<{ deals: CrmDeal[] }>({
    queryKey: ["/api/crm/deals"],
    enabled: open,
  });
  const deals = dealsResponse?.deals || [];

  const { data: propertiesResponse } = useQuery<{ properties: CrmProperty[] }>({
    queryKey: ["/api/crm/properties"],
    enabled: open,
  });
  const properties = propertiesResponse?.properties || [];

  const { data: entitlements } = useQuery<{
    assetClasses: string[];
    assetClassTierName: string;
    assetClassCount: number;
  }>({
    queryKey: ["/api/orgs/me/entitlements"],
    enabled: open,
  });

  const form = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      projectType: "single",
      linkedDealId: "",
      linkedPropertyId: "",
      marinaName: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      placeId: "",
    },
  });

  const watchedDealId = form.watch("linkedDealId");
  const watchedPropertyId = form.watch("linkedPropertyId");
  const watchedProjectType = form.watch("projectType");

  const selectedDeal = watchedDealId && watchedDealId !== "_none"
    ? deals.find((d) => d.id === watchedDealId) ?? null
    : null;
  const dealAssetKey = selectedDeal?.assetClass ?? null;
  // Lock if entitlements loaded AND the deal's asset class is not in the entitled list.
  // Note: when entitlements.assetClasses is [] (org with no classes), all mapped types are locked.
  const isDealAssetClassLocked =
    dealAssetKey !== null &&
    entitlements !== undefined &&
    !entitlements.assetClasses.includes(dealAssetKey);

  useEffect(() => {
    if (watchedDealId && watchedDealId !== "_none") {
      const deal = deals.find(d => d.id === watchedDealId);
      if (deal) {
        if (deal.title || deal.name) form.setValue("marinaName", (deal.title || deal.name) ?? "");
        if (deal.city) form.setValue("city", deal.city);
        if (deal.state) form.setValue("state", deal.state);
        const addr = [deal.city, deal.state].filter(Boolean).join(", ");
        if (addr) setAddressInputValue(addr);
        if (!form.getValues("name")) {
          form.setValue("name", `${deal.title || deal.name} DD`);
        }
      }
    }
  }, [watchedDealId, deals]);

  useEffect(() => {
    if (watchedPropertyId && watchedPropertyId !== "_none") {
      const property = properties.find(p => p.id === watchedPropertyId);
      if (property) {
        if (property.title) form.setValue("marinaName", property.title);
        if (property.address) form.setValue("address", property.address);
        if (property.city) form.setValue("city", property.city);
        if (property.state) form.setValue("state", property.state);
        if (property.zipCode) form.setValue("zipCode", property.zipCode);
        const coords = property.coordinates as { lat?: number; lng?: number } | null;
        if (coords?.lat) form.setValue("lat", coords.lat);
        if (coords?.lng) form.setValue("lng", coords.lng);
        setAddressInputValue(property.address || `${property.city || ''}, ${property.state || ''}`);
      }
    }
  }, [watchedPropertyId, properties]);

  const handleAddressSelect = (addr: NormalizedAddress) => {
    form.setValue("address", addr.line1 || addr.formattedAddress || "", { shouldDirty: true });
    form.setValue("city", addr.city || "", { shouldDirty: true });
    form.setValue("state", addr.state || "", { shouldDirty: true });
    form.setValue("zipCode", addr.postalCode || "", { shouldDirty: true });
    form.setValue("placeId", addr.placeId || "", { shouldDirty: true });
    if (addr.lat) form.setValue("lat", addr.lat, { shouldDirty: true });
    if (addr.lng) form.setValue("lng", addr.lng, { shouldDirty: true });
    setAddressInputValue(addr.formattedAddress || "");
  };

  const createProjectMutation = useMutation({
    mutationFn: async (values: CreateProjectFormValues) => {
      const coordinates = (values.lat && values.lng) 
        ? { lat: values.lat, lng: values.lng } 
        : undefined;
      
      const portfolioPropertiesPayload = values.projectType === "portfolio" 
        ? portfolioProperties.filter(p => p.name).map(p => ({
            name: p.name,
            address: p.address || undefined,
            city: p.city || undefined,
            state: p.state || undefined,
            zipCode: p.zipCode || undefined,
            placeId: p.placeId || undefined,
            coordinates: (p.lat && p.lng) ? { lat: p.lat, lng: p.lng } : undefined,
          }))
        : undefined;

      const response = await apiRequest("POST", "/api/dd/projects", {
        name: values.name,
        description: values.description || undefined,
        projectType: values.projectType as "single" | "portfolio",
        dealId: values.linkedDealId && values.linkedDealId !== "_none" ? values.linkedDealId : undefined,
        propertyId: values.linkedPropertyId && values.linkedPropertyId !== "_none" ? values.linkedPropertyId : undefined,
        marinaName: values.marinaName || undefined,
        address: values.address || undefined,
        city: values.city || undefined,
        state: values.state || undefined,
        zipCode: values.zipCode || undefined,
        placeId: values.placeId || undefined,
        coordinates,
        portfolioProperties: portfolioPropertiesPayload,
      });
      return response.json();
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dd/projects"] });
      queryClient.invalidateQueries({ queryKey: ["all-projects-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/properties"] });
      const childCount = portfolioProperties.filter(p => p.name).length;
      toast({
        title: "Project created",
        description: watchedProjectType === "portfolio" && childCount > 0
          ? `"${project.name}" portfolio created with ${childCount} properties.`
          : `"${project.name}" has been created successfully.`,
      });
      setOpen(false);
      form.reset();
      setAddressInputValue("");
      setPortfolioProperties([]);
      navigate(`/dd/projects/${project.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error creating project",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: CreateProjectFormValues) => {
    createProjectMutation.mutate(values);
  };

  const hasLinkedDealOrProperty = (watchedDealId && watchedDealId !== "_none") || 
                                   (watchedPropertyId && watchedPropertyId !== "_none");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Create Due Diligence Project
            {entitlements && (
              <Badge variant="secondary" className="text-xs font-normal ml-1 flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {entitlements.assetClassTierName}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Start a new due diligence project. You can link it to an existing deal or property, or enter a new address.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="projectType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Project Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="single" id="single" />
                        <Label htmlFor="single" className="flex items-center gap-2 cursor-pointer">
                          <Building2 className="h-4 w-4" />
                          Single Property
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="portfolio" id="portfolio" />
                        <Label htmlFor="portfolio" className="flex items-center gap-2 cursor-pointer">
                          <Briefcase className="h-4 w-4" />
                          Portfolio
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormDescription>
                    {field.value === "portfolio" 
                      ? "A portfolio project groups multiple properties with individual DD tracking and a summary view." 
                      : "A single property project tracks DD for one marina."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={watchedProjectType === "portfolio" ? "e.g. USVI Portfolio" : "e.g. Sunset Marina DD"} 
                      {...field} 
                    />
                  </FormControl>
                  {watchedProjectType === "single" && field.value && (
                    <div className="flex items-center gap-2">
                      {form.watch("marinaName") === field.value ? (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <Anchor className="h-3 w-3" />
                          Using as Marina Name
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-primary"
                          onClick={() => form.setValue("marinaName", field.value, { shouldDirty: true })}
                        >
                          <Anchor className="h-3 w-3 mr-1" />
                          Use as Marina Name
                        </Button>
                      )}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of the project..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchedProjectType === "single" && (
              <>
                <FormField
                  control={form.control}
                  name="linkedDealId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Link to Deal</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          if (value === "_create_new") {
                            setShowCreateDeal(true);
                            return;
                          }
                          field.onChange(value === "_none" ? "" : value);
                        }}
                        value={field.value || "_none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a deal (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none">No deal</SelectItem>
                          <SelectItem value="_create_new">
                            <span className="flex items-center gap-1.5 text-primary font-medium">
                              <PlusCircle className="h-3.5 w-3.5" />
                              Create New Deal
                            </span>
                          </SelectItem>
                          {deals.length > 0 && <Separator className="my-1" />}
                          {deals.map((deal) => (
                            <SelectItem key={deal.id} value={deal.id}>
                              {deal.title || deal.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Link to a CRM deal to auto-populate address
                      </FormDescription>
                      <FormMessage />
                      {isDealAssetClassLocked && dealAssetKey && (
                        <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 px-3 py-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                          <span className="text-amber-800 dark:text-amber-300">
                            This deal's asset class (<strong>{dealAssetKey.replace(/_/g, " ")}</strong>) is not in your current plan.{" "}
                            <button
                              type="button"
                              className="underline underline-offset-2 font-medium"
                              onClick={() => {
                                setUpgradeModalKey(dealAssetKey);
                                setShowUpgradeModal(true);
                              }}
                            >
                              Unlock it
                            </button>
                          </span>
                        </div>
                      )}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="linkedPropertyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Link to Property</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          if (value === "_create_new") {
                            setShowCreateProperty(true);
                            return;
                          }
                          field.onChange(value === "_none" ? "" : value);
                        }}
                        value={field.value || "_none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a property (optional)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none">No property</SelectItem>
                          <SelectItem value="_create_new">
                            <span className="flex items-center gap-1.5 text-primary font-medium">
                              <PlusCircle className="h-3.5 w-3.5" />
                              Create New Property
                            </span>
                          </SelectItem>
                          {properties.length > 0 && <Separator className="my-1" />}
                          {properties.map((property) => (
                            <SelectItem key={property.id} value={property.id}>
                              {property.title} {property.city ? `- ${property.city}, ${property.state}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Link to a CRM property to auto-populate address
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <Label>Property Address</Label>
                  <AddressAutocompleteInput
                    value={addressInputValue}
                    onChangeText={setAddressInputValue}
                    onSelectAddress={handleAddressSelect}
                    placeholder="Search for a marina or enter an address..."
                    searchType="all"
                  />
                  <p className="text-sm text-muted-foreground">
                    {hasLinkedDealOrProperty
                      ? "Address auto-populated from linked record. You can change it if needed."
                      : "Search for a marina or enter an address."}
                  </p>
                </div>

                {(form.watch("city") || form.watch("state")) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="City" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., VA"
                              {...field}
                              onBlur={(e) => {
                                field.onBlur();
                                const abbr = toStateAbbr(e.target.value);
                                if (abbr !== field.value) field.onChange(abbr);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </>
            )}

            {watchedProjectType === "portfolio" && (
              <div className="space-y-4">
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Portfolio Properties</Label>
                    <p className="text-sm text-muted-foreground">
                      Add properties to include in this portfolio. Each will become a separate DD project.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPortfolioProperty}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Property
                  </Button>
                </div>

                {portfolioProperties.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-muted-foreground mb-3">No properties added yet</p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addPortfolioProperty}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add First Property
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <ScrollArea className="max-h-[50vh]">
                    <div className="space-y-4 pr-2">
                      {portfolioProperties.map((prop, index) => (
                        <Card key={prop.id} className="relative">
                          <CardContent className="pt-4 pb-3">
                            <div className="flex items-start justify-between mb-3">
                              <span className="text-sm font-medium text-muted-foreground">
                                Marina {index + 1}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={() => removePortfolioProperty(prop.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <Label className="text-sm">Marina Name *</Label>
                                <Input
                                  placeholder="e.g. Sunset Marina"
                                  value={prop.name}
                                  onChange={(e) => updatePortfolioProperty(prop.id, { name: e.target.value })}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-sm">Address</Label>
                                <AddressAutocompleteInput
                                  value={prop.addressInputValue}
                                  onChangeText={(val) => updatePortfolioProperty(prop.id, { addressInputValue: val })}
                                  onSelectAddress={(addr) => handlePortfolioAddressSelect(prop.id, addr)}
                                  placeholder="Search for marina or address..."
                                  searchType="all"
                                  className="mt-1"
                                />
                                {prop.city && prop.state && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {prop.city}, {prop.state} {prop.zipCode}
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={addPortfolioProperty}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Another Marina
                      </Button>
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createProjectMutation.isPending ||
                  !!isDealAssetClassLocked ||
                  (!!selectedDeal && entitlements === undefined)
                }
              >
                {createProjectMutation.isPending ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      {/* Asset class upgrade modal triggered from locked deal warning */}
      <AssetClassUpgradeModal
        open={showUpgradeModal}
        onOpenChange={(v) => {
          setShowUpgradeModal(v);
          if (!v) setUpgradeModalKey("");
        }}
        pendingKeys={upgradeModalKey ? [upgradeModalKey] : []}
      />

      {/* Inline Deal Creation Modal */}
      <DealFormModal
        isOpen={showCreateDeal}
        onClose={() => {
          setShowCreateDeal(false);
          // Refresh deals list so newly created deal appears
          queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
        }}
        deal={null}
      />

      {/* Inline Property Creation Modal */}
      <PropertyFormModal
        isOpen={showCreateProperty}
        onClose={() => {
          setShowCreateProperty(false);
          // Refresh properties list so newly created property appears
          queryClient.invalidateQueries({ queryKey: ["/api/crm/properties"] });
        }}
        property={null}
      />
    </Dialog>
  );
}
