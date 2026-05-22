import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TrendingUp, Building2, Wrench, Users, BarChart3 } from "lucide-react";

const ROLES = [
  {
    id: "investor",
    label: "Investor / LP",
    description: "Evaluating and underwriting marina or CRE acquisitions",
    icon: TrendingUp,
    color: "text-blue-600",
    bg: "bg-blue-50 hover:bg-blue-100 border-blue-200",
    activeBg: "bg-blue-600 text-white border-blue-600",
  },
  {
    id: "broker",
    label: "Broker",
    description: "Representing buyers or sellers in marina transactions",
    icon: Building2,
    color: "text-green-600",
    bg: "bg-green-50 hover:bg-green-100 border-green-200",
    activeBg: "bg-green-600 text-white border-green-600",
  },
  {
    id: "operator",
    label: "Operator / Owner",
    description: "Running day-to-day operations of a marina or portfolio",
    icon: Wrench,
    color: "text-orange-600",
    bg: "bg-orange-50 hover:bg-orange-100 border-orange-200",
    activeBg: "bg-orange-600 text-white border-orange-600",
  },
  {
    id: "gp",
    label: "GP / Fund Manager",
    description: "Raising capital and managing investor relationships",
    icon: Users,
    color: "text-purple-600",
    bg: "bg-purple-50 hover:bg-purple-100 border-purple-200",
    activeBg: "bg-purple-600 text-white border-purple-600",
  },
  {
    id: "analyst",
    label: "Analyst / Advisor",
    description: "Supporting due diligence, modeling, or appraisal work",
    icon: BarChart3,
    color: "text-slate-600",
    bg: "bg-slate-50 hover:bg-slate-100 border-slate-200",
    activeBg: "bg-slate-700 text-white border-slate-700",
  },
] as const;

interface RolePickerModalProps {
  open: boolean;
  onComplete: () => void;
  userId?: number;
  userName?: string;
}

export function RolePickerModal({ open, onComplete, userId, userName }: RolePickerModalProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: (role: string) =>
      apiRequest("PATCH", "/api/users/me", { userPrimaryRole: role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const handleContinue = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await saveMutation.mutateAsync(selected);
      // Write legacy key (read by sidebar role-defaults) and user-scoped key (read by useRolePickerCheck)
      // Only written after successful server save so future sessions re-prompt if save failed.
      localStorage.setItem("vantage_primary_role", selected);
      if (userId) localStorage.setItem(`vantage_role_picked_${userId}`, 'true');
    } catch {
      // Server save failed — show a warning. Do NOT write the user-scoped "picked" flag
      // so the user will be re-prompted next session when the server is available.
      toast({
        title: "Role saved locally",
        description: "We couldn't save your role to the server right now. You may be asked to select it again next time.",
        variant: "destructive",
      });
      // Still write the legacy display-only key for sidebar personalisation this session.
      localStorage.setItem("vantage_primary_role", selected);
    } finally {
      setSaving(false);
      onComplete();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-lg p-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
        hideCloseButton
      >
        <VisuallyHidden>
          <DialogTitle>Choose your primary role</DialogTitle>
          <DialogDescription>Select how you primarily use Vantage to personalize your experience.</DialogDescription>
        </VisuallyHidden>
        <div className="p-6 pb-4 bg-gradient-to-br from-primary/5 to-background border-b">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white text-lg font-bold select-none">
              V
            </div>
            <span className="text-sm font-medium text-muted-foreground">Vantage Platform</span>
          </div>
          <h2 className="text-xl font-semibold mt-3">
            Welcome{userName ? `, ${userName}` : ""}!
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            How do you primarily use Vantage? We'll customize your experience accordingly.
          </p>
        </div>

        <div className="p-6 space-y-2.5">
          {ROLES.map((role) => {
            const Icon = role.icon;
            const isSelected = selected === role.id;
            return (
              <button
                key={role.id}
                onClick={() => setSelected(role.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-3.5 rounded-lg border-2 text-left transition-all",
                  isSelected ? role.activeBg : cn(role.bg, "border-transparent")
                )}
              >
                <div className={cn("p-2 rounded-md bg-white/20", !isSelected && "bg-white shadow-sm")}>
                  <Icon className={cn("w-5 h-5", isSelected ? "text-white" : role.color)} />
                </div>
                <div>
                  <p className={cn("text-sm font-medium", isSelected ? "text-white" : "text-foreground")}>
                    {role.label}
                  </p>
                  <p className={cn("text-xs mt-0.5", isSelected ? "text-white/80" : "text-muted-foreground")}>
                    {role.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-6 pb-6 flex justify-end">
          <Button
            onClick={handleContinue}
            disabled={!selected || saving}
            className="w-full"
          >
            {saving ? "Saving..." : "Get Started"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
