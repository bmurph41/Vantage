/**
 * DealComparisonPage
 * 
 * Side-by-side deal comparison for IC meetings:
 *   - 2-4 deals in columns, metrics in rows
 *   - Asset-class-aware field rendering
 *   - Best/worst value highlighting per metric
 *   - Cross-asset-class support (union of fields)
 *   - Copy to clipboard for IC decks
 * 
 * Route: /crm/deals/compare?ids=1,2,3 (App.tsx line 1502)
 * Lazy: const DealComparison = lazy(() => import("@/pages/deal-comparison")); (line 99)
 */

import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import {
  BarChart3, Plus, X, ArrowLeft, Copy, Check, ExternalLink, Scale,
  TrendingUp, Eye, Ban, Clock as ClockIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useComparisonCart, MAX_COMPARISON_DEALS } from "@/stores/comparison-cart-store";
import DDSegmentRow, { type DDExtensionInput } from "@/components/deals/dd-segment-row";
import type { BrokerFeedbackResponse } from "@/hooks/use-broker-feedback";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Deal } from "@shared/schema";
import {
  getAssetClassConfig,
  type AssetClassConfig,
  type FieldDefinition,
} from "@/components/crm/asset-class-fields";

// ─── Types ────────────────────────────────────────────────────────

interface ComparisonMetric {
  key: string;
  label: string;
  group: string;
  type: "currency" | "number" | "percent" | "text" | "date";
  values: (string | number | null)[];
  bestIndex: number | null;
  worstIndex: number | null;
  higherIsBetter: boolean;
}

// ─── Core fields always shown ─────────────────────────────────────

const CORE_FIELDS: { key: string; label: string; group: string; type: ComparisonMetric["type"]; higherIsBetter?: boolean }[] = [
  { key: "amount", label: "Deal Amount", group: "Deal Summary", type: "currency", higherIsBetter: false },
  { key: "pipelineStage", label: "Pipeline Stage", group: "Deal Summary", type: "text" },
  { key: "status", label: "Status", group: "Deal Summary", type: "text" },
  { key: "closeDate", label: "Close Date", group: "Deal Summary", type: "date" },
  { key: "source", label: "Source", group: "Deal Summary", type: "text" },
  { key: "priority", label: "Priority", group: "Deal Summary", type: "text" },
];

// Fields where higher is better (for highlighting)
const HIGHER_IS_BETTER = new Set([
  "noi", "occupancyRate", "totalUnits", "wetSlips", "drySlips", "totalCapacity",
  "totalSF", "slipRevenue", "fuelRevenue", "avgRent", "marketRent", "rentGrowth",
  "tenantCount", "netRentableSF", "residentialUnits",
]);

const LOWER_IS_BETTER = new Set([
  "askingPrice", "amount", "pricePerUnit", "avgAgeDays", "opexRatio",
  "turnoverRate", "nearTermExpiry", "vacancyRate",
]);

// ─── Main Component ──────────────────────────────────────────────

