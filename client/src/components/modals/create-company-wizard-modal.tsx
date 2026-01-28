import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StateSelect } from "@/components/ui/state-select";
import { 
  Building2, 
  ChevronRight,
  ChevronLeft,
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
  Globe,
  MapPin,
  Phone,
  Mail,
  MoreHorizontal,
  Wrench,
  Package
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CreateCompanyWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompanyCreated?: (companyId: string) => void;
}

type CompanyType = "investor" | "owner" | "broker" | "boat_dealer" | "boat_broker" | "marina_operator" | "yacht_club" | "marine_contractor" | "marine_supplier" | "boat_manufacturer" | "marine_services" | "fuel_supplier" | "insurance" | "finance_lender" | "legal" | "environmental" | "government" | "other";

interface WizardState {
  step: number;
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
  { id: 1, title: "Type", icon: Building2 },
  { id: 2, title: "Basic Info", icon: Globe },
  { id: 3, title: "Details", icon: MapPin },
];

const companyTypes = [
  { id: "investor", name: "Investor", description: "Investment firm or private equity", icon: Briefcase },
  { id: "owner", name: "Owner", description: "Marina or property owner", icon: Building2 },
  { id: "broker", name: "Broker", description: "Real estate or marina broker", icon: Users },
  { id: "marina_operator", name: "Marina Operator", description: "Marina management company", icon: Anchor },
  { id: "boat_dealer", name: "Boat Dealer", description: "New or used boat dealer", icon: Ship },
  { id: "boat_broker", name: "Boat Broker", description: "Yacht or boat brokerage", icon: Ship },
  { id: "yacht_club", name: "Yacht Club", description: "Private yacht or sailing club", icon: Anchor },
  { id: "marine_contractor", name: "Marine Contractor", description: "Marine construction services", icon: Wrench },
  { id: "marine_supplier", name: "Marine Supplier", description: "Marine parts and supplies", icon: Package },
  { id: "boat_manufacturer", name: "Boat Manufacturer", description: "Boat or yacht manufacturer", icon: Ship },
  { id: "marine_services", name: "Marine Services", description: "Marine repair and services", icon: Wrench },
  { id: "fuel_supplier", name: "Fuel Supplier", description: "Marine fuel distributor", icon: Fuel },
  { id: "insurance", name: "Insurance", description: "Marine insurance provider", icon: Shield },
  { id: "finance_lender", name: "Finance/Lender", description: "Marine financing or bank", icon: Landmark },
  { id: "legal", name: "Legal", description: "Law firm or attorney", icon: Scale },
  { id: "environmental", name: "Environmental", description: "Environmental consulting", icon: Leaf },
  { id: "government", name: "Government", description: "Government or regulatory", icon: Building },
  { id: "other", name: "Other", description: "Other company type", icon: MoreHorizontal },
];

const companySizes = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1000+", label: "1000+ employees" },
];

