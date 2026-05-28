import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bot, Inbox, Settings2, CheckCheck } from "lucide-react";
import { SuggestionCard } from "./SuggestionCard";
import { ModeToggle } from "./ModeToggle";

interface JuniorAnalystPanelProps {
  open: boolean;
  onClose: () => void;
  projectId?: string;
}

const AGENT_DESCRIPTIONS: Record<string, { label: string; description: string; icon: string }> = {
  document_intake: { label: "Document Intake", description: "Routes uploads, flags parse quality, alerts on low-confidence extractions.", icon: "📄" },
  underwriting: { label: "Underwriting", description: "Drafts first-pass pro forma assumptions from imported P&L data.", icon: "📊" },
  deal_scout: { label: "Deal Scout", description: "Scores new deals against investment criteria and flags stage advances.", icon: "🔍" },
  dd_coordinator: { label: "DD Coordinator", description: "Generates due diligence checklists and alerts on overdue items.", icon: "📋" },
  rent_roll: { label: "Rent Roll", description: "Analyzes occupancy, expiring leases, and below-market pricing opportunities.", icon: "🏠" },
  market_pulse: { label: "Market Pulse", description: "Tracks cap rates, treasury rates, and provides implied value ranges.", icon: "📈" },
  outreach: { label: "Outreach", description: "Drafts initial owner outreach emails for new prospect deals.", icon: "✉️" },
};

export function JuniorAnalystPanel({ open, onClose, projectId }: JuniorAnalystPanelProps) {
  const [tab, setTab] = useState("inbox");

  const suggestionsKey = ["/api/junior-analyst/suggestions", projectId ?? "all", "pending"];
  const { data: pending = [], isLoading } = useQuery<any[]>({
    queryKey: suggestionsKey,
    queryFn: () => {
      const params = new URLSearchParams({ status: "pending" });
      if (projectId) params.set("projectId", projectId);
      return fetch(`/api/junior-analyst/suggestions?${params}`, { credentials: "include" }).then(r => r.json());
    },
    enabled: open,
  });

  const { data: history = [] } = useQuery<any[]>({
    queryKey: ["/api/junior-analyst/suggestions", projectId ?? "all", "history"],
    queryFn: () => {
      const params = new URLSearchParams({ status: "approved" });
      if (projectId) params.set("projectId", projectId);
      return fetch(`/api/junior-analyst/suggestions?${params}`, { credentials: "include" }).then(r => r.json());
    },
    enabled: open && tab === "history",
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <SheetTitle className="text-base font-semibold">Junior Analyst</SheetTitle>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Your AI acquisition team member</p>
            </div>
            {pending.length > 0 && (
              <Badge className="ml-auto bg-blue-600 hover:bg-blue-600 text-white text-xs px-2">
                {pending.length}
              </Badge>
            )}
          </div>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
          <TabsList className="mx-4 mt-3 mb-1 flex-shrink-0">
            <TabsTrigger value="inbox" className="flex-1 gap-1.5 text-xs">
              <Inbox className="h-3.5 w-3.5" />
              Inbox
              {pending.length > 0 && (
                <span className="ml-1 bg-blue-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {pending.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 gap-1.5 text-xs">
              <CheckCheck className="h-3.5 w-3.5" />
              History
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 gap-1.5 text-xs">
              <Settings2 className="h-3.5 w-3.5" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full px-4 pb-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-zinc-400 text-sm">Loading...</div>
              ) : pending.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                    <Bot className="h-6 w-6 text-zinc-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">All caught up</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                    Junior Analyst will surface suggestions here as you work through deals and documents.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 pt-2">
                  {pending.map((s) => (
                    <SuggestionCard key={s.id} suggestion={s} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full px-4 pb-4">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <p className="text-sm text-zinc-400">No approved suggestions yet.</p>
                </div>
              ) : (
                <div className="space-y-2.5 pt-2">
                  {history.map((s) => (
                    <SuggestionCard key={s.id} suggestion={s} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="settings" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full px-4 pb-4">
              <div className="space-y-4 pt-2">
                <ModeToggle projectId={projectId} />

                <div>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 px-1">
                    Active Agents
                  </p>
                  <div className="space-y-1.5">
                    {Object.entries(AGENT_DESCRIPTIONS).map(([id, meta]) => (
                      <div key={id} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                        <span className="text-lg leading-none mt-0.5">{meta.icon}</span>
                        <div>
                          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{meta.label}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{meta.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
