import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  MMModalWizard, 
  MMFormGrid, 
  MMInput,
  MMPhoneInput,
  MMEmailInput,
  MMSelect,
  MMTextarea,
  MMRadioCardGroup,
  MMStateSelect
} from "@/components/mm-ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Briefcase,
  Users,
  Building2,
  Handshake,
  Scale,
  Truck,
  Shield,
  Landmark,
  MoreHorizontal,
  Plus,
  X,
  Link as LinkIcon,
  MapPin,
  Anchor
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import type { Company } from "@shared/schema";

interface CreateContactWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactCreated?: (contactId: string) => void;
}

type ContactTag = "lead" | "seller" | "competitor" | "broker" | "vendor" | "insurance" | "lender" | "attorney" | "other";

interface WizardState {
  contactTag: ContactTag | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  companyId: string | null;
  role: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  notes: string;
  leadStatus: string | null;
}

interface LinkedCompany {
  id: string;
  name: string;
  role?: string;
  isNew?: boolean;
}

interface LinkedProperty {
  id: string;
  name: string;
  city?: string;
  state?: string;
  isNew?: boolean;
}

const steps = [
  { id: "type", label: "Type", title: "What type of contact is this?", subtitle: "Choose a category that best describes this contact" },
  { id: "basic", label: "Basic Info", title: "Basic Information", subtitle: "Enter the contact's name and contact details" },
  { id: "relationships", label: "Relationships", title: "Company & Properties", subtitle: "Associate with a company and create related properties" },
  { id: "details", label: "Details", title: "Additional Details", subtitle: "Address and notes (optional)" },
];

const contactTagOptions = [
  { value: "lead", title: "Lead", description: "Potential business opportunity", icon: <Briefcase className="h-5 w-5" /> },
  { value: "seller", title: "Seller", description: "Property seller or representative", icon: <Handshake className="h-5 w-5" /> },
  { value: "broker", title: "Broker", description: "Real estate or marina broker", icon: <Users className="h-5 w-5" /> },
  { value: "vendor", title: "Vendor", description: "Service or product provider", icon: <Truck className="h-5 w-5" /> },
  { value: "insurance", title: "Insurance", description: "Insurance provider or agent", icon: <Shield className="h-5 w-5" /> },
  { value: "lender", title: "Lender", description: "Financial institution or lender", icon: <Landmark className="h-5 w-5" /> },
  { value: "attorney", title: "Attorney", description: "Legal counsel or law firm", icon: <Scale className="h-5 w-5" /> },
  { value: "competitor", title: "Competitor", description: "Industry competitor", icon: <Building2 className="h-5 w-5" /> },
  { value: "other", title: "Other", description: "Other contact type", icon: <MoreHorizontal className="h-5 w-5" /> },
];

const leadStatusOptions = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "unqualified", label: "Unqualified" },
  { value: "converted", label: "Converted" },
];

