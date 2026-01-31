import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  MMModalWizard, 
  MMFormGrid, 
  MMFormRow,
  MMInput,
  MMPhoneInput,
  MMEmailInput,
  MMSelect,
  MMTextarea,
  MMRadioCardGroup,
  MMStateSelect
} from "@/components/mm-ui";
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
  MoreHorizontal
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

const steps = [
  { id: "type", label: "Type", title: "What type of contact is this?", subtitle: "Choose a category that best describes this contact" },
  { id: "basic", label: "Basic Info", title: "Basic Information", subtitle: "Enter the contact's name and contact details" },
  { id: "details", label: "Details", title: "Additional Details", subtitle: "Company affiliation and address (optional)" },
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

const companyModeOptions = [
  { value: "new", label: "New Company" },
  { value: "existing", label: "Search existing" },
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

  const [companyMode, setCompanyMode] = useState<"new" | "existing">("new");
  const [companySearch, setCompanySearch] = useState("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);

  const { data: companiesData } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: open && currentStep === 2 && companyMode === "existing" && companySearch.length >= 1,
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
      setCompanyMode("new");
      setCompanySearch("");
      setShowCompanyDropdown(false);
    }
  }, [open]);

  const createContactMutation = useMutation({
    mutationFn: async (data: WizardState) => {
      const res = await apiRequest('POST', '/api/contacts', {
        firstName: data.firstName,
        lastName: data.lastName || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        company: data.company || undefined,
        companyId: data.companyId || undefined,
        role: data.role || undefined,
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
          <div className="space-y-4">
            <MMFormGrid columns={2}>
              <MMSelect
                label="Company"
                value={companyMode}
                onValueChange={(v: string) => {
                  const mode = v as "new" | "existing";
                  setCompanyMode(mode);
                  if (mode === "new") {
                    setState(s => ({ ...s, companyId: null }));
                    setCompanySearch("");
                    setShowCompanyDropdown(false);
                  } else {
                    setState(s => ({ ...s, company: "" }));
                  }
                }}
                options={companyModeOptions}
              />
              <MMInput
                label="Role / Title"
                placeholder="e.g. Owner, Manager"
                value={state.role}
                onChange={(e) => setState(s => ({ ...s, role: e.target.value }))}
              />
            </MMFormGrid>
            
            {companyMode === "new" ? (
              <MMInput
                label="Company Name"
                placeholder="Enter company name"
                value={state.company}
                onChange={(e) => setState(s => ({ ...s, company: e.target.value }))}
              />
            ) : (
              <div className="relative">
                <MMInput
                  label="Search Company"
                  placeholder="Type to search companies..."
                  value={state.companyId ? (companiesData?.find(c => c.id === state.companyId)?.name || companySearch) : companySearch}
                  onChange={(e) => {
                    setCompanySearch(e.target.value);
                    setState(s => ({ ...s, companyId: null, company: "" }));
                    setShowCompanyDropdown(e.target.value.length >= 1);
                  }}
                  onFocus={() => {
                    if (companySearch.length >= 1) {
                      setShowCompanyDropdown(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowCompanyDropdown(false), 200);
                  }}
                />
                {showCompanyDropdown && filteredCompanies.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredCompanies.map((c) => (
                      <div
                        key={c.id}
                        className="px-4 py-3 cursor-pointer hover:bg-blue-50 text-sm text-gray-900 border-b border-gray-100 last:border-b-0"
                        onMouseDown={() => {
                          setState(s => ({ ...s, companyId: c.id, company: c.name || "" }));
                          setCompanySearch(c.name || "");
                          setShowCompanyDropdown(false);
                        }}
                      >
                        {c.name}
                      </div>
                    ))}
                  </div>
                )}
                {showCompanyDropdown && companySearch.length >= 1 && filteredCompanies.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-sm text-gray-500">
                    No companies found. Select "New Company" to create one.
                  </div>
                )}
              </div>
            )}
            
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
              rows={2}
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
      size="md"
    />
  );
}

export default CreateContactWizardModal;
