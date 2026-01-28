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
  MapPin, 
  ChevronRight,
  ChevronLeft,
  Anchor,
  Wrench,
  Building2,
  Target,
  Tag,
  FileText,
  DollarSign,
  LayoutGrid
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CreatePropertyWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPropertyCreated?: (propertyId: string) => void;
}

type PropertyType = "marina" | "boat_yard" | "marina_yard";
type PropertyStatus = "target" | "for_sale" | "under_loi" | "under_contract";

interface WizardState {
  step: number;
  propertyType: PropertyType | null;
  name: string;
  address: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  status: PropertyStatus;
  askingPrice: string;
  wetSlips: string;
  dryStorage: string;
  acreage: string;
  notes: string;
}

const steps = [
  { id: 1, title: "Type", icon: Tag },
  { id: 2, title: "Location", icon: MapPin },
  { id: 3, title: "Details", icon: LayoutGrid },
];

const propertyTypes = [
  { id: "marina", name: "Marina", description: "Wet slips and dock facilities", icon: Anchor },
  { id: "boat_yard", name: "Boat Yard", description: "Dry storage and maintenance facilities", icon: Wrench },
  { id: "marina_yard", name: "Marina & Yard", description: "Combined wet and dry storage", icon: Building2 },
];

const propertyStatuses = [
  { value: "target", label: "Target", description: "Potential acquisition target" },
  { value: "for_sale", label: "For Sale", description: "Actively listed for sale" },
  { value: "under_loi", label: "Under LOI", description: "Letter of Intent signed" },
  { value: "under_contract", label: "Under Contract", description: "Purchase agreement in place" },
];

