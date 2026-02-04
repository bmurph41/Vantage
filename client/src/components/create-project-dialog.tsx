import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Building2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import { ddClient } from "@/lib/ddClient";
import type { CrmDeal, CrmProperty } from "@shared/schema";

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  projectType: z.enum(["single", "portfolio"]).default("single"),
  linkedDealId: z.string().optional(),
  linkedPropertyId: z.string().optional(),
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

  const form = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
      description: "",
      projectType: "single",
      linkedDealId: "",
      linkedPropertyId: "",
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

  useEffect(() => {
    if (watchedDealId && watchedDealId !== "_none") {
      const deal = deals.find(d => d.id === watchedDealId);
      if (deal) {
        if (deal.city) form.setValue("city", deal.city);
        if (deal.state) form.setValue("state", deal.state);
        if (!form.getValues("name")) {
          form.setValue("name", `${deal.title || deal.name} DD`);
        }
      }
    }
  }, [watchedDealId, deals, form]);

  useEffect(() => {
    if (watchedPropertyId && watchedPropertyId !== "_none") {
      const property = properties.find(p => p.id === watchedPropertyId);
      if (property) {
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
  }, [watchedPropertyId, properties, form]);

  const handleAddressSelect = (addr: NormalizedAddress) => {
    form.setValue("address", addr.line1 || addr.formattedAddress || "");
    form.setValue("city", addr.city || "");
    form.setValue("state", addr.state || "");
    form.setValue("zipCode", addr.postalCode || "");
    form.setValue("placeId", addr.placeId || "");
    if (addr.lat) form.setValue("lat", addr.lat);
    if (addr.lng) form.setValue("lng", addr.lng);
    setAddressInputValue(addr.formattedAddress || "");
  };

  const createProjectMutation = useMutation({
    mutationFn: async (values: CreateProjectFormValues) => {
      const coordinates = (values.lat && values.lng) 
        ? { lat: values.lat, lng: values.lng } 
        : undefined;
      
      const project = await ddClient.createProject({
        name: values.name,
        description: values.description || undefined,
        projectType: values.projectType as "single" | "portfolio",
        dealId: values.linkedDealId && values.linkedDealId !== "_none" ? values.linkedDealId : undefined,
        propertyId: values.linkedPropertyId && values.linkedPropertyId !== "_none" ? values.linkedPropertyId : undefined,
        address: values.address || undefined,
        city: values.city || undefined,
        state: values.state || undefined,
        zipCode: values.zipCode || undefined,
        placeId: values.placeId || undefined,
        coordinates,
      });
      return project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dd/projects"] });
      queryClient.invalidateQueries({ queryKey: ["all-projects-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/properties"] });
      toast({
        title: "Project created",
        description: `"${project.name}" has been created successfully.`,
      });
      setOpen(false);
      form.reset();
      setAddressInputValue("");
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
          <DialogTitle>Create Due Diligence Project</DialogTitle>
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

            <FormField
              control={form.control}
              name="linkedDealId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link to Deal</FormLabel>
                  <Select
                    onValueChange={(value) => {
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
                    onValueChange={(value) => field.onChange(value === "_none" ? "" : value)} 
                    value={field.value || "_none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a property (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none">No property</SelectItem>
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

            {!hasLinkedDealOrProperty && watchedProjectType === "single" && (
              <div className="space-y-2">
                <Label>Property Address</Label>
                <AddressAutocompleteInput
                  value={addressInputValue}
                  onChangeText={setAddressInputValue}
                  onSelectAddress={handleAddressSelect}
                  placeholder="Start typing an address..."
                  searchType="establishment"
                />
                <p className="text-sm text-muted-foreground">
                  Search for a marina or enter an address. A new property will be created in your CRM.
                </p>
              </div>
            )}

            {hasLinkedDealOrProperty && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} disabled />
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
                        <Input placeholder="State" {...field} disabled />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
              <Button type="submit" disabled={createProjectMutation.isPending}>
                {createProjectMutation.isPending ? "Creating..." : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
