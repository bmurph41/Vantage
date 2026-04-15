import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  MMModalWizard, 
  MMFormGrid, 
  MMInput,
  MMSelect,
  MMTextarea,
  MMRadioCardGroup,
  MMStateSelect,
  MMCurrencyInput
} from "@/components/mm-ui";
import { 
  Anchor, 
  Wrench,
  Building2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { GooglePlaceSearch, type PlaceDetails } from "@/components/GooglePlaceSearch";
import { Label } from "@/components/ui/label";

interface CreatePropertyWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPropertyCreated?: (propertyId: string) => void;
}

type PropertyType = "marina" | "boat_yard" | "marina_yard";
type PropertyStatus = "target" | "for_sale" | "under_loi" | "under_contract";

interface WizardState {
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
  { id: "type", label: "Type", title: "What type of property is this?", subtitle: "Choose the property category" },
  { id: "location", label: "Location", title: "Property Location", subtitle: "Enter the property name and address" },
  { id: "details", label: "Details", title: "Property Details", subtitle: "Status and capacity information" },
];

const propertyTypeOptions = [
  { value: "marina", title: "Marina", description: "Wet slips and dock facilities", icon: <Anchor className="h-5 w-5" /> },
  { value: "boat_yard", title: "Boat Yard", description: "Dry storage and maintenance facilities", icon: <Wrench className="h-5 w-5" /> },
  { value: "marina_yard", title: "Marina & Yard", description: "Combined wet and dry storage", icon: <Building2 className="h-5 w-5" /> },
];

const propertyStatusOptions = [
  { value: "target", label: "Target" },
  { value: "for_sale", label: "For Sale" },
  { value: "under_loi", label: "Under LOI" },
  { value: "under_contract", label: "Under Contract" },
];

export function CreatePropertyWizardModal({ open, onOpenChange, onPropertyCreated }: CreatePropertyWizardModalProps) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  
  const [state, setState] = useState<WizardState>({
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

  useEffect(() => {
    if (!open) {
      setCurrentStep(0);
      setState({
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

  const isStepValid = () => {
    if (currentStep === 0) return !!state.propertyType;
    if (currentStep === 1) return !!state.name.trim();
    return true;
  };

  const handleNext = () => {
    if (currentStep === 0 && !state.propertyType) {
      toast({ title: "Select a property type", description: "Please choose a property type to continue.", variant: "destructive" });
      return;
    }
    if (currentStep === 1 && !state.name.trim()) {
      toast({ title: "Name required", description: "Please enter a property name.", variant: "destructive" });
      return;
    }
    if (currentStep === steps.length - 1) {
      createPropertyMutation.mutate(state);
    }
  };

  const renderStep = (stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return (
          <div className="space-y-3">
            <MMRadioCardGroup
              options={propertyTypeOptions}
              value={state.propertyType || undefined}
              onChange={(value) => setState(s => ({ ...s, propertyType: value as PropertyType }))}
              columns={1}
              size="lg"
            />
          </div>
        );
      
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Search Google Places (optional)</Label>
              <GooglePlaceSearch
                searchType="establishment"
                placeholder="Search for the marina or property..."
                onSelect={(place: PlaceDetails) => {
                  const parts = (place.address || "").split(",");
                  const street = parts[0]?.trim() || "";
                  let city = "";
                  let stateAbbr = "";
                  let zip = "";
                  if (parts.length >= 2) {
                    const cityStateZip = parts.slice(1).join(",").trim();
                    const match = cityStateZip.match(/^([^,]+),\s*([A-Z]{2})\s*(\d{5})?/);
                    if (match) {
                      city = match[1]?.trim() || "";
                      stateAbbr = match[2]?.trim() || "";
                      zip = match[3]?.trim() || "";
                    }
                  }
                  setState(s => ({
                    ...s,
                    name: place.name || s.name,
                    address: street || s.address,
                    city: city || s.city,
                    state: stateAbbr || s.state,
                    zipCode: zip || s.zipCode,
                  }));
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">Selecting a result will auto-fill the fields below.</p>
            </div>
            <MMInput
              label="Property Name"
              required
              placeholder="Sunset Marina"
              value={state.name}
              onChange={(e) => setState(s => ({ ...s, name: e.target.value }))}
            />
            <MMInput
              label="Street Address"
              placeholder="123 Harbor Drive"
              value={state.address}
              onChange={(e) => setState(s => ({ ...s, address: e.target.value }))}
            />
            <MMInput
              label="Address Line 2"
              placeholder="Suite 100, Building A"
              value={state.addressLine2}
              onChange={(e) => setState(s => ({ ...s, addressLine2: e.target.value }))}
            />
            <MMFormGrid columns={3}>
              <MMInput
                label="City"
                placeholder="Miami"
                value={state.city}
                onChange={(e) => setState(s => ({ ...s, city: e.target.value }))}
              />
              <MMStateSelect
                label="State"
                value={state.state}
                onChange={(e) => setState(s => ({ ...s, state: e.target.value }))}
              />
              <MMInput
                label="Zip"
                placeholder="33101"
                value={state.zipCode}
                onChange={(e) => setState(s => ({ ...s, zipCode: e.target.value }))}
              />
            </MMFormGrid>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-4">
            <MMSelect
              label="Status"
              value={state.status}
              onValueChange={(v) => setState(s => ({ ...s, status: v as PropertyStatus }))}
              options={propertyStatusOptions}
            />
            <MMCurrencyInput
              label="Asking Price"
              placeholder="$5,000,000"
              value={state.askingPrice}
              onChange={(e) => setState(s => ({ ...s, askingPrice: e.target.value }))}
            />
            <MMFormGrid columns={3}>
              <MMInput
                label="Wet Slips"
                type="number"
                placeholder="100"
                value={state.wetSlips}
                onChange={(e) => setState(s => ({ ...s, wetSlips: e.target.value }))}
              />
              <MMInput
                label="Dry Storage"
                type="number"
                placeholder="50"
                value={state.dryStorage}
                onChange={(e) => setState(s => ({ ...s, dryStorage: e.target.value }))}
              />
              <MMInput
                label="Acreage"
                type="number"
                placeholder="5.5"
                value={state.acreage}
                onChange={(e) => setState(s => ({ ...s, acreage: e.target.value }))}
              />
            </MMFormGrid>
            <MMTextarea
              label="Notes"
              placeholder="Any additional notes about this property..."
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
      title="New Property"
      subtitle="Add a new property to your CRM"
      icon={<Anchor className="h-5 w-5" />}
      steps={steps}
      onStepChange={setCurrentStep}
      onNext={handleNext}
      isStepValid={isStepValid()}
      isLoading={createPropertyMutation.isPending}
      nextLabel="Continue"
      submitLabel="Create Property"
      renderStep={renderStep}
      size="md"
    />
  );
}

export default CreatePropertyWizardModal;