export function CreatePropertyWizardModal({ open, onOpenChange, onPropertyCreated }: CreatePropertyWizardModalProps) {
  const queryClient = useQueryClient();
  
  const [state, setState] = useState<WizardState>({
    step: 1,
    propertyType: null,
    name: "",
    address: "",
    addressLine2: "",
    city: "",
    state: "",
    zipCode: "",
    status: "target",
    askingPrice: "",
    wetSlips: "",
    dryStorage: "",
    acreage: "",
    notes: "",
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      const hasChanges = state.name || state.address || state.city || state.propertyType;
      setHasUnsavedChanges(Boolean(hasChanges));
    }
  }, [open, state]);

  useEffect(() => {
    if (!open) {
      setState({
        step: 1,
        propertyType: null,
        name: "",
        address: "",
        addressLine2: "",
        city: "",
        state: "",
        zipCode: "",
        status: "target",
        askingPrice: "",
        wetSlips: "",
        dryStorage: "",
        acreage: "",
        notes: "",
      });
      setHasUnsavedChanges(false);
      setValidationErrors({});
    }
  }, [open]);

  const createPropertyMutation = useMutation({
    mutationFn: async (data: WizardState) => {
      const res = await apiRequest('POST', '/api/properties', {
        name: data.name,
        propertyType: data.propertyType || undefined,
        address: data.address || undefined,
        addressLine2: data.addressLine2 || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        zipCode: data.zipCode || undefined,
        status: data.status || "target",
        askingPrice: data.askingPrice ? parseFloat(data.askingPrice.replace(/[^0-9.]/g, '')) : undefined,
        wetSlips: data.wetSlips ? parseInt(data.wetSlips) : undefined,
        dryStorage: data.dryStorage ? parseInt(data.dryStorage) : undefined,
        acreage: data.acreage ? parseFloat(data.acreage) : undefined,
        notes: data.notes || undefined,
      });
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      toast({ 
        title: "Property Created", 
        description: `${state.name} has been added.` 
      });
      onOpenChange(false);
      if (onPropertyCreated && result.property?.id) {
        onPropertyCreated(result.property.id);
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create property.", 
        variant: "destructive" 
      });
    }
  });

  const progress = (state.step / steps.length) * 100;

  function handleNext() {
    if (state.step === 1 && !state.propertyType) {
      setValidationErrors({ propertyType: true });
      toast({ title: "Select a property type", description: "Please choose a property type to continue.", variant: "destructive" });
      return;
    }
    if (state.step === 2 && !state.name.trim()) {
      setValidationErrors({ name: true });
      toast({ title: "Name required", description: "Please enter a property name.", variant: "destructive" });
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
      toast({ title: "Name required", description: "Please enter a property name.", variant: "destructive" });
      return;
    }
    setValidationErrors({});
    createPropertyMutation.mutate(state);
  }

  function formatPrice(value: string) {
    const digits = value.replace(/[^0-9]/g, '');
    if (!digits) return '';
    return '$' + parseInt(digits).toLocaleString();
  }

  const renderTypeStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">What type of property is this? <span className="text-red-500">*</span></h3>
        <p className="text-sm text-muted-foreground">
          Choose the property category
        </p>
      </div>
      <RadioGroup
        value={state.propertyType || ""}
        onValueChange={(value) => {
          setState(s => ({ ...s, propertyType: value as PropertyType }));
          setValidationErrors(prev => ({ ...prev, propertyType: false }));
        }}
        className={cn(
          "space-y-3 rounded-lg",
          validationErrors.propertyType && "ring-2 ring-red-500 ring-offset-2"
        )}
      >
        {propertyTypes.map((type) => (
          <div
            key={type.id}
            className={cn(
              "flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors",
              state.propertyType === type.id 
                ? "border-[#1E4FAB] bg-[#1E4FAB]/5" 
                : "hover:bg-muted/50"
            )}
            onClick={() => {
              setState(s => ({ ...s, propertyType: type.id as PropertyType }));
              setValidationErrors(prev => ({ ...prev, propertyType: false }));
            }}
          >
            <RadioGroupItem value={type.id} id={`type-${type.id}`} />
            <div className="p-2 rounded-lg bg-muted">
              <type.icon className="h-5 w-5 text-[#1E4FAB]" />
            </div>
            <div className="flex-1">
              <Label htmlFor={`type-${type.id}`} className="font-medium cursor-pointer">
                {type.name}
              </Label>
              <p className="text-sm text-muted-foreground">{type.description}</p>
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );

  const renderLocationStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">Property Location</h3>
        <p className="text-sm text-muted-foreground">Enter the property name and address</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Property Name <span className="text-red-500">*</span></Label>
        <Input
          id="name"
          placeholder="Sunset Marina"
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
        <Label htmlFor="address" className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Street Address
        </Label>
        <Input
          id="address"
          placeholder="123 Harbor Drive"
          value={state.address}
          onChange={(e) => setState(s => ({ ...s, address: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine2">Address Line 2</Label>
        <Input
          id="addressLine2"
          placeholder="Suite 100, Building A"
          value={state.addressLine2}
          onChange={(e) => setState(s => ({ ...s, addressLine2: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            placeholder="Miami"
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
            placeholder="33101"
            value={state.zipCode}
            onChange={(e) => setState(s => ({ ...s, zipCode: e.target.value }))}
          />
        </div>
      </div>
    </div>
  );

  const renderDetailsStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">Property Details</h3>
        <p className="text-sm text-muted-foreground">Status and capacity information</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="status" className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          Status
        </Label>
        <Select
          value={state.status}
          onValueChange={(v) => setState(s => ({ ...s, status: v as PropertyStatus }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {propertyStatuses.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="askingPrice" className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          Asking Price
        </Label>
        <Input
          id="askingPrice"
          placeholder="$5,000,000"
          value={state.askingPrice}
          onChange={(e) => setState(s => ({ ...s, askingPrice: formatPrice(e.target.value) }))}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="wetSlips">Wet Slips</Label>
          <Input
            id="wetSlips"
            type="number"
            placeholder="100"
            value={state.wetSlips}
            onChange={(e) => setState(s => ({ ...s, wetSlips: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dryStorage">Dry Storage</Label>
          <Input
            id="dryStorage"
            type="number"
            placeholder="50"
            value={state.dryStorage}
            onChange={(e) => setState(s => ({ ...s, dryStorage: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="acreage">Acreage</Label>
          <Input
            id="acreage"
            type="number"
            step="0.1"
            placeholder="5.5"
            value={state.acreage}
            onChange={(e) => setState(s => ({ ...s, acreage: e.target.value }))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes" className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Notes
        </Label>
        <Textarea
          id="notes"
          placeholder="Any additional notes about this property..."
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
      case 2: return renderLocationStep();
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
              <Anchor className="h-5 w-5 text-[#1E4FAB]" />
              New Property
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
            Add a new property to your CRM
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
              disabled={createPropertyMutation.isPending}
            >
              {createPropertyMutation.isPending ? "Creating..." : "Create Property"}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
