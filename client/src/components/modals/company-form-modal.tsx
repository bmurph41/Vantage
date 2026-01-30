import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StandardDialogShell } from "@/components/ui/standard-dialog-shell";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X, User, Building, Star, MapPin, AlertTriangle, Check, AlertCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AddressInput, type AddressComponents } from "@/components/address-input";
import { StateSelect } from "@/components/ui/state-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { insertCompanySchema, insertContactSchema, type Company, type Contact, type ContactCompany, type Property, type CompanyProperty } from "@shared/schema";

// Type for joined ContactCompany data from API
type CompanyContactWithContact = ContactCompany & { contact: Contact };
type CompanyPropertyWithProperty = CompanyProperty & { property: Property };

interface CompanyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
  pendingCompanyId?: string | null;
  onSuccess?: () => void;
}

interface CompanyDuplicateMatch {
  company: Company;
  similarityScore: number;
  matchReasons: string[];
  matchDetails: {
    nameMatch: number;
    addressMatch: number;
    overallConfidence: 'high' | 'medium' | 'low';
  };
}

const companySizes = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1000+", label: "1000+ employees" },
];

const companyTypes = [
  { value: "investor", label: "Investor" },
  { value: "owner", label: "Owner" },
  { value: "broker", label: "Broker" },
  { value: "boat_dealer", label: "Boat Dealer" },
  { value: "boat_broker", label: "Boat Broker" },
  { value: "marina_operator", label: "Marina Operator" },
  { value: "yacht_club", label: "Yacht Club" },
  { value: "marine_contractor", label: "Marine Contractor" },
  { value: "marine_supplier", label: "Marine Supplier" },
  { value: "boat_manufacturer", label: "Boat Manufacturer" },
  { value: "marine_services", label: "Marine Services" },
  { value: "fuel_supplier", label: "Fuel Supplier" },
  { value: "insurance", label: "Insurance" },
  { value: "finance_lender", label: "Finance/Lender" },
  { value: "legal", label: "Legal" },
  { value: "environmental", label: "Environmental" },
  { value: "government", label: "Government/Regulatory" },
  { value: "other", label: "Other" },
];

const contactPositionOptions = [
  { value: "owner", label: "Owner" },
  { value: "investor", label: "Investor" },
  { value: "broker", label: "Broker" },
  { value: "lender", label: "Lender" },
  { value: "attorney", label: "Attorney" },
  { value: "appraiser", label: "Appraiser" },
  { value: "ceo", label: "CEO" },
  { value: "cfo", label: "CFO" },
  { value: "general_manager", label: "General Manager" },
  { value: "marina_manager", label: "Marina Manager" },
  { value: "dockmaster", label: "Dockmaster" },
  { value: "accountant", label: "Accountant" },
  { value: "operations", label: "Operations" },
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "consultant", label: "Consultant" },
  { value: "other", label: "Other" },
];

