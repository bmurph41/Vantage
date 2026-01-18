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
  Fuel
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

interface WizardState {
  step: number;
  marinaName: string;
  location: string;
  dealType: DealType;
  purchasePrice: string;
  featuresToExplore: string[];
}

const steps = [
  { id: 1, title: "Welcome", icon: Sparkles },
  { id: 2, title: "First Deal", icon: Anchor },
  { id: 3, title: "Deal Type", icon: Target },
  { id: 4, title: "Features", icon: ClipboardList },
  { id: 5, title: "Get Started", icon: Check },
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
    marinaName: "",
    location: "",
    dealType: null,
    purchasePrice: "",
    featuresToExplore: [],
  });

  const createDealMutation = useMutation({
    mutationFn: async (data: {
      marinaName: string;
      location: string;
      dealType: DealType;
      purchasePrice: string;
    }) => {
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
    },
    onSuccess: (newProject: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects'] });
      toast({ 
        title: "Project Created!", 
        description: `${state.marinaName} has been added to your projects.` 
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
    if (state.marinaName && state.dealType) {
      createDealMutation.mutate({
        marinaName: state.marinaName,
        location: state.location,
        dealType: state.dealType,
        purchasePrice: state.purchasePrice,
      });
    }
    
    onOpenChange(false);
    
    if (state.featuresToExplore.includes("modeling") && state.marinaName) {
      navigate("/modeling/projects");
    } else if (state.featuresToExplore.includes("crm")) {
      navigate("/crm/deals");
    } else if (state.featuresToExplore.includes("dd")) {
      navigate("/due-diligence");
    } else {
      navigate("/");
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
                <h3 className="text-lg font-semibold">Tell us about your first deal</h3>
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

          {state.step === 3 && (
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

          {state.step === 4 && (
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

          {state.step === 5 && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">You're all set!</h3>
                <p className="text-muted-foreground mt-2">
                  {state.marinaName 
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
