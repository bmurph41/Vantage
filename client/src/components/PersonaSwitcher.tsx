import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { UserCircle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PERSONA_LABELS: Record<string, string> = {
  pe_investor: "PE Investor",
  broker: "Broker",
  operator: "Operator",
  advisor: "Advisor",
};

const PERSONA_DESCRIPTIONS: Record<string, string> = {
  pe_investor: "Full access to all platform features",
  broker: "CRM, DD, and market intelligence tools",
  operator: "Asset portfolio and operations management",
  advisor: "Market intel and portfolio analytics",
};

export function PersonaSwitcher() {
  const { toast } = useToast();

  const { data: persona, isLoading, error } = useQuery<any>({
    queryKey: ['/api/personas/me'],
  });

  const updatePersonaMutation = useMutation({
    mutationFn: async (newPersona: { primaryPersona: string; secondaryPersona?: string }) => {
      return await apiRequest('POST', '/api/personas/me', newPersona);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/personas/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/personas/features'] });
      toast({
        title: "Persona updated",
        description: "Your persona has been successfully changed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update persona",
        description: error.message || "An error occurred while updating your persona.",
        variant: "destructive",
      });
    },
  });

  const handlePersonaSwitch = (newPrimaryPersona: string) => {
    updatePersonaMutation.mutate({
      primaryPersona: newPrimaryPersona,
      secondaryPersona: persona?.secondaryPersona,
    });
  };

  const handleSecondaryPersonaToggle = (secondaryPersona: string) => {
    const newSecondary = persona?.secondaryPersona === secondaryPersona ? undefined : secondaryPersona;
    updatePersonaMutation.mutate({
      primaryPersona: persona?.primaryPersona,
      secondaryPersona: newSecondary,
    });
  };

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" className="gap-2" disabled data-testid="persona-switcher-loading">
        <UserCircle className="h-4 w-4" />
        <span className="text-sm">Loading...</span>
      </Button>
    );
  }

  // If no persona is assigned, show a default state instead of loading
  if (!persona || error) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2" data-testid="persona-switcher-trigger">
            <UserCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Select Persona</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64" data-testid="persona-switcher-menu">
          <DropdownMenuLabel>Choose Your Persona</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <div className="px-2 py-1.5">
            <p className="text-xs text-muted-foreground mb-2">Primary Persona</p>
            {Object.keys(PERSONA_LABELS).map((personaKey) => (
              <DropdownMenuItem
                key={personaKey}
                onClick={() => handlePersonaSwitch(personaKey)}
                className="flex items-start gap-2 cursor-pointer"
                data-testid={`persona-option-${personaKey}`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{PERSONA_LABELS[personaKey]}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {PERSONA_DESCRIPTIONS[personaKey]}
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2" data-testid="persona-switcher-trigger">
          <UserCircle className="h-4 w-4" />
          <span className="text-sm font-medium">{PERSONA_LABELS[persona.primaryPersona]}</span>
          {persona.secondaryPersona && (
            <span className="text-xs text-muted-foreground">
              + {PERSONA_LABELS[persona.secondaryPersona]}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" data-testid="persona-switcher-menu">
        <DropdownMenuLabel>Switch Persona</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground mb-2">Primary Persona</p>
          {Object.keys(PERSONA_LABELS).map((personaKey) => (
            <DropdownMenuItem
              key={personaKey}
              onClick={() => handlePersonaSwitch(personaKey)}
              className="flex items-start gap-2 cursor-pointer"
              data-testid={`persona-option-${personaKey}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{PERSONA_LABELS[personaKey]}</span>
                  {persona.primaryPersona === personaKey && (
                    <Check className="h-4 w-4 text-primary" data-testid="persona-active-check" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {PERSONA_DESCRIPTIONS[personaKey]}
                </p>
              </div>
            </DropdownMenuItem>
          ))}
        </div>

        <DropdownMenuSeparator />
        
        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground mb-2">Secondary Persona (Optional)</p>
          {Object.keys(PERSONA_LABELS)
            .filter(p => p !== persona.primaryPersona)
            .map((personaKey) => (
              <DropdownMenuItem
                key={`secondary-${personaKey}`}
                onClick={() => handleSecondaryPersonaToggle(personaKey)}
                className="flex items-center gap-2 cursor-pointer"
                data-testid={`secondary-persona-option-${personaKey}`}
              >
                <span className="flex-1">{PERSONA_LABELS[personaKey]}</span>
                {persona.secondaryPersona === personaKey && (
                  <Check className="h-4 w-4 text-primary" data-testid="secondary-persona-active-check" />
                )}
              </DropdownMenuItem>
            ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
