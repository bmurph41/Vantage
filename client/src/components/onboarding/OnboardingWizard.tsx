import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string;
}

type DealType = "acquisition" | "refinance" | "owned_marina" | null;
type DealStructure = "single" | "portfolio" | null;

interface PortfolioMarina {
  name: string;
  location: string;
  purchasePrice: string;
}

interface WizardState {
  step: number;
  dealStructure: DealStructure;
  marinaName: string;
  location: string;
  dealType: DealType;
  purchasePrice: string;
  portfolioName: string;
  portfolioMarinas: PortfolioMarina[];
  featuresToExplore: string[];
}

const steps = [
  { id: 1, title: "Welcome", icon: Sparkles },
  { id: 2, title: "Deal Structure", icon: Layers },
  { id: 3, title: "First Deal", icon: Anchor },
  { id: 4, title: "Deal Type", icon: Target },
  { id: 5, title: "Features", icon: ClipboardList },
  { id: 6, title: "Get Started", icon: Check },
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
  { id: "modeling", name: "Valuator", description: "Financial modeling", icon: TrendingUp },
  { id: "operations", name: "Operations", description: "Manage marina ops", icon: Store },
  { id: "fuel", name: "Fuel Sales", description: "Track fuel revenue", icon: Fuel },
  { id: "documents", name: "Documents", description: "Virtual data room", icon: FileText },
];