export function CreateContactWizardModal({ open, onOpenChange, onContactCreated }: CreateContactWizardModalProps) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  
  const [state, setState] = useState<WizardState>({
    contactTag: null,
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    companyId: null,
    role: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    notes: "",
    leadStatus: "new",
  });

  const [linkedCompany, setLinkedCompany] = useState<LinkedCompany | null>(null);
  const [linkedProperties, setLinkedProperties] = useState<LinkedProperty[]>([]);
  
  const [showCompanySection, setShowCompanySection] = useState<"none" | "link" | "create">("none");
  const [showPropertySection, setShowPropertySection] = useState<"none" | "link" | "create">("none");
  
  const [companySearch, setCompanySearch] = useState("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [selectedCompanyRole, setSelectedCompanyRole] = useState("");
  
  
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyRole, setNewCompanyRole] = useState("");
  
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newPropertyCity, setNewPropertyCity] = useState("");
  const [newPropertyState, setNewPropertyState] = useState("");

  const { data: companiesData } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: open && currentStep === 2,
  });
  
  const filteredCompanies = (companiesData || []).filter(c => 
    c.name?.toLowerCase().includes(companySearch.toLowerCase())
  );

  useEffect(() => {
    if (!open) {
      setCurrentStep(0);
      setState({
        contactTag: null,
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        company: "",
        companyId: null,
        role: "",
        address: "",
        city: "",
        state: "",
        zipCode: "",
        notes: "",
        leadStatus: "new",
      });
      setLinkedCompany(null);
      setLinkedProperties([]);
      setShowCompanySection("none");
      setShowPropertySection("none");
      setCompanySearch("");
      setShowCompanyDropdown(false);
      setNewCompanyName("");
      setNewCompanyRole("");
      setNewPropertyName("");
      setNewPropertyCity("");
      setNewPropertyState("");
      setSelectedCompanyRole("");
    }
  }, [open]);

  const createContactMutation = useMutation({
    mutationFn: async (data: WizardState) => {
      let primaryCompanyId: string | undefined = undefined;
      
      if (linkedCompany) {
        if (linkedCompany.isNew) {
          try {
            const companyRes = await apiRequest('POST', '/api/companies', {
              name: linkedCompany.name,
            });
            const companyData = await companyRes.json();
            if (companyData.company?.id) {
              primaryCompanyId = companyData.company.id;
            }
          } catch (err) {
            console.error('Failed to create company:', linkedCompany.name, err);
          }
        } else {
          primaryCompanyId = linkedCompany.id;
        }
      }
      
      for (const property of linkedProperties) {
        if (property.isNew) {
          try {
            await apiRequest('POST', '/api/properties', {
              name: property.name,
              city: property.city,
              state: property.state,
            });
          } catch (err) {
            console.error('Failed to create property:', property.name, err);
          }
        }
      }
      
      const res = await apiRequest('POST', '/api/contacts', {
        firstName: data.firstName,
        lastName: data.lastName || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        company: linkedCompany?.name || data.company || undefined,
        companyId: primaryCompanyId || data.companyId || undefined,
        role: linkedCompany?.role || data.role || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        zipCode: data.zipCode || undefined,
        notes: data.notes || undefined,
        contactTag: data.contactTag || undefined,
        leadStatus: data.contactTag === "lead" ? data.leadStatus : null,
      });
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({ 
        title: "Contact Created", 
        description: `${state.firstName} ${state.lastName || ''} has been added.` 
      });
      onOpenChange(false);
      if (onContactCreated && result.contact?.id) {
        onContactCreated(result.contact.id);
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create contact.", 
        variant: "destructive" 
      });
    }
  });

  const isStepValid = () => {
    if (currentStep === 0) return !!state.contactTag;
    if (currentStep === 1) return !!state.firstName.trim();
    return true;
  };

  const handleNext = () => {
    if (currentStep === 0 && !state.contactTag) {
      toast({ title: "Select a contact type", description: "Please choose a contact type to continue.", variant: "destructive" });
      return;
    }
    if (currentStep === 1 && !state.firstName.trim()) {
      toast({ title: "Name required", description: "Please enter at least a first name.", variant: "destructive" });
      return;
    }
    if (currentStep === steps.length - 1) {
      createContactMutation.mutate(state);
    }
  };

  const handleLinkCompany = (company: Company) => {
    setLinkedCompany({
      id: company.id,
      name: company.name || "",
      role: selectedCompanyRole,
      isNew: false
    });
    setCompanySearch("");
    setSelectedCompanyRole("");
    setShowCompanyDropdown(false);
    setShowCompanySection("none");
  };

  const handleCreateNewCompany = () => {
    if (!newCompanyName.trim()) {
      toast({ title: "Company name required", variant: "destructive" });
      return;
    }
    const tempId = `new-${Date.now()}`;
    setLinkedCompany({
      id: tempId,
      name: newCompanyName.trim(),
      role: newCompanyRole,
      isNew: true
    });
    setNewCompanyName("");
    setNewCompanyRole("");
    setShowCompanySection("none");
  };

  const handleRemoveCompany = () => {
    setLinkedCompany(null);
  };

  const handleCreateNewProperty = () => {
    if (!newPropertyName.trim()) {
      toast({ title: "Property name required", variant: "destructive" });
      return;
    }
    const tempId = `new-${Date.now()}`;
    setLinkedProperties(prev => [...prev, {
      id: tempId,
      name: newPropertyName.trim(),
      city: newPropertyCity.trim() || undefined,
      state: newPropertyState || undefined,
      isNew: true
    }]);
    setNewPropertyName("");
    setNewPropertyCity("");
    setNewPropertyState("");
    setShowPropertySection("none");
  };

  const handleRemoveProperty = (id: string) => {
    setLinkedProperties(prev => prev.filter(p => p.id !== id));
  };

  const renderStep = (stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return (
          <div className="max-h-[380px] overflow-y-auto pr-1">
            <MMRadioCardGroup
              options={contactTagOptions}
              value={state.contactTag || undefined}
              onChange={(value) => setState(s => ({ ...s, contactTag: value as ContactTag }))}
              columns={1}
            />
          </div>
        );
      
      case 1:
        return (
          <div className="space-y-4">
            <MMFormGrid columns={2}>
              <MMInput
                label="First Name"
                required
                placeholder="John"
                value={state.firstName}
                onChange={(e) => setState(s => ({ ...s, firstName: e.target.value }))}
              />
              <MMInput
                label="Last Name"
                placeholder="Smith"
                value={state.lastName}
                onChange={(e) => setState(s => ({ ...s, lastName: e.target.value }))}
              />
            </MMFormGrid>
            <MMEmailInput
              label="Email"
              placeholder="john@example.com"
              value={state.email}
              onChange={(e) => setState(s => ({ ...s, email: e.target.value }))}
            />
            <MMPhoneInput
              label="Phone"
              placeholder="(555) 123-4567"
              value={state.phone}
              onChange={(e) => setState(s => ({ ...s, phone: e.target.value }))}
            />
            {state.contactTag === "lead" && (
              <MMSelect
                label="Lead Status"
                value={state.leadStatus || "new"}
                onValueChange={(v) => setState(s => ({ ...s, leadStatus: v }))}
                options={leadStatusOptions}
              />
            )}
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-6 max-h-[400px] overflow-y-auto pr-1">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#1E4FAB]" />
                  <span className="font-medium text-gray-900">Company</span>
                  <span className="text-xs text-gray-500">(Primary association)</span>
                </div>
                {!linkedCompany && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCompanySection(showCompanySection === "link" ? "none" : "link")}
                      className="text-xs"
                    >
                      <LinkIcon className="h-3 w-3 mr-1" />
                      Link Existing
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCompanySection(showCompanySection === "create" ? "none" : "create")}
                      className="text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add New
                    </Button>
                  </div>
                )}
              </div>

              {linkedCompany && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1.5">
                    <Building2 className="h-3 w-3" />
                    {linkedCompany.name}
                    {linkedCompany.role && <span className="text-xs opacity-70">({linkedCompany.role})</span>}
                    {linkedCompany.isNew && <span className="text-xs text-blue-600">(new)</span>}
                    <button
                      type="button"
                      onClick={handleRemoveCompany}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </div>
              )}

              {showCompanySection === "link" && (
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                  <div className="relative">
                    <MMInput
                      label="Search Company"
                      placeholder="Type to search..."
                      value={companySearch}
                      onChange={(e) => {
                        setCompanySearch(e.target.value);
                        setShowCompanyDropdown(e.target.value.length >= 1);
                      }}
                      onFocus={() => companySearch.length >= 1 && setShowCompanyDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 200)}
                    />
                    {showCompanyDropdown && filteredCompanies.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {filteredCompanies.map((c) => (
                          <div
                            key={c.id}
                            className="px-4 py-2 cursor-pointer hover:bg-blue-50 text-sm"
                            onMouseDown={() => handleLinkCompany(c)}
                          >
                            {c.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <MMInput
                    label="Role at Company"
                    placeholder="e.g. Owner, Manager"
                    value={selectedCompanyRole}
                    onChange={(e) => setSelectedCompanyRole(e.target.value)}
                  />
                </div>
              )}

              {showCompanySection === "create" && (
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                  <MMInput
                    label="Company Name"
                    required
                    placeholder="Enter company name"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                  />
                  <MMInput
                    label="Role at Company"
                    placeholder="e.g. Owner, Manager"
                    value={newCompanyRole}
                    onChange={(e) => setNewCompanyRole(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateNewCompany}
                    className="bg-[#1E4FAB] hover:bg-[#1a4294]"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Company
                  </Button>
                </div>
              )}
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#1E4FAB]" />
                  <span className="font-medium text-gray-900">Related Properties</span>
                  <span className="text-xs text-gray-500">(Optional - creates new properties)</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPropertySection(showPropertySection === "create" ? "none" : "create")}
                    className="text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add New Property
                  </Button>
                </div>
              </div>

              {linkedProperties.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {linkedProperties.map((property) => (
                    <Badge key={property.id} variant="secondary" className="flex items-center gap-1 px-3 py-1.5">
                      <Anchor className="h-3 w-3" />
                      {property.name}
                      {property.isNew && <span className="text-xs text-blue-600">(new)</span>}
                      <button
                        type="button"
                        onClick={() => handleRemoveProperty(property.id)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-500">
                Properties created here will be added to your system. Link to contact from the contact detail page.
              </p>

              {showPropertySection === "create" && (
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
                  <MMInput
                    label="Property Name"
                    required
                    placeholder="Enter property name"
                    value={newPropertyName}
                    onChange={(e) => setNewPropertyName(e.target.value)}
                  />
                  <MMFormGrid columns={2}>
                    <MMInput
                      label="City"
                      placeholder="City"
                      value={newPropertyCity}
                      onChange={(e) => setNewPropertyCity(e.target.value)}
                    />
                    <MMStateSelect
                      label="State"
                      value={newPropertyState}
                      onValueChange={setNewPropertyState}
                    />
                  </MMFormGrid>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateNewProperty}
                    className="bg-[#1E4FAB] hover:bg-[#1a4294]"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Property
                  </Button>
                </div>
              )}
            </div>

            {!linkedCompany && linkedProperties.length === 0 && showCompanySection === "none" && showPropertySection === "none" && (
              <div className="text-center py-6 text-gray-500 text-sm">
                <p>No relationships added yet.</p>
                <p className="text-xs mt-1">Click the buttons above to link or create companies and properties.</p>
              </div>
            )}
          </div>
        );
      
      case 3:
        return (
          <div className="space-y-4">
            <MMInput
              label="Street Address"
              placeholder="123 Main St"
              value={state.address}
              onChange={(e) => setState(s => ({ ...s, address: e.target.value }))}
            />
            
            <MMFormGrid columns={3}>
              <MMInput
                label="City"
                placeholder="City"
                value={state.city}
                onChange={(e) => setState(s => ({ ...s, city: e.target.value }))}
              />
              <MMStateSelect
                label="State"
                value={state.state}
                onValueChange={(v) => setState(s => ({ ...s, state: v }))}
              />
              <MMInput
                label="Zip"
                placeholder="12345"
                value={state.zipCode}
                onChange={(e) => setState(s => ({ ...s, zipCode: e.target.value }))}
              />
            </MMFormGrid>
            
            <MMTextarea
              label="Notes"
              placeholder="Any additional notes..."
              value={state.notes}
              onChange={(e) => setState(s => ({ ...s, notes: e.target.value }))}
              rows={3}
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <MMModalWizard
      open={open}
      onOpenChange={onOpenChange}
      title="New Contact"
      subtitle="Add a new contact to your CRM"
      icon={<User className="h-5 w-5" />}
      steps={steps}
      onStepChange={setCurrentStep}
      onNext={handleNext}
      isStepValid={isStepValid()}
      isLoading={createContactMutation.isPending}
      nextLabel="Continue"
      submitLabel="Create Contact"
      renderStep={renderStep}
      size="lg"
    />
  );
}

export default CreateContactWizardModal;
