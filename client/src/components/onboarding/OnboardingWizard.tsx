import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddressAutocompleteInput, type NormalizedAddress } from "@/components/ui/address-autocomplete-input";
import { US_REGIONS } from "@shared/salescomps-constants";
import { 
  Building2, 
  Anchor, 
  Users, 
  FileText, 
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Target,
  ClipboardList,
  Briefcase,
  Store,
  Fuel,
  Layers,
  Plus,
  Trash2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type WizardMode = "onboarding" | "new_project";

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
  mode?: WizardMode;
  onProjectCreated?: (projectId: string) => void;
}

type DealType = "acquisition" | "refinance" | "owned_marina" | null;
type DealStructure = "single" | "portfolio" | null;

interface MarinaAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
  placeId?: string;
}

interface PortfolioMarina {
  name: string;
  address: MarinaAddress;
}

const emptyAddress: MarinaAddress = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  zip: "",
};

type DealStatus = "active" | "won" | "lost" | "passed" | "under_review";

interface WizardState {
  step: number;
  dealStructure: DealStructure;
  marinaName: string;
  marinaAddress: MarinaAddress;
  dealType: DealType;
  region: string;
  dealStatus: DealStatus;
  portfolioName: string;
  portfolioMarinas: PortfolioMarina[];
  featuresToExplore: string[];
}

const onboardingSteps = [
  { id: 1, title: "Welcome", icon: Sparkles },
  { id: 2, title: "Deal Structure", icon: Layers },
  { id: 3, title: "Marina Details", icon: Anchor },
  { id: 4, title: "Deal Type", icon: Target },
  { id: 5, title: "Features", icon: ClipboardList },
  { id: 6, title: "Get Started", icon: Check },
];

const newProjectSteps = [
  { id: 1, title: "Deal Structure", icon: Layers },
  { id: 2, title: "Marina Details", icon: Anchor },
  { id: 3, title: "Deal Info", icon: Target },
];

const dealStructures = [
  {
    id: "single",
    name: "Single Marina",
    description: "One marina being evaluated or managed",
    icon: Anchor,
  },
  {
    id: "portfolio",
    name: "Portfolio Deal",
    description: "Multiple marinas being evaluated as one deal",
    icon: Layers,
  },
];

const dealTypes = [
  {
    id: "acquisition",
    name: "New Acquisition",
    description: "Evaluating a marina to potentially purchase",
    icon: Briefcase,
  },
  {
    id: "refinance",
    name: "Refinance/Revaluation",
    description: "Refinancing or updating valuation of owned asset",
    icon: TrendingUp,
  },
  {
    id: "owned_marina",
    name: "Owned Marina",
    description: "Managing an existing marina in your portfolio",
    icon: Anchor,
  },
];

const features = [
  { id: "crm", name: "CRM & Leads", description: "Track deals and contacts", icon: Users },
  { id: "dd", name: "Due Diligence", description: "Manage DD checklists", icon: ClipboardList },
  { id: "modeling", name: "Financial Model", description: "Financial modeling", icon: TrendingUp },
  { id: "operations", name: "Operations", description: "Manage marina ops", icon: Store },
  { id: "fuel", name: "Fuel Sales", description: "Track fuel revenue", icon: Fuel },
  { id: "documents", name: "Documents", description: "Virtual data room", icon: FileText },
];

