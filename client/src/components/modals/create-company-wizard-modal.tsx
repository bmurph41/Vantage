import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { 
  Building2, 
  Briefcase,
  Users,
  Anchor,
  Ship,
  Fuel,
  Shield,
  Landmark,
  Scale,
  Leaf,
  Building,
  MoreHorizontal,
  Wrench,
  Package
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

interface CreateCompanyWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompanyCreated?: (companyId: string) => void;
}

type CompanyType = "investor" | "owner" | "broker" | "boat_dealer" | "boat_broker" | "marina_operator" | "yacht_club" | "marine_contractor" | "marine_supplier" | "boat_manufacturer" | "marine_services" | "fuel_supplier" | "insurance" | "finance_lender" | "legal" | "environmental" | "government" | "other";

interface WizardState {
  companyType: CompanyType | null;
  name: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  unit: string;
  city: string;
  state: string;
  zipCode: string;
  size: string;
  notes: string;
}

const steps = [
  { id: "type", label: "Type", title: "What type of company is this?", subtitle: "Choose a category that best describes this company" },
  { id: "basic", label: "Basic Info", title: "Basic Information", subtitle: "Enter the company's name and contact details" },
  { id: "details", label: "Details", title: "Address & Notes", subtitle: "Add location and additional information" },
];

const companyTypeOptions = [
  { value: "investor", title: "Investor", description: "Investment firm or private equity", icon: <Briefcase className="h-5 w-5" /> },
  { value: "owner", title: "Owner", description: "Marina or property owner", icon: <Building2 className="h-5 w-5" /> },
  { value: "broker", title: "Broker", description: "Real estate or marina broker", icon: <Users className="h-5 w-5" /> },
  { value: "marina_operator", title: "Marina Operator", description: "Marina management company", icon: <Anchor className="h-5 w-5" /> },
  { value: "boat_dealer", title: "Boat Dealer", description: "New or used boat dealer", icon: <Ship className="h-5 w-5" /> },
  { value: "boat_broker", title: "Boat Broker", description: "Yacht or boat brokerage", icon: <Ship className="h-5 w-5" /> },
  { value: "yacht_club", title: "Yacht Club", description: "Private yacht or sailing club", icon: <Anchor className="h-5 w-5" /> },
  { value: "marine_contractor", title: "Marine Contractor", description: "Marine construction services", icon: <Wrench className="h-5 w-5" /> },
  { value: "marine_supplier", title: "Marine Supplier", description: "Marine parts and supplies", icon: <Package className="h-5 w-5" /> },
  { value: "boat_manufacturer", title: "Boat Manufacturer", description: "Boat or yacht manufacturer", icon: <Ship className="h-5 w-5" /> },
  { value: "marine_services", title: "Marine Services", description: "Marine repair and services", icon: <Wrench className="h-5 w-5" /> },
  { value: "fuel_supplier", title: "Fuel Supplier", description: "Marine fuel distributor", icon: <Fuel className="h-5 w-5" /> },
  { value: "insurance", title: "Insurance", description: "Marine insurance provider", icon: <Shield className="h-5 w-5" /> },
  { value: "finance_lender", title: "Finance/Lender", description: "Marine financing or bank", icon: <Landmark className="h-5 w-5" /> },
  { value: "legal", title: "Legal", description: "Law firm or attorney", icon: <Scale className="h-5 w-5" /> },
  { value: "environmental", title: "Environmental", description: "Environmental consulting", icon: <Leaf className="h-5 w-5" /> },
  { value: "government", title: "Government", description: "Government or regulatory", icon: <Building className="h-5 w-5" /> },
  { value: "other", title: "Other", description: "Other company type", icon: <MoreHorizontal className="h-5 w-5" /> },
];

const companySizeOptions = [
  { value: "_none", label: "Not specified" },
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1000+", label: "1000+ employees" },
];

