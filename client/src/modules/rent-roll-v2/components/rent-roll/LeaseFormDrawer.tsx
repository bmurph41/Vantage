import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { createLease, updateLease, getLease } from "../lib/rentRollApi";
import { useToast } from "@/hooks/use-toast";
import { addYears, addMonths, subDays, format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CommentsSection } from "../components/comments/CommentsSection";
import LeaseEconomicsSection from "../components/rent-roll/LeaseEconomicsSection";
import type { LeaseLineItem } from "@shared/schema";

interface LeaseFormDrawerProps {
  open: boolean;
  onClose: () => void;
  leaseId: string | null;
  locationId?: string | null;
  location?: {
    charge1Label: string | null;
    charge2Label: string | null;
    charge3Label: string | null;
    seasonStartDate: string | null;
    seasonEndDate: string | null;
    winterStartDate: string | null;
    winterEndDate: string | null;
  };
}

const leaseFormSchema = z.object({
  // Tenant information
  tenantName: z.string().min(1, "Tenant name is required"),
  boatMake: z.string().optional(),
  boatYear: z.coerce.number().int().min(1900).max(2100).optional().or(z.literal("")),
  boatLength: z.coerce.number().positive().optional().or(z.literal("")),
  boatWidth: z.coerce.number().positive().optional().or(z.literal("")),
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  
  // Lease information (commencement and amount are optional to allow partial data entry)
  leaseCommencement: z.string().optional(),
  leaseExpiration: z.string().optional(),
  leaseAmount: z.coerce.number().positive("Monthly rent must be positive").optional().or(z.literal("")),
  rateType: z.string().optional(),
  contractTerm: z.string().optional(),
  storageType: z.string().default("Wet Slip"),
  boatType: z.string().optional(),
  unitLocation: z.string().optional(),
  unitNumber: z.string().optional(),
  slipLength: z.coerce.number().positive().optional().or(z.literal("")),
  slipWidth: z.coerce.number().positive().optional().or(z.literal("")),
  leaseOnFile: z.boolean().default(false),
  coiOnFile: z.boolean().default(false),
  coiExpiration: z.string().optional(),
  
  // Additional charges
  additionalCharge1: z.coerce.number().min(0).optional().or(z.literal("")),
  additionalCharge2: z.coerce.number().min(0).optional().or(z.literal("")),
  additionalCharge3: z.coerce.number().min(0).optional().or(z.literal("")),
  
  // Discount tracking
  hasDiscount: z.boolean().default(false),
  discountType: z.enum(["PERCENT_OFF", "FLAT_RATE", "AMOUNT_OFF"]).optional(),
  discountValue: z.coerce.number().min(0).optional().or(z.literal("")),
});

type LeaseFormValues = z.infer<typeof leaseFormSchema>;

