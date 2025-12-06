import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, X, User, Building, Link2, Search } from "lucide-react";
import { AddressInput, type AddressComponents } from "@/components/address-input";
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
  const [specificationKeys, setSpecificationKeys] = useState<string[]>([]);
  const [specificationValues, setSpecificationValues] = useState<Record<string, string>>({});
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
