import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { StandardDialogShell } from "@/components/ui/standard-dialog-shell";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X, User, Building, Link2, Search, MapPin } from "lucide-react";
import { AddressInput, type AddressComponents } from "@/components/address-input";
import { StateSelect } from "@/components/ui/state-select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { insertPropertySchema, type Property, type Contact, type Company, PREDEFINED_CRM_STORAGE_TYPES, type CrmPropertyStorageEntry } from "@shared/schema";

// Local type for form storage entries (before saving to DB)
interface StorageEntryRow {
  id?: string;
  storageType: string;
  capacity: string;
  occupied: string;
  rate: string;
  rateType: "monthly" | "annual";
}

interface PropertyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: Property | null;
}

const propertyTypes = [
  { value: "marina", label: "Marina" },
  { value: "boat_yard", label: "Boat Yard" },
  { value: "marina_yard", label: "Marina & Yard" },
];

const propertyStatuses = [
  { value: "target", label: "Target" },
  { value: "for_sale", label: "For Sale" },
  { value: "under_loi", label: "Under LOI" },
  { value: "under_contract", label: "Under Contract" },
];

const relationshipTypes = [
  { value: "owner", label: "Owner" },
  { value: "buyer", label: "Buyer" },
  { value: "seller", label: "Seller" },
  { value: "broker", label: "Broker" },
  { value: "agent", label: "Agent" },
  { value: "investor", label: "Investor" },
  { value: "tenant", label: "Tenant" },
  { value: "other", label: "Other" },
];

type LinkedContact = {
  id: string;
  contactId: string;
  propertyId: string;
  relationship?: string | null;
  contact?: Contact | null;
};

type LinkedCompany = {
  id: string;
  companyId: string;
  propertyId: string;
  relationship?: string | null;
  company?: Company | null;
};