export default function LeaseFormDrawer({ open, onClose, leaseId, locationId, location }: LeaseFormDrawerProps) {
  const { toast } = useToast();
  const isEditing = !!leaseId;
  const [showCustomStorageInput, setShowCustomStorageInput] = useState(false);
  const [customStorageType, setCustomStorageType] = useState("");
  const [lineItemsOpen, setLineItemsOpen] = useState(false);
  const [newLineItem, setNewLineItem] = useState({
    lineType: "winter_slip" as LeaseLineItem["lineType"],
    amount: "",
    slipAssignment: "",
    startDate: "",
    endDate: "",
    notes: "",
  });

  const charge1Label = location?.charge1Label || "Charge 1";
  const charge2Label = location?.charge2Label || "Charge 2";
  const charge3Label = location?.charge3Label || "Charge 3";

  // Fetch custom storage types
  const { data: customStorageTypes = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/rent-roll/custom-storage-types"],
    enabled: open,
  });

  // Fetch storage locations for dropdown
  const { data: storageLocations = [] } = useQuery<Array<{ id: string; name: string; isActive: boolean }>>({
    queryKey: ["/api/rent-roll/storage-locations", { projectId: locationId }],
    enabled: !!locationId && open,
  });

  // Fetch project details configuration for filtering options
  const { data: projectConfig } = useQuery<{
    enabledStorageTypes: string[];
    enabledRateTypes: string[];
    enabledContractTerms: string[];
  }>({
    queryKey: [`/api/rent-roll/locations/${locationId}/details-config`],
    enabled: !!locationId && open,
  });

  // Filter options based on project configuration
  const enabledRateTypes = projectConfig?.enabledRateTypes || ['$/ft./mo.', '$/ft./season', '$/ft./yr.', '$/mo.', '$/season', '$/yr.', '$/SF', 'Flat Fee'];
  const enabledContractTerms = projectConfig?.enabledContractTerms || ['Annual', 'Seasonal/Summer', '6-Months', '3-Months', 'Winter', 'Monthly', 'Weekly', 'Daily/Nightly'];
  const defaultBuiltInStorageTypes = [
    'Wet Slip',
    'Lift Slip',
    'Mooring',
    'Jet Ski',
    'Dry Rack - Indoor',
    'Dry Rack - Outdoor',
    'Houseboat',
    'Land Storage',
    'Boat on Trailer',
    'Trailer Only',
    'Carport',
    'RV Site',
  ];
  const enabledStorageTypes = projectConfig?.enabledStorageTypes && projectConfig.enabledStorageTypes.length > 0
    ? projectConfig.enabledStorageTypes
    : defaultBuiltInStorageTypes;
  const allEnabledStorageTypes = [
    ...enabledStorageTypes,
    ...customStorageTypes.map(t => t.name),
  ];

  // Fetch existing lease data when editing
  const { data: existingLease, isLoading: isLoadingLease, isError: isErrorLease } = useQuery({
    queryKey: ["/api/rent-roll/leases", leaseId],
    queryFn: () => getLease(leaseId!),
    enabled: !!leaseId && open,
    retry: false,
  });

  // Fetch line items for the lease when editing
  const { data: lineItems = [], isLoading: isLoadingLineItems } = useQuery<LeaseLineItem[]>({
    queryKey: ["/api/rent-roll/leases", leaseId, "line-items"],
    queryFn: async () => {
      const res = await fetch(`/api/rent-roll/leases/${leaseId}/line-items`);
      if (!res.ok) throw new Error("Failed to fetch line items");
      return res.json();
    },
    enabled: !!leaseId && open,
  });


  const createMutation = useMutation({
    mutationFn: createLease,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/leases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/monthly-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/revenue-by-storage-type"] });
      // Invalidate Project Overview queries for real-time updates (matches all date ranges)
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/move-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/revenue-trend"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/revenue-by-storage"] });
      // Invalidate Executive Dashboard queries (matches all date ranges)
      queryClient.invalidateQueries({ queryKey: ["/api/executive-dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executive-dashboard/revenue-trend"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/project-hub-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/included-projects"] });
      toast({
        title: "Lease created",
        description: "The lease has been successfully created",
      });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create lease",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateLease(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/leases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/monthly-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/revenue-by-storage-type"] });
      if (leaseId) {
        queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/leases", leaseId] });
      }
      // Invalidate Project Overview queries for real-time updates (matches all date ranges)
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/move-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/revenue-trend"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll", locationId, "overview/revenue-by-storage"] });
      // Invalidate Executive Dashboard queries (matches all date ranges)
      queryClient.invalidateQueries({ queryKey: ["/api/executive-dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executive-dashboard/revenue-trend"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/project-hub-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/included-projects"] });
      toast({
        title: "Lease updated",
        description: "The lease has been successfully updated",
      });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update lease",
        variant: "destructive",
      });
    },
  });

  const createCustomStorageTypeMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest("POST", "/api/rent-roll/custom-storage-types", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/custom-storage-types"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create custom storage type",
        variant: "destructive",
      });
    },
  });

  // Line item mutations
  const createLineItemMutation = useMutation({
    mutationFn: async (data: { leaseId: string; lineType: string; amount: string; slipAssignment?: string; startDate?: string; endDate?: string; notes?: string }) => {
      return await apiRequest("POST", `/api/rent-roll/leases/${data.leaseId}/line-items`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/leases", leaseId, "line-items"] });
      setNewLineItem({
        lineType: "winter_slip",
        amount: "",
        slipAssignment: "",
        startDate: "",
        endDate: "",
        notes: "",
      });
      toast({
        title: "Line item added",
        description: "Fee line item has been added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add line item",
        variant: "destructive",
      });
    },
  });

  const deleteLineItemMutation = useMutation({
    mutationFn: async (lineItemId: string) => {
      return await apiRequest("DELETE", `/api/rent-roll/leases/${leaseId}/line-items/${lineItemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/leases", leaseId, "line-items"] });
      toast({
        title: "Line item deleted",
        description: "Fee line item has been removed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete line item",
        variant: "destructive",
      });
    },
  });

  const form = useForm<LeaseFormValues>({
    resolver: zodResolver(leaseFormSchema),
    defaultValues: {
      tenantName: "",
      boatMake: "",
      boatYear: "" as any,
      boatLength: "" as any,
      boatWidth: "" as any,
      address1: "",
      address2: "",
      city: "",
      state: "",
      zip: "",
      leaseCommencement: "",
      leaseExpiration: "",
      leaseAmount: 0,
      rateType: "",
      contractTerm: "Monthly",
      storageType: "Wet Slip",
      boatType: "",
      unitLocation: "",
      unitNumber: "",
      slipLength: "" as any,
      slipWidth: "" as any,
      leaseOnFile: false,
      coiOnFile: false,
      coiExpiration: "",
      additionalCharge1: "" as any,
      additionalCharge2: "" as any,
      additionalCharge3: "" as any,
      hasDiscount: false,
      discountType: undefined,
      discountValue: "" as any,
    },
  });

  useEffect(() => {
    if (open && !isEditing) {
      // Reset form for creation mode
      form.reset();
    } else if (open && isEditing && existingLease) {
      // Pre-populate form with existing lease data
      form.reset({
        tenantName: existingLease.tenant.name,
        boatMake: existingLease.tenant.boatMake || "",
        boatYear: existingLease.tenant.boatYear || ("" as any),
        boatLength: existingLease.tenant.boatLength ? parseFloat(existingLease.tenant.boatLength) : ("" as any),
        boatWidth: existingLease.tenant.boatWidth ? parseFloat(existingLease.tenant.boatWidth) : ("" as any),
        address1: existingLease.tenant.address1 || "",
        address2: existingLease.tenant.address2 || "",
        city: existingLease.tenant.city || "",
        state: existingLease.tenant.state || "",
        zip: existingLease.tenant.zip || "",
        leaseCommencement: existingLease.leaseCommencement,
        leaseExpiration: existingLease.leaseExpiration || "",
        leaseAmount: parseFloat(existingLease.leaseAmount),
        rateType: existingLease.rateType || "",
        contractTerm: existingLease.contractTerm || "",
        storageType: existingLease.storageType,
        boatType: existingLease.boatType || "",
        unitLocation: existingLease.unitLocation || "",
        unitNumber: existingLease.unitNumber || "",
        slipLength: existingLease.slipLength ? parseFloat(existingLease.slipLength) : ("" as any),
        slipWidth: existingLease.slipWidth ? parseFloat(existingLease.slipWidth) : ("" as any),
        leaseOnFile: existingLease.leaseOnFile || false,
        coiOnFile: existingLease.coiOnFile || false,
        coiExpiration: existingLease.coiExpiration || "",
        additionalCharge1: existingLease.additionalCharge1 ? parseFloat(existingLease.additionalCharge1) : ("" as any),
        additionalCharge2: existingLease.additionalCharge2 ? parseFloat(existingLease.additionalCharge2) : ("" as any),
        additionalCharge3: existingLease.additionalCharge3 ? parseFloat(existingLease.additionalCharge3) : ("" as any),
        hasDiscount: existingLease.hasDiscount || false,
        discountType: existingLease.discountType || undefined,
        discountValue: existingLease.discountValue ? parseFloat(existingLease.discountValue) : ("" as any),
      });
    }
  }, [open, isEditing, existingLease, form]);

  const onSubmit = async (data: LeaseFormValues) => {
    let finalStorageType = data.storageType;

    // If "Other" is selected, validate and save the custom storage type first
    if (data.storageType === "Other") {
      if (!customStorageType || customStorageType.trim() === "") {
        toast({
          title: "Custom storage type required",
          description: "Please enter a name for the custom storage type",
          variant: "destructive",
        });
        return;
      }

      const trimmedName = customStorageType.trim();
      
      // Check if custom type already exists
      const existingType = customStorageTypes.find(
        (type) => type.name.toLowerCase() === trimmedName.toLowerCase()
      );

      if (existingType) {
        // Type already exists, use it
        finalStorageType = existingType.name;
        toast({
          title: "Storage type already exists",
          description: `"${existingType.name}" is already available in the dropdown`,
        });
        setShowCustomStorageInput(false);
        setCustomStorageType("");
      } else {
        try {
          // Save the custom storage type
          await createCustomStorageTypeMutation.mutateAsync(trimmedName);
          finalStorageType = trimmedName;
          
          toast({
            title: "Custom storage type created",
            description: `"${trimmedName}" has been added to the storage types`,
          });

          // Reset custom storage input
          setShowCustomStorageInput(false);
          setCustomStorageType("");
        } catch (error) {
          // Error already handled by mutation
          return;
        }
      }
    }

    const payload = {
      tenant: {
        name: data.tenantName,
        boatMake: data.boatMake || undefined,
        boatYear: data.boatYear ? Number(data.boatYear) : undefined,
        boatLength: data.boatLength ? data.boatLength.toString() : undefined,
        boatWidth: data.boatWidth ? data.boatWidth.toString() : undefined,
        address1: data.address1 || undefined,
        address2: data.address2 || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        zip: data.zip || undefined,
      },
      lease: {
        locationId: locationId || undefined,
        leaseCommencement: data.leaseCommencement,
        leaseExpiration: data.leaseExpiration || undefined,
        leaseAmount: data.leaseAmount.toString(),
        rateType: data.rateType || undefined,
        contractTerm: data.contractTerm || undefined,
        storageType: finalStorageType,
        boatType: data.boatType || undefined,
        unitLocation: data.unitLocation || undefined,
        unitNumber: data.unitNumber || undefined,
        slipLength: data.slipLength ? data.slipLength.toString() : undefined,
        slipWidth: data.slipWidth ? data.slipWidth.toString() : undefined,
        leaseOnFile: data.leaseOnFile,
        coiOnFile: data.coiOnFile,
        coiExpiration: data.coiExpiration || undefined,
        additionalCharge1: data.additionalCharge1 ? data.additionalCharge1.toString() : "0",
        additionalCharge2: data.additionalCharge2 ? data.additionalCharge2.toString() : "0",
        additionalCharge3: data.additionalCharge3 ? data.additionalCharge3.toString() : "0",
        hasDiscount: data.hasDiscount || false,
        discountType: data.hasDiscount ? data.discountType : null,
        discountValue: data.hasDiscount && data.discountValue ? data.discountValue.toString() : null,
      },
    };
    
    if (isEditing && leaseId) {
      updateMutation.mutate({ id: leaseId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[480px] w-full p-0">
        <ScrollArea className="h-full">
          <div className="px-6 py-6">
            <SheetHeader>
              <SheetTitle className="text-2xl font-semibold">
                {isEditing ? "Edit Lease" : "Add New Lease"}
              </SheetTitle>
              <SheetDescription>
                {isEditing
                  ? "Update lease and tenant information"
                  : "Enter tenant and lease details to create a new lease"}
              </SheetDescription>
            </SheetHeader>

            {isEditing && isLoadingLease ? (
              <div className="flex h-96 items-center justify-center" data-testid="status-loading-lease">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading lease data...</span>
              </div>
            ) : isEditing && isErrorLease ? (
              <div className="flex h-96 flex-col items-center justify-center gap-2" data-testid="status-error-lease">
                <p className="text-sm text-destructive">Failed to load lease data</p>
                <Button variant="outline" onClick={onClose}>Close</Button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-6">
                  {/* Tenant Information Section */}
                  <div className="space-y-4">
                  <h3 className="text-lg font-medium">Tenant Information</h3>
                  <Separator />
                  
                  <FormField
                    control={form.control}
                    name="tenantName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tenant Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John Doe"
                            data-testid="input-tenant-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="boatMake"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Boat Make</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Sea Ray"
                              data-testid="input-boat-make"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="boatYear"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Boat Year</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="2020"
                              data-testid="input-boat-year"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>


                  <FormField
                    control={form.control}
                    name="address1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 1</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="123 Marina Blvd"
                            data-testid="input-address1"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Line 2</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Apt 4B"
                            data-testid="input-address2"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Miami"
                              data-testid="input-city"
                              {...field}
                            />
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
                              placeholder="FL"
                              maxLength={2}
                              data-testid="input-state"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="zip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="33101"
                            data-testid="input-zip"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Lease Information Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Lease Terms</h3>
                  <Separator />

                  <FormField
                    control={form.control}
                    name="contractTerm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract Term</FormLabel>
                        <Select
                          onValueChange={(term) => {
                            field.onChange(term);
                            // Clear expiration date when switching to a rolling/MTM term
                            const isRolling = ['monthly', 'mtm', 'month-to-month', 'weekly', 'daily', 'daily/nightly']
                              .includes(term.toLowerCase());
                            if (isRolling) {
                              form.setValue("leaseExpiration", "");
                            }
                          }}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-contract-term">
                              <SelectValue placeholder="Select term" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {enabledContractTerms.map((term) => (
                              <SelectItem key={term} value={term}>{term}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Quick Term Calculator - Auto-fills dates based on term type */}
                  <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                    <label className="text-sm font-medium">Quick Term Calculator</label>
                    <div className="flex flex-wrap gap-2">
                      {enabledContractTerms.includes('Annual') && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const commencementDate = form.getValues("leaseCommencement");
                            if (!commencementDate || commencementDate.trim() === "") {
                              toast({
                                title: "Commencement date required",
                                description: "Please enter a commencement date first",
                                variant: "destructive",
                              });
                              return;
                            }
                            const startDate = new Date(commencementDate);
                            if (isNaN(startDate.getTime())) {
                              toast({
                                title: "Invalid commencement date",
                                description: "Please enter a valid date",
                                variant: "destructive",
                              });
                              return;
                            }
                            // Annual: exactly 1 year (365 or 366 days depending on calendar)
                            const endDate = subDays(addYears(startDate, 1), 1);
                            form.setValue("leaseExpiration", format(endDate, 'yyyy-MM-dd'));
                            form.setValue("contractTerm", "Annual");
                          }}
                          data-testid="button-term-annual"
                        >
                          Annual
                        </Button>
                      )}
                      {(enabledRateTypes.includes('Seasonal') || location?.seasonStartDate) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!location?.seasonStartDate || !location?.seasonEndDate) {
                              toast({
                                title: "Season dates not configured",
                                description: "Please configure season dates in Settings tab first",
                                variant: "destructive",
                              });
                              return;
                            }
                            // Parse season dates (MM/DD format) and use current year
                            const currentYear = new Date().getFullYear();
                            const [startMonth, startDay] = location.seasonStartDate.split('/').map(Number);
                            const [endMonth, endDay] = location.seasonEndDate.split('/').map(Number);
                            
                            const startDate = new Date(currentYear, startMonth - 1, startDay);
                            const endDate = new Date(currentYear, endMonth - 1, endDay);
                            
                            form.setValue("leaseCommencement", format(startDate, 'yyyy-MM-dd'));
                            form.setValue("leaseExpiration", format(endDate, 'yyyy-MM-dd'));
                            form.setValue("contractTerm", "Seasonal/Summer");
                          }}
                          disabled={!location?.seasonStartDate || !location?.seasonEndDate}
                          data-testid="button-term-seasonal"
                        >
                          Seasonal
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!location?.winterStartDate || !location?.winterEndDate) {
                            toast({
                              title: "Winter dates not configured",
                              description: "Please configure winter dates in Settings tab first",
                              variant: "destructive",
                            });
                            return;
                          }
                          // Parse winter dates (MM/DD format)
                          // Winter starts in one year (Oct/Nov) and ends in the next (Mar/Apr/May)
                          const currentYear = new Date().getFullYear();
                          const [startMonth, startDay] = location.winterStartDate.split('/').map(Number);
                          const [endMonth, endDay] = location.winterEndDate.split('/').map(Number);
                          
                          // Start date is in current year
                          const startDate = new Date(currentYear, startMonth - 1, startDay);
                          // End date crosses into next year if end month < start month
                          const endYear = endMonth < startMonth ? currentYear + 1 : currentYear;
                          const endDate = new Date(endYear, endMonth - 1, endDay);
                          
                          form.setValue("leaseCommencement", format(startDate, 'yyyy-MM-dd'));
                          form.setValue("leaseExpiration", format(endDate, 'yyyy-MM-dd'));
                          form.setValue("contractTerm", "Winter");
                        }}
                        disabled={!location?.winterStartDate || !location?.winterEndDate}
                        data-testid="button-term-winter"
                      >
                        Winter
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const commencementDate = form.getValues("leaseCommencement");
                          if (!commencementDate || commencementDate.trim() === "") {
                            toast({
                              title: "Commencement date required",
                              description: "Please enter a commencement date first",
                              variant: "destructive",
                            });
                            return;
                          }
                          const startDate = new Date(commencementDate);
                          if (isNaN(startDate.getTime())) {
                            toast({
                              title: "Invalid commencement date",
                              description: "Please enter a valid date",
                              variant: "destructive",
                            });
                            return;
                          }
                          const endDate = subDays(addMonths(startDate, 6), 1);
                          form.setValue("leaseExpiration", format(endDate, 'yyyy-MM-dd'));
                          form.setValue("contractTerm", "6-Months");
                        }}
                        data-testid="button-term-6months"
                      >
                        6 Months
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const commencementDate = form.getValues("leaseCommencement");
                          if (!commencementDate || commencementDate.trim() === "") {
                            toast({
                              title: "Commencement date required",
                              description: "Please enter a commencement date first",
                              variant: "destructive",
                            });
                            return;
                          }
                          const startDate = new Date(commencementDate);
                          if (isNaN(startDate.getTime())) {
                            toast({
                              title: "Invalid commencement date",
                              description: "Please enter a valid date",
                              variant: "destructive",
                            });
                            return;
                          }
                          const endDate = subDays(addMonths(startDate, 3), 1);
                          form.setValue("leaseExpiration", format(endDate, 'yyyy-MM-dd'));
                          form.setValue("contractTerm", "3-Months");
                        }}
                        data-testid="button-term-3months"
                      >
                        3 Months
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const commencementDate = form.getValues("leaseCommencement");
                          if (!commencementDate || commencementDate.trim() === "") {
                            toast({
                              title: "Commencement date required",
                              description: "Please enter a commencement date first",
                              variant: "destructive",
                            });
                            return;
                          }
                          const startDate = new Date(commencementDate);
                          if (isNaN(startDate.getTime())) {
                            toast({
                              title: "Invalid commencement date",
                              description: "Please enter a valid date",
                              variant: "destructive",
                            });
                            return;
                          }
                          const endDate = subDays(addMonths(startDate, 1), 1);
                          form.setValue("leaseExpiration", format(endDate, 'yyyy-MM-dd'));
                          form.setValue("contractTerm", "Monthly");
                        }}
                        data-testid="button-term-mtm"
                      >
                        MTM
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          form.setValue("leaseExpiration", "");
                          form.setValue("contractTerm", "Open-Ended");
                          toast({
                            title: "Open-ended lease",
                            description: "Expiration date cleared. Lease will continue until marked expired or vacated.",
                          });
                        }}
                        data-testid="button-term-open-ended"
                      >
                        Open-Ended
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Seasonal/Winter auto-fill both dates from Settings. Other terms calculate from commencement.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="leaseCommencement"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commencement Date *</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              data-testid="input-lease-commencement"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="leaseExpiration"
                      render={({ field }) => {
                        // Check if current contract term is a rolling/MTM type
                        const currentContractTerm = form.watch("contractTerm") || "";
                        const isRollingTerm = ['monthly', 'mtm', 'month-to-month', 'weekly', 'daily', 'daily/nightly']
                          .includes(currentContractTerm.toLowerCase());
                        
                        return (
                          <FormItem>
                            <FormLabel>Expiration Date</FormLabel>
                            {isRollingTerm ? (
                              <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/50">
                                <span className="text-sm text-muted-foreground">Rolling (No Fixed Expiration)</span>
                              </div>
                            ) : (
                              <FormControl>
                                <Input
                                  type="date"
                                  data-testid="input-lease-expiration"
                                  {...field}
                                />
                              </FormControl>
                            )}
                            <FormDescription className="text-xs">
                              {isRollingTerm 
                                ? "Rolling leases auto-renew until terminated" 
                                : "Leave blank for open-ended"
                              }
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="rateType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rate Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-rate-type">
                              <SelectValue placeholder="Select rate type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {enabledRateTypes.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="leaseAmount"
                    render={({ field }) => {
                      const formatAsCurrency = (value: string | number | undefined | null) => {
                        if (value === undefined || value === null || value === '') return '';
                        const strValue = String(value);
                        const num = parseFloat(strValue.replace(/[^0-9.-]/g, ''));
                        if (isNaN(num)) return '';
                        return num.toLocaleString('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        });
                      };
                      
                      const [displayValue, setDisplayValue] = useState(
                        field.value ? formatAsCurrency(field.value) : ''
                      );
                      const [isFocused, setIsFocused] = useState(false);
                      
                      return (
                        <FormItem>
                          <FormLabel>Monthly Rent *</FormLabel>
                          <FormControl>
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="$0.00"
                              data-testid="input-lease-amount"
                              value={isFocused ? field.value || '' : displayValue}
                              onFocus={() => setIsFocused(true)}
                              onBlur={() => {
                                setIsFocused(false);
                                if (field.value) {
                                  setDisplayValue(formatAsCurrency(field.value));
                                }
                              }}
                              onChange={(e) => {
                                const rawValue = e.target.value.replace(/[^0-9.]/g, '');
                                field.onChange(rawValue);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  <FormField
                    control={form.control}
                    name="storageType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Storage Type *</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            if (value === "Other") {
                              setShowCustomStorageInput(true);
                            } else {
                              setShowCustomStorageInput(false);
                              setCustomStorageType("");
                            }
                          }}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-storage-type">
                              <SelectValue placeholder="Select storage type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {allEnabledStorageTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                            <SelectItem value="Other">Other (Add New)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {showCustomStorageInput && (
                    <div className="space-y-2">
                      <FormLabel>Custom Storage Type Name *</FormLabel>
                      <Input
                        placeholder="Enter custom storage type name"
                        value={customStorageType}
                        onChange={(e) => setCustomStorageType(e.target.value)}
                        data-testid="input-custom-storage-type"
                      />
                      <p className="text-xs text-muted-foreground">
                        This will be saved and added to all dropdowns permanently
                      </p>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="boatType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Boat Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-boat-type">
                              <SelectValue placeholder="Select boat type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Power">Power</SelectItem>
                            <SelectItem value="Sail">Sail</SelectItem>
                            <SelectItem value="Liveaboard">Liveaboard</SelectItem>
                            <SelectItem value="Jet Ski">Jet Ski</SelectItem>
                            <SelectItem value="Catamaran">Catamaran</SelectItem>
                            <SelectItem value="Houseboat">Houseboat</SelectItem>
                            <SelectItem value="Dinghy">Dinghy</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="unitLocation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Storage Location</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ""}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-unit-location">
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {storageLocations.filter(loc => loc.isActive).map((location) => (
                                <SelectItem key={location.id} value={location.name}>
                                  {location.name}
                                </SelectItem>
                              ))}
                              {storageLocations.filter(loc => loc.isActive).length === 0 && (
                                <SelectItem value="none" disabled>
                                  No active locations available
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Physical dock or area at the marina
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="unitNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit #</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., A-12, 23"
                              data-testid="input-unit-number"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Slip, berth, or unit number
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="boatLength"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Boat Length (ft)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="35"
                              data-testid="input-boat-length"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="boatWidth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Boat Beam (ft)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="12"
                              data-testid="input-boat-width"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="slipLength"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Slip Length (ft)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="40"
                              data-testid="input-slip-length"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="slipWidth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Slip Width (ft)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="12"
                              data-testid="input-slip-width"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Additional Monthly Charges</h4>
                    <p className="text-xs text-muted-foreground">Optional charges for utilities, maintenance, parking, etc.</p>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="additionalCharge1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{charge1Label}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                data-testid="input-additional-charge-1"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="additionalCharge2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{charge2Label}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                data-testid="input-additional-charge-2"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="additionalCharge3"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{charge3Label}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                data-testid="input-additional-charge-3"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Discount Section */}
                  <div className="space-y-4">
                    <Separator />
                    <h3 className="text-lg font-medium">Discount</h3>
                    
                    <FormField
                      control={form.control}
                      name="hasDiscount"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-has-discount"
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            Discount Applied
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    {form.watch("hasDiscount") && (
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="discountType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Discount Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-discount-type">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="PERCENT_OFF">% Off Posted Rate</SelectItem>
                                  <SelectItem value="FLAT_RATE">Flat Rate (Pay Posted Rate)</SelectItem>
                                  <SelectItem value="AMOUNT_OFF">$ Amount Off</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="discountValue"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {form.watch("discountType") === "PERCENT_OFF" ? "Discount %" : 
                                 form.watch("discountType") === "AMOUNT_OFF" ? "Amount Off ($)" : "Value"}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder={form.watch("discountType") === "PERCENT_OFF" ? "10" : "50.00"}
                                  data-testid="input-discount-value"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-6">
                    <FormField
                      control={form.control}
                      name="leaseOnFile"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-lease-on-file"
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            Lease on File
                          </FormLabel>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="coiOnFile"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-coi-on-file"
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            COI on File
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  {form.watch("coiOnFile") && (
                    <FormField
                      control={form.control}
                      name="coiExpiration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>COI Expiration</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              data-testid="input-coi-expiration"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Line Items Section - Only shown when editing */}
                {isEditing && leaseId && (
                  <div className="space-y-4">
                    <Collapsible open={lineItemsOpen} onOpenChange={setLineItemsOpen}>
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          className="flex w-full items-center justify-between p-0 h-auto hover:bg-transparent"
                          data-testid="button-toggle-line-items"
                        >
                          <h3 className="text-lg font-medium">Fee Line Items ({lineItems.length})</h3>
                          {lineItemsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </CollapsibleTrigger>
                      <Separator className="mt-2" />
                      
                      <CollapsibleContent className="space-y-4 pt-4">
                        {isLoadingLineItems ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span className="text-sm text-muted-foreground">Loading line items...</span>
                          </div>
                        ) : (
                          <>
                            {/* Existing Line Items */}
                            {lineItems.length > 0 ? (
                              <div className="space-y-2">
                                {lineItems.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                                    data-testid={`line-item-${item.id}`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm capitalize">
                                          {item.lineType.replace(/_/g, " ")}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                          ${parseFloat(item.amount).toLocaleString()}
                                        </span>
                                      </div>
                                      {item.slipAssignment && (
                                        <span className="text-xs text-muted-foreground">
                                          Slip: {item.slipAssignment}
                                        </span>
                                      )}
                                      {(item.startDate || item.endDate) && (
                                        <div className="text-xs text-muted-foreground">
                                          {item.startDate && format(new Date(item.startDate), "MMM d, yyyy")}
                                          {item.startDate && item.endDate && " - "}
                                          {item.endDate && format(new Date(item.endDate), "MMM d, yyyy")}
                                        </div>
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => deleteLineItemMutation.mutate(item.id)}
                                      disabled={deleteLineItemMutation.isPending}
                                      data-testid={`button-delete-line-item-${item.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-2">
                                No fee line items. Add one below.
                              </p>
                            )}

                            {/* Add New Line Item Form */}
                            <div className="space-y-3 p-3 border rounded-md">
                              <h4 className="text-sm font-medium">Add Line Item</h4>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs text-muted-foreground">Fee Type</label>
                                  <Select
                                    value={newLineItem.lineType}
                                    onValueChange={(value) => setNewLineItem(prev => ({ ...prev, lineType: value as LeaseLineItem["lineType"] }))}
                                  >
                                    <SelectTrigger className="mt-1" data-testid="select-line-item-type">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="winter_slip">Winter Slip</SelectItem>
                                      <SelectItem value="summer_slip">Summer Slip</SelectItem>
                                      <SelectItem value="seasonal_slip">Seasonal Slip</SelectItem>
                                      <SelectItem value="annual_slip">Annual Slip</SelectItem>
                                      <SelectItem value="liveaboard">Liveaboard</SelectItem>
                                      <SelectItem value="electric">Electric</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div>
                                  <label className="text-xs text-muted-foreground">Amount</label>
                                  <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={newLineItem.amount}
                                    onChange={(e) => setNewLineItem(prev => ({ ...prev, amount: e.target.value }))}
                                    className="mt-1"
                                    data-testid="input-line-item-amount"
                                  />
                                </div>
                              </div>
                              
                              <div>
                                <label className="text-xs text-muted-foreground">Slip Assignment (optional)</label>
                                <Input
                                  placeholder="e.g., A-12"
                                  value={newLineItem.slipAssignment}
                                  onChange={(e) => setNewLineItem(prev => ({ ...prev, slipAssignment: e.target.value }))}
                                  className="mt-1"
                                  data-testid="input-line-item-slip"
                                />
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs text-muted-foreground">Start Date (optional)</label>
                                  <Input
                                    type="date"
                                    value={newLineItem.startDate}
                                    onChange={(e) => setNewLineItem(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="mt-1"
                                    data-testid="input-line-item-start-date"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground">End Date (optional)</label>
                                  <Input
                                    type="date"
                                    value={newLineItem.endDate}
                                    onChange={(e) => setNewLineItem(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="mt-1"
                                    data-testid="input-line-item-end-date"
                                  />
                                </div>
                              </div>
                              
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  if (!newLineItem.amount || parseFloat(newLineItem.amount) <= 0) {
                                    toast({
                                      title: "Amount required",
                                      description: "Please enter a valid amount",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  createLineItemMutation.mutate({
                                    leaseId: leaseId,
                                    lineType: newLineItem.lineType,
                                    amount: newLineItem.amount,
                                    slipAssignment: newLineItem.slipAssignment || undefined,
                                    startDate: newLineItem.startDate || undefined,
                                    endDate: newLineItem.endDate || undefined,
                                  });
                                }}
                                disabled={createLineItemMutation.isPending}
                                className="w-full"
                                data-testid="button-add-line-item"
                              >
                                {createLineItemMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Plus className="h-4 w-4 mr-2" />
                                )}
                                Add Line Item
                              </Button>
                            </div>
                          </>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}

                {isEditing && leaseId && (
                  <div className="space-y-4 pt-2">
                    <LeaseEconomicsSection leaseId={leaseId} />
                  </div>
                )}

                {isEditing && leaseId && (
                  <div className="space-y-4 pt-2">
                    <Separator />
                    <CommentsSection 
                      entityType="lease" 
                      entityId={leaseId} 
                      title="Lease Notes"
                      compact
                    />
                  </div>
                )}

                <SheetFooter className="gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoadingLease || createMutation.isPending || updateMutation.isPending || (isEditing && !existingLease)}
                    data-testid="button-save-lease"
                  >
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isEditing ? "Update Lease" : "Create Lease"}
                  </Button>
                </SheetFooter>
              </form>
            </Form>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
