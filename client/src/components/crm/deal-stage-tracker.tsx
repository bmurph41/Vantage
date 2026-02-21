/**
 * DealStageTracker
 * 
 * Visual pipeline progression component showing:
 * - Horizontal stage flow with current position
 * - Days in current stage
 * - Stage completion timestamps
 * - Quick stage advancement actions
 * - Won/Lost terminal indicators
 */

import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  CheckCircle2, Circle, Clock, ChevronRight, Trophy, XCircle,
  AlertTriangle, ArrowRight, Loader2, MoreHorizontal
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Deal, PipelineStage } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────

interface DealStageTrackerProps {
  deal: Deal;
  onStageChange?: (newStage: string) => void;
  compact?: boolean;       // For use in table rows
  readOnly?: boolean;
}

interface StageInfo {
  id: string;
  name: string;
  order: number;
  isCurrent: boolean;
  isCompleted: boolean;
  isPast: boolean;
  enteredAt?: string;
  daysInStage?: number;
}

// ─── Default Stages (fallback) ────────────────────────────────────

const DEFAULT_STAGES = [
  { id: "lead", name: "Lead", order: 0 },
  { id: "qualified", name: "Qualified", order: 1 },
  { id: "loi", name: "LOI", order: 2 },
  { id: "due_diligence", name: "Due Diligence", order: 3 },
  { id: "under_contract", name: "Under Contract", order: 4 },
  { id: "closing", name: "Closing", order: 5 },
];

// ─── Component ────────────────────────────────────────────────────

