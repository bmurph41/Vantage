import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { insertPropertySchema, type Property, type Contact, type Company } from "@shared/schema";

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
  const [contactSearch, setContactSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [selectedContactRelationship, setSelectedContactRelationship] = useState("owner");
  const [selectedCompanyRelationship, setSelectedCompanyRelationship] = useState("owner");
  const [showContactSearch, setShowContactSearch] = useState(false);
  const [showCompanySearch, setShowCompanySearch] = useState(false);

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
  const [dryStorage, setDryStorage] = useState("");
  const [totalAcres, setTotalAcres] = useState("");
  const [waterDepth, setWaterDepth] = useState("");
  const [linearFeet, setLinearFeet] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");

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
      
      // Load marina specifications from specifications object
      if (property.specifications && typeof property.specifications === 'object') {
        const specs = property.specifications as Record<string, any>;
        setWetSlips(specs.wetSlips || "");
        setDryStorage(specs.dryStorage || "");
        setTotalAcres(specs.totalAcres || "");
        setWaterDepth(specs.waterDepth || "");
        setLinearFeet(specs.linearFeet || "");
        setYearBuilt(specs.yearBuilt || "");
      }
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
      setDryStorage("");
      setTotalAcres("");
      setWaterDepth("");
      setLinearFeet("");
      setYearBuilt("");
    }
  }, [property, form]);

  const createPropertyMutation = useMutation({
    mutationFn: async (data: any) => {
      const specifications: Record<string, string> = {};
      if (wetSlips) specifications.wetSlips = wetSlips;
      if (dryStorage) specifications.dryStorage = dryStorage;
      if (totalAcres) specifications.totalAcres = totalAcres;
      if (waterDepth) specifications.waterDepth = waterDepth;
      if (linearFeet) specifications.linearFeet = linearFeet;
      if (yearBuilt) specifications.yearBuilt = yearBuilt;

      const cleanData = { 
        ...data,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        specifications: Object.keys(specifications).length > 0 ? specifications : {},
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
      setWetSlips("");
      setDryStorage("");
      setTotalAcres("");
      setWaterDepth("");
      setLinearFeet("");
      setYearBuilt("");
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
      const specifications: Record<string, string> = {};
      if (wetSlips) specifications.wetSlips = wetSlips;
      if (dryStorage) specifications.dryStorage = dryStorage;
      if (totalAcres) specifications.totalAcres = totalAcres;
      if (waterDepth) specifications.waterDepth = waterDepth;
      if (linearFeet) specifications.linearFeet = linearFeet;
      if (yearBuilt) specifications.yearBuilt = yearBuilt;

      const cleanData = { 
        ...data,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        specifications: Object.keys(specifications).length > 0 ? specifications : {},
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
                  <FormLabel>Property Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Property Name" {...field} data-testid="input-property-title" />
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
                      data-testid="input-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state" className="text-sm">State *</Label>
                    <StateSelect
                      value={state}
                      onValueChange={setState}
                      placeholder="Select state"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode" className="text-sm">Zip Code *</Label>
                    <Input
                      id="zipCode"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder="33000"
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
                    data-testid="input-wet-slips"
                  />
                </div>
                <div className="space-y-2">
                  <FormLabel className="text-sm">Dry Storage</FormLabel>
                  <Input
                    type="number"
                    placeholder="Number of dry storage units"
                    value={dryStorage}
                    onChange={(e) => setDryStorage(e.target.value)}
                    data-testid="input-dry-storage"
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
                    data-testid="input-year-built"
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
                              className="pl-8"
                              data-testid="input-search-contacts"
                            />
                          </div>
                          <Select value={selectedContactRelationship} onValueChange={setSelectedContactRelationship}>
                            <SelectTrigger className="w-[130px]" data-testid="select-contact-relationship">
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
                              className="pl-8"
                              data-testid="input-search-companies"
                            />
                          </div>
                          <Select value={selectedCompanyRelationship} onValueChange={setSelectedCompanyRelationship}>
                            <SelectTrigger className="w-[130px]" data-testid="select-company-relationship">
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