export function CreateCompanyWizardModal({ open, onOpenChange, onCompanyCreated }: CreateCompanyWizardModalProps) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  
  const [state, setState] = useState<WizardState>({
    companyType: null,
    name: "",
    website: "",
    phone: "",
    email: "",
    address: "",
    unit: "",
    city: "",
    state: "",
    zipCode: "",
    size: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) {
      setCurrentStep(0);
      setState({
        companyType: null,
        name: "",
        website: "",
        phone: "",
        email: "",
        address: "",
        unit: "",
        city: "",
        state: "",
        zipCode: "",
        size: "",
        notes: "",
      });
    }
  }, [open]);

  const createCompanyMutation = useMutation({
    mutationFn: async (data: WizardState) => {
      const res = await apiRequest('POST', '/api/companies', {
        name: data.name,
        type: data.companyType || undefined,
        website: data.website || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
        unit: data.unit || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        zipCode: data.zipCode || undefined,
        size: data.size === "_none" ? undefined : data.size || undefined,
        notes: data.notes || undefined,
      });
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      toast({ 
        title: "Company Created", 
        description: `${state.name} has been added.` 
      });
      onOpenChange(false);
      if (onCompanyCreated && result.company?.id) {
        onCompanyCreated(result.company.id);
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create company.", 
        variant: "destructive" 
      });
    }
  });

  const isStepValid = () => {
    if (currentStep === 0) return !!state.companyType;
    if (currentStep === 1) return !!state.name.trim();
    return true;
  };

  const handleNext = () => {
    if (currentStep === 0 && !state.companyType) {
      toast({ title: "Select a company type", description: "Please choose a company type to continue.", variant: "destructive" });
      return;
    }
    if (currentStep === 1 && !state.name.trim()) {
      toast({ title: "Name required", description: "Please enter a company name.", variant: "destructive" });
      return;
    }
    if (currentStep === steps.length - 1) {
      createCompanyMutation.mutate(state);
    }
  };

  const renderStep = (stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return (
          <div className="max-h-[380px] overflow-y-auto pr-1">
            <MMRadioCardGroup
              options={companyTypeOptions}
              value={state.companyType || undefined}
              onChange={(value) => setState(s => ({ ...s, companyType: value as CompanyType }))}
              columns={1}
            />
          </div>
        );
      
      case 1:
        return (
          <div className="space-y-4">
            <MMInput
              label="Company Name"
              required
              placeholder="Acme Marina Group"
              value={state.name}
              onChange={(e) => setState(s => ({ ...s, name: e.target.value }))}
            />
            <MMInput
              label="Website"
              placeholder="https://www.example.com"
              value={state.website}
              onChange={(e) => setState(s => ({ ...s, website: e.target.value }))}
            />
            <MMFormGrid columns={2}>
              <MMPhoneInput
                label="Phone"
                placeholder="(555) 123-4567"
                value={state.phone}
                onChange={(e) => setState(s => ({ ...s, phone: e.target.value }))}
              />
              <MMEmailInput
                label="Email"
                placeholder="info@example.com"
                value={state.email}
                onChange={(e) => setState(s => ({ ...s, email: e.target.value }))}
              />
            </MMFormGrid>
            <MMSelect
              label="Company Size"
              value={state.size || "_none"}
              onValueChange={(v) => setState(s => ({ ...s, size: v }))}
              options={companySizeOptions}
            />
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-4">
            <MMInput
              label="Street Address"
              placeholder="123 Main St"
              value={state.address}
              onChange={(e) => setState(s => ({ ...s, address: e.target.value }))}
            />
            <MMInput
              label="Suite / Unit"
              placeholder="Suite 100"
              value={state.unit}
              onChange={(e) => setState(s => ({ ...s, unit: e.target.value }))}
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
              placeholder="Any additional notes about this company..."
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
      title="New Company"
      subtitle="Add a new company to your CRM"
      icon={<Building2 className="h-5 w-5" />}
      steps={steps}
      onStepChange={setCurrentStep}
      onNext={handleNext}
      isStepValid={isStepValid()}
      isLoading={createCompanyMutation.isPending}
      nextLabel="Continue"
      submitLabel="Create Company"
      renderStep={renderStep}
      size="md"
    />
  );
}

export default CreateCompanyWizardModal;
