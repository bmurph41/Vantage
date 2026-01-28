import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  User, 
  ChevronRight,
  ChevronLeft,
  Briefcase,
  Users,
  Building2,
  Phone,
  Mail,
  MapPin,
  Tag,
  Handshake,
  Scale,
  Truck,
  Shield,
  Landmark,
  MoreHorizontal
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Company } from "@shared/schema";

interface CreateContactWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactCreated?: (contactId: string) => void;
}

type ContactTag = "lead" | "seller" | "competitor" | "broker" | "vendor" | "insurance" | "lender" | "attorney" | "other";

interface WizardState {
  step: number;
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
  { id: 1, title: "Type", icon: Tag },
  { id: 2, title: "Basic Info", icon: User },
  { id: 3, title: "Details", icon: Building2 },
];

const contactTags = [
  { id: "lead", name: "Lead", description: "Potential business opportunity", icon: Briefcase },
  { id: "seller", name: "Seller", description: "Property seller or representative", icon: Handshake },
  { id: "broker", name: "Broker", description: "Real estate or marina broker", icon: Users },
  { id: "vendor", name: "Vendor", description: "Service or product provider", icon: Truck },
  { id: "insurance", name: "Insurance", description: "Insurance provider or agent", icon: Shield },
  { id: "lender", name: "Lender", description: "Financial institution or lender", icon: Landmark },
  { id: "attorney", name: "Attorney", description: "Legal counsel or law firm", icon: Scale },
  { id: "competitor", name: "Competitor", description: "Industry competitor", icon: Building2 },
  { id: "other", name: "Other", description: "Other contact type", icon: MoreHorizontal },
];

const leadStatuses = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "unqualified", label: "Unqualified" },
  { value: "converted", label: "Converted" },
];

function formatPhone(raw?: string) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`;
}

export function CreateContactWizardModal({ open, onOpenChange, onContactCreated }: CreateContactWizardModalProps) {
  const queryClient = useQueryClient();
  
  const [state, setState] = useState<WizardState>({
    step: 1,
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

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const { data: companiesData } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: open && state.step === 3,
  });
  const companies = companiesData || [];

  useEffect(() => {
    if (open) {
      const hasChanges = state.firstName || state.lastName || state.email || state.phone || state.contactTag;
      setHasUnsavedChanges(Boolean(hasChanges));
    }
  }, [open, state]);

  useEffect(() => {
    if (!open) {
      setState({
        step: 1,
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
      setHasUnsavedChanges(false);
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

  const progress = (state.step / steps.length) * 100;

  function handleNext() {
    if (state.step === 1 && !state.contactTag) {
      toast({ title: "Select a contact type", description: "Please choose a contact type to continue.", variant: "destructive" });
      return;
    }
    if (state.step === 2 && !state.firstName.trim()) {
      toast({ title: "Name required", description: "Please enter at least a first name.", variant: "destructive" });
      return;
    }
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
    if (!state.firstName.trim()) {
      toast({ title: "Name required", description: "Please enter at least a first name.", variant: "destructive" });
      return;
    }
    createContactMutation.mutate(state);
  }

  const renderTypeStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">What type of contact is this?</h3>
        <p className="text-sm text-muted-foreground">
          Choose a category that best describes this contact
        </p>
      </div>
      <RadioGroup
        value={state.contactTag || ""}
        onValueChange={(value) => setState(s => ({ ...s, contactTag: value as ContactTag }))}
        className="grid grid-cols-1 gap-2 max-h-[320px] overflow-y-auto pr-1"
      >
        {contactTags.map((tag) => (
          <div
            key={tag.id}
            className={cn(
              "flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors",
              state.contactTag === tag.id 
                ? "border-[#1E4FAB] bg-[#1E4FAB]/5" 
                : "hover:bg-muted/50"
            )}
            onClick={() => setState(s => ({ ...s, contactTag: tag.id as ContactTag }))}
          >
            <RadioGroupItem value={tag.id} id={`tag-${tag.id}`} />
            <div className="p-2 rounded-lg bg-muted">
              <tag.icon className="h-4 w-4 text-[#1E4FAB]" />
            </div>
            <div className="flex-1">
              <Label htmlFor={`tag-${tag.id}`} className="font-medium cursor-pointer">
                {tag.name}
              </Label>
              <p className="text-xs text-muted-foreground">{tag.description}</p>
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
        <p className="text-sm text-muted-foreground">Enter the contact's name and contact details</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            placeholder="John"
            value={state.firstName}
            onChange={(e) => setState(s => ({ ...s, firstName: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            placeholder="Smith"
            value={state.lastName}
            onChange={(e) => setState(s => ({ ...s, lastName: e.target.value }))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email" className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="john@example.com"
          value={state.email}
          onChange={(e) => setState(s => ({ ...s, email: e.target.value }))}
        />
      </div>
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
      {state.contactTag === "lead" && (
        <div className="space-y-2">
          <Label htmlFor="leadStatus">Lead Status</Label>
          <Select
            value={state.leadStatus || "new"}
            onValueChange={(v) => setState(s => ({ ...s, leadStatus: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {leadStatuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  const renderDetailsStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">Additional Details</h3>
        <p className="text-sm text-muted-foreground">Company affiliation and address (optional)</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="company" className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Company
          </Label>
          <Select
            value={state.companyId || "_manual"}
            onValueChange={(v) => {
              if (v === "_manual") {
                setState(s => ({ ...s, companyId: null }));
              } else {
                const company = companies.find(c => c.id === v);
                setState(s => ({ ...s, companyId: v, company: company?.name || "" }));
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select or enter company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_manual">Enter manually</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role / Title</Label>
          <Input
            id="role"
            placeholder="e.g. Owner, Manager"
            value={state.role}
            onChange={(e) => setState(s => ({ ...s, role: e.target.value }))}
          />
        </div>
      </div>
      {!state.companyId && (
        <div className="space-y-2">
          <Label htmlFor="companyManual">Company Name</Label>
          <Input
            id="companyManual"
            placeholder="Enter company name"
            value={state.company}
            onChange={(e) => setState(s => ({ ...s, company: e.target.value }))}
          />
        </div>
      )}
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
          placeholder="Any additional notes..."
          value={state.notes}
          onChange={(e) => setState(s => ({ ...s, notes: e.target.value }))}
          rows={2}
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
              <User className="h-5 w-5 text-[#1E4FAB]" />
              New Contact
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
            Add a new contact to your CRM
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
              disabled={createContactMutation.isPending}
            >
              {createContactMutation.isPending ? "Creating..." : "Create Contact"}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