export default function PropertyFormModal({ isOpen, onClose, property }: PropertyFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [selectedContactRelationship, setSelectedContactRelationship] = useState("owner");
  const [selectedCompanyRelationship, setSelectedCompanyRelationship] = useState("owner");
  const [showContactSearch, setShowContactSearch] = useState(false);
  const [showCompanySearch, setShowCompanySearch] = useState(false);
  
  // Dynamic storage entries state
  const [storageEntries, setStorageEntries] = useState<StorageEntryRow[]>([]);
  const [customStorageType, setCustomStorageType] = useState("");

  // Fetch existing storage entries (for edit mode)
  const { data: existingStorageEntries = [] } = useQuery<CrmPropertyStorageEntry[]>({
    queryKey: ['/api/properties', property?.id, 'storage-entries'],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${property?.id}/storage-entries`);
      if (!res.ok) throw new Error('Failed to fetch storage entries');
      return res.json();
    },
    enabled: isOpen && !!property?.id,
  });

  // Fetch linked contacts (for edit mode)
  const { data: linkedContacts = [], refetch: refetchLinkedContacts } = useQuery<LinkedContact[]>({
    queryKey: [`/api/properties/${property?.id}/contacts`],
    enabled: isOpen && !!property?.id,
  });

  // Fetch linked companies (for edit mode)
  const { data: linkedCompanies = [], refetch: refetchLinkedCompanies } = useQuery<LinkedCompany[]>({
    queryKey: [`/api/properties/${property?.id}/companies`],
    enabled: isOpen && !!property?.id,
  });

  // Fetch all contacts for search
  const { data: allContacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    enabled: isOpen && showContactSearch,
  });

  // Fetch all companies for search
  const { data: allCompanies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: isOpen && showCompanySearch,
  });

  // Link contact mutation
  const linkContactMutation = useMutation({
    mutationFn: async ({ contactId, relationship }: { contactId: string; relationship: string }) => {
      return await apiRequest('POST', `/api/properties/${property!.id}/contacts`, { contactId, relationship });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/properties/${property!.id}/contacts`] });
      setShowContactSearch(false);
      setContactSearch("");
      toast({ title: "Contact linked successfully" });
    },
    onError: () => {
      toast({ title: "Failed to link contact", variant: "destructive" });
    },
  });

  // Link company mutation
  const linkCompanyMutation = useMutation({
    mutationFn: async ({ companyId, relationship }: { companyId: string; relationship: string }) => {
      return await apiRequest('POST', `/api/properties/${property!.id}/companies`, { companyId, relationship });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/properties/${property!.id}/companies`] });
      setShowCompanySearch(false);
      setCompanySearch("");
      toast({ title: "Company linked successfully" });
    },
    onError: () => {
      toast({ title: "Failed to link company", variant: "destructive" });
    },
  });

  // Unlink contact mutation
  const unlinkContactMutation = useMutation({
    mutationFn: async (linkId: string) => {
      return await apiRequest('DELETE', `/api/properties/${property!.id}/contacts/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/properties/${property!.id}/contacts`] });
      toast({ title: "Contact unlinked" });
    },
  });

  // Unlink company mutation
  const unlinkCompanyMutation = useMutation({
    mutationFn: async (linkId: string) => {
      return await apiRequest('DELETE', `/api/properties/${property!.id}/companies/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/properties/${property!.id}/companies`] });
      toast({ title: "Company unlinked" });
    },
  });

  // Filter contacts for search
  const filteredContacts = allContacts.filter(contact => {
    if (!contactSearch) return true;
    const searchLower = contactSearch.toLowerCase();
    const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
    return fullName.includes(searchLower) || contact.email?.toLowerCase().includes(searchLower);
  }).filter(contact => !linkedContacts.some(lc => lc.contactId === contact.id));

  // Filter companies for search
  const filteredCompanies = allCompanies.filter(company => {
    if (!companySearch) return true;
    const searchLower = companySearch.toLowerCase();
    return company.name?.toLowerCase().includes(searchLower);
  }).filter(company => !linkedCompanies.some(lc => lc.companyId === company.id));

  // Address fields state
  const [address, setAddress] = useState("");
  const [unit, setUnit] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");

  // Additional marina property fields
  const [wetSlips, setWetSlips] = useState("");
  const [drySlips, setDrySlips] = useState(""); // Changed from dryStorage to match schema
  const [moorings, setMoorings] = useState("");
  const [totalCapacity, setTotalCapacity] = useState("");
  const [totalAcres, setTotalAcres] = useState("");
  const [waterDepth, setWaterDepth] = useState("");
  const [linearFeet, setLinearFeet] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  
  // Sale history fields
  const [lastSaleMonth, setLastSaleMonth] = useState("");
  const [lastSaleYear, setLastSaleYear] = useState("");
  const [lastSalePrice, setLastSalePrice] = useState("");

  const form = useForm({
    resolver: zodResolver(insertPropertySchema.extend({
      title: z.string().min(1, "Property name is required"),
      address: z.string().optional(),
      description: z.string().optional(),
    })),
    defaultValues: {
      title: "",
      type: "marina",
      status: "target",
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
        description: property.description || "",
      });
      
      // Reset address fields from property data
      setAddress(property.address || "");
      setUnit("");
      setCity(property.city || "");
      setState(property.state || "");
      setZipCode(property.zipCode || "");
      
      // Load storage capacity from top-level fields (matching crmProperties schema)
      const propAny = property as any;
      setWetSlips(propAny.wetSlips?.toString() || "");
      setDrySlips(propAny.drySlips?.toString() || "");
      setMoorings(propAny.moorings?.toString() || "");
      setTotalCapacity(propAny.totalCapacity?.toString() || "");
      
      // Load marina specifications from specifications object (legacy support)
      if (property.specifications && typeof property.specifications === 'object') {
        const specs = property.specifications as Record<string, any>;
        setTotalAcres(specs.totalAcres || "");
        setWaterDepth(specs.waterDepth || "");
        setLinearFeet(specs.linearFeet || "");
        setYearBuilt(specs.yearBuilt || "");
        // Fallback: if top-level fields empty, try specifications
        if (!propAny.wetSlips && specs.wetSlips) setWetSlips(specs.wetSlips.toString());
        if (!propAny.drySlips && specs.dryStorage) setDrySlips(specs.dryStorage.toString());
      }
      
      // Load sale history from property
      setLastSaleMonth(propAny.lastSaleMonth?.toString() || "");
      setLastSaleYear(propAny.lastSaleYear?.toString() || "");
      setLastSalePrice(propAny.lastSalePrice?.toString() || "");
    } else {
      form.reset({
        title: "",
        type: "marina",
        status: "target",
        description: "",
      });
      // Reset address fields
      setAddress("");
      setUnit("");
      setCity("");
      setState("");
      setZipCode("");
      setWetSlips("");
      setDrySlips("");
      setMoorings("");
      setTotalCapacity("");
      setTotalAcres("");
      setWaterDepth("");
      setLinearFeet("");
      setYearBuilt("");
      setLastSaleMonth("");
      setLastSaleYear("");
      setLastSalePrice("");
      setStorageEntries([]);
    }
  }, [property, form, isOpen]);

  // Load storage entries from server when editing
  useEffect(() => {
    if (existingStorageEntries.length > 0) {
      setStorageEntries(existingStorageEntries.map(entry => ({
        id: entry.id,
        storageType: entry.storageTypeName, // API returns storageTypeName
        capacity: entry.capacity?.toString() || "",
        occupied: entry.occupied?.toString() || "",
        rate: entry.rate?.toString() || "",
        rateType: (entry.rateType as "monthly" | "annual") || "monthly",
      })));
    }
  }, [existingStorageEntries]);

  // Storage entry management functions
  const addStorageEntry = (storageType: string) => {
    if (!storageType.trim()) return;
    if (storageEntries.some(e => e.storageType.toLowerCase() === storageType.toLowerCase())) {
      toast({ title: "Storage type already added", variant: "destructive" });
      return;
    }
    setStorageEntries([...storageEntries, {
      storageType: storageType.trim(),
      capacity: "",
      occupied: "",
      rate: "",
      rateType: "monthly",
    }]);
    setCustomStorageType("");
  };

  const removeStorageEntry = (index: number) => {
    setStorageEntries(storageEntries.filter((_, i) => i !== index));
  };

  const updateStorageEntry = (index: number, field: keyof StorageEntryRow, value: string) => {
    const updated = [...storageEntries];
    updated[index] = { ...updated[index], [field]: value };
    setStorageEntries(updated);
  };

  // Save storage entries mutation
  const saveStorageEntriesMutation = useMutation({
    mutationFn: async (propertyId: string) => {
      const entries = storageEntries.map(e => ({
        storageTypeName: e.storageType, // API expects storageTypeName
        capacity: e.capacity ? parseInt(e.capacity) : null,
        occupied: e.occupied ? parseInt(e.occupied) : null,
        rate: e.rate ? e.rate : null,
        rateType: e.rateType,
      }));
      return await apiRequest('PUT', `/api/properties/${propertyId}/storage-entries`, { entries });
    },
    onSuccess: (_, propertyId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties', propertyId, 'storage-entries'] });
    },
  });

  const createPropertyMutation = useMutation({
    mutationFn: async (data: any) => {
      // Store non-capacity specs in specifications object
      const specifications: Record<string, string> = {};
      if (totalAcres) specifications.totalAcres = totalAcres;
      if (waterDepth) specifications.waterDepth = waterDepth;
      if (linearFeet) specifications.linearFeet = linearFeet;
      if (yearBuilt) specifications.yearBuilt = yearBuilt;

      const cleanData: Record<string, any> = { 
        ...data,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        specifications: Object.keys(specifications).length > 0 ? specifications : {},
      };
      
      // Add storage capacity to top-level fields (matching crmProperties schema)
      if (wetSlips) cleanData.wetSlips = parseInt(wetSlips);
      if (drySlips) cleanData.drySlips = parseInt(drySlips);
      if (moorings) cleanData.moorings = parseInt(moorings);
      if (totalCapacity) cleanData.totalCapacity = parseInt(totalCapacity);
      
      // Add sale history fields (ensure proper types for backend)
      if (lastSaleMonth) cleanData.lastSaleMonth = parseInt(lastSaleMonth);
      if (lastSaleYear) cleanData.lastSaleYear = parseInt(lastSaleYear);
      if (lastSalePrice) {
        const parsedPrice = parseFloat(lastSalePrice);
        if (!isNaN(parsedPrice)) cleanData.lastSalePrice = parsedPrice.toFixed(2);
      }
      
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === "" || cleanData[key] === undefined) {
          delete cleanData[key];
        }
      });
      
      const result = await apiRequest('POST', '/api/properties', cleanData);
      const createdProperty = await result.json();
      // Save storage entries for the new property
      if (storageEntries.length > 0 && createdProperty?.id) {
        await saveStorageEntriesMutation.mutateAsync(createdProperty.id);
      }
      return createdProperty;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({ title: "Property created successfully" });
      onClose();
      form.reset();
      setWetSlips("");
      setDrySlips("");
      setMoorings("");
      setTotalCapacity("");
      setTotalAcres("");
      setWaterDepth("");
      setLinearFeet("");
      setYearBuilt("");
      setStorageEntries([]);
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
      // Store non-capacity specs in specifications object
      const specifications: Record<string, string> = {};
      if (totalAcres) specifications.totalAcres = totalAcres;
      if (waterDepth) specifications.waterDepth = waterDepth;
      if (linearFeet) specifications.linearFeet = linearFeet;
      if (yearBuilt) specifications.yearBuilt = yearBuilt;

      const cleanData: Record<string, any> = { 
        ...data,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        specifications: Object.keys(specifications).length > 0 ? specifications : {},
      };
      
      // Add storage capacity to top-level fields (matching crmProperties schema)
      if (wetSlips) cleanData.wetSlips = parseInt(wetSlips);
      if (drySlips) cleanData.drySlips = parseInt(drySlips);
      if (moorings) cleanData.moorings = parseInt(moorings);
      if (totalCapacity) cleanData.totalCapacity = parseInt(totalCapacity);
      
      // Add sale history fields (ensure proper types for backend)
      if (lastSaleMonth) cleanData.lastSaleMonth = parseInt(lastSaleMonth);
      if (lastSaleYear) cleanData.lastSaleYear = parseInt(lastSaleYear);
      if (lastSalePrice) {
        const parsedPrice = parseFloat(lastSalePrice);
        if (!isNaN(parsedPrice)) cleanData.lastSalePrice = parsedPrice.toFixed(2);
      }
      
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === "" || cleanData[key] === undefined) {
          delete cleanData[key];
        }
      });
      
      await apiRequest('PUT', `/api/properties/${property!.id}`, cleanData);
      // Save storage entries for this property
      await saveStorageEntriesMutation.mutateAsync(property!.id);
      return property;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({ title: "Property updated successfully" });
      onClose();
      setStorageEntries([]);
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
    // Validate required address fields
    if (!address.trim() || !city.trim() || !state.trim() || !zipCode.trim()) {
      toast({
        title: "Address Required",
        description: "Please fill in all required address fields (street, city, state, zip code)",
        variant: "destructive",
      });
      return;
    }
    
    if (property) {
      updatePropertyMutation.mutate(data);
    } else {
      createPropertyMutation.mutate(data);
    }
  };

  const isLoading = createPropertyMutation.isPending || updatePropertyMutation.isPending;

  const handlePrimaryClick = () => {
    formRef.current?.requestSubmit();
  };

  return (
    <StandardDialogShell
      open={isOpen}
      onOpenChange={onClose}
      title={property ? 'Edit Property' : 'Add New Property'}
      icon={MapPin}
      size="lg"
      className="max-h-[90vh] overflow-y-auto"
      primaryAction={{
        label: property ? "Update Property" : "Create Property",
        onClick: handlePrimaryClick,
        disabled: isLoading,
        loading: isLoading,
      }}
      secondaryAction={{
        label: "Cancel",
        onClick: onClose,
        disabled: isLoading,
      }}
    >
      <Form {...form}>
        <form ref={formRef} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="property-form-modal">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Property Name" className="bg-white dark:bg-slate-900" {...field} data-testid="input-property-title" />
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
                        <SelectTrigger className="bg-white dark:bg-slate-900" data-testid="select-property-type">
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
                        <SelectTrigger className="bg-white dark:bg-slate-900" data-testid="select-property-status">
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

            {/* Address Section */}
            <Card className="border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Address *
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <AddressInput
                    value={address}
                    onChange={(value) => setAddress(value)}
                    onAddressSelect={(components: AddressComponents) => {
                      if (components.source === 'google' && components.street) {
                        setAddress(components.street);
                      }
                      if (components.city) setCity(components.city);
                      if (components.state) setState(components.state);
                      if (components.zipCode) setZipCode(components.zipCode);
                    }}
                    label="Street Address *"
                    placeholder="123 Harbor Way"
                    testId="input-property-address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit" className="text-sm">Unit/Suite</Label>
                  <Input
                    id="unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Dock A, Slip 12, etc."
                    className="bg-white dark:bg-slate-900"
                    data-testid="input-unit"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-sm">City *</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Marina City"
                      className="bg-white dark:bg-slate-900"
                      data-testid="input-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state" className="text-sm">State *</Label>
                    <StateSelect
                      value={state}
                      onValueChange={setState}
                      placeholder="Select state"
                      className="bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode" className="text-sm">Zip Code *</Label>
                    <Input
                      id="zipCode"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder="33000"
                      className="bg-white dark:bg-slate-900"
                      data-testid="input-zip-code"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Detailed property description..." 
                      rows={3}
                      className="bg-white dark:bg-slate-900"
                      {...field} 
                      data-testid="textarea-property-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Marina Property Details */}
            <Separator className="my-4" />
            <div className="space-y-4">
              <FormLabel className="text-base font-medium">Property Details</FormLabel>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FormLabel className="text-sm">Wet Slips</FormLabel>
                  <Input
                    type="number"
                    placeholder="Number of wet slips"
                    value={wetSlips}
                    onChange={(e) => setWetSlips(e.target.value)}
                    className="bg-white dark:bg-slate-900"
                    data-testid="input-wet-slips"
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel className="text-sm">Dry Racks</FormLabel>
                  <Input
                    type="number"
                    placeholder="Number of dry racks"
                    value={drySlips}
                    onChange={(e) => setDrySlips(e.target.value)}
                    className="bg-white dark:bg-slate-900"
                    data-testid="input-dry-slips"
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel className="text-sm">Moorings</FormLabel>
                  <Input
                    type="number"
                    placeholder="Number of moorings"
                    value={moorings}
                    onChange={(e) => setMoorings(e.target.value)}
                    className="bg-white dark:bg-slate-900"
                    data-testid="input-moorings"
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel className="text-sm">Total Capacity</FormLabel>
                  <Input
                    type="number"
                    placeholder="Total capacity"
                    value={totalCapacity}
                    onChange={(e) => setTotalCapacity(e.target.value)}
                    className="bg-white dark:bg-slate-900"
                    data-testid="input-total-capacity"
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel className="text-sm">Total Acres</FormLabel>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Total acreage"
                    value={totalAcres}
                    onChange={(e) => setTotalAcres(e.target.value)}
                    className="bg-white dark:bg-slate-900"
                    data-testid="input-total-acres"
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel className="text-sm">Water Depth (ft)</FormLabel>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Average water depth"
                    value={waterDepth}
                    onChange={(e) => setWaterDepth(e.target.value)}
                    className="bg-white dark:bg-slate-900"
                    data-testid="input-water-depth"
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel className="text-sm">Linear Feet</FormLabel>
                  <Input
                    type="number"
                    placeholder="Linear feet of dockage"
                    value={linearFeet}
                    onChange={(e) => setLinearFeet(e.target.value)}
                    className="bg-white dark:bg-slate-900"
                    data-testid="input-linear-feet"
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel className="text-sm">Year Built</FormLabel>
                  <Input
                    type="number"
                    placeholder="Year built"
                    value={yearBuilt}
                    onChange={(e) => setYearBuilt(e.target.value)}
                    className="bg-white dark:bg-slate-900"
                    data-testid="input-year-built"
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Storage Types Section */}
            <Separator className="my-4" />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base font-medium">Storage Types</FormLabel>
                <div className="flex gap-2 items-center">
                  <Select onValueChange={(value) => addStorageEntry(value)}>
                    <SelectTrigger className="w-[180px] bg-white dark:bg-slate-900" data-testid="select-storage-type">
                      <SelectValue placeholder="Add storage type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PREDEFINED_CRM_STORAGE_TYPES.filter(
                        type => !storageEntries.some(e => e.storageType.toLowerCase() === type.toLowerCase())
                      ).map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Custom storage type input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Or enter custom type..."
                  value={customStorageType}
                  onChange={(e) => setCustomStorageType(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addStorageEntry(customStorageType);
                    }
                  }}
                  className="flex-1 bg-white dark:bg-slate-900"
                  data-testid="input-custom-storage-type"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => addStorageEntry(customStorageType)}
                  disabled={!customStorageType.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Storage entries table */}
              {storageEntries.length > 0 && (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Type</th>
                        <th className="px-3 py-2 text-left font-medium">Capacity</th>
                        <th className="px-3 py-2 text-left font-medium">Occupied</th>
                        <th className="px-3 py-2 text-left font-medium">Rate</th>
                        <th className="px-3 py-2 text-left font-medium">Rate Type</th>
                        <th className="px-3 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {storageEntries.map((entry, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-3 py-2 font-medium">{entry.storageType}</td>
                          <td className="px-3 py-1">
                            <Input
                              type="number"
                              placeholder="0"
                              value={entry.capacity}
                              onChange={(e) => updateStorageEntry(index, 'capacity', e.target.value)}
                              className="h-8 w-20 bg-white dark:bg-slate-900"
                            />
                          </td>
                          <td className="px-3 py-1">
                            <Input
                              type="number"
                              placeholder="0"
                              value={entry.occupied}
                              onChange={(e) => updateStorageEntry(index, 'occupied', e.target.value)}
                              className="h-8 w-20 bg-white dark:bg-slate-900"
                            />
                          </td>
                          <td className="px-3 py-1">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={entry.rate}
                              onChange={(e) => updateStorageEntry(index, 'rate', e.target.value)}
                              className="h-8 w-24 bg-white dark:bg-slate-900"
                            />
                          </td>
                          <td className="px-3 py-1">
                            <Select 
                              value={entry.rateType} 
                              onValueChange={(val) => updateStorageEntry(index, 'rateType', val)}
                            >
                              <SelectTrigger className="h-8 w-24 bg-white dark:bg-slate-900">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="annual">Annual</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeStorageEntry(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {storageEntries.length === 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm border rounded-md border-dashed">
                  No storage types added. Select from predefined types or enter a custom type.
                </div>
              )}
            </div>

            {/* Sale History Section */}
            <Separator className="my-4" />
            <div className="space-y-4">
              <FormLabel className="text-base font-medium">Sale History</FormLabel>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <FormLabel className="text-sm">Last Sale Month</FormLabel>
                  <Select value={lastSaleMonth} onValueChange={setLastSaleMonth}>
                    <SelectTrigger className="bg-white dark:bg-slate-900" data-testid="select-last-sale-month">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">January</SelectItem>
                      <SelectItem value="2">February</SelectItem>
                      <SelectItem value="3">March</SelectItem>
                      <SelectItem value="4">April</SelectItem>
                      <SelectItem value="5">May</SelectItem>
                      <SelectItem value="6">June</SelectItem>
                      <SelectItem value="7">July</SelectItem>
                      <SelectItem value="8">August</SelectItem>
                      <SelectItem value="9">September</SelectItem>
                      <SelectItem value="10">October</SelectItem>
                      <SelectItem value="11">November</SelectItem>
                      <SelectItem value="12">December</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <FormLabel className="text-sm">Last Sale Year</FormLabel>
                  <Input
                    type="number"
                    placeholder="e.g. 2023"
                    value={lastSaleYear}
                    onChange={(e) => setLastSaleYear(e.target.value)}
                    className="bg-white dark:bg-slate-900"
                    data-testid="input-last-sale-year"
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel className="text-sm">Sale Price</FormLabel>
                  <Input
                    type="number"
                    placeholder="e.g. 5000000"
                    value={lastSalePrice}
                    onChange={(e) => setLastSalePrice(e.target.value)}
                    className="bg-white dark:bg-slate-900"
                    data-testid="input-last-sale-price"
                  />
                </div>
              </div>
            </div>

            {/* Linked Contacts & Companies Section - Only for Edit Mode */}
            {property?.id && (
              <>
                <Separator className="my-4" />
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Link2 className="h-4 w-4" />
                    Linked Contacts & Companies
                  </div>

                  {/* Linked Contacts */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Contacts
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowContactSearch(!showContactSearch)}
                        data-testid="button-add-contact-link"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Link Contact
                      </Button>
                    </div>

                    {showContactSearch && (
                      <div className="bg-muted/50 rounded-md p-3 space-y-2">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search contacts..."
                              value={contactSearch}
                              onChange={(e) => setContactSearch(e.target.value)}
                              className="pl-8 bg-white dark:bg-slate-900"
                              data-testid="input-search-contacts"
                            />
                          </div>
                          <Select value={selectedContactRelationship} onValueChange={setSelectedContactRelationship}>
                            <SelectTrigger className="w-[130px] bg-white dark:bg-slate-900" data-testid="select-contact-relationship">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {relationshipTypes.map(rt => (
                                <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {filteredContacts.slice(0, 5).map(contact => (
                            <div
                              key={contact.id}
                              className="flex items-center justify-between p-2 rounded hover:bg-muted cursor-pointer"
                              onClick={() => linkContactMutation.mutate({ contactId: contact.id, relationship: selectedContactRelationship })}
                              data-testid={`link-contact-${contact.id}`}
                            >
                              <span className="text-sm">{contact.firstName} {contact.lastName}</span>
                              <span className="text-xs text-muted-foreground">{contact.email}</span>
                            </div>
                          ))}
                          {filteredContacts.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-2">No contacts found</p>
                          )}
                        </div>
                      </div>
                    )}

                    {linkedContacts.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {linkedContacts.map(lc => (
                          <Badge key={lc.id} variant="secondary" className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {lc.contact?.firstName} {lc.contact?.lastName}
                            {lc.relationship && <span className="text-xs opacity-70">({lc.relationship})</span>}
                            <button
                              type="button"
                              onClick={() => unlinkContactMutation.mutate(lc.id)}
                              className="ml-1 hover:text-destructive"
                              data-testid={`unlink-contact-${lc.id}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No contacts linked</p>
                    )}
                  </div>

                  {/* Linked Companies */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Companies
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCompanySearch(!showCompanySearch)}
                        data-testid="button-add-company-link"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Link Company
                      </Button>
                    </div>

                    {showCompanySearch && (
                      <div className="bg-muted/50 rounded-md p-3 space-y-2">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search companies..."
                              value={companySearch}
                              onChange={(e) => setCompanySearch(e.target.value)}
                              className="pl-8 bg-white dark:bg-slate-900"
                              data-testid="input-search-companies"
                            />
                          </div>
                          <Select value={selectedCompanyRelationship} onValueChange={setSelectedCompanyRelationship}>
                            <SelectTrigger className="w-[130px] bg-white dark:bg-slate-900" data-testid="select-company-relationship">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {relationshipTypes.map(rt => (
                                <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {filteredCompanies.slice(0, 5).map(company => (
                            <div
                              key={company.id}
                              className="flex items-center justify-between p-2 rounded hover:bg-muted cursor-pointer"
                              onClick={() => linkCompanyMutation.mutate({ companyId: company.id, relationship: selectedCompanyRelationship })}
                              data-testid={`link-company-${company.id}`}
                            >
                              <span className="text-sm">{company.name}</span>
                            </div>
                          ))}
                          {filteredCompanies.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-2">No companies found</p>
                          )}
                        </div>
                      </div>
                    )}

                    {linkedCompanies.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {linkedCompanies.map(lc => (
                          <Badge key={lc.id} variant="secondary" className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {lc.company?.name}
                            {lc.relationship && <span className="text-xs opacity-70">({lc.relationship})</span>}
                            <button
                              type="button"
                              onClick={() => unlinkCompanyMutation.mutate(lc.id)}
                              className="ml-1 hover:text-destructive"
                              data-testid={`unlink-company-${lc.id}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No companies linked</p>
                    )}
                  </div>
                </div>
              </>
            )}

        </form>
      </Form>
    </StandardDialogShell>
  );
}