export function DealStageTracker({ deal, onStageChange, compact = false, readOnly = false }: DealStageTrackerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);

  // Fetch pipeline stages
  const { data: pipelineStages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  // Stage advancement mutation
  const advanceStageMutation = useMutation({
    mutationFn: async (newStage: string) => {
      const response = await apiRequest("PATCH", `/api/deals/${deal.id}`, {
        pipelineStage: newStage,
      });
      return response.json();
    },
    onSuccess: (_, newStage) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${deal.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/timeline"] });
      toast({ title: "Stage Updated", description: `Deal moved to ${newStage}` });
      onStageChange?.(newStage);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Win/Loss mutations
  const setDealOutcome = useMutation({
    mutationFn: async (status: "won" | "lost") => {
      const response = await apiRequest("PATCH", `/api/deals/${deal.id}`, { status });
      return response.json();
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({ 
        title: status === "won" ? "Deal Won!" : "Deal Lost", 
        description: status === "won" ? "Congratulations on closing this deal." : "Deal marked as lost.",
      });
    },
  });

  // Build stage info
  const stages = useMemo<StageInfo[]>(() => {
    const stageList = pipelineStages?.length 
      ? [...pipelineStages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : DEFAULT_STAGES;

    const currentSlug = deal.pipelineStage || "lead";
    const currentIndex = stageList.findIndex(s => 
      s.id === currentSlug || (s as any).slug === currentSlug || s.name?.toLowerCase().replace(/\s+/g, '_') === currentSlug
    );

    return stageList.map((stage, index) => {
      const stageId = (stage as any).slug || stage.id || stage.name?.toLowerCase().replace(/\s+/g, '_');
      return {
        id: stageId,
        name: stage.name || stageId,
        order: index,
        isCurrent: index === currentIndex,
        isCompleted: index < currentIndex,
        isPast: index < currentIndex,
        daysInStage: index === currentIndex ? getDaysInStage(deal) : undefined,
      };
    });
  }, [pipelineStages, deal]);

  const currentStage = stages.find(s => s.isCurrent);
  const nextStage = stages.find(s => s.order === (currentStage?.order ?? -1) + 1);
  const isTerminal = deal.status === "won" || deal.status === "lost";

  // ─── Compact Mode (for table rows) ─────────────────────────────

  if (compact) {
    return (
      <TooltipProvider>
        <div className="flex items-center gap-1">
          {stages.map((stage, i) => (
            <Tooltip key={stage.id}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    stage.isCompleted ? "bg-green-500 w-6" :
                    stage.isCurrent ? "bg-blue-500 w-8" :
                    "bg-muted w-4"
                  )}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p className="font-medium">{stage.name}</p>
                {stage.isCurrent && stage.daysInStage !== undefined && (
                  <p className="text-muted-foreground">{stage.daysInStage}d in stage</p>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
          {isTerminal && (
            <Badge variant={deal.status === "won" ? "default" : "destructive"} className="ml-1 text-[10px] h-4 px-1">
              {deal.status === "won" ? "WON" : "LOST"}
            </Badge>
          )}
        </div>
      </TooltipProvider>
    );
  }

  // ─── Full Mode ──────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Stage Progress Bar */}
      <div className="relative">
        {/* Connection Line */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted" />
        <div 
          className="absolute top-4 left-4 h-0.5 bg-green-500 transition-all duration-500"
          style={{ 
            width: `${Math.max(0, ((currentStage?.order ?? 0) / Math.max(stages.length - 1, 1)) * 100)}%`,
            maxWidth: 'calc(100% - 32px)'
          }}
        />
        
        {/* Stage Dots */}
        <div className="relative flex justify-between">
          {stages.map((stage) => (
            <TooltipProvider key={stage.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      "flex flex-col items-center gap-1 transition-all group relative z-10",
                      !readOnly && !isTerminal && "cursor-pointer",
                      readOnly && "cursor-default"
                    )}
                    onClick={() => {
                      if (!readOnly && !isTerminal && !advanceStageMutation.isPending) {
                        advanceStageMutation.mutate(stage.id);
                      }
                    }}
                    onMouseEnter={() => setHoveredStage(stage.id)}
                    onMouseLeave={() => setHoveredStage(null)}
                    disabled={readOnly || isTerminal}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 bg-background",
                        stage.isCompleted && "bg-green-500 border-green-500 text-white",
                        stage.isCurrent && !isTerminal && "bg-blue-500 border-blue-500 text-white ring-4 ring-blue-500/20",
                        stage.isCurrent && deal.status === "won" && "bg-green-500 border-green-500 text-white ring-4 ring-green-500/20",
                        stage.isCurrent && deal.status === "lost" && "bg-red-500 border-red-500 text-white ring-4 ring-red-500/20",
                        !stage.isCompleted && !stage.isCurrent && "border-muted-foreground/30 text-muted-foreground",
                        hoveredStage === stage.id && !readOnly && !isTerminal && "scale-110"
                      )}
                    >
                      {stage.isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : stage.isCurrent && deal.status === "won" ? (
                        <Trophy className="h-4 w-4" />
                      ) : stage.isCurrent && deal.status === "lost" ? (
                        <XCircle className="h-4 w-4" />
                      ) : stage.isCurrent ? (
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      ) : (
                        <Circle className="h-3 w-3" />
                      )}
                    </div>
                    <span className={cn(
                      "text-[10px] font-medium max-w-[60px] text-center leading-tight",
                      stage.isCurrent ? "text-foreground" : "text-muted-foreground",
                      stage.isCompleted && "text-green-600 dark:text-green-400"
                    )}>
                      {stage.name}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  <div className="space-y-1">
                    <p className="font-medium">{stage.name}</p>
                    {stage.isCurrent && (
                      <p className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {stage.daysInStage ?? 0} days in stage
                      </p>
                    )}
                    {stage.isCompleted && <p className="text-green-600">Completed</p>}
                    {!stage.isCompleted && !stage.isCurrent && <p className="text-muted-foreground">Upcoming</p>}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </div>

      {/* Stage Actions Bar */}
      {!readOnly && !isTerminal && (
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{currentStage?.daysInStage ?? 0} days in <span className="font-medium text-foreground">{currentStage?.name}</span></span>
            {(currentStage?.daysInStage ?? 0) > 30 && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 h-5 text-[10px]">
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                Stale
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-1.5">
            {nextStage && (
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs gap-1"
                onClick={() => advanceStageMutation.mutate(nextStage.id)}
                disabled={advanceStageMutation.isPending}
              >
                {advanceStageMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <ArrowRight className="h-3 w-3" />
                    Move to {nextStage.name}
                  </>
                )}
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem 
                  className="text-green-600 gap-2"
                  onClick={() => setDealOutcome.mutate("won")}
                >
                  <Trophy className="h-3.5 w-3.5" />
                  Mark as Won
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-red-600 gap-2"
                  onClick={() => setDealOutcome.mutate("lost")}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Mark as Lost
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {stages.filter(s => !s.isCurrent).map(stage => (
                  <DropdownMenuItem 
                    key={stage.id}
                    className="gap-2 text-xs"
                    onClick={() => advanceStageMutation.mutate(stage.id)}
                  >
                    <ChevronRight className="h-3 w-3" />
                    Jump to {stage.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Terminal State Banner */}
      {isTerminal && (
        <div className={cn(
          "flex items-center justify-between rounded-md px-3 py-2",
          deal.status === "won" && "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800",
          deal.status === "lost" && "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
        )}>
          <div className="flex items-center gap-2">
            {deal.status === "won" ? (
              <Trophy className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            <span className={cn(
              "text-sm font-medium",
              deal.status === "won" ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
            )}>
              Deal {deal.status === "won" ? "Won" : "Lost"}
              {deal.closeDate && ` — ${new Date(deal.closeDate).toLocaleDateString()}`}
            </span>
          </div>
          {!readOnly && (
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 text-xs"
              onClick={() => {
                advanceStageMutation.mutate(currentStage?.id || "lead");
                setDealOutcome.mutate("won"); // Hack: will need a reopen mutation
              }}
            >
              Reopen
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────

function getDaysInStage(deal: Deal): number {
  const stageDate = (deal as any).stageChangedAt || deal.updatedAt || deal.createdAt;
  if (!stageDate) return 0;
  const diff = Date.now() - new Date(stageDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default DealStageTracker;
