import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AddressInput, type AddressComponents } from "@/components/address-input";
import type { MarinaRateDatabase } from "@shared/schema";
import { US_REGIONS, US_STATES } from "@shared/salescomps-constants";

const WATER_TYPES = ["Saltwater", "Freshwater", "Brackish"];

const marinaFormSchema = z.object({
  marinaName: z.string().min(1, "Marina name is required"),
  address: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().optional(),
  region: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  waterType: z.string().optional(),
  wetSlips: z.coerce.number().int().min(0).optional(),
  dryRacks: z.coerce.number().int().min(0).optional(),
  moorings: z.coerce.number().int().min(0).optional(),
  maxLoa: z.coerce.number().min(0).optional(),
  maxBeam: z.coerce.number().min(0).optional(),
  maxDraft: z.coerce.number().min(0).optional(),
  hasFuel: z.boolean().optional(),
  hasRepairs: z.boolean().optional(),
  hasShipStore: z.boolean().optional(),
  hasRestaurant: z.boolean().optional(),
  website: z.string().url().optional().or(z.literal("")),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

type MarinaFormValues = z.infer<typeof marinaFormSchema>;

interface AddEditMarinaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marina: MarinaRateDatabase | null;
  onSuccess: (marina: MarinaRateDatabase) => void;
}

export default function AddEditMarinaDialog({ open, onOpenChange, marina, onSuccess }: AddEditMarinaDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!marina;

  const form = useForm<MarinaFormValues>({
    resolver: zodResolver(marinaFormSchema),
    defaultValues: {
      marinaName: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      region: "",
      waterType: "",
      wetSlips: undefined,
      dryRacks: undefined,
      moorings: undefined,
      maxLoa: undefined,
      maxBeam: undefined,
      maxDraft: undefined,
      hasFuel: false,
      hasRepairs: false,
      hasShipStore: false,
      hasRestaurant: false,
      website: "",
      phone: "",
      email: "",
      notes: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (marina) {
      form.reset({
        marinaName: marina.marinaName || "",
        address: marina.address || "",
        city: marina.city || "",
        state: marina.state || "",
        zip: marina.zip || "",
        region: marina.region || "",
        waterType: marina.waterType || "",
        wetSlips: marina.wetSlips ?? undefined,
        dryRacks: marina.dryRacks ?? undefined,
        moorings: marina.moorings ?? undefined,
        maxLoa: marina.maxLoa ?? undefined,
        maxBeam: marina.maxBeam ?? undefined,
        maxDraft: marina.maxDraft ?? undefined,
        hasFuel: marina.hasFuel || false,
        hasRepairs: marina.hasRepairs || false,
        hasShipStore: marina.hasShipStore || false,
        hasRestaurant: marina.hasRestaurant || false,
        website: marina.website || "",
        phone: marina.phone || "",
        email: marina.email || "",
        notes: marina.notes || "",
        isActive: marina.isActive ?? true,
      });
    } else {
      form.reset({
        marinaName: "",
        address: "",
        city: "",
        state: "",
        zip: "",
        region: "",
        waterType: "",
        wetSlips: undefined,
        dryRacks: undefined,
        moorings: undefined,
        maxLoa: undefined,
        maxBeam: undefined,
        maxDraft: undefined,
        hasFuel: false,
        hasRepairs: false,
        hasShipStore: false,
        hasRestaurant: false,
        website: "",
        phone: "",
        email: "",
        notes: "",
        isActive: true,
      });
    }
  }, [marina]);

  const createMutation = useMutation({
    mutationFn: async (data: MarinaFormValues) => {
      const response = await apiRequest("POST", "/api/marina-database", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/marina-database"] });
      toast({ title: "Marina created successfully" });
      onSuccess(data);
    },
    onError: () => {
      toast({ title: "Failed to create marina", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: MarinaFormValues) => {
      const response = await apiRequest("PATCH", `/api/marina-database/${marina!.id}`, data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/marina-database"] });
      toast({ title: "Marina updated successfully" });
      onSuccess(data);
    },
    onError: () => {
      toast({ title: "Failed to update marina", variant: "destructive" });
    },
  });

  const onSubmit = (data: MarinaFormValues) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Marina" : "Add New Marina"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update marina information" : "Add a marina to the rate database"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="marinaName"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Marina Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter marina name" data-testid="input-marina-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormControl>
                        <AddressInput
                          value={field.value || ""}
                          onChange={(value) => field.onChange(value)}
                          onAddressSelect={(components: AddressComponents) => {
                            if (components.source === 'google' && components.street) {
                              field.onChange(components.street);
                            }
                            if (components.city) form.setValue("city", components.city);
                            if (components.state) form.setValue("state", components.state);
                            if (components.zipCode) form.setValue("zip", components.zipCode);
                          }}
                          label="Address"
                          placeholder="Start typing an address..."
                          testId="input-address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="City" data-testid="input-city" />
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
                      <FormLabel>State *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-state">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {US_STATES.map(state => (
                            <SelectItem key={state} value={state}>{state}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ZIP Code</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="ZIP" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select region" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {US_REGIONS.map(region => (
                            <SelectItem key={region} value={region}>{region}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="waterType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Water Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select water type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {WATER_TYPES.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Capacity */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Capacity</h4>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="wetSlips"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wet Slips</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} value={field.value ?? ""} placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dryRacks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dry Racks</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} value={field.value ?? ""} placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="moorings"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moorings</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} value={field.value ?? ""} placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxLoa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max LOA (ft)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" {...field} value={field.value ?? ""} placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxBeam"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Beam (ft)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" {...field} value={field.value ?? ""} placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxDraft"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Draft (ft)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" {...field} value={field.value ?? ""} placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Amenities */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Amenities</h4>
              <div className="flex flex-wrap gap-6">
                <FormField
                  control={form.control}
                  name="hasFuel"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="font-normal">Fuel</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hasRepairs"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="font-normal">Repairs</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hasShipStore"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="font-normal">Ship Store</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hasRestaurant"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="font-normal">Restaurant</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Contact Information</h4>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="(555) 555-5555" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="email@marina.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Additional notes about this marina..." rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-marina">
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Save Changes" : "Add Marina"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
