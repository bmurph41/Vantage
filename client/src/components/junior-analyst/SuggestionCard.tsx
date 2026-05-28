import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, ChevronDown, ChevronUp, Bot, AlertTriangle, Info, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface Suggestion {
  id: string;
  agentId: string;
  agentName: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  status: string;
  priority: string;
  createdAt: string;
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  onActed?: () => void;
}

const PRIORITY_STYLES: Record<string, string> = {
  critical: "border-l-red-500 bg-red-50 dark:bg-red-950/20",
  high: "border-l-amber-500 bg-amber-50 dark:bg-amber-950/20",
  normal: "border-l-blue-400 bg-white dark:bg-zinc-900",
  low: "border-l-zinc-300 bg-white dark:bg-zinc-900",
};

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const AGENT_ICONS: Record<string, string> = {
  document_intake: "📄",
  underwriting: "📊",
  deal_scout: "🔍",
  dd_coordinator: "📋",
  rent_roll: "🏠",
  market_pulse: "📈",
  outreach: "✉️",
};

function PriorityIcon({ priority }: { priority: string }) {
  if (priority === "critical" || priority === "high") return <AlertTriangle className="h-3.5 w-3.5" />;
  if (priority === "normal") return <Info className="h-3.5 w-3.5" />;
  return <Zap className="h-3.5 w-3.5" />;
}

function renderBody(body: string) {
  return body.split('\n').map((line, i) => {
    const formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return (
      <p key={i} className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: formatted }} />
    );
  });
}

export function SuggestionCard({ suggestion, onActed }: SuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/junior-analyst/suggestions/${suggestion.id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/junior-analyst/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/junior-analyst/suggestions/count"] });
      onActed?.();
    },
  });

  const dismissMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/junior-analyst/suggestions/${suggestion.id}/dismiss`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/junior-analyst/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/junior-analyst/suggestions/count"] });
      onActed?.();
    },
  });

  const borderStyle = PRIORITY_STYLES[suggestion.priority] ?? PRIORITY_STYLES.normal;
  const badgeStyle = PRIORITY_BADGE[suggestion.priority] ?? PRIORITY_BADGE.normal;
  const icon = AGENT_ICONS[suggestion.agentId] ?? "🤖";
  const bodyLines = suggestion.body.split('\n').filter(Boolean);
  const preview = bodyLines[0] ?? "";
  const hasMore = bodyLines.length > 1;

  return (
    <div className={cn("border-l-4 rounded-r-lg border border-l-0 border-zinc-200 dark:border-zinc-700 p-3 space-y-2 transition-all", borderStyle)}>
      <div className="flex items-start gap-2">
        <span className="text-base leading-none mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{suggestion.agentName}</span>
            {suggestion.priority !== "normal" && (
              <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full", badgeStyle)}>
                <PriorityIcon priority={suggestion.priority} />
                {suggestion.priority}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-snug">{suggestion.title}</p>
        </div>
      </div>

      <div className="pl-6">
        <div className={cn("space-y-1", !expanded && "line-clamp-2")}>
          {expanded ? renderBody(suggestion.body) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2"
              dangerouslySetInnerHTML={{ __html: preview.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
          )}
        </div>

        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
          >
            {expanded ? <><ChevronUp className="h-3 w-3" />Less</> : <><ChevronDown className="h-3 w-3" />More</>}
          </button>
        )}

        <div className="flex items-center gap-2 mt-2">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs px-2 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/30"
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending || dismissMutation.isPending}
          >
            <Check className="h-3 w-3 mr-1" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs px-2 text-zinc-400 hover:text-zinc-600"
            onClick={() => dismissMutation.mutate()}
            disabled={approveMutation.isPending || dismissMutation.isPending}
          >
            <X className="h-3 w-3 mr-1" />
            Dismiss
          </Button>
          <span className="ml-auto text-xs text-zinc-400">
            {new Date(suggestion.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}
