/**
 * Deal Scoring System
 * 
 * Two exports:
 *   1. DealScoringConfig — Settings panel for IC to tune scoring weights
 *   2. DealScoreBadge — Compact 0-100 score ring for deal cards/tables
 * 
 * Scoring dimensions:
 *   - Financial Attractiveness (cap rate, NOI yield, deal size)
 *   - Engagement Recency (last activity, last note, stage movement)
 *   - Stage Momentum (days in stage vs average, direction of movement)
 *   - Strategic Fit (asset class priority, location, deal source)
 *   - Source Quality (win rate by source, broker reputation)
 * 
 * Usage:
 *   <DealScoreBadge deal={deal} size="sm" />
 *   <DealScoringConfig />  (settings page or dialog)
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DollarSign, Activity, TrendingUp, Target, Users,
  RotateCcw, Save, Loader2, Info, Zap, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Deal } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────

export interface ScoringWeights {
  financial: number;      // 0-100
  engagement: number;     // 0-100
  momentum: number;       // 0-100
  strategicFit: number;   // 0-100
  sourceQuality: number;  // 0-100
}

interface ScoringDimension {
  key: keyof ScoringWeights;
  label: string;
  description: string;
  icon: typeof DollarSign;
  color: string;
  factors: string[];
}

const DIMENSIONS: ScoringDimension[] = [
  {
    key: "financial",
    label: "Financial Attractiveness",
    description: "Cap rate, NOI yield, deal size relative to portfolio",
    icon: DollarSign,
    color: "text-green-600",
    factors: ["Cap rate vs target", "NOI margin", "Deal size / avg portfolio"],
  },
  {
    key: "engagement",
    label: "Engagement Recency",
    description: "How recently this deal has had activity",
    icon: Activity,
    color: "text-blue-600",
    factors: ["Days since last activity", "Total touchpoints", "Note frequency"],
  },
  {
    key: "momentum",
    label: "Stage Momentum",
    description: "Speed of pipeline progression",
    icon: TrendingUp,
    color: "text-purple-600",
    factors: ["Days in current stage vs avg", "Stages advanced this month", "Stage direction"],
  },
  {
    key: "strategicFit",
    label: "Strategic Fit",
    description: "Alignment with fund thesis and priorities",
    icon: Target,
    color: "text-amber-600",
    factors: ["Asset class priority", "Target geography", "Size bracket match"],
  },
  {
    key: "sourceQuality",
    label: "Source Quality",
    description: "Historical win rate from this deal source",
    icon: Users,
    color: "text-cyan-600",
    factors: ["Source win rate", "Broker track record", "Referral chain strength"],
  },
];

const DEFAULT_WEIGHTS: ScoringWeights = {
  financial: 30,
  engagement: 20,
  momentum: 20,
  strategicFit: 20,
  sourceQuality: 10,
};

const PRESETS: { name: string; weights: ScoringWeights }[] = [
  { name: "Balanced", weights: { financial: 20, engagement: 20, momentum: 20, strategicFit: 20, sourceQuality: 20 } },
  { name: "Value-First", weights: { financial: 40, engagement: 10, momentum: 15, strategicFit: 25, sourceQuality: 10 } },
  { name: "Activity-Driven", weights: { financial: 15, engagement: 35, momentum: 30, strategicFit: 10, sourceQuality: 10 } },
  { name: "Strategic", weights: { financial: 20, engagement: 10, momentum: 15, strategicFit: 40, sourceQuality: 15 } },
];

// ─── Scoring Config Panel ─────────────────────────────────────────

export function DealScoringConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS);
  const [isDirty, setIsDirty] = useState(false);

  // Load saved config
  const { data: savedConfig } = useQuery({
    queryKey: ["/api/crm/scoring/config"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/crm/scoring/config");
        if (!response.ok) return null;
        return response.json();
      } catch {
        return null;
      }
    },
  });

  useEffect(() => {
    if (savedConfig?.weights) {
      setWeights(savedConfig.weights);
    }
  }, [savedConfig]);

  // Preview scores
  const { data: deals = [] } = useQuery<Deal[]>({ queryKey: ["/api/deals"] });

  const previewScores = useMemo(() => {
    return deals
      .filter((d: any) => !d.isClosed && d.status !== "won" && d.status !== "lost")
      .slice(0, 5)
      .map((d) => ({
        deal: d,
        score: computeDealScore(d, weights),
      }))
      .sort((a, b) => b.score - a.score);
  }, [deals, weights]);

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const handleWeightChange = (key: keyof ScoringWeights, value: number[]) => {
    setWeights((prev) => ({ ...prev, [key]: value[0] }));
    setIsDirty(true);
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setWeights(preset.weights);
    setIsDirty(true);
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      try {
        const response = await apiRequest("POST", "/api/crm/scoring/config", { weights });
        return response.json();
      } catch {
        // Store locally if no backend
        localStorage.setItem("deal-scoring-weights", JSON.stringify(weights));
        return { weights };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/scoring/config"] });
      toast({ title: "Scoring Weights Saved" });
      setIsDirty(false);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Deal Scoring</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tune how deals are ranked — weights must sum to 100
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setWeights(DEFAULT_WEIGHTS); setIsDirty(true); }}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || totalWeight !== 100 || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Weight Total Indicator */}
      <div className={cn(
        "text-center py-2 rounded-md text-sm font-medium",
        totalWeight === 100 ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400" :
        "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400"
      )}>
        Total: {totalWeight}%
        {totalWeight !== 100 && ` (${totalWeight > 100 ? "reduce" : "add"} ${Math.abs(100 - totalWeight)}%)`}
      </div>

      {/* Presets */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Presets:</span>
        {PRESETS.map((preset) => (
          <Button
            key={preset.name}
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => applyPreset(preset)}
          >
            {preset.name}
          </Button>
        ))}
      </div>

      {/* Weight Sliders */}
      <div className="grid grid-cols-1 gap-4">
        {DIMENSIONS.map((dim) => {
          const Icon = dim.icon;
          const weight = weights[dim.key];
          const pct = totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;
          return (
            <Card key={dim.key}>
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-start gap-3">
                  <div className={cn("mt-0.5", dim.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">{dim.label}</h3>
                        <p className="text-[11px] text-muted-foreground">{dim.description}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold tabular-nums">{weight}%</span>
                      </div>
                    </div>
                    <Slider
                      value={[weight]}
                      onValueChange={(v) => handleWeightChange(dim.key, v)}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex flex-wrap gap-1">
                      {dim.factors.map((f) => (
                        <Badge key={f} variant="outline" className="text-[9px] py-0">{f}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Live Preview */}
      {previewScores.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Live Preview
            </CardTitle>
            <CardDescription className="text-xs">
              Top 5 open deals scored with current weights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {previewScores.map(({ deal, score }, i) => (
                <div key={deal.id} className="flex items-center gap-3 py-1.5">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                  <DealScoreBadge score={score} size="sm" />
                  <span className="text-xs font-medium flex-1 truncate">{deal.name || "Untitled"}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {(deal as any).amount ? `$${(Number((deal as any).amount) / 1_000_000).toFixed(1)}M` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Needed for preview - using lucide Eye
import { Eye } from "lucide-react";

// ─── Deal Score Badge ─────────────────────────────────────────────

export function DealScoreBadge({
  deal,
  score: propScore,
  size = "md",
  showTooltip = true,
}: {
  deal?: Deal;
  score?: number;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
}) {
  const finalScore = propScore ?? (deal ? computeDealScore(deal, DEFAULT_WEIGHTS) : 0);

  const scoreColor =
    finalScore >= 70 ? "text-green-600" :
    finalScore >= 40 ? "text-amber-600" : "text-red-600";

  const ringColor =
    finalScore >= 70 ? "stroke-green-500" :
    finalScore >= 40 ? "stroke-amber-500" : "stroke-red-500";

  const sizeMap = { sm: 28, md: 36, lg: 48 };
  const svgSize = sizeMap[size];
  const radius = size === "sm" ? 10 : size === "md" ? 14 : 18;
  const circumference = 2 * Math.PI * radius;
  const dashArray = `${(finalScore / 100) * circumference} ${circumference}`;

  const badge = (
    <div className="relative inline-flex items-center justify-center" style={{ width: svgSize, height: svgSize }}>
      <svg width={svgSize} height={svgSize} className="-rotate-90">
        <circle cx={svgSize / 2} cy={svgSize / 2} r={radius} fill="none" stroke="currentColor" className="text-muted/20" strokeWidth={size === "sm" ? 2 : 3} />
        <circle
          cx={svgSize / 2} cy={svgSize / 2} r={radius} fill="none"
          className={ringColor}
          strokeWidth={size === "sm" ? 2 : 3}
          strokeLinecap="round"
          strokeDasharray={dashArray}
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
      </svg>
      <span className={cn("absolute text-center font-bold tabular-nums", scoreColor, size === "sm" ? "text-[9px]" : size === "md" ? "text-[10px]" : "text-xs")}>
        {finalScore}
      </span>
    </div>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">Deal Score: {finalScore}/100</p>
          <p className="text-muted-foreground">
            {finalScore >= 70 ? "Strong candidate" : finalScore >= 40 ? "Needs attention" : "At risk"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Score Computation ────────────────────────────────────────────

export function computeDealScore(deal: Deal, weights: ScoringWeights): number {
  const d = deal as any;
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 100;

  // Financial (0-100 raw)
  let financialRaw = 50; // default middle
  const amount = Number(d.amount) || 0;
  if (amount > 10_000_000) financialRaw += 20;
  else if (amount > 5_000_000) financialRaw += 10;
  else if (amount > 1_000_000) financialRaw += 5;
  const capRate = Number(d.capRate || d.cap_rate) || 0;
  if (capRate > 7) financialRaw += 15;
  else if (capRate > 5) financialRaw += 10;
  else if (capRate > 3) financialRaw += 5;
  financialRaw = Math.min(100, financialRaw);

  // Engagement (0-100 raw)
  let engagementRaw = 30;
  const updatedAt = d.updatedAt || d.updated_at;
  if (updatedAt) {
    const daysSinceUpdate = (Date.now() - new Date(updatedAt).getTime()) / 86400000;
    if (daysSinceUpdate < 3) engagementRaw = 90;
    else if (daysSinceUpdate < 7) engagementRaw = 70;
    else if (daysSinceUpdate < 14) engagementRaw = 50;
    else if (daysSinceUpdate < 30) engagementRaw = 30;
    else engagementRaw = 10;
  }

  // Momentum (0-100 raw)
  let momentumRaw = 50;
  const stageOrder = ["lead", "qualified", "loi", "due_diligence", "under_contract", "closing"];
  const stageIdx = stageOrder.indexOf(d.pipelineStage || d.stage || "lead");
  if (stageIdx >= 4) momentumRaw = 90;
  else if (stageIdx >= 2) momentumRaw = 60;
  else momentumRaw = 30;

  // Strategic Fit (0-100 raw)
  let fitRaw = 50;
  const assetClass = d.assetClass || d.asset_class || "marina";
  if (assetClass === "marina") fitRaw = 80; // primary focus
  else if (assetClass === "multifamily") fitRaw = 70;
  else fitRaw = 40;

  // Source Quality (0-100 raw)
  let sourceRaw = 50;
  const source = d.source || d.dealSource;
  if (source === "referral") sourceRaw = 80;
  else if (source === "broker") sourceRaw = 70;
  else if (source === "outbound") sourceRaw = 60;
  else if (source === "inbound") sourceRaw = 50;
  else sourceRaw = 40;

  // Weighted composite
  const composite = (
    (financialRaw * weights.financial +
      engagementRaw * weights.engagement +
      momentumRaw * weights.momentum +
      fitRaw * weights.strategicFit +
      sourceRaw * weights.sourceQuality) / total
  );

  return Math.round(Math.min(100, Math.max(0, composite)));
}

export default DealScoringConfig;
