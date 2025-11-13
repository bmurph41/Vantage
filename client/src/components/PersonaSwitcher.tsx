import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { UserCircle } from "lucide-react";

const PERSONA_LABELS: Record<string, string> = {
  pe_investor: "PE Investor",
  broker: "Broker",
  operator: "Operator",
  advisor: "Advisor",
};

export function PersonaSwitcher() {
  const { data: persona, isLoading } = useQuery<any>({
    queryKey: ['/api/personas/me'],
  });

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" className="gap-2" disabled data-testid="persona-switcher-loading">
        <UserCircle className="h-4 w-4" />
        <span className="text-sm">Loading...</span>
      </Button>
    );
  }

  // Display persona as read-only (set during signup, not changeable by user)
  if (!persona) {
    return (
      <div className="flex items-center gap-2 px-3 py-2" data-testid="persona-display">
        <UserCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">No Persona</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2" data-testid="persona-display">
      <UserCircle className="h-4 w-4" />
      <span className="text-sm font-medium">{PERSONA_LABELS[persona.primaryPersona] || persona.primaryPersona}</span>
      {persona.secondaryPersona && (
        <span className="text-xs text-muted-foreground">
          + {PERSONA_LABELS[persona.secondaryPersona]}
        </span>
      )}
    </div>
  );
}