export function OnboardingWizard({ open, onOpenChange, userName }: OnboardingWizardProps) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  
  const [state, setState] = useState<WizardState>({
    step: 1,
    dealStructure: null,
    marinaName: "",
    location: "",
    dealType: null,
    purchasePrice: "",
    portfolioName: "",
    portfolioMarinas: [{ name: "", location: "", purchasePrice: "" }],
    featuresToExplore: [],
  });

  const createDealMutation = useMutation({
    mutationFn: async (data: {
      dealStructure: DealStructure;
      marinaName: string;
      location: string;
      dealType: DealType;
      purchasePrice: string;
      portfolioName: string;
      portfolioMarinas: PortfolioMarina[];
    }) => {
      if (data.dealStructure === "portfolio") {
        const validMarinas = data.portfolioMarinas.filter(m => m.name.trim());
        const results = await Promise.all(
          validMarinas.map((marina, index) =>
            apiRequest('/api/modeling/projects', {
              method: 'POST',
              body: JSON.stringify({
                marinaName: marina.name,
                city: marina.location.split(',')[0]?.trim(),
                state: marina.location.split(',')[1]?.trim(),
                dealSource: data.dealType,
                purchasePrice: marina.purchasePrice ? parseFloat(marina.purchasePrice.replace(/[^0-9.]/g, '')) : null,
                dealOutcome: 'active',
                portfolioName: data.portfolioName || 'Untitled Portfolio',
                isPortfolio: true,
              }),
            })
          )
        );
        return results;
      } else {
        return apiRequest('/api/modeling/projects', {
          method: 'POST',
          body: JSON.stringify({
            marinaName: data.marinaName,
            city: data.location.split(',')[0]?.trim(),
            state: data.location.split(',')[1]?.trim(),
            dealSource: data.dealType,
            purchasePrice: data.purchasePrice ? parseFloat(data.purchasePrice.replace(/[^0-9.]/g, '')) : null,
            dealOutcome: 'active',
          }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects'] });
      const isPortfolio = state.dealStructure === "portfolio";
      const projectCount = isPortfolio ? state.portfolioMarinas.filter(m => m.name.trim()).length : 1;
      toast({ 
        title: isPortfolio ? "Portfolio Created!" : "Project Created!", 
        description: isPortfolio 
          ? `${projectCount} marina${projectCount > 1 ? 's' : ''} added to "${state.portfolioName || 'Untitled Portfolio'}".`
          : `${state.marinaName} has been added to your projects.` 
      });
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
    const hasSingleDeal = state.dealStructure === "single" && state.marinaName && state.dealType;
    const hasPortfolio = state.dealStructure === "portfolio" && state.portfolioMarinas.some(m => m.name.trim()) && state.dealType;
    
    if (hasSingleDeal || hasPortfolio) {
      createDealMutation.mutate({
        dealStructure: state.dealStructure,
        marinaName: state.marinaName,
        location: state.location,
        dealType: state.dealType,
        purchasePrice: state.purchasePrice,
        portfolioName: state.portfolioName,
        portfolioMarinas: state.portfolioMarinas,
      });
    }
    
    onOpenChange(false);
    
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

  function addPortfolioMarina() {
    setState(s => ({
      ...s,
      portfolioMarinas: [...s.portfolioMarinas, { name: "", location: "", purchasePrice: "" }]
    }));
  }

  function removePortfolioMarina(index: number) {
    setState(s => ({
      ...s,
      portfolioMarinas: s.portfolioMarinas.filter((_, i) => i !== index)
    }));
  }

  function updatePortfolioMarina(index: number, field: keyof PortfolioMarina, value: string) {
    setState(s => ({
      ...s,
      portfolioMarinas: s.portfolioMarinas.map((m, i) => 
        i === index ? { ...m, [field]: value } : m
      )
    }));
  }

  function toggleFeature(featureId: string) {
    setState(s => ({
      ...s,
      featuresToExplore: s.featuresToExplore.includes(featureId)
        ? s.featuresToExplore.filter(f => f !== featureId)
        : [...s.featuresToExplore, featureId]
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <DialogTitle className="flex items-center gap-2">
              <Anchor className="h-5 w-5 text-[#1E4FAB]" />
              MarinaMatch Setup
            </DialogTitle>
            <div className="flex items-center gap-1">
              {steps.map((s, i) => (
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
        </DialogHeader>

        <div className="py-4">
          {state.step === 1 && (
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
                  <p className="text-sm font-medium">Valuator</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <ClipboardList className="h-6 w-6 mx-auto text-[#1E4FAB] mb-2" />
                  <p className="text-sm font-medium">Due Diligence</p>
                </div>
              </div>
            </div>
          )}

          {state.step === 2 && (
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
          )}

          {state.step === 3 && state.dealStructure === "single" && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold">Tell us about your marina</h3>
                <p className="text-sm text-muted-foreground">
                  We'll create a project to get you started
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="marinaName">Marina Name</Label>
                  <Input
                    id="marinaName"
                    placeholder="e.g., Sunset Bay Marina"
                    value={state.marinaName}
                    onChange={(e) => setState(s => ({ ...s, marinaName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location (City, State)</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Miami, FL"
                    value={state.location}
                    onChange={(e) => setState(s => ({ ...s, location: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchasePrice">Purchase Price (Optional)</Label>
                  <Input
                    id="purchasePrice"
                    placeholder="e.g., $5,000,000"
                    value={state.purchasePrice}
                    onChange={(e) => setState(s => ({ ...s, purchasePrice: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          {state.step === 3 && state.dealStructure === "portfolio" && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold">Build your portfolio</h3>
                <p className="text-sm text-muted-foreground">
                  Add the marinas in this deal
                </p>
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removePortfolioMarina(index)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder="Marina name"
                      value={marina.name}
                      onChange={(e) => updatePortfolioMarina(index, 'name', e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Location (City, State)"
                        value={marina.location}
                        onChange={(e) => updatePortfolioMarina(index, 'location', e.target.value)}
                      />
                      <Input
                        placeholder="Price (optional)"
                        value={marina.purchasePrice}
                        onChange={(e) => updatePortfolioMarina(index, 'purchasePrice', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addPortfolioMarina}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Marina
              </Button>
            </div>
          )}

          {state.step === 4 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold">What type of deal is this?</h3>
                <p className="text-sm text-muted-foreground">
                  This helps us tailor your experience
                </p>
              </div>
              <RadioGroup
                value={state.dealType || ""}
                onValueChange={(value) => setState(s => ({ ...s, dealType: value as DealType }))}
                className="space-y-3"
              >
                {dealTypes.map((type) => (
                  <div
                    key={type.id}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors",
                      state.dealType === type.id 
                        ? "border-[#1E4FAB] bg-[#1E4FAB]/5" 
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => setState(s => ({ ...s, dealType: type.id as DealType }))}
                  >
                    <RadioGroupItem value={type.id} id={type.id} />
                    <div className="p-2 rounded-lg bg-muted">
                      <type.icon className="h-5 w-5 text-[#1E4FAB]" />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor={type.id} className="font-medium cursor-pointer">
                        {type.name}
                      </Label>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {state.step === 5 && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold">What would you like to explore?</h3>
                <p className="text-sm text-muted-foreground">
                  Select the features you're most interested in
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {features.map((feature) => (
                  <button
                    key={feature.id}
                    onClick={() => toggleFeature(feature.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                      state.featuresToExplore.includes(feature.id)
                        ? "border-[#1E4FAB] bg-[#1E4FAB]/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg",
                      state.featuresToExplore.includes(feature.id)
                        ? "bg-[#1E4FAB] text-white"
                        : "bg-muted"
                    )}>
                      <feature.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{feature.name}</p>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                    {state.featuresToExplore.includes(feature.id) && (
                      <Check className="h-4 w-4 text-[#1E4FAB] ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {state.step === 6 && (
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
          )}
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
