import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Anchor, 
  Briefcase, 
  TrendingUp, 
  Building2, 
  ChevronRight,
  Sparkles,
  DollarSign,
  MapPin,
  CheckCircle2
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DealTemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DealTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  dealSource: string;
  defaultConfig: {
    holdPeriod?: number;
    hasRentRoll?: boolean;
    hasFuelSales?: boolean;
    hasOperations?: boolean;
  };
  features: string[];
}

const templates: DealTemplate[] = [
  {
    id: "acquisition",
    name: "New Acquisition",
    description: "Full due diligence and valuation for a potential purchase",
    icon: Briefcase,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    dealSource: "broker",
    defaultConfig: {
      holdPeriod: 5,
      hasRentRoll: true,
      hasFuelSales: true,
      hasOperations: false,
    },
    features: ["Purchase price analysis", "Pro forma modeling", "Exit scenarios", "Cap rate analysis"],
  },
  {
    id: "refinance",
    name: "Refinance / Revaluation",
    description: "Update valuation for an owned asset seeking new financing",
    icon: TrendingUp,
    color: "text-green-600",
    bgColor: "bg-green-50",
    dealSource: "owned_marina",
    defaultConfig: {
      holdPeriod: 10,
      hasRentRoll: true,
      hasFuelSales: true,
      hasOperations: true,
    },
    features: ["Current valuation", "LTV analysis", "Debt service coverage", "Live operations data"],
  },
  {
    id: "owned_marina",
    name: "Portfolio Asset",
    description: "Ongoing tracking and management of an owned asset",
    icon: Anchor,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    dealSource: "owned_marina",
    defaultConfig: {
      holdPeriod: 10,
      hasRentRoll: true,
      hasFuelSales: true,
      hasOperations: true,
    },
    features: ["Live data sync", "Operations dashboard", "Performance tracking", "Exit planning"],
  },
  {
    id: "off_market",
    name: "Off-Market Deal",
    description: "Direct-to-seller opportunity without broker involvement",
    icon: Building2,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    dealSource: "direct_to_seller",
    defaultConfig: {
      holdPeriod: 7,
      hasRentRoll: true,
      hasFuelSales: true,
      hasOperations: false,
    },
    features: ["Quick valuation", "Seller negotiation model", "Market comp analysis", "Confidential handling"],
  },
];

export function DealTemplateSelector({ open, onOpenChange }: DealTemplateSelectorProps) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<"select" | "details">("select");
  const [selectedTemplate, setSelectedTemplate] = useState<DealTemplate | null>(null);
  const [marinaName, setMarinaName] = useState("");
  const [address, setAddress] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) throw new Error("No template selected");
      
      return apiRequest('/api/modeling/projects', {
        method: 'POST',
        body: JSON.stringify({
          marinaName,
          address: address || null,
          addressLine2: address2 || null,
          city: city || null,
          state: state || null,
          zipCode: zipCode || null,
          dealSource: selectedTemplate.dealSource,
          purchasePrice: purchasePrice ? parseFloat(purchasePrice.replace(/[^0-9.]/g, '')) : null,
          dealOutcome: 'active',
          customMetrics: {
            templateId: selectedTemplate.id,
            ...selectedTemplate.defaultConfig,
          },
        }),
      });
    },
    onSuccess: (newProject: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling/projects'] });
      toast({ 
        title: "Project Created!", 
        description: `${marinaName} has been created using the ${selectedTemplate?.name} template.` 
      });
      onOpenChange(false);
      resetForm();
      navigate(`/modeling/projects/${newProject.id}`);
    },
    onError: (error) => {
      toast({ 
        title: "Error", 
        description: "Failed to create project. Please try again.", 
        variant: "destructive" 
      });
    }
  });

  function resetForm() {
    setStep("select");
    setSelectedTemplate(null);
    setMarinaName("");
    setAddress("");
    setAddress2("");
    setCity("");
    setState("");
    setZipCode("");
    setPurchasePrice("");
  }

  function handleSelectTemplate(template: DealTemplate) {
    setSelectedTemplate(template);
    setStep("details");
  }

  function handleBack() {
    setStep("select");
  }

  function handleCreate() {
    if (!marinaName.trim()) {
      toast({ title: "Error", description: "Marina name is required", variant: "destructive" });
      return;
    }
    createProjectMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#1E4FAB]" />
            {step === "select" ? "Choose a Template" : selectedTemplate?.name}
          </DialogTitle>
          <DialogDescription>
            {step === "select" 
              ? "Start with a template that matches your deal type for optimal setup"
              : "Enter the marina details to create your project"
            }
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className="flex flex-col items-start gap-3 p-4 rounded-lg border hover:border-[#1E4FAB] hover:bg-[#1E4FAB]/5 transition-all text-left group"
              >
                <div className="flex items-center justify-between w-full">
                  <div className={cn("p-2 rounded-lg", template.bgColor)}>
                    <template.icon className={cn("h-5 w-5", template.color)} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-[#1E4FAB] transition-colors" />
                </div>
                <div>
                  <h4 className="font-semibold group-hover:text-[#1E4FAB] transition-colors">
                    {template.name}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {template.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 mt-auto">
                  {template.features.slice(0, 2).map((feature, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                  {template.features.length > 2 && (
                    <Badge variant="secondary" className="text-xs">
                      +{template.features.length - 2} more
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {step === "details" && selectedTemplate && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className={cn("p-2 rounded-lg", selectedTemplate.bgColor)}>
                <selectedTemplate.icon className={cn("h-5 w-5", selectedTemplate.color)} />
              </div>
              <div>
                <p className="font-medium">{selectedTemplate.name}</p>
                <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="marinaName" className="flex items-center gap-2">
                  <Anchor className="h-4 w-4" />
                  Marina Name *
                </Label>
                <Input
                  id="marinaName"
                  placeholder="e.g., Sunset Bay Marina"
                  value={marinaName}
                  onChange={(e) => setMarinaName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Address
                </Label>
                <Input
                  id="address"
                  placeholder="e.g., 123 Marina Drive"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address2">Suite, Apt, Unit, etc.</Label>
                <Input
                  id="address2"
                  placeholder="e.g., Suite 100"
                  value={address2}
                  onChange={(e) => setAddress2(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="e.g., Miami"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    placeholder="e.g., FL"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input
                    id="zipCode"
                    placeholder="e.g., 33139"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchasePrice" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Purchase Price
                </Label>
                <Input
                  id="purchasePrice"
                  placeholder="e.g., 5,000,000"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium text-muted-foreground">Template Includes:</p>
              <div className="flex flex-wrap gap-2">
                {selectedTemplate.features.map((feature, i) => (
                  <Badge key={i} variant="outline" className="gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "details" && (
            <Button variant="ghost" onClick={handleBack}>
              Back
            </Button>
          )}
          {step === "details" && (
            <Button 
              onClick={handleCreate}
              disabled={createProjectMutation.isPending || !marinaName.trim()}
              className="bg-[#1E4FAB] hover:bg-[#1a4294]"
            >
              {createProjectMutation.isPending ? "Creating..." : "Create Project"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