function formatPhone(raw?: string) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`;
}

export function CreateCompanyWizardModal({ open, onOpenChange, onCompanyCreated }: CreateCompanyWizardModalProps) {
  const queryClient = useQueryClient();
  
  const [state, setState] = useState<WizardState>({
    step: 1,
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

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      const hasChanges = state.name || state.website || state.phone || state.companyType;
      setHasUnsavedChanges(Boolean(hasChanges));
    }
  }, [open, state]);

  useEffect(() => {
    if (!open) {
      setState({
        step: 1,
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
      setHasUnsavedChanges(false);
      setValidationErrors({});
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
        size: data.size || undefined,
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

  const progress = (state.step / steps.length) * 100;

  function handleNext() {
    if (state.step === 1 && !state.companyType) {
      setValidationErrors({ companyType: true });
      toast({ title: "Select a company type", description: "Please choose a company type to continue.", variant: "destructive" });
      return;
    }
    if (state.step === 2 && !state.name.trim()) {
      setValidationErrors({ name: true });
      toast({ title: "Name required", description: "Please enter a company name.", variant: "destructive" });
      return;
    }
    setValidationErrors({});
    if (state.step < steps.length) {
      setState(s => ({ ...s, step: s.step + 1 }));
    }
  }

  function handleBack() {
    if (state.step > 1) {
      setState(s => ({ ...s, step: s.step - 1 }));
    }
  }

  function handleFinish() {
    if (!state.name.trim()) {
      setValidationErrors({ name: true });
      toast({ title: "Name required", description: "Please enter a company name.", variant: "destructive" });
      return;
    }
    setValidationErrors({});
    createCompanyMutation.mutate(state);
  }

  const renderTypeStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">What type of company is this? <span className="text-red-500">*</span></h3>
        <p className="text-sm text-muted-foreground">
          Choose a category that best describes this company
        </p>
      </div>
      <RadioGroup
        value={state.companyType || ""}
        onValueChange={(value) => {
          setState(s => ({ ...s, companyType: value as CompanyType }));
          setValidationErrors(prev => ({ ...prev, companyType: false }));
        }}
        className={cn(
          "grid grid-cols-1 gap-2 max-h-[320px] overflow-y-auto pr-1 rounded-lg",
          validationErrors.companyType && "ring-2 ring-red-500 ring-offset-2"
        )}
      >
        {companyTypes.map((type) => (
          <div
            key={type.id}
            className={cn(
              "flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors",
              state.companyType === type.id 
                ? "border-[#1E4FAB] bg-[#1E4FAB]/5" 
                : "hover:bg-muted/50"
            )}
            onClick={() => {
              setState(s => ({ ...s, companyType: type.id as CompanyType }));
              setValidationErrors(prev => ({ ...prev, companyType: false }));
            }}
          >
            <RadioGroupItem value={type.id} id={`type-${type.id}`} />
            <div className="p-2 rounded-lg bg-muted">
              <type.icon className="h-4 w-4 text-[#1E4FAB]" />
            </div>
            <div className="flex-1">
              <Label htmlFor={`type-${type.id}`} className="font-medium cursor-pointer">
                {type.name}
              </Label>
              <p className="text-xs text-muted-foreground">{type.description}</p>
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );

  const renderBasicInfoStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">Basic Information</h3>
        <p className="text-sm text-muted-foreground">Enter the company's name and contact details</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Company Name <span className="text-red-500">*</span></Label>
        <Input
          id="name"
          placeholder="Acme Marina Group"
          value={state.name}
          onChange={(e) => {
            setState(s => ({ ...s, name: e.target.value }));
            if (e.target.value.trim()) {
              setValidationErrors(prev => ({ ...prev, name: false }));
            }
          }}
          className={cn(validationErrors.name && "border-red-500 ring-1 ring-red-500")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="website" className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          Website
        </Label>
        <Input
          id="website"
          placeholder="https://www.example.com"
          value={state.website}
          onChange={(e) => setState(s => ({ ...s, website: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="phone" className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            Phone
          </Label>
          <Input
            id="phone"
            placeholder="(555) 123-4567"
            value={state.phone}
            onChange={(e) => setState(s => ({ ...s, phone: formatPhone(e.target.value) }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="info@example.com"
            value={state.email}
            onChange={(e) => setState(s => ({ ...s, email: e.target.value }))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="size">Company Size</Label>
        <Select
          value={state.size || "_none"}
          onValueChange={(v) => setState(s => ({ ...s, size: v === "_none" ? "" : v }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">Not specified</SelectItem>
            {companySizes.map((size) => (
              <SelectItem key={size.value} value={size.value}>
                {size.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderDetailsStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">Address & Notes</h3>
        <p className="text-sm text-muted-foreground">Add location and additional information</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address" className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Street Address
        </Label>
        <Input
          id="address"
          placeholder="123 Main St"
          value={state.address}
          onChange={(e) => setState(s => ({ ...s, address: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="unit">Suite / Unit</Label>
        <Input
          id="unit"
          placeholder="Suite 100"
          value={state.unit}
          onChange={(e) => setState(s => ({ ...s, unit: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            placeholder="City"
            value={state.city}
            onChange={(e) => setState(s => ({ ...s, city: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <StateSelect
            value={state.state}
            onValueChange={(v) => setState(s => ({ ...s, state: v }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zipCode">Zip</Label>
          <Input
            id="zipCode"
            placeholder="12345"
            value={state.zipCode}
            onChange={(e) => setState(s => ({ ...s, zipCode: e.target.value }))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="Any additional notes about this company..."
          value={state.notes}
          onChange={(e) => setState(s => ({ ...s, notes: e.target.value }))}
          rows={3}
        />
      </div>
    </div>
  );

  const getStepContent = () => {
    switch (state.step) {
      case 1: return renderTypeStep();
      case 2: return renderBasicInfoStep();
      case 3: return renderDetailsStep();
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#1E4FAB]" />
              New Company
            </DialogTitle>
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <div className="w-2 h-2 rounded-full bg-[#1E4FAB]" title="Unsaved changes" />
              )}
              <div className="flex items-center gap-1">
                {steps.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      "w-2 h-2 rounded-full transition-colors",
                      state.step >= s.id ? "bg-[#1E4FAB]" : "bg-muted"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
          <Progress value={progress} className="h-1" />
          <DialogDescription className="text-sm text-muted-foreground">
            Add a new company to your CRM
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 min-h-[320px]">
          {getStepContent()}
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={state.step === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          {state.step < steps.length ? (
            <Button onClick={handleNext} className="bg-[#1E4FAB] hover:bg-[#1a4294]">
              Continue
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={handleFinish} 
              className="bg-[#1E4FAB] hover:bg-[#1a4294]"
              disabled={createCompanyMutation.isPending}
            >
              {createCompanyMutation.isPending ? "Creating..." : "Create Company"}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
