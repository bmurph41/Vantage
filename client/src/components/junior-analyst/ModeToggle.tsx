import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

interface ModeToggleProps {
  projectId?: string;
}

export function ModeToggle({ projectId }: ModeToggleProps) {
  const queryClient = useQueryClient();

  const settingsKey = ["/api/junior-analyst/settings", projectId ?? "org"];

  const { data: settings, isLoading } = useQuery<{ mode: string; enabledAgents: string[] }>({
    queryKey: settingsKey,
    queryFn: () =>
      fetch(`/api/junior-analyst/settings${projectId ? `?projectId=${projectId}` : ""}`, {
        credentials: "include",
      }).then((r) => r.json()),
  });

  const mutation = useMutation({
    mutationFn: (mode: string) =>
      apiRequest("PUT", "/api/junior-analyst/settings", { projectId: projectId ?? undefined, mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKey });
    },
  });

  const isAssisted = settings?.mode === "assisted";

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />;
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
      <div>
        <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {isAssisted ? "Assisted" : "Manual"} mode
        </Label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          {isAssisted
            ? "Junior Analyst runs automatically and surfaces suggestions"
            : "Junior Analyst stays quiet — trigger tasks manually"}
        </p>
      </div>
      <Switch
        checked={isAssisted}
        onCheckedChange={(checked) => mutation.mutate(checked ? "assisted" : "manual")}
        disabled={mutation.isPending}
      />
    </div>
  );
}