export function OnboardingWizard({ open, onOpenChange, userName, mode = "onboarding", onProjectCreated }: OnboardingWizardProps) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  
  const steps = mode === "new_project" ? newProjectSteps : onboardingSteps;
  const totalSteps = steps.length;
  
  const [state, setState] = useState<WizardState>({
    step: 1,
    dealStructure: mode === "new_project" ? "single" : null,
    marinaName: "",
    marinaAddress: { ...emptyAddress },
    dealType: mode === "new_project" ? "acquisition" : null,
    region: "",
    dealStatus: "active",
    portfolioName: "",
    portfolioMarinas: [{ name: "", address: { ...emptyAddress } }],
    featuresToExplore: [],
  });

  const createDealMutation = useMutation({
    mutationFn: async (data: {
      dealStructure: DealStructure;
      marinaName: string;
      marinaAddress: MarinaAddress;
      dealType: DealType;
      region: string;
      dealStatus: DealStatus;
      portfolioName: string;
      portfolioMarinas: PortfolioMarina[];
    }) => {
      if (data.dealStructure === "portfolio") {
        const validMarinas = data.portfolioMarinas.filter(m => m.name.trim() && m.address.city && m.address.state);
        if (validMarinas.length === 0) {
          throw new Error("Please add at least one marina with a name, city, and state");
        }
        
        const results = await Promise.all(
          validMarinas.map(async (marina) => {
            const propertyRes = await apiRequest('POST', '/api/properties', {
              name: marina.name,
              address: marina.address.line1,
              addressLine2: marina.address.line2 || null,
              city: marina.address.city,
              state: marina.address.state,
              zipCode: marina.address.zip,
              latitude: marina.address.lat?.toString(),
              longitude: marina.address.lng?.toString(),
              placeId: marina.address.placeId,
              propertyType: 'marina',
              status: 'prospect',
            });
            const crmProperty = await propertyRes.json();
            
            const dealRes = await apiRequest('POST', '/api/deals', {
              name: `${marina.name} - ${data.dealType === 'acquisition' ? 'Acquisition' : data.dealType === 'refinance' ? 'Refinance' : 'Operations'}`,
              propertyId: crmProperty.id,
              dealSource: data.dealType,
              status: 'lead',
              portfolioName: data.portfolioName || 'Untitled Portfolio',
            });
            const crmDeal = await dealRes.json();
            
            const projectRes = await apiRequest('POST', '/api/modeling/projects', {
              marinaName: marina.name,
              address: marina.address.line1,
              addressLine2: marina.address.line2 || null,
              city: marina.address.city,
              state: marina.address.state,
              zipCode: marina.address.zip,
              region: data.region || null,
              latitude: marina.address.lat,
              longitude: marina.address.lng,
              dealOutcome: data.dealStatus,
              portfolioName: data.portfolioName || 'Untitled Portfolio',
              isPortfolio: true,
              dealId: crmDeal.id,
              propertyId: crmProperty.id,
              customMetrics: { dealType: data.dealType },
            });
            const modelingProject = await projectRes.json();
            
            return { crmProperty, crmDeal, modelingProject };
          })
        );
        return results;
      } else {
        if (!data.marinaName.trim() || !data.marinaAddress.city || !data.marinaAddress.state) {
          throw new Error("Please provide a marina name, city, and state");
        }
        
        const propertyRes = await apiRequest('POST', '/api/properties', {
          name: data.marinaName,
          address: data.marinaAddress.line1,
          addressLine2: data.marinaAddress.line2 || null,
          city: data.marinaAddress.city,
          state: data.marinaAddress.state,
          zipCode: data.marinaAddress.zip,
          latitude: data.marinaAddress.lat?.toString(),
          longitude: data.marinaAddress.lng?.toString(),
          placeId: data.marinaAddress.placeId,
          propertyType: 'marina',
          status: 'prospect',
        });
        const crmProperty = await propertyRes.json();
        
        const dealRes = await apiRequest('POST', '/api/deals', {
          name: `${data.marinaName} - ${data.dealType === 'acquisition' ? 'Acquisition' : data.dealType === 'refinance' ? 'Refinance' : 'Operations'}`,
          propertyId: crmProperty.id,
          dealSource: data.dealType,
          status: 'lead',
        });
        const crmDeal = await dealRes.json();
        
        const projectRes = await apiRequest('POST', '/api/modeling/projects', {
          marinaName: data.marinaName,
          address: data.marinaAddress.line1,
          addressLine2: data.marinaAddress.line2 || null,
          city: data.marinaAddress.city,
          state: data.marinaAddress.state,
          zipCode: data.marinaAddress.zip,
          region: data.region || null,
          latitude: data.marinaAddress.lat,
          longitude: data.marinaAddress.lng,
          dealOutcome: data.dealStatus,
          dealId: crmDeal.id,
          propertyId: crmProperty.id,
          customMetrics: { dealType: data.dealType },
        });
        const modelingProject = await projectRes.json();
        
        return { crmProperty, crmDeal, modelingProject };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/properties'] });
      const isPortfolio = state.dealStructure === "portfolio";
      const projectCount = isPortfolio ? state.portfolioMarinas.filter(m => m.name.trim()).length : 1;
      toast({ 
        title: isPortfolio ? "Portfolio Created!" : "Deal Created!", 
        description: isPortfolio 
          ? `${projectCount} marina${projectCount > 1 ? 's' : ''} added to CRM and Financial Model.`
          : `${state.marinaName} has been added to CRM and Financial Model.` 
      });
      
      onOpenChange(false);
      
      if (onProjectCreated && !Array.isArray(result)) {
        onProjectCreated(result.modelingProject.id);
      } else if (onProjectCreated && Array.isArray(result) && result.length > 0) {
        onProjectCreated(result[0].modelingProject.id);
      }
      
      if (mode === "onboarding") {
        if (state.featuresToExplore.includes("modeling")) {
          navigate("/modeling/projects");
        } else if (state.featuresToExplore.includes("crm")) {
          navigate("/crm/deals");
        } else if (state.featuresToExplore.includes("dd")) {
          navigate("/due-diligence");
        } else {
          navigate("/");
        }
      }
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to create project. You can create one later from the Modeling page.", 
        variant: "destructive" 
      });
    }
  });

  const progress = (state.step / steps.length) * 100;

  function handleNext() {
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
    const hasSingleDeal = state.dealStructure === "single" && state.marinaName.trim() && state.marinaAddress.city && state.marinaAddress.state && state.dealType;
    const hasPortfolio = state.dealStructure === "portfolio" && state.portfolioMarinas.some(m => m.name.trim() && m.address.city && m.address.state) && state.dealType;
    
    if (hasSingleDeal || hasPortfolio) {
      createDealMutation.mutate({
        dealStructure: state.dealStructure,
        marinaName: state.marinaName,
        marinaAddress: state.marinaAddress,
        dealType: state.dealType,
        region: state.region,
        dealStatus: state.dealStatus,
        portfolioName: state.portfolioName,
        portfolioMarinas: state.portfolioMarinas,
      });
    } else {
      toast({
        title: "Missing Information",
        description: "Please fill in the required marina details (name, city, and state).",
        variant: "destructive"
      });
    }
  }

  function addPortfolioMarina() {
    setState(s => ({
      ...s,
      portfolioMarinas: [...s.portfolioMarinas, { name: "", address: { ...emptyAddress } }]
    }));
  }

  function removePortfolioMarina(index: number) {
    setState(s => ({
      ...s,
      portfolioMarinas: s.portfolioMarinas.filter((_, i) => i !== index)
    }));
  }

  function updatePortfolioMarinaName(index: number, name: string) {
    setState(s => ({
      ...s,
      portfolioMarinas: s.portfolioMarinas.map((m, i) => 
        i === index ? { ...m, name } : m
      )
    }));
  }

  function updatePortfolioMarinaAddress(index: number, field: keyof MarinaAddress, value: string) {
    setState(s => ({
      ...s,
      portfolioMarinas: s.portfolioMarinas.map((m, i) => 
        i === index ? { ...m, address: { ...m.address, [field]: value } } : m
      )
    }));
  }

  function handleAddressAutocomplete(addr: NormalizedAddress, index?: number) {
    const newAddress: MarinaAddress = {
      line1: addr.line1 || "",
      line2: addr.line2 || "",
      city: addr.city || "",
      state: addr.state || "",
      zip: addr.postalCode || "",
      lat: addr.lat,
      lng: addr.lng,
      placeId: addr.placeId,
    };
    
    if (index !== undefined) {
      setState(s => ({
        ...s,
        portfolioMarinas: s.portfolioMarinas.map((m, i) => 
          i === index ? { ...m, address: newAddress } : m
        )
      }));
    } else {
      setState(s => ({ ...s, marinaAddress: newAddress }));
    }
  }

  function toggleFeature(featureId: string) {
    setState(s => ({
      ...s,
      featuresToExplore: s.featuresToExplore.includes(featureId)
        ? s.featuresToExplore.filter(f => f !== featureId)
        : [...s.featuresToExplore, featureId]
    }));
  }

  const getStepContent = () => {
    if (mode === "new_project") {
      return {
        1: renderDealStructureStep(),
        2: renderMarinaDetailsStep(),
        3: renderDealInfoStep(),
      }[state.step];
    }
    return {
      1: renderWelcomeStep(),
      2: renderDealStructureStep(),
      3: renderMarinaDetailsStep(),
      4: renderDealTypeStep(),
      5: renderFeaturesStep(),
      6: renderGetStartedStep(),
    }[state.step];
  };

  const renderWelcomeStep = () => (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-full bg-[#1E4FAB]/10 flex items-center justify-center">
        <Sparkles className="h-8 w-8 text-[#1E4FAB]" />
      </div>
      <div>
        <h3 className="text-xl font-semibold">
          Welcome{userName ? `, ${userName}` : ''}!
        </h3>
        <p className="text-muted-foreground mt-2">
          Let's get you set up with MarinaMatch, your all-in-one platform for 
          marina acquisitions and portfolio management.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4 pt-4">
        <div className="text-center p-4 rounded-lg bg-muted/50">
          <Building2 className="h-6 w-6 mx-auto text-[#1E4FAB] mb-2" />
          <p className="text-sm font-medium">CRM & Pipeline</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-muted/50">
          <TrendingUp className="h-6 w-6 mx-auto text-[#1E4FAB] mb-2" />
          <p className="text-sm font-medium">Financial Model</p>
        </div>
        <div className="text-center p-4 rounded-lg bg-muted/50">
          <ClipboardList className="h-6 w-6 mx-auto text-[#1E4FAB] mb-2" />
          <p className="text-sm font-medium">Due Diligence</p>
        </div>
      </div>
    </div>
  );

  const renderDealStructureStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">What type of deal are you working on?</h3>
        <p className="text-sm text-muted-foreground">
          Choose between a single marina or a portfolio of assets
        </p>
      </div>
      <RadioGroup
        value={state.dealStructure || ""}
        onValueChange={(value) => setState(s => ({ ...s, dealStructure: value as DealStructure }))}
        className="space-y-3"
      >
        {dealStructures.map((structure) => (
          <div
            key={structure.id}
            className={cn(
              "flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors",
              state.dealStructure === structure.id 
                ? "border-[#1E4FAB] bg-[#1E4FAB]/5" 
                : "hover:bg-muted/50"
            )}
            onClick={() => setState(s => ({ ...s, dealStructure: structure.id as DealStructure }))}
          >
            <RadioGroupItem value={structure.id} id={`structure-${structure.id}`} />
            <div className="p-2 rounded-lg bg-muted">
              <structure.icon className="h-5 w-5 text-[#1E4FAB]" />
            </div>
            <div className="flex-1">
              <Label htmlFor={`structure-${structure.id}`} className="font-medium cursor-pointer">
                {structure.name}
              </Label>
              <p className="text-sm text-muted-foreground">{structure.description}</p>
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );

  const renderMarinaDetailsStep = () => {
    if (state.dealStructure === "portfolio") {
      return (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold">Build your portfolio</h3>
            <p className="text-sm text-muted-foreground">Add the marinas in this deal</p>
          </div>
          <div className="space-y-2 mb-4">
            <Label htmlFor="portfolioName">Portfolio Name</Label>
            <Input
              id="portfolioName"
              placeholder="e.g., Gulf Coast Portfolio"
              value={state.portfolioName}
              onChange={(e) => setState(s => ({ ...s, portfolioName: e.target.value }))}
            />
          </div>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {state.portfolioMarinas.map((marina, index) => (
              <div key={index} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Marina {index + 1}</span>
                  {state.portfolioMarinas.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removePortfolioMarina(index)} className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <Input placeholder="Marina name" value={marina.name} onChange={(e) => updatePortfolioMarinaName(index, e.target.value)} />
                <AddressAutocompleteInput value={marina.address.line1} placeholder="Address" onChangeText={(text) => updatePortfolioMarinaAddress(index, 'line1', text)} onSelectAddress={(addr) => handleAddressAutocomplete(addr, index)} searchType="address" />
                <Input placeholder="Address Line 2 (optional)" value={marina.address.line2} onChange={(e) => updatePortfolioMarinaAddress(index, 'line2', e.target.value)} />
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="City" value={marina.address.city} onChange={(e) => updatePortfolioMarinaAddress(index, 'city', e.target.value)} />
                  <Input placeholder="State" maxLength={2} value={marina.address.state} onChange={(e) => updatePortfolioMarinaAddress(index, 'state', e.target.value.toUpperCase())} />
                  <Input placeholder="Zip" maxLength={10} value={marina.address.zip} onChange={(e) => updatePortfolioMarinaAddress(index, 'zip', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={addPortfolioMarina} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Another Marina
          </Button>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold">Tell us about your marina</h3>
          <p className="text-sm text-muted-foreground">We'll create a CRM property and modeling project</p>
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="marinaName">Marina Name</Label>
            <Input id="marinaName" placeholder="e.g., Sunset Bay Marina" value={state.marinaName} onChange={(e) => setState(s => ({ ...s, marinaName: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <AddressAutocompleteInput value={state.marinaAddress.line1} placeholder="Start typing an address..." onChangeText={(text) => setState(s => ({ ...s, marinaAddress: { ...s.marinaAddress, line1: text } }))} onSelectAddress={(addr) => handleAddressAutocomplete(addr)} searchType="address" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressLine2">Address Line 2 (Optional)</Label>
            <Input id="addressLine2" placeholder="Suite, Unit, etc." value={state.marinaAddress.line2} onChange={(e) => setState(s => ({ ...s, marinaAddress: { ...s.marinaAddress, line2: e.target.value } }))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" placeholder="City" value={state.marinaAddress.city} onChange={(e) => setState(s => ({ ...s, marinaAddress: { ...s.marinaAddress, city: e.target.value } }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" placeholder="FL" maxLength={2} value={state.marinaAddress.state} onChange={(e) => setState(s => ({ ...s, marinaAddress: { ...s.marinaAddress, state: e.target.value.toUpperCase() } }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">Zip</Label>
              <Input id="zip" placeholder="33139" maxLength={10} value={state.marinaAddress.zip} onChange={(e) => setState(s => ({ ...s, marinaAddress: { ...s.marinaAddress, zip: e.target.value } }))} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDealTypeStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">What type of deal is this?</h3>
        <p className="text-sm text-muted-foreground">This helps us tailor your experience</p>
      </div>
      <RadioGroup value={state.dealType || ""} onValueChange={(value) => setState(s => ({ ...s, dealType: value as DealType }))} className="space-y-3">
        {dealTypes.map((type) => (
          <div key={type.id} className={cn("flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors", state.dealType === type.id ? "border-[#1E4FAB] bg-[#1E4FAB]/5" : "hover:bg-muted/50")} onClick={() => setState(s => ({ ...s, dealType: type.id as DealType }))}>
            <RadioGroupItem value={type.id} id={type.id} />
            <div className="p-2 rounded-lg bg-muted"><type.icon className="h-5 w-5 text-[#1E4FAB]" /></div>
            <div className="flex-1">
              <Label htmlFor={type.id} className="font-medium cursor-pointer">{type.name}</Label>
              <p className="text-sm text-muted-foreground">{type.description}</p>
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );

  const renderFeaturesStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">What would you like to explore?</h3>
        <p className="text-sm text-muted-foreground">Select the features you're most interested in</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {features.map((feature) => (
          <button key={feature.id} onClick={() => toggleFeature(feature.id)} className={cn("flex items-center gap-3 p-3 rounded-lg border text-left transition-colors", state.featuresToExplore.includes(feature.id) ? "border-[#1E4FAB] bg-[#1E4FAB]/5" : "hover:bg-muted/50")}>
            <div className={cn("p-2 rounded-lg", state.featuresToExplore.includes(feature.id) ? "bg-[#1E4FAB] text-white" : "bg-muted")}>
              <feature.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium text-sm">{feature.name}</p>
              <p className="text-xs text-muted-foreground">{feature.description}</p>
            </div>
            {state.featuresToExplore.includes(feature.id) && <Check className="h-4 w-4 text-[#1E4FAB] ml-auto" />}
          </button>
        ))}
      </div>
    </div>
  );

  const renderGetStartedStep = () => (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
        <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
      </div>
      <div>
        <h3 className="text-xl font-semibold">You're all set!</h3>
        <p className="text-muted-foreground mt-2">
          {state.dealStructure === "portfolio" 
            ? `We'll create "${state.portfolioName || 'Untitled Portfolio'}" with ${state.portfolioMarinas.filter(m => m.name.trim()).length} marina${state.portfolioMarinas.filter(m => m.name.trim()).length > 1 ? 's' : ''}.`
            : state.marinaName 
              ? `We'll create "${state.marinaName}" as your first project.`
              : "You can create projects anytime from the Modeling page."}
        </p>
      </div>
      {state.featuresToExplore.length > 0 && (
        <div className="pt-4">
          <p className="text-sm text-muted-foreground mb-2">We'll take you to:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {state.featuresToExplore.map((id) => {
              const feature = features.find(f => f.id === id);
              return feature ? (
                <Badge key={id} variant="secondary" className="gap-1">
                  <feature.icon className="h-3 w-3" />
                  {feature.name}
                </Badge>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderDealInfoStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">Deal Details</h3>
        <p className="text-sm text-muted-foreground">Configure your deal settings</p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Deal Source</Label>
          <Select value={state.dealType || undefined} onValueChange={(value) => setState(s => ({ ...s, dealType: value as DealType }))}>
            <SelectTrigger><SelectValue placeholder="Select deal source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="acquisition">New Acquisition</SelectItem>
              <SelectItem value="refinance">Refinance/Revaluation</SelectItem>
              <SelectItem value="owned_marina">Owned Marina</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Region</Label>
          <Select value={state.region || undefined} onValueChange={(value) => setState(s => ({ ...s, region: value }))}>
            <SelectTrigger><SelectValue placeholder="Select region (optional)" /></SelectTrigger>
            <SelectContent>
              {US_REGIONS.map((region) => (
                <SelectItem key={region} value={region}>{region}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Deal Status</Label>
          <Select value={state.dealStatus} onValueChange={(value) => setState(s => ({ ...s, dealStatus: value as DealStatus }))}>
            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
              <SelectItem value="passed">Passed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <DialogTitle className="flex items-center gap-2">
              <Anchor className="h-5 w-5 text-[#1E4FAB]" />
              {mode === "new_project" ? "New Project" : "MarinaMatch Setup"}
            </DialogTitle>
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
          <Progress value={progress} className="h-1" />
          {mode === "new_project" && (
            <DialogDescription className="text-sm text-muted-foreground">
              Add a new valuation/financial modeling project
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4">
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
              disabled={createDealMutation.isPending}
            >
              {createDealMutation.isPending ? "Creating..." : "Get Started"}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
