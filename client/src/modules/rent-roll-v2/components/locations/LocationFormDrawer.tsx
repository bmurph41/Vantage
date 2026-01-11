import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { createStorageLocation, updateStorageLocation, getStorageLocationById } from "../lib/storageLocationApi";
import { useToast } from "@/hooks/use-toast";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const STORAGE_TYPES = [
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

const RATE_TYPES = [
  '$/ft./mo.',
  '$/ft./season',
  '$/ft./yr.',
  '$/mo.',
  '$/season',
  '$/yr.',
  '$/SF',
  'Flat Fee',
];

interface LocationFormDrawerProps {
  open: boolean;
  onClose: () => void;
  locationId: string | null;
  projectId: string;
}

const storageLocationFormSchema = z.object({
  name: z.string().min(1, "Location name is required"),
  code: z.string().optional(),
  description: z.string().optional(),
  storageType: z.string().optional(),
  capacity: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? null : Number(val),
    z.union([
      z.number().int().positive("Capacity must be a positive integer"),
      z.null(),
    ]).nullable()
  ),
  postedRate: z.preprocess(
    (val) => (val === "" || val === null || val === undefined) ? null : Number(val),
    z.union([
      z.number().positive("Posted rate must be positive"),
      z.null(),
    ]).nullable()
  ),
  postedRateType: z.string().optional(),
  isActive: z.boolean().default(true),
});

type StorageLocationFormValues = z.infer<typeof storageLocationFormSchema>;

export default function LocationFormDrawer({ open, onClose, locationId, projectId }: LocationFormDrawerProps) {
  const { toast } = useToast();
  const isEditing = !!locationId;

  const { data: existingLocation, isLoading: isLoadingLocation, isError: isErrorLocation } = useQuery({
    queryKey: ["/api/rent-roll/storage-locations", locationId],
    queryFn: () => getStorageLocationById(locationId!),
    enabled: isEditing && open,
  });

  const form = useForm<StorageLocationFormValues>({
    resolver: zodResolver(storageLocationFormSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      storageType: "",
      capacity: null,
      postedRate: null,
      postedRateType: "",
      isActive: true,
    },
  });

  // Convert form values to API format (postedRate as string)
  const toApiData = (data: StorageLocationFormValues) => ({
    name: data.name,
    code: data.code || null,
    description: data.description || null,
    storageType: data.storageType || null,
    capacity: data.capacity,
    postedRate: data.postedRate !== null ? String(data.postedRate) : null,
    postedRateType: data.postedRateType || null,
    isActive: data.isActive,
  });

  const createMutation = useMutation({
    mutationFn: (data: ReturnType<typeof toApiData> & { projectId: string }) => createStorageLocation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/storage-locations", { projectId }] });
      toast({
        title: "Success",
        description: "Storage location created successfully",
      });
      onClose();
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create storage location",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ReturnType<typeof toApiData>> }) =>
      updateStorageLocation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rent-roll/storage-locations", { projectId }] });
      toast({
        title: "Success",
        description: "Storage location updated successfully",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update storage location",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (open && !isEditing) {
      form.reset({
        name: "",
        code: "",
        description: "",
        storageType: "",
        capacity: null,
        postedRate: null,
        postedRateType: "",
        isActive: true,
      });
    } else if (open && isEditing && existingLocation) {
      form.reset({
        name: existingLocation.name,
        code: existingLocation.code || "",
        description: existingLocation.description || "",
        storageType: existingLocation.storageType || "",
        capacity: existingLocation.capacity ?? null,
        postedRate: existingLocation.postedRate ? Number(existingLocation.postedRate) : null,
        postedRateType: existingLocation.postedRateType || "",
        isActive: existingLocation.isActive,
      });
    }
  }, [open, isEditing, existingLocation, form]);

  const onSubmit = (data: StorageLocationFormValues) => {
    const apiData = toApiData(data);
    
    if (isEditing && locationId) {
      updateMutation.mutate({ id: locationId, data: apiData });
    } else {
      createMutation.mutate({ ...apiData, projectId });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[480px] w-full p-0">
        <ScrollArea className="h-full">
          <div className="px-6 py-6">
            <SheetHeader>
              <SheetTitle className="text-2xl font-semibold">
                {isEditing ? "Edit Storage Location" : "Add New Storage Location"}
              </SheetTitle>
              <SheetDescription>
                {isEditing
                  ? "Update storage location details"
                  : "Create a new storage location (dock, slip, or berth) within this project"}
              </SheetDescription>
            </SheetHeader>

            {isEditing && isLoadingLocation ? (
              <div className="flex h-96 items-center justify-center" data-testid="status-loading-location">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading storage location data...</span>
              </div>
            ) : isEditing && isErrorLocation ? (
              <div className="flex h-96 flex-col items-center justify-center gap-2" data-testid="status-error-location">
                <p className="text-sm text-destructive">Failed to load storage location data</p>
                <Button variant="outline" onClick={onClose}>Close</Button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Storage Location Information</h3>
                    <Separator />
                    
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location Name *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="A Dock"
                              data-testid="input-storage-location-name"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Unique name for this storage location (e.g., A Dock, B Dock, Slip 23)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location Code</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="A"
                              data-testid="input-storage-location-code"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Optional short code or abbreviation
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="storageType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Storage Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger data-testid="select-storage-location-storage-type">
                                <SelectValue placeholder="Select storage type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {STORAGE_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Type of storage at this location
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="capacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Capacity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="50"
                              data-testid="input-storage-location-capacity"
                              {...field}
                              value={field.value === null ? "" : field.value}
                              onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                            />
                          </FormControl>
                          <FormDescription>
                            Total number of slips or spaces available
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator className="my-4" />
                    <h3 className="text-lg font-medium">Posted Rate (Rack Rate)</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Set the list price for this location to calculate potential revenue
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="postedRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Posted Rate</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="500.00"
                                data-testid="input-storage-location-posted-rate"
                                {...field}
                                value={field.value === null ? "" : field.value}
                                onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="postedRateType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rate Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-storage-location-rate-type">
                                  <SelectValue placeholder="Select rate type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {RATE_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator className="my-4" />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Additional notes about this storage location..."
                              rows={3}
                              data-testid="input-storage-location-description"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-storage-location-active"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Active Storage Location
                            </FormLabel>
                            <FormDescription>
                              Inactive storage locations won't appear in location selectors
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <SheetFooter className="gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      data-testid="button-cancel-storage-location"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoadingLocation || createMutation.isPending || updateMutation.isPending || (isEditing && !existingLocation)}
                      data-testid="button-save-storage-location"
                    >
                      {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {isEditing ? "Update Storage Location" : "Create Storage Location"}
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
