import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { AddressInput, type AddressComponents } from "@/components/address-input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { insertPropertySchema, type Property } from "@shared/schema";

interface PropertyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property | null;
}

const propertyTypes = [
  { value: "marina", label: "Marina" },
  { value: "boat", label: "Boat" },
  { value: "slip", label: "Slip" },
  { value: "dry_storage", label: "Dry Storage" },
];

const propertyStatuses = [
  { value: "available", label: "Available" },
  { value: "under_contract", label: "Under Contract" },
  { value: "sold", label: "Sold" },
  { value: "off_market", label: "Off Market" },
];

export default function PropertyFormModal({ isOpen, onClose, property }: PropertyFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [specificationKeys, setSpecificationKeys] = useState<string[]>([]);
  const [specificationValues, setSpecificationValues] = useState<Record<string, string>>({});

  const form = useForm({
    resolver: zodResolver(insertPropertySchema.extend({
      listingPrice: z.string().optional(),
      address: z.string().optional(),
      description: z.string().optional(),
    })),
    defaultValues: {
      title: "",
      type: "marina",
      status: "available",
      listingPrice: "",
      address: "",
      description: "",
    },
  });

  useEffect(() => {
    if (property) {
      form.reset({
        title: property.title,
        type: property.type,
        status: property.status,
        listingPrice: property.listingPrice?.toString() || "",
        address: property.address || "",
        description: property.description || "",
      });
      
      // Load specifications
      if (property.specifications && typeof property.specifications === 'object') {
        const specs = property.specifications as Record<string, any>;
        const keys = Object.keys(specs);
        setSpecificationKeys(keys);
        setSpecificationValues(specs);
      }
    } else {
      form.reset({
        title: "",
        type: "marina",
        status: "available",
        listingPrice: "",
        address: "",
        description: "",
      });
      setSpecificationKeys([]);
      setSpecificationValues({});
    }
  }, [property, form]);

  const createPropertyMutation = useMutation({
    mutationFn: async (data: any) => {
      const cleanData = { 
        ...data,
        listingPrice: data.listingPrice ? parseFloat(data.listingPrice) : undefined,
        specifications: specificationKeys.length > 0 ? specificationValues : {},
      };
      
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === "" || cleanData[key] === undefined) {
          delete cleanData[key];
        }
      });
      
      return await apiRequest('POST', '/api/properties', cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({ title: "Property created successfully" });
      onClose();
      form.reset();
      setSpecificationKeys([]);
      setSpecificationValues({});
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create property", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updatePropertyMutation = useMutation({
    mutationFn: async (data: any) => {
      const cleanData = { 
        ...data,
        listingPrice: data.listingPrice ? parseFloat(data.listingPrice) : undefined,
        specifications: specificationKeys.length > 0 ? specificationValues : {},
      };
      
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === "" || cleanData[key] === undefined) {
          delete cleanData[key];
        }
      });
      
      return await apiRequest('PUT', `/api/properties/${property!.id}`, cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({ title: "Property updated successfully" });
      onClose();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update property", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const onSubmit = (data: any) => {
    if (property) {
      updatePropertyMutation.mutate(data);
    } else {
      createPropertyMutation.mutate(data);
    }
  };

  const addSpecification = () => {
    const newKey = `spec_${specificationKeys.length + 1}`;
    setSpecificationKeys([...specificationKeys, newKey]);
    setSpecificationValues({ ...specificationValues, [newKey]: "" });
  };

  const removeSpecification = (key: string) => {
    setSpecificationKeys(specificationKeys.filter(k => k !== key));
    const newValues = { ...specificationValues };
    delete newValues[key];
    setSpecificationValues(newValues);
  };

  const updateSpecificationKey = (oldKey: string, newKey: string) => {
    const newKeys = specificationKeys.map(k => k === oldKey ? newKey : k);
    setSpecificationKeys(newKeys);
    const newValues = { ...specificationValues };
    newValues[newKey] = newValues[oldKey];
    delete newValues[oldKey];
    setSpecificationValues(newValues);
  };

  const updateSpecificationValue = (key: string, value: string) => {
    setSpecificationValues({ ...specificationValues, [key]: value });
  };

  const isLoading = createPropertyMutation.isPending || updatePropertyMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="property-form-modal">
        <DialogHeader>
          <DialogTitle>{property ? 'Edit Property' : 'Add New Property'}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Luxury Marina Slip" {...field} data-testid="input-property-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-property-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {propertyTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-property-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {propertyStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="listingPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Listing Price (Optional)</FormLabel>
                  <FormControl>
                    <CurrencyInput
                      value={field.value ? parseFloat(field.value) : undefined}
                      onValueChange={(val) => field.onChange(val?.toString() || "")}
                      onBlur={field.onBlur}
                      data-testid="input-listing-price"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address (Optional)</FormLabel>
                  <FormControl>
                    <AddressInput
                      value={field.value || ''}
                      onChange={(value) => field.onChange(value)}
                      onAddressSelect={(components: AddressComponents) => {
                        field.onChange(components.fullAddress || components.street || '');
                      }}
                      placeholder="123 Harbor Way, Marina City, FL 33000"
                      testId="input-property-address"
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
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Detailed property description..." 
                      rows={3}
                      {...field} 
                      data-testid="textarea-property-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Specifications Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel>Specifications (Optional)</FormLabel>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={addSpecification}
                  data-testid="button-add-specification"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Specification
                </Button>
              </div>

              {specificationKeys.map((key) => (
                <div key={key} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
                  <Input
                    placeholder="Key (e.g., Length)"
                    value={key}
                    onChange={(e) => updateSpecificationKey(key, e.target.value)}
                    data-testid={`input-spec-key-${key}`}
                  />
                  <Input
                    placeholder="Value (e.g., 40 feet)"
                    value={specificationValues[key] || ""}
                    onChange={(e) => updateSpecificationValue(key, e.target.value)}
                    data-testid={`input-spec-value-${key}`}
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => removeSpecification(key)}
                    data-testid={`button-remove-spec-${key}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {specificationKeys.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No specifications added. Click "Add Specification" to add property details.
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                disabled={isLoading}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
                data-testid="button-submit"
              >
                {isLoading ? "Saving..." : (property ? "Update Property" : "Create Property")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