export default function DealComparisonPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { toast } = useToast();
  const [selectedDealIds, setSelectedDealIds] = useState<string[]>([]);
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const cartDeals = useComparisonCart((s) => s.deals);
  const cartClear = useComparisonCart((s) => s.clear);

  // Parse IDs from URL; fall back to comparison cart if URL is empty
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const ids = params.get("ids");
    if (ids) {
      setSelectedDealIds(ids.split(",").filter(Boolean));
    } else if (cartDeals.length > 0) {
      setSelectedDealIds(cartDeals.map((d) => d.id));
    }
    // Only hydrate on mount / when URL changes — intentionally NOT reacting
    // to cart changes afterward so the user can refine their selection on
    // the comparison page without it being overwritten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchString]);

  // Fetch all deals for the selector
  const { data: allDeals = [] } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  // Fetch full details for selected deals
  const { data: comparisonDeals = [], isLoading } = useQuery<Deal[]>({
    queryKey: ["/api/deals/compare", selectedDealIds],
    queryFn: async () => {
      if (selectedDealIds.length === 0) return [];
      const results = await Promise.all(
        selectedDealIds.map(async (id) => {
          try {
            const response = await fetch(`/api/deals/${id}`);
            if (!response.ok) return null;
            return response.json();
          } catch {
            return null;
          }
        })
      );
      return results.filter(Boolean) as Deal[];
    },
    enabled: selectedDealIds.length > 0,
  });

  // Update URL when selection changes
  useEffect(() => {
    if (selectedDealIds.length > 0) {
      window.history.replaceState({}, "", `/crm/deals/compare?ids=${selectedDealIds.join(",")}`);
    }
  }, [selectedDealIds]);

  const addDeal = (id: string) => {
    if (selectedDealIds.length >= MAX_COMPARISON_DEALS) {
      toast({
        title: `Maximum ${MAX_COMPARISON_DEALS} deals`,
        description: "Remove one before adding another.",
        variant: "destructive",
      });
      return;
    }
    if (!selectedDealIds.includes(id)) {
      setSelectedDealIds([...selectedDealIds, id]);
    }
    setAddDealOpen(false);
  };

  const removeDeal = (id: string) => {
    setSelectedDealIds(selectedDealIds.filter((d) => d !== id));
  };

  // Build comparison metrics
  const metrics = useMemo(() => buildComparisonMetrics(comparisonDeals), [comparisonDeals]);

  const groupedMetrics = useMemo(() => {
    const groups: Record<string, ComparisonMetric[]> = {};
    metrics.forEach((m) => {
      if (!groups[m.group]) groups[m.group] = [];
      groups[m.group].push(m);
    });
    return groups;
  }, [metrics]);

  const handleCopy = () => {
    const lines: string[] = [];
    const dealNames = comparisonDeals.map((d) => d.name || "Untitled");
    lines.push(["Metric", ...dealNames].join("\t"));

    metrics.forEach((m) => {
      const vals = m.values.map((v) => formatMetricValue(v, m.type));
      lines.push([m.label, ...vals].join("\t"));
    });

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard", description: "Paste into Excel or your IC deck." });
  };

  // Column widths
  const dealColCount = comparisonDeals.length;
  const colWidth = dealColCount > 0 ? `${Math.floor(80 / dealColCount)}%` : "auto";

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/deal-workspace")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Deal Comparison</h1>
            <p className="text-sm text-muted-foreground">
              Side-by-side analysis for investment committee review
            </p>
          </div>
        </div>
        {comparisonDeals.length >= 2 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy Table"}
          </Button>
        )}
      </div>

      {/* Deal Selector Row */}
      <div className="flex items-stretch gap-3">
        {comparisonDeals.map((deal, i) => (
          <DealColumnHeader key={deal.id} deal={deal} index={i} onRemove={() => removeDeal(String(deal.id))} />
        ))}

        {selectedDealIds.length < MAX_COMPARISON_DEALS && (
          <AddDealCard
            open={addDealOpen}
            onOpenChange={setAddDealOpen}
            deals={allDeals.filter((d) => !selectedDealIds.includes(String(d.id)))}
            onSelect={addDeal}
          />
        )}

        {selectedDealIds.length === 0 && (
          <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg p-8 text-center">
            <div>
              <BarChart3 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select 2–{MAX_COMPARISON_DEALS} deals to compare</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Use the Scale icon on any kanban card, then click Compare in the floating bar.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New signal rows — broker feedback + DD timelines */}
      {comparisonDeals.length >= 2 && (
        <NewSignalsSection deals={comparisonDeals} />
      )}

      {/* Comparison Grid */}
      {comparisonDeals.length >= 2 && (
        <div className="space-y-4">
          {Object.entries(groupedMetrics).map(([group, groupMetrics]) => {
            // Skip groups where every value is null
            const hasData = groupMetrics.some((m) => m.values.some((v) => v != null && v !== "" && v !== "—"));
            if (!hasData) return null;

            return (
              <Card key={group}>
                <CardHeader className="py-3 px-4 bg-muted/30">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 px-4 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-[200px]">
                          Metric
                        </th>
                        {comparisonDeals.map((deal, i) => (
                          <th key={deal.id} className="py-2 px-4 text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            {deal.name || `Deal ${i + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupMetrics.map((metric, mi) => {
                        const allNull = metric.values.every((v) => v == null || v === "");
                        if (allNull) return null;

                        return (
                          <tr key={metric.key} className={cn("border-t", mi % 2 === 0 && "bg-muted/10")}>
                            <td className="py-2.5 px-4 text-xs text-muted-foreground font-medium">
                              {metric.label}
                            </td>
                            {metric.values.map((value, vi) => (
                              <td
                                key={vi}
                                className={cn(
                                  "py-2.5 px-4 text-xs font-medium text-center tabular-nums",
                                  metric.bestIndex === vi && value != null && "text-green-700 bg-green-50 dark:bg-green-950/20",
                                  metric.worstIndex === vi && value != null && metric.values.filter((v) => v != null).length > 1 && "text-red-600 bg-red-50 dark:bg-red-950/20"
                                )}
                              >
                                {formatMetricValue(value, metric.type)}
                                {metric.bestIndex === vi && value != null && (
                                  <span className="ml-1 text-[10px] text-green-500">★</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {isLoading && selectedDealIds.length > 0 && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      )}
    </div>
  );
}

// ─── New Signals Section — broker feedback + DD timelines ────────
//
// Rendered below the main comparison grid. Fetches per-deal signals in
// parallel:
//   - /api/crm/deals/:id/extensions      → DD mini-bar via DDSegmentRow
//   - /api/broker-feedback/modeling-project/:id → broker verdicts (only for
//       deals that have a linked modeling project; else shows N/A chip)

function NewSignalsSection({ deals }: { deals: Deal[] }) {
  return (
    <div className="space-y-4">
      <DDTimelineCompareRow deals={deals} />
      <BrokerFeedbackCompareRow deals={deals} />
    </div>
  );
}

function DDTimelineCompareRow({ deals }: { deals: Deal[] }) {
  const extQueries = useQueries({
    queries: deals.map((d) => ({
      queryKey: ["/api/crm/deals", String(d.id), "extensions"],
      queryFn: async (): Promise<DDExtensionInput[]> => {
        const res = await fetch(`/api/crm/deals/${d.id}/extensions`, { credentials: "include" });
        if (!res.ok) return [];
        return res.json();
      },
      staleTime: 60_000,
    })),
  });

  return (
    <Card>
      <CardHeader className="py-3 px-4 bg-muted/30">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <ClockIcon className="h-3 w-3" /> Due Diligence Timelines
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {deals.map((deal, i) => {
          const d: any = deal;
          const psa = d.psaSignedDate;
          const ddDays = d.ddPeriodDays;
          const extensions = extQueries[i]?.data || [];
          return (
            <div key={deal.id} className="flex items-center gap-3">
              <div className="w-[180px] flex-shrink-0">
                <p className="text-xs font-semibold text-slate-700 truncate">
                  {d.name || d.title || `Deal ${i + 1}`}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {psa && ddDays
                    ? `${ddDays}d DD${extensions.filter((e) => e.executed).length > 0 ? ` + ${extensions.filter((e) => e.executed).length} ext` : ""}`
                    : "PSA not signed"}
                </p>
              </div>
              {psa && ddDays ? (
                <CompactDDBar
                  psaSignedDate={psa}
                  ddPeriodDays={ddDays}
                  extensions={extensions}
                />
              ) : (
                <div className="flex-1 h-8 rounded-md border border-dashed border-slate-200 flex items-center px-3 text-[10px] text-slate-400 italic">
                  No DD period yet
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CompactDDBar({
  psaSignedDate,
  ddPeriodDays,
  extensions,
}: {
  psaSignedDate: string;
  ddPeriodDays: number;
  extensions: DDExtensionInput[];
}) {
  // Build a local coordinate system: psa → psa + ddPeriodDays + total extensions + 15% pad
  const MS = 86_400_000;
  const totalExtDays = extensions.reduce((n, e) => n + (e.days || 0), 0);
  const totalDays = Math.max(1, Math.round((ddPeriodDays + totalExtDays) * 1.15));
  const width = 420; // fixed pixel width for the mini bar
  const psa = new Date(psaSignedDate);
  const end = new Date(psa.getTime() + totalDays * MS);
  const getXPx = (d: Date) => {
    const t = d.getTime();
    const a = psa.getTime();
    const b = end.getTime();
    return ((t - a) / (b - a)) * width;
  };
  return (
    <div className="relative flex-1 h-8" style={{ maxWidth: `${width}px` }}>
      <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-slate-200 rounded-full -translate-y-1/2" />
      <DDSegmentRow
        psaSignedDate={psaSignedDate}
        ddPeriodDays={ddPeriodDays}
        extensions={extensions}
        getXPx={getXPx}
        baseDelay={0}
      />
    </div>
  );
}

function BrokerFeedbackCompareRow({ deals }: { deals: Deal[] }) {
  const feedbackQueries = useQueries({
    queries: deals.map((d) => {
      const mpId = (d as any).modelingProjectId || (d as any).modeling_project_id;
      return {
        queryKey: ["/api/broker-feedback/modeling-project", String(mpId ?? `none-${d.id}`)],
        queryFn: async (): Promise<BrokerFeedbackResponse | null> => {
          if (!mpId) return null;
          const res = await fetch(`/api/broker-feedback/modeling-project/${mpId}`, {
            credentials: "include",
          });
          if (!res.ok) return null;
          return res.json();
        },
        enabled: !!mpId,
        staleTime: 5 * 60_000,
        retry: false,
      };
    }),
  });

  // Derive the set of brokers a user follows across any of the deals (should
  // be a stable set, but we union to be safe).
  const brokerMap = new Map<string, { label: string }>();
  feedbackQueries.forEach((q) => {
    q.data?.feedback.forEach((f) => {
      if (!brokerMap.has(f.brokerProfileId)) {
        brokerMap.set(f.brokerProfileId, { label: `Broker ${f.brokerProfileId.slice(0, 6)}` });
      }
    });
  });
  const brokerList = Array.from(brokerMap.entries());

  const hasAnyFeedback = feedbackQueries.some((q) => q.data && q.data.feedback.length > 0);

  return (
    <Card>
      <CardHeader className="py-3 px-4 bg-muted/30">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Scale className="h-3 w-3" /> Broker Feedback
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {!hasAnyFeedback ? (
          <p className="text-xs text-muted-foreground italic">
            Broker feedback is available for deals with a linked modeling project.
            Follow brokers from the <a href="/brokers" className="underline">directory</a> to see their verdicts here.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="py-2 px-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-[160px]">
                  Broker
                </th>
                {deals.map((d, i) => (
                  <th key={d.id} className="py-2 px-2 text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {(d as any).name || (d as any).title || `Deal ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {brokerList.map(([brokerId, meta]) => (
                <tr key={brokerId} className="border-t">
                  <td className="py-2 px-2 text-xs text-muted-foreground font-medium truncate">
                    {meta.label}
                  </td>
                  {deals.map((d, di) => {
                    const q = feedbackQueries[di];
                    const entry = q.data?.feedback.find((f) => f.brokerProfileId === brokerId);
                    if (!entry) {
                      return (
                        <td key={d.id} className="py-2 px-2 text-center text-[10px] text-muted-foreground">
                          —
                        </td>
                      );
                    }
                    const vs =
                      entry.verdict === "pursue"
                        ? { Icon: TrendingUp, text: "Pursue", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" }
                        : entry.verdict === "watch"
                          ? { Icon: Eye, text: "Watch", cls: "text-amber-700 bg-amber-50 border-amber-200" }
                          : { Icon: Ban, text: "Pass", cls: "text-slate-600 bg-slate-50 border-slate-200" };
                    return (
                      <td key={d.id} className="py-2 px-2 text-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${vs.cls}`}>
                          <vs.Icon className="h-2.5 w-2.5" />
                          {vs.text}
                          <span className="font-mono opacity-60 ml-0.5">{entry.score}</span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Deal Column Header ───────────────────────────────────────────

function DealColumnHeader({ deal, index, onRemove }: { deal: Deal; index: number; onRemove: () => void }) {
  const assetClass = (deal as any).assetClass || (deal as any).asset_class || "marina";
  const config = getAssetClassConfig(assetClass);
  const Icon = config.icon;
  const borderColors = ["border-t-blue-400", "border-t-purple-400", "border-t-amber-400", "border-t-cyan-400"];

  return (
    <Card className={cn("flex-1 min-w-[200px] relative border-t-2", borderColors[index % borderColors.length])}>
      <Button size="sm" variant="ghost" className="absolute top-1 right-1 h-6 w-6 p-0" onClick={onRemove}>
        <X className="h-3 w-3" />
      </Button>
      <CardContent className="pt-3 pb-3 px-4">
        <div className="flex items-start gap-2">
          <div className={cn("w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0", config.color)}>
            <Icon className={cn("h-4 w-4", config.textColor)} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate pr-6">{deal.name || "Untitled"}</p>
            <p className="text-lg font-bold text-green-600 tabular-nums">
              {deal.amount ? formatCurrencyCompact(deal.amount) : "—"}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge className={cn("text-[9px] px-1.5 py-0", config.color, config.textColor)}>
                {config.label}
              </Badge>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 capitalize">
                {deal.pipelineStage || deal.status || "open"}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Add Deal Card ────────────────────────────────────────────────

function AddDealCard({
  open, onOpenChange, deals, onSelect,
}: {
  open: boolean; onOpenChange: (open: boolean) => void; deals: Deal[]; onSelect: (id: string) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Card className="flex-1 min-w-[200px] border-dashed cursor-pointer hover:bg-muted/30 transition-colors">
          <CardContent className="flex flex-col items-center justify-center h-full py-6">
            <Plus className="h-6 w-6 text-muted-foreground/40 mb-1" />
            <span className="text-xs text-muted-foreground">Add Deal</span>
          </CardContent>
        </Card>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search deals..." />
          <CommandList>
            <CommandEmpty>No deals found.</CommandEmpty>
            <CommandGroup>
              {deals.slice(0, 25).map((deal) => {
                const ac = (deal as any).assetClass || "marina";
                const cfg = getAssetClassConfig(ac);
                return (
                  <CommandItem
                    key={deal.id}
                    value={`${deal.name} ${deal.id}`}
                    onSelect={() => onSelect(String(deal.id))}
                    className="gap-2 cursor-pointer"
                  >
                    <Badge className={cn("text-[9px] px-1 py-0", cfg.color, cfg.textColor)}>
                      {cfg.label.slice(0, 3)}
                    </Badge>
                    <span className="flex-1 truncate text-sm">{deal.name || "Untitled"}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {deal.amount ? formatCurrencyCompact(deal.amount) : "—"}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Build Comparison Metrics ─────────────────────────────────────

function buildComparisonMetrics(deals: Deal[]): ComparisonMetric[] {
  if (deals.length === 0) return [];

  const metrics: ComparisonMetric[] = [];

  // Core fields
  CORE_FIELDS.forEach((f) => {
    const values = deals.map((d) => getFieldValue(d, f.key));
    const hib = !LOWER_IS_BETTER.has(f.key);
    metrics.push({
      key: f.key,
      label: f.label,
      group: f.group,
      type: f.type,
      values,
      higherIsBetter: hib,
      ...computeBestWorst(values, f.type, hib),
    });
  });

  // Collect all unique asset classes
  const assetClasses = [...new Set(deals.map((d) => (d as any).assetClass || (d as any).asset_class || "marina"))];

  // Get union of all fields across asset classes
  const seenKeys = new Set(CORE_FIELDS.map((f) => f.key));
  const allFields: (FieldDefinition & { _group: string })[] = [];

  assetClasses.forEach((ac) => {
    const config = getAssetClassConfig(ac);
    config.fieldGroups.forEach((group) => {
      config.fields
        .filter((f) => f.group === group.key)
        .forEach((f) => {
          if (!seenKeys.has(f.key)) {
            seenKeys.add(f.key);
            allFields.push({ ...f, _group: group.label });
          }
        });
    });
  });

  // Asset-class-specific fields
  allFields.forEach((f) => {
    const values = deals.map((d) => getFieldValue(d, f.key));
    // Skip if all null
    if (values.every((v) => v == null || v === "")) return;

    const metricType: ComparisonMetric["type"] =
      f.type === "currency" ? "currency" :
      f.type === "percent" ? "percent" :
      f.type === "number" ? "number" :
      f.type === "date" ? "date" : "text";

    const hib = HIGHER_IS_BETTER.has(f.key) || (!LOWER_IS_BETTER.has(f.key) && (f.type === "currency" || f.type === "number"));

    metrics.push({
      key: f.key,
      label: f.label,
      group: f._group,
      type: metricType,
      values,
      higherIsBetter: hib,
      ...computeBestWorst(values, metricType, hib),
    });
  });

  return metrics;
}

// ─── Compute Best/Worst ───────────────────────────────────────────

function computeBestWorst(
  values: (string | number | null)[],
  type: ComparisonMetric["type"],
  higherIsBetter: boolean
): { bestIndex: number | null; worstIndex: number | null } {
  if (type === "text" || type === "date") return { bestIndex: null, worstIndex: null };

  const numericValues = values.map((v) => (v != null ? Number(v) : null));
  const validIndices = numericValues.map((v, i) => (v != null && !isNaN(v) ? i : -1)).filter((i) => i >= 0);

  if (validIndices.length < 2) return { bestIndex: null, worstIndex: null };

  let bestIdx = validIndices[0];
  let worstIdx = validIndices[0];

  validIndices.forEach((i) => {
    const val = numericValues[i]!;
    if (higherIsBetter) {
      if (val > numericValues[bestIdx]!) bestIdx = i;
      if (val < numericValues[worstIdx]!) worstIdx = i;
    } else {
      if (val < numericValues[bestIdx]!) bestIdx = i;
      if (val > numericValues[worstIdx]!) worstIdx = i;
    }
  });

  // Don't mark best/worst if all values are equal
  if (numericValues[bestIdx] === numericValues[worstIdx]) return { bestIndex: null, worstIndex: null };

  return { bestIndex: bestIdx, worstIndex: worstIdx };
}

// ─── Utilities ────────────────────────────────────────────────────

function getFieldValue(deal: Deal, key: string): string | number | null {
  const d = deal as any;
  const val = d[key] ?? d[camelToSnake(key)] ?? d[snakeToCamel(key)] ?? null;
  if (val === null || val === undefined || val === "") return null;
  return val;
}

function formatMetricValue(value: string | number | null, type: ComparisonMetric["type"]): string {
  if (value == null || value === "") return "—";

  switch (type) {
    case "currency": {
      const num = Number(value);
      if (isNaN(num)) return String(value);
      return formatCurrencyCompact(num);
    }
    case "percent":
      return `${Number(value).toFixed(1)}%`;
    case "number":
      return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
    case "date": {
      try {
        return new Date(value as string).toLocaleDateString();
      } catch {
        return String(value);
      }
    }
    default:
      return String(value);
  }
}

function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
}
