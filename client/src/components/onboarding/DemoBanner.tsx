import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

function getDismissKey(orgId: string): string {
  return `vantage_demo_banner_dismissed_${orgId}`;
}

export function DemoBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(() => {
    if (!user?.orgId) return true;
    return !!localStorage.getItem(getDismissKey(user.orgId));
  });

  const { data } = useQuery<{ hasDemoData: boolean }>({
    queryKey: ["/api/onboarding/demo-data/status"],
    staleTime: 1000 * 60 * 5,
    enabled: !!user?.orgId && !dismissed,
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/onboarding/demo-data");
    },
    onSuccess: () => {
      dismiss();
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/demo-data/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm-v2/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/modeling/projects"] });
      toast({ title: "Sample data cleared", description: "All demo records have been removed." });
    },
    onError: () => {
      toast({ title: "Could not clear sample data", variant: "destructive" });
    },
  });

  function dismiss() {
    if (user?.orgId) {
      localStorage.setItem(getDismissKey(user.orgId), "1");
    }
    setDismissed(true);
  }

  if (dismissed || !data?.hasDemoData) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
      <FlaskConical className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
      <p className="flex-1 text-blue-800 dark:text-blue-300">
        You're looking at sample data to help you get started.{" "}
        <button
          onClick={() => clearMutation.mutate()}
          disabled={clearMutation.isPending}
          className="underline font-medium hover:no-underline disabled:opacity-50"
        >
          {clearMutation.isPending ? "Clearing…" : "Clear sample data"}
        </button>{" "}
        when you're ready to use your own.
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900 flex-shrink-0"
        onClick={dismiss}
        aria-label="Dismiss banner"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