export default function CompanyFormModal({ isOpen, onClose, company, pendingCompanyId, onSuccess }: CompanyFormModalProps) {
  const { toast} = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("basic");
  const [isLinkingContact, setIsLinkingContact] = useState(false);
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [isLinkingProperty, setIsLinkingProperty] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  
  // Address fields state
  const [address, setAddress] = useState("");
  const [unit, setUnit] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  
  // Portfolio company fields
  const [isPortfolioCompany, setIsPortfolioCompany] = useState(false);
  const [capitalPartner, setCapitalPartner] = useState("");
  
  // Pending relationships for new companies
  const [pendingContacts, setPendingContacts] = useState<Array<{contact: Contact, role?: string}>>([]);
  const [pendingContactsToCreate, setPendingContactsToCreate] = useState<Array<{data: any, role?: string}>>([]);
  const [pendingProperties, setPendingProperties] = useState<Property[]>([]);

  // Duplicate detection state
  const [duplicates, setDuplicates] = useState<CompanyDuplicateMatch[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<any>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  
  // Successfully created pending contacts (for success state UI)
  const [createdPendingContacts, setCreatedPendingContacts] = useState<Array<{data: any, pendingContactId: string}>>([]);

  // Query to fetch linked contacts for existing company
  const { data: linkedContacts = [], refetch: refetchLinkedContacts } = useQuery<CompanyContactWithContact[]>({
    queryKey: ['/api/companies', company?.id, 'contacts'],
    enabled: !!company?.id && isOpen,
  });

  // Query to fetch all contacts for linking (enabled when on contacts tab or linking)
  const { data: allContacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    enabled: (isLinkingContact || activeTab === 'contacts') && isOpen,
  });

  // Query to fetch linked properties for existing company
  const { data: linkedProperties = [], refetch: refetchLinkedProperties } = useQuery<CompanyPropertyWithProperty[]>({
    queryKey: ['/api/companies', company?.id, 'properties'],
    enabled: !!company?.id && isOpen,
  });

  // Query to fetch all properties for linking (enabled when on properties tab or linking)
  const { data: allProperties = [] } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
    enabled: (isLinkingProperty || activeTab === 'properties') && isOpen,
  });

  const form = useForm({
    resolver: zodResolver(insertCompanySchema.omit({
      orgId: true,
      ownerId: true,
      labels: true,
      annualRevenue: true,
      annualMarinaSpend: true,
      acquisitionInterest: true,
      portfolioCount: true,
      city: true,
      state: true,
      zipCode: true,
      country: true,
      linkedInUrl: true,
      twitterHandle: true,
      employeeCount: true,
      tags: true,
      metadata: true,
      createdBy: true,
      isPortfolioCompany: true,
      capitalPartner: true,
    }).extend({
      name: z.string().min(1, "Company name is required"),
      industry: z.string().optional(),
      size: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      website: z.string().optional(),
      description: z.string().optional(),
    })),
    defaultValues: {
      name: "",
      industry: "",
      size: "",
      address: "",
      phone: "",
      website: "",
      description: "",
    },
  });

  // Form for creating new contacts
  const contactForm = useForm({
    resolver: zodResolver(insertContactSchema.extend({
      phone: insertContactSchema.shape.phone.optional(),
      position: insertContactSchema.shape.position.optional(),
    })),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      position: "",
    },
  });

  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name,
        industry: company.industry || "",
        size: company.size || "",
        phone: company.phone || "",
        website: company.website || "",
        description: company.description || "",
      });
      // Reset address fields from company data
      setAddress(company.address || "");
      setUnit("");
      setCity(company.city || "");
      setState(company.state || "");
      setZipCode(company.zipCode || "");
      // Reset portfolio company fields
      setIsPortfolioCompany(company.isPortfolioCompany || false);
      setCapitalPartner(company.capitalPartner || "");
    } else {
      form.reset({
        name: "",
        domain: "",
        industry: "",
        size: "",
        phone: "",
        website: "",
        description: "",
      });
      // Reset address fields
      setAddress("");
      setUnit("");
      setCity("");
      setState("");
      setZipCode("");
      // Reset portfolio company fields
      setIsPortfolioCompany(false);
      setCapitalPartner("");
      // Reset pending relationships when creating a new company
      setPendingContacts([]);
      setPendingContactsToCreate([]);
      setPendingProperties([]);
    }
    // Reset created pending contacts (success state)
    setCreatedPendingContacts([]);
    // Reset active tab when opening modal
    setActiveTab("basic");
  }, [company, form, isOpen]);

  const createCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      const cleanData = { 
        ...data,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
        isPortfolioCompany,
        capitalPartner: isPortfolioCompany ? capitalPartner.trim() || undefined : undefined,
      };
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === "" || cleanData[key] === undefined) delete cleanData[key];
      });
      
      const response = await apiRequest('POST', '/api/companies', cleanData);
      const newCompany = await response.json();
      
      // Handle pending contacts and properties
      if (pendingContacts.length > 0 || pendingContactsToCreate.length > 0 || pendingProperties.length > 0) {
        // Link existing contacts
        for (const { contact, role } of pendingContacts) {
          await apiRequest('POST', '/api/contact-companies', {
            contactId: contact.id,
            companyId: newCompany.id,
            role: role || null,
            isPrimary: false,
          });
        }
        
        // Create and link new contacts
        for (const { data: contactData, role } of pendingContactsToCreate) {
          const cleanContactData = { ...contactData };
          Object.keys(cleanContactData).forEach(key => {
            if (cleanContactData[key] === "") delete cleanContactData[key];
          });
          const contactResponse = await apiRequest('POST', '/api/contacts', cleanContactData);
          const newContact = await contactResponse.json();
          
          await apiRequest('POST', '/api/contact-companies', {
            contactId: newContact.id,
            companyId: newCompany.id,
            role: role || null,
            isPrimary: false,
          });
        }
        
        // Link properties
        for (const property of pendingProperties) {
          await apiRequest('POST', '/api/company-properties', {
            propertyId: property.id,
            companyId: newCompany.id,
          });
        }
      }
      
      return newCompany;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({ title: "Company created successfully" });
      onClose();
      form.reset();
      setPendingContacts([]);
      setPendingContactsToCreate([]);
      setPendingProperties([]);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create company", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      const cleanData = { 
        ...data,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        zipCode: zipCode.trim() || null,
        isPortfolioCompany,
        capitalPartner: isPortfolioCompany ? capitalPartner.trim() || null : null,
      };
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === "") cleanData[key] = null;
      });
      
      return await apiRequest('PUT', `/api/companies/${company!.id}`, cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({ title: "Company updated successfully" });
      onClose();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update company", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updatePendingCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      const cleanData = { 
        ...data,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zipCode: zipCode.trim() || undefined,
      };
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === "" || cleanData[key] === undefined) delete cleanData[key];
      });
      
      return await apiRequest('PATCH', `/api/pending-companies/${pendingCompanyId}`, cleanData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pending-companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/pending-companies'] });
      toast({ title: "Company details updated. You can now proceed to accept and add to CRM." });
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update pending company", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Contact-Company relationship mutations
  const createContactMutation = useMutation<Contact, Error, any>({
    mutationFn: async (contactData: any) => {
      const cleanData = { ...contactData };
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === "") delete cleanData[key];
      });
      // Set companyId if creating from within a company context
      if (company?.id) {
        cleanData.companyId = company.id;
      }
      const response = await apiRequest('POST', '/api/contacts', cleanData);
      return await response.json();
    },
    onSuccess: async (newContact) => {
      if (company?.id) {
        try {
          // Check if this is the first contact for the company
          const isFirstContact = !linkedContacts || linkedContacts.length === 0;
          
          // Link the new contact to the company
          await linkContactMutation.mutateAsync({
            contactId: newContact.id,
            companyId: company.id,
            role: newContact.position || null,
            isPrimary: isFirstContact, // Set as primary if first contact
          });
          
          // If first contact, also update company's primaryContactId
          if (isFirstContact) {
            try {
              await apiRequest('PATCH', `/api/companies/${company.id}`, {
                primaryContactId: newContact.id
              });
              queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
              queryClient.invalidateQueries({ queryKey: ['/api/companies', company.id] });
            } catch (err) {
              console.error('Failed to set primary contact on company:', err);
            }
          }
          
          queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
          queryClient.invalidateQueries({ queryKey: ['/api/companies', company.id, 'contacts'] });
          refetchLinkedContacts();
          toast({ title: isFirstContact ? "Contact created and set as primary" : "Contact created and linked successfully" });
          setIsCreatingContact(false);
          contactForm.reset();
        } catch (error: any) {
          // If linking fails, we need to clean up
          toast({
            title: "Contact created but linking failed",
            description: "The contact was created but could not be linked to the company. Please try linking manually.",
            variant: "destructive"
          });
          // Don't reset the form so user can try again
          queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
        }
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
        toast({ title: "Contact created successfully" });
        setIsCreatingContact(false);
        contactForm.reset();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create contact",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const createPendingContactMutation = useMutation<any, Error, any>({
    mutationFn: async (contactData: any) => {
      const response = await apiRequest('POST', '/api/crm/pending-contacts', {
        firstName: contactData.firstName || null,
        lastName: contactData.lastName || null,
        email: contactData.email || null,
        phone: contactData.phone || null,
        position: contactData.position || null,
        companyId: company?.id || null,
        linkedPropertyIds: linkedProperties?.map((lp: any) => lp.property?.id).filter(Boolean) || [],
      });
      return await response.json();
    },
    onSuccess: (pendingContact, variables) => {
      setCreatedPendingContacts(prev => [...prev, { 
        data: variables, 
        pendingContactId: pendingContact.id 
      }]);
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pending-contacts'] });
      setIsCreatingContact(false);
      contactForm.reset();
      toast({ 
        title: "Contact created and linked",
        description: "Click 'Update' to save the company with the linked contact."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create pending contact",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const linkContactMutation = useMutation({
    mutationFn: async (data: { contactId: string; companyId: string; role?: string | null; isPrimary?: boolean }) => {
      return await apiRequest('POST', '/api/contact-companies', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies', company?.id, 'contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({ title: "Contact linked successfully" });
      setIsLinkingContact(false);
      setSelectedContactId("");
      setContactRole("");
      refetchLinkedContacts();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to link contact",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const unlinkContactMutation = useMutation({
    mutationFn: async (contactCompanyId: string) => {
      return await apiRequest('DELETE', `/api/contact-companies/${contactCompanyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies', company?.id, 'contacts'] });
      toast({ title: "Contact unlinked successfully" });
      refetchLinkedContacts();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to unlink contact",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const updateContactCompanyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest('PUT', `/api/contact-companies/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies', company?.id, 'contacts'] });
      toast({ title: "Contact relationship updated successfully" });
      refetchLinkedContacts();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update contact relationship",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Check for duplicate companies
  const checkForDuplicates = async (name: string): Promise<CompanyDuplicateMatch[]> => {
    try {
      const params = new URLSearchParams({
        name,
        ...(address && { address }),
        ...(city && { city }),
        ...(state && { state }),
        ...(zipCode && { zipCode }),
        ...(company?.id && { excludeId: company.id }),
      });
      const response = await fetch(`/api/crm/companies/check-duplicates?${params}`);
      const data = await response.json();
      return data.duplicates || [];
    } catch (error) {
      console.error("Failed to check for duplicates:", error);
      return [];
    }
  };

  const onSubmit = async (data: any) => {
    // Validate required address fields
    if (!address.trim() || !city.trim() || !state.trim() || !zipCode.trim()) {
      toast({
        title: "Address Required",
        description: "Please fill in all required address fields (street, city, state, zip code)",
        variant: "destructive",
      });
      return;
    }
    
    if (pendingCompanyId) {
      updatePendingCompanyMutation.mutate(data);
    } else if (company?.id) {
      updateCompanyMutation.mutate(data);
    } else {
      // For new companies, check for duplicates first
      setIsCheckingDuplicates(true);
      const foundDuplicates = await checkForDuplicates(data.name);
      setIsCheckingDuplicates(false);
      
      if (foundDuplicates.length > 0) {
        // Show warning dialog with duplicates
        setDuplicates(foundDuplicates);
        setPendingFormData(data);
        setShowDuplicateWarning(true);
      } else {
        // No duplicates found, proceed with creation
        createCompanyMutation.mutate(data);
      }
    }
  };

  const handleConfirmCreate = () => {
    if (pendingFormData) {
      createCompanyMutation.mutate(pendingFormData);
      setShowDuplicateWarning(false);
      setPendingFormData(null);
      setDuplicates([]);
    }
  };

  const handleCancelCreate = () => {
    setShowDuplicateWarning(false);
    setPendingFormData(null);
    setDuplicates([]);
  };

  // Helper functions
  const handleLinkExistingContact = () => {
    if (!selectedContactId) return;
    
    if (company?.id) {
      // Existing company - link immediately
      linkContactMutation.mutate({
        contactId: selectedContactId,
        companyId: company.id,
        role: contactRole || null,
        isPrimary: false,
      });
    } else {
      // New company - add to pending
      const contact = allContacts.find(c => c.id === selectedContactId);
      if (contact) {
        setPendingContacts([...pendingContacts, { contact, role: contactRole || undefined }]);
        setIsLinkingContact(false);
        setSelectedContactId("");
        setContactRole("");
        toast({ title: "Contact added (will be linked when company is created)" });
      }
    }
  };

  const handleCreateNewContact = (data: any) => {
    if (company?.id) {
      // Existing company - create real contact and link it immediately
      createContactMutation.mutate(data);
    } else {
      // New company - add to pending (use position as role)
      setPendingContactsToCreate([...pendingContactsToCreate, { data, role: data.position || undefined }]);
      setIsCreatingContact(false);
      contactForm.reset();
      toast({ title: "Contact added (will be created when company is created)" });
    }
  };
  
  const handleRemovePendingContact = (index: number) => {
    setPendingContacts(pendingContacts.filter((_, i) => i !== index));
  };
  
  const handleRemovePendingContactToCreate = (index: number) => {
    setPendingContactsToCreate(pendingContactsToCreate.filter((_, i) => i !== index));
  };

  const handleSetPrimary = (contactCompanyId: string) => {
    updateContactCompanyMutation.mutate({
      id: contactCompanyId,
      data: { isPrimary: true }
    });
  };

  const handleUnlinkContact = (contactCompanyId: string) => {
    unlinkContactMutation.mutate(contactCompanyId);
  };

  // Property-Company relationship mutations
  const linkPropertyMutation = useMutation({
    mutationFn: async (data: { propertyId: string; companyId: string }) => {
      return await apiRequest('POST', '/api/company-properties', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies', company?.id, 'properties'] });
      toast({ title: "Property linked successfully" });
      setIsLinkingProperty(false);
      setSelectedPropertyId("");
      refetchLinkedProperties();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to link property",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const unlinkPropertyMutation = useMutation({
    mutationFn: async (companyPropertyId: string) => {
      return await apiRequest('DELETE', `/api/company-properties/${companyPropertyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies', company?.id, 'properties'] });
      toast({ title: "Property unlinked successfully" });
      refetchLinkedProperties();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to unlink property",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const handleLinkProperty = () => {
    if (!selectedPropertyId) return;
    
    if (company?.id) {
      // Existing company - link immediately
      linkPropertyMutation.mutate({
        propertyId: selectedPropertyId,
        companyId: company.id,
      });
    } else {
      // New company - add to pending
      const property = allProperties.find(p => p.id === selectedPropertyId);
      if (property) {
        setPendingProperties([...pendingProperties, property]);
        setIsLinkingProperty(false);
        setSelectedPropertyId("");
        toast({ title: "Property added (will be linked when company is created)" });
      }
    }
  };

  const handleUnlinkProperty = (companyPropertyId: string) => {
    unlinkPropertyMutation.mutate(companyPropertyId);
  };
  
  const handleRemovePendingProperty = (index: number) => {
    setPendingProperties(pendingProperties.filter((_, i) => i !== index));
  };

  const isLoading = createCompanyMutation.isPending || updateCompanyMutation.isPending || updatePendingCompanyMutation.isPending || isCheckingDuplicates;
  const availableContacts = allContacts.filter((contact: Contact) => 
    !linkedContacts.some((linked: CompanyContactWithContact) => linked.contact.id === contact.id) &&
    !pendingContacts.some(pending => pending.contact.id === contact.id)
  );
  const availableProperties = allProperties.filter((property: Property) => 
    !linkedProperties.some((linked: CompanyPropertyWithProperty) => linked.property.id === property.id) &&
    !pendingProperties.some(pending => pending.id === property.id)
  );

  // Prepare contact options for searchable select
  const contactOptions = useMemo(() => {
    return availableContacts.map((contact) => ({
      value: contact.id,
      label: `${contact.firstName} ${contact.lastName}${contact.email ? ` - ${contact.email}` : ''}`,
    }));
  }, [availableContacts]);

  return (
    <StandardDialogShell
      open={isOpen}
      onOpenChange={onClose}
      title={company ? 'Edit Company' : 'Create Company'}
      description={pendingCompanyId ? 'Review and edit company details before adding to CRM' : undefined}
      icon={Building}
      size="lg"
      showProgressBar={true}
      primaryAction={{
        label: isLoading ? 'Saving...' : ((company?.id || pendingCompanyId) ? 'Update' : 'Create'),
        onClick: form.handleSubmit(onSubmit),
        disabled: isLoading,
        loading: isLoading,
      }}
      secondaryAction={{
        label: 'Back',
        onClick: onClose,
        disabled: isLoading,
      }}
    >
      <div data-testid="company-form-modal">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Company Info
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Contacts ({company ? linkedContacts?.length || 0 : pendingContacts.length + pendingContactsToCreate.length})
            </TabsTrigger>
            <TabsTrigger value="properties" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Properties ({company ? linkedProperties?.length || 0 : pendingProperties.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Corporation" className="bg-white dark:bg-slate-900" {...field} data-testid="input-company-name" />
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
                        <Input placeholder="https://acme.com" className="bg-white dark:bg-slate-900" {...field} data-testid="input-website" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white dark:bg-slate-900" data-testid="select-company-type">
                              <SelectValue placeholder="Select company type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companyTypes.map((type) => (
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
                    name="size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Size</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white dark:bg-slate-900" data-testid="select-size">
                              <SelectValue placeholder="Select size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Not specified</SelectItem>
                            {companySizes.map((size) => (
                              <SelectItem key={size.value} value={size.value}>
                                {size.label}
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
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 (555) 123-4567" className="bg-white dark:bg-slate-900" {...field} data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                        placeholder="123 Main Street"
                        testId="input-address"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit" className="text-sm">Unit/Suite</Label>
                      <Input
                        id="unit"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="Apt 4B, Suite 100, etc."
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
                          placeholder="City"
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
                          placeholder="12345"
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
                          placeholder="Brief description of the company..." 
                          rows={3}
                          className="bg-white dark:bg-slate-900"
                          {...field} 
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Portfolio Company Section */}
                <Card className="border-cyan-200 dark:border-cyan-800 bg-cyan-50/50 dark:bg-cyan-950/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-cyan-800 dark:text-cyan-200">Portfolio Company</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isPortfolioCompany"
                        checked={isPortfolioCompany}
                        onCheckedChange={(checked) => {
                          setIsPortfolioCompany(checked === true);
                          if (!checked) {
                            setCapitalPartner("");
                          }
                        }}
                        data-testid="checkbox-portfolio-company"
                      />
                      <Label 
                        htmlFor="isPortfolioCompany" 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        This is a portfolio company
                      </Label>
                    </div>
                    
                    {isPortfolioCompany && (
                      <div className="space-y-2 pl-6">
                        <Label htmlFor="capitalPartner" className="text-sm">Capital Partner</Label>
                        <Input
                          id="capitalPartner"
                          value={capitalPartner}
                          onChange={(e) => setCapitalPartner(e.target.value)}
                          placeholder="Enter capital partner name..."
                          className="bg-white dark:bg-slate-900"
                          data-testid="input-capital-partner"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

              </form>
            </Form>
          </TabsContent>

          <TabsContent value="contacts" className="space-y-4">
            {/* Linked/Pending Contacts Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">{company ? 'Linked Contacts' : 'Contacts to Add'}</h3>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsLinkingContact(true)}
                    data-testid="button-link-existing-contact"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Link Existing
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreatingContact(true)}
                    data-testid="button-create-new-contact"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New
                  </Button>
                </div>
              </div>

              {company ? (
                // Existing company - show linked contacts and created pending contacts
                (linkedContacts?.length === 0 && createdPendingContacts.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No contacts linked to this company yet.</p>
                    <p className="text-sm">Click the buttons above to add contacts.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Successfully created pending contacts with green success state */}
                    {createdPendingContacts.map((created, index) => (
                      <div
                        key={`created-pending-${index}`}
                        className="flex items-center justify-between p-4 border-2 border-green-500 rounded-lg bg-green-50 dark:bg-green-900/20"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center">
                            <Check className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-green-800 dark:text-green-200">
                                {created.data.firstName} {created.data.lastName}
                              </span>
                              <Badge className="bg-green-500 text-white text-xs">
                                <Check className="h-3 w-3 mr-1" />
                                Linked
                              </Badge>
                            </div>
                            <div className="text-sm text-green-700 dark:text-green-300">
                              {created.data.email}
                              {created.data.position && (
                                <Badge variant="outline" className="ml-2 text-xs border-green-500 text-green-700 dark:text-green-300">
                                  {created.data.position}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="text-sm text-green-600 dark:text-green-400 italic">
                          Click Update to save
                        </span>
                      </div>
                    ))}
                    {/* Existing linked contacts */}
                    {linkedContacts?.map((linkedContact: any) => (
                        <div
                          key={linkedContact.id}
                          className="flex items-center justify-between p-4 border rounded-lg bg-card"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                              <User className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {linkedContact.contact.firstName} {linkedContact.contact.lastName}
                                </span>
                                {linkedContact.isPrimary && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Star className="h-3 w-3 mr-1" />
                                    Primary
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {linkedContact.contact.email}
                                {linkedContact.role && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {linkedContact.role}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!linkedContact.isPrimary && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSetPrimary(linkedContact.id)}
                                data-testid={`button-set-primary-${linkedContact.id}`}
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnlinkContact(linkedContact.id)}
                              data-testid={`button-unlink-contact-${linkedContact.id}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                )
              ) : (
                // New company - show pending contacts
                (pendingContacts.length === 0 && pendingContactsToCreate.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No contacts added yet.</p>
                    <p className="text-sm">Contacts added here will be linked when you create the company.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Pending existing contacts */}
                    {pendingContacts.map((pending, index) => (
                      <div
                        key={`pending-${index}`}
                        className="flex items-center justify-between p-4 border rounded-lg bg-card border-dashed"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {pending.contact.firstName} {pending.contact.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {pending.contact.email}
                              {pending.role && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {pending.role}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="ml-2 text-xs">Pending</Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemovePendingContact(index)}
                          data-testid={`button-remove-pending-contact-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {/* Pending new contacts to create */}
                    {pendingContactsToCreate.map((pending, index) => (
                      <div
                        key={`pending-create-${index}`}
                        className="flex items-center justify-between p-4 border rounded-lg bg-card border-dashed border-green-300"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {pending.data.firstName} {pending.data.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {pending.data.email}
                              {pending.role && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {pending.role}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="ml-2 text-xs bg-green-100 text-green-800">Will Create</Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemovePendingContactToCreate(index)}
                          data-testid={`button-remove-pending-create-contact-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Link Existing Contact Section */}
            {isLinkingContact && (
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <h4 className="font-medium mb-3">Link Existing Contact</h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium">Select Contact</label>
                          <SearchableSelect
                            options={contactOptions}
                            value={selectedContactId}
                            onValueChange={setSelectedContactId}
                            placeholder="Search contacts..."
                            searchPlaceholder="Type to search contacts..."
                            emptyText="No contacts found"
                            testId="select-existing-contact"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Role</label>
                          <Input
                            placeholder="e.g., CEO, Manager"
                            value={contactRole}
                            onChange={(e) => setContactRole(e.target.value)}
                            className="bg-white dark:bg-slate-900"
                            data-testid="input-contact-role"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsLinkingContact(false);
                            setSelectedContactId("");
                            setContactRole("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleLinkExistingContact}
                          disabled={!selectedContactId || linkContactMutation.isPending}
                          data-testid="button-confirm-link-contact"
                        >
                          {linkContactMutation.isPending ? "Linking..." : "Link Contact"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Create New Contact Section */}
                {isCreatingContact && (
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <h4 className="font-medium mb-3">Create New Contact</h4>
                    <Form {...contactForm}>
                      <form onSubmit={contactForm.handleSubmit(handleCreateNewContact)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={contactForm.control}
                            name="firstName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>First Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="John" className="bg-white dark:bg-slate-900" {...field} data-testid="input-new-contact-first-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={contactForm.control}
                            name="lastName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Last Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Doe" className="bg-white dark:bg-slate-900" {...field} data-testid="input-new-contact-last-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={contactForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="john@example.com" className="bg-white dark:bg-slate-900" {...field} data-testid="input-new-contact-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={contactForm.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone</FormLabel>
                                <FormControl>
                                  <Input placeholder="+1 (555) 123-4567" className="bg-white dark:bg-slate-900" {...field} data-testid="input-new-contact-phone" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={contactForm.control}
                            name="position"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Position</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ""}>
                                  <FormControl>
                                    <SelectTrigger className="bg-white dark:bg-slate-900" data-testid="select-new-contact-position">
                                      <SelectValue placeholder="Select position" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {contactPositionOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setIsCreatingContact(false);
                              contactForm.reset();
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={createContactMutation.isPending}
                            data-testid="button-create-contact"
                          >
                            {createContactMutation.isPending ? "Creating..." : "Create & Link Contact"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </div>
                )}
          </TabsContent>

          <TabsContent value="properties" className="space-y-4">
            {/* Linked/Pending Properties Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">{company ? 'Linked Properties' : 'Properties to Add'}</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLinkingProperty(true)}
                  data-testid="button-link-property"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Link Property
                </Button>
              </div>

              {company ? (
                // Existing company - show linked properties
                linkedProperties?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No properties linked to this company yet.</p>
                    <p className="text-sm">Click the button above to link properties.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {linkedProperties?.map((linkedProperty: any) => (
                        <div
                          key={linkedProperty.id}
                          className="flex items-center justify-between p-4 border rounded-lg bg-card"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                              <MapPin className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                              <div className="font-medium">
                                {linkedProperty.property.name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {linkedProperty.property.address}
                                {linkedProperty.property.price && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    ${linkedProperty.property.price.toLocaleString()}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnlinkProperty(linkedProperty.id)}
                            data-testid={`button-unlink-property-${linkedProperty.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )
              ) : (
                // New company - show pending properties
                pendingProperties.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No properties added yet.</p>
                    <p className="text-sm">Properties added here will be linked when you create the company.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingProperties.map((property, index) => (
                      <div
                        key={`pending-prop-${index}`}
                        className="flex items-center justify-between p-4 border rounded-lg bg-card border-dashed"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                            <MapPin className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {property.title}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {property.address}
                              {property.listingPrice && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  ${property.listingPrice.toLocaleString()}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="ml-2 text-xs">Pending</Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemovePendingProperty(index)}
                          data-testid={`button-remove-pending-property-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Link Property Section */}
            {isLinkingProperty && (
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <h4 className="font-medium mb-3">Link Property</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium">Select Property</label>
                        <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                          <SelectTrigger className="bg-white dark:bg-slate-900" data-testid="select-property">
                            <SelectValue placeholder="Choose property" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableProperties.map((property: any) => (
                              <SelectItem key={property.id} value={property.id}>
                                {property.name} - {property.address}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsLinkingProperty(false);
                            setSelectedPropertyId("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleLinkProperty}
                          disabled={!selectedPropertyId || linkPropertyMutation.isPending}
                          data-testid="button-confirm-link-property"
                        >
                          {linkPropertyMutation.isPending ? "Linking..." : "Link Property"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
          </TabsContent>
        </Tabs>

        {/* Duplicate Warning Dialog */}
        <AlertDialog open={showDuplicateWarning} onOpenChange={setShowDuplicateWarning}>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Potential Duplicate Found
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>We found {duplicates.length} existing {duplicates.length === 1 ? 'company' : 'companies'} that may be a duplicate:</p>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {duplicates.map((match) => (
                      <div key={match.company.id} className="p-3 border rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{match.company.name}</span>
                          <Badge variant={
                            match.matchDetails.overallConfidence === 'high' ? 'destructive' :
                            match.matchDetails.overallConfidence === 'medium' ? 'default' : 'secondary'
                          }>
                            {match.similarityScore}% match
                          </Badge>
                        </div>
                        {match.company.address && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {match.company.address}
                            {match.company.city && `, ${match.company.city}`}
                            {match.company.state && `, ${match.company.state}`}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {match.matchReasons.join(' • ')}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm">Do you still want to create a new company?</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelCreate}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmCreate}>
                Create Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </StandardDialogShell>
  );
}
