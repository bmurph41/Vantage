import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssetClassSelect } from "@/components/ui/asset-class-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  Search, Plus, LayoutGrid, List, DollarSign, Calendar, User, Building2,
  TrendingUp, Filter, ArrowUpDown, Settings2, Edit2, Check, X,
  ExternalLink, Timer, AlertTriangle, Target, BarChart3, Award, Map,
  Flame, Skull, Zap, ChevronDown, Bookmark, Eye, MoreHorizontal,
  Clock, ArrowRight, Phone, Mail, StickyNote,
} from "lucide-react";
import { Link } from "wouter";
import { format, differenceInDays, isAfter, addDays } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import DealFormModal from "@/components/modals/deal-form-modal";
import PipelineSettingsModal from "@/components/modals/pipeline-settings-modal";
import type { Deal, Contact, Company, PipelineStage, Pipeline } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import { useDisplayMode } from "@/stores/display-mode-store";
import SimpleDealTracker from "@/components/pipeline/SimpleDealTracker";
import MarinaMapEmbed from "@/components/marina-map/MarinaMapEmbed";
import AutomationRulesPanel from "@/components/pipeline/AutomationRulesPanel";
import { PipelineNudges } from "@/components/pipeline/PipelineNudges";
import { ForecastChart } from "@/components/pipeline/ForecastChart";
import PipelineTemplateSelector from "@/components/pipeline/PipelineTemplateSelector";
import {
  ASSET_CLASSES,
  DEAL_PRIORITIES,
  SAVED_VIEW_PRESETS,
  calculateDaysInStage,
  isDealRotting,
  formatCompactCurrency,
  type AssetClassValue,
} from "@shared/crm-constants";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

type DealWithRelations = Deal & {
  contact?: Contact | null;
  company?: Company | null;
};

// ─── Utilities ───────────────────────────────────────────────────────

const getInitials = (firstName?: string, lastName?: string) => {
  if (!firstName && !lastName) return "U";
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
};

const getStageColor = (stageName: string, stageColor?: string | null) => {
  if (stageColor) return stageColor;
  const lower = stageName.toLowerCase();
  if (lower.includes("lead") || lower.includes("prospect")) return "#6366f1";
  if (lower.includes("qualif")) return "#8b5cf6";
  if (lower.includes("proposal") || lower.includes("loi")) return "#3b82f6";
  if (lower.includes("negoti")) return "#f59e0b";
  if (lower.includes("diligence")) return "#14b8a6";
  if (lower.includes("financ")) return "#84cc16";
  if (lower.includes("won") || lower.includes("closing")) return "#10b981";
  if (lower.includes("lost")) return "#ef4444";
  return "#6b7280";
};

const getPriorityConfig = (priority: string) => {
  const p = DEAL_PRIORITIES.find(d => d.value === priority);
  return p || { value: priority, label: priority, color: '#94a3b8', bgColor: 'bg-gray-500' };
};

// ─── Deal Card ───────────────────────────────────────────────────────

interface DealCardProps {
  deal: DealWithRelations;
  onClick: () => void;
  rotThreshold?: number;
}

function DealCard({ deal, onClick, rotThreshold = 30 }: DealCardProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: deal.id });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const daysInStage = calculateDaysInStage(deal.currentStageEnteredAt);
  const isRotting = isDealRotting(daysInStage, rotThreshold);
  const isOverdue = deal.expectedCloseDate && new Date(deal.expectedCloseDate) < new Date();
  const priorityCfg = getPriorityConfig(deal.priority || 'medium');
  const dealAge = calculateDaysInStage(deal.createdAt);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`mb-2.5 ${isDragging ? "opacity-50 scale-105 rotate-2" : ""}`}
      data-testid={`deal-card-${deal.id}`}
    >
      <Card
        className={`
          cursor-grab active:cursor-grabbing transition-all duration-200 border
          ${isDragging ? "shadow-2xl border-blue-400" : "hover:shadow-md hover:border-blue-200"}
          ${isRotting ? "border-l-[3px] border-l-red-400" : ""}
          ${isOverdue ? "bg-red-50/40" : ""}
        `}
        onClick={onClick}
      >
        <CardContent className="p-3.5">
          <div className="space-y-2">
            {/* Top row: title + quick actions */}
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-sm text-gray-900 line-clamp-2 flex-1 leading-snug">
                {deal.title}
              </h4>
              <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {isRotting && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                          <Flame className="h-3 w-3 text-red-500" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">Rotting — {daysInStage}d in stage</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {/* Deal Value */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-base font-bold text-green-700">
                  {formatCompactCurrency(Number(deal.amount) || 0)}
                </span>
              </div>
              {(deal as any).probability != null && (
                <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-medium">
                  {(deal as any).probability}% prob
                </Badge>
              )}
              {(deal as any).score != null && (
                  <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-1 ${
                    (deal as any).score >= 80 ? 'bg-green-100 text-green-700' :
                    (deal as any).score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-600'
                  }`} title="Deal Score">
                    {(deal as any).score}
                  </div>
                )}
            </div>

            {/* Company / Contact */}
            {(deal.company || deal.contact) && (
              <div className="flex items-center gap-3 text-xs text-gray-600">
                {deal.company && (
                  <div className="flex items-center gap-1 min-w-0">
                    <Building2 className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{deal.company.name}</span>
                  </div>
                )}
                {deal.contact && (
                  <div className="flex items-center gap-1 min-w-0">
                    <User className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{deal.contact.firstName} {deal.contact.lastName}</span>
                  </div>
                )}
              </div>
            )}

            {/* Commission chip */}
            {deal.commissionAmount && Number(deal.commissionAmount) > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-purple-700 font-medium bg-purple-50 px-2 py-0.5 rounded-md w-fit">
                <DollarSign className="h-3 w-3" />
                {formatCurrency(Number(deal.commissionAmount))} comm.
              </div>
            )}

            {/* Stage time + close date row */}
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span className={isRotting ? "text-red-600 font-medium" : ""}>
                  {daysInStage}d in stage
                </span>
              </div>
              {deal.expectedCloseDate && (
                <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                  <Calendar className="h-3 w-3" />
                  {format(new Date(deal.expectedCloseDate), "MMM d")}
                </div>
              )}
            </div>

            {/* Bottom row: priority + owner + cross-links */}
            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              <div className="flex items-center gap-1.5">
                {deal.priority && (
                  <Badge
                    className="text-[10px] px-1.5 py-0 h-[18px] text-white"
                    style={{ backgroundColor: priorityCfg.color }}
                  >
                    {priorityCfg.label}
                  </Badge>
                )}
                {/* Asset class indicator */}
                {(deal as any).assetClass && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-[18px]">
                    {ASSET_CLASSES.find(a => a.value === (deal as any).assetClass)?.label || (deal as any).assetClass}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Cross-module links */}
                {deal.contactId && (
                  <Link href={`/crm/contacts/${deal.contactId}`} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-colors">
                      <User className="h-2.5 w-2.5 text-blue-600" />
                    </div>
                  </Link>
                )}
                {deal.propertyId && (
                  <Link href={`/crm/properties/${deal.propertyId}`} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center hover:bg-teal-200 transition-colors">
                      <Building2 className="h-2.5 w-2.5 text-teal-600" />
                    </div>
                  </Link>
                )}
                {/* Owner avatar */}
                <div
                  className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shadow-sm"
                  title={deal.contact ? `${deal.contact.firstName || ''} ${deal.contact.lastName || ''}`.trim() : "Unassigned"}
                >
                  {getInitials(deal.contact?.firstName, deal.contact?.lastName)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Pipeline Column ─────────────────────────────────────────────────

interface PipelineColumnProps {
  stage: PipelineStage;
  deals: DealWithRelations[];
  onDealClick: (deal: DealWithRelations) => void;
}

function PipelineColumn({ stage, deals, onDealClick }: PipelineColumnProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(stage.name);
  const { toast } = useToast();
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const totalValue = deals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
  const avgDaysInStage = deals.length > 0
    ? Math.round(deals.reduce((sum, d) => sum + calculateDaysInStage(d.currentStageEnteredAt), 0) / deals.length)
    : 0;
  const rottingCount = deals.filter(d => calculateDaysInStage(d.currentStageEnteredAt) > (stage.rotDays || 30)).length;

  const updateStageMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await apiRequest("PUT", `/api/pipeline-stages/${stage.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stages"] });
      toast({ title: "Stage name updated" });
      setIsEditingName(false);
    },
    onError: () => {
      toast({ title: "Failed to update stage", variant: "destructive" });
    },
  });

  const handleSaveName = () => {
    if (!editedName.trim()) {
      toast({ title: "Stage name cannot be empty", variant: "destructive" });
      return;
    }
    if (editedName !== stage.name) {
      updateStageMutation.mutate({ name: editedName });
    } else {
      setIsEditingName(false);
    }
  };

  const stageColor = getStageColor(stage.name, stage.color);
  const probability = stage.probability ?? 50;

  return (
    <div
      className="flex-shrink-0 w-[300px] bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col"
      data-testid={`pipeline-column-${stage.name.replace(/\s+/g, "-").toLowerCase()}`}
    >
      {/* Column Header */}
      <div
        className="px-4 py-3 rounded-t-xl"
        style={{
          backgroundColor: `${stageColor}08`,
          borderBottom: `2px solid ${stageColor}`,
        }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stageColor }} />
            {isEditingName ? (
              <div className="flex items-center gap-1 flex-1">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="h-7 text-sm font-semibold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") { setEditedName(stage.name); setIsEditingName(false); }
                  }}
                />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSaveName}>
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditedName(stage.name); setIsEditingName(false); }}>
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-gray-900 text-sm truncate">
                  {stage.name.replace(/_/g, " ")}
                </h3>
                <Button
                  size="sm" variant="ghost"
                  className="h-5 w-5 p-0 opacity-0 hover:opacity-100 transition-opacity"
                  onClick={() => setIsEditingName(true)}
                >
                  <Edit2 className="h-3 w-3 text-gray-400" />
                </Button>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{deals.length}</Badge>
              </>
            )}
          </div>
        </div>

        {/* Stage metrics bar */}
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span className="font-medium" style={{ color: stageColor }}>
            {formatCompactCurrency(totalValue)}
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Target className="h-3 w-3" /> {probability}%
            </span>
            {avgDaysInStage > 0 && (
              <span className="flex items-center gap-1">
                <Timer className="h-3 w-3" /> {avgDaysInStage}d avg
              </span>
            )}
            {rottingCount > 0 && (
              <span className="flex items-center gap-1 text-red-500 font-medium">
                <Flame className="h-3 w-3" /> {rottingCount}
              </span>
            )}
          </div>
        </div>

        {/* Win probability bar */}
        <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${probability}%`, backgroundColor: stageColor }}
          />
        </div>
      </div>

      {/* Drop Zone */}
      <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex-1 p-2.5 min-h-[500px] transition-colors overflow-y-auto ${
            isOver ? "bg-blue-50/70" : "bg-gray-50/50"
          }`}
        >
          {deals.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              {isOver ? (
                <div className="space-y-2">
                  <ArrowRight className="h-6 w-6 mx-auto text-blue-400 animate-bounce" />
                  <span className="text-blue-500">Drop here</span>
                </div>
              ) : (
                "No deals"
              )}
            </div>
          ) : (
            deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                onClick={() => onDealClick(deal)}
                rotThreshold={stage.rotDays || 30}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ─── Main Pipeline Component ─────────────────────────────────────────

export default function Pipeline() {
  const { simplifiedMode } = useDisplayMode();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [sortBy, setSortBy] = useState("value");
  const [viewMode, setViewMode] = useState<"kanban" | "list" | "map" | "automations" | "templates" | "forecast">("kanban");
  const [isDealFormOpen, setIsDealFormOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<DealWithRelations | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Stage entry requirements: { [stageId]: string[] } — loaded from stage config
  const stageRequirements: Record<string, string[]> = useMemo(() => {
    if (!stages) return {};
    return Object.fromEntries(
      stages
        .filter(s => (s as any).requiredFields?.length > 0)
        .map(s => [s.id, (s as any).requiredFields as string[]])
    );
  }, [stages]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeAssetClass, setActiveAssetClass] = useState<string>("all");
  const [activeSavedView, setActiveSavedView] = useState<string>("all_deals");
  const [filters, setFilters] = useState({
    commissionMin: "",
    commissionMax: "",
    hasCommission: false,
    priorities: [] as string[],
    closingThisMonth: false,
    isRotting: false,
  });
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ── Data Fetching ──
  const { data: pipelines = [] } = useQuery<Pipeline[]>({ queryKey: ["/api/pipelines"] });

  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      setSelectedPipelineId(pipelines[0].id);
    }
  }, [pipelines, selectedPipelineId]);

  const { data: allStages = [] } = useQuery<PipelineStage[]>({ queryKey: ["/api/pipeline-stages"] });

  const stages = useMemo(() => {
    return allStages
      .filter(stage => stage.pipelineId === selectedPipelineId || (!stage.pipelineId && selectedPipelineId === ""))
      .sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0));
  }, [allStages, selectedPipelineId]);

  const { data: deals = [], isLoading } = useQuery<DealWithRelations[]>({ queryKey: ["/api/deals"] });

  // ── Mutations ──
  const updateDealMutation = useMutation({
    mutationFn: async ({ dealId, stageId, stage, fromStageId }: { dealId: string; stageId: string; stage: string; fromStageId?: string }) => {
      const response = await apiRequest("PUT", `/api/deals/${dealId}`, {
        stageId, stage, pipelineId: selectedPipelineId || null,
      });
      return response.json();
    },
    onMutate: async ({ dealId, stageId, stage }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/deals"] });
      const previousDeals = queryClient.getQueryData(["/api/deals"]);
      queryClient.setQueryData(["/api/deals"], (old: DealWithRelations[] = []) =>
        old.map(deal =>
          deal.id === dealId ? { ...deal, stageId, stage, pipelineId: selectedPipelineId || null } : deal
        )
      );
      return { previousDeals };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousDeals) queryClient.setQueryData(["/api/deals"], context.previousDeals);
      toast({ title: "Failed to update deal", variant: "destructive" });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({ title: "Deal moved successfully" });
      // Fire-and-forget: trigger automation rules evaluation for this stage change
      if (vars.fromStageId && vars.stageId) {
        apiRequest("POST", "/api/pipeline/automation/evaluate", {
          dealId: vars.dealId,
          fromStageId: vars.fromStageId,
          toStageId: vars.stageId,
          triggerType: "stage_change",
        }).catch(() => {});
      }
    },
  });

  // ── Filtering & Sorting ──
  const filteredDeals = useMemo(() => {
    let filtered = deals.filter((deal) => {
      // Text search
      const matchesSearch = !searchTerm ||
        deal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.contact?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.contact?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.company?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      // Asset class filter
      const matchesAssetClass = activeAssetClass === "all" || (deal as any).assetClass === activeAssetClass;

      // Commission filters
      const commissionAmount = Number(deal.commissionAmount || 0);
      const matchesCommMin = !filters.commissionMin || commissionAmount >= Number(filters.commissionMin);
      const matchesCommMax = !filters.commissionMax || commissionAmount <= Number(filters.commissionMax);
      const matchesHasComm = !filters.hasCommission || commissionAmount > 0;

      // Priority filter
      const matchesPriority = filters.priorities.length === 0 || filters.priorities.includes(deal.priority || '');

      // Closing this month
      const matchesClosing = !filters.closingThisMonth || (
        deal.expectedCloseDate &&
        new Date(deal.expectedCloseDate).getMonth() === new Date().getMonth() &&
        new Date(deal.expectedCloseDate).getFullYear() === new Date().getFullYear()
      );

      // Rotting filter
      const matchesRotting = !filters.isRotting || calculateDaysInStage(deal.currentStageEnteredAt) > 30;

      return matchesSearch && matchesAssetClass && matchesCommMin && matchesCommMax &&
             matchesHasComm && matchesPriority && matchesClosing && matchesRotting;
    });

    // Sort
    if (sortBy === "value") {
      filtered.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
    } else if (sortBy === "date") {
      filtered.sort((a, b) => {
        const dateA = a.expectedCloseDate ? new Date(a.expectedCloseDate).getTime() : 0;
        const dateB = b.expectedCloseDate ? new Date(b.expectedCloseDate).getTime() : 0;
        return dateB - dateA;
      });
    } else if (sortBy === "priority") {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      filtered.sort((a, b) => (order[a.priority || ''] ?? 4) - (order[b.priority || ''] ?? 4));
    } else if (sortBy === "age") {
      filtered.sort((a, b) => calculateDaysInStage(b.currentStageEnteredAt) - calculateDaysInStage(a.currentStageEnteredAt));
    }

    return filtered;
  }, [deals, searchTerm, sortBy, filters, activeAssetClass]);

  // ── Group by stage ──
  const dealsByStage = useMemo(() => {
    const grouped: Record<string, DealWithRelations[]> = {};
    stages.forEach(stage => {
      grouped[stage.id] = filteredDeals.filter(deal => {
        if (deal.stageId) return deal.stageId === stage.id;
        return deal.stage === stage.name;
      });
    });
    return grouped;
  }, [stages, filteredDeals]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const isOpen = (d: DealWithRelations) => {
      const s = (d.stage || "").toLowerCase().replace(/[_\s]/g, "");
      return !s.includes("closedwon") && !s.includes("won") && !s.includes("closedlost") && !s.includes("lost");
    };
    const isWon = (d: DealWithRelations) => {
      const s = (d.stage || "").toLowerCase().replace(/[_\s]/g, "");
      return s.includes("closedwon") || s === "won";
    };
    const isLost = (d: DealWithRelations) => {
      const s = (d.stage || "").toLowerCase().replace(/[_\s]/g, "");
      return s.includes("closedlost") || s === "lost";
    };

    const open = deals.filter(isOpen);
    const won = deals.filter(isWon);
    const lost = deals.filter(isLost);

    const totalPipelineValue = open.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const weightedValue = open.reduce((sum, d) => {
      const amt = Number(d.amount || 0);
      const prob = ((d as any).probability ?? 50) / 100;
      return sum + amt * prob;
    }, 0);
    const avgDealSize = open.length > 0 ? totalPipelineValue / open.length : 0;
    const totalClosed = won.length + lost.length;
    const winRate = totalClosed > 0 ? (won.length / totalClosed) * 100 : 0;
    const avgDaysInStage = open.length > 0
      ? Math.round(open.reduce((sum, d) => sum + calculateDaysInStage(d.currentStageEnteredAt), 0) / open.length)
      : 0;
    const rottingDeals = open.filter(d => calculateDaysInStage(d.currentStageEnteredAt) > 30).length;
    const closingThisMonth = open.filter(d =>
      d.expectedCloseDate &&
      new Date(d.expectedCloseDate).getMonth() === new Date().getMonth() &&
      new Date(d.expectedCloseDate).getFullYear() === new Date().getFullYear()
    ).length;
    const totalCommission = deals.reduce((sum, d) => sum + Number(d.commissionAmount || 0), 0);

    return { totalPipelineValue, weightedValue, avgDealSize, winRate, avgDaysInStage, rottingDeals, closingThisMonth, totalCommission, openCount: open.length, wonCount: won.length };
  }, [deals]);

  // ── Forecast by stage ──
  const forecastByStage = useMemo(() => {
    return stages
      .filter(s => !s.name.toLowerCase().includes("lost"))
      .map(s => {
        const stageDeals = dealsByStage[s.id] || [];
        const totalVal = stageDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
        const prob = s.probability ?? 50;
        return {
          stageId: s.id,
          name: s.name,
          color: getStageColor(s.name, s.color),
          count: stageDeals.length,
          totalValue: totalVal,
          weightedValue: totalVal * (prob / 100),
          probability: prob,
        };
      });
  }, [stages, dealsByStage]);

  // ── Event Handlers ──
  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) { setActiveId(null); return; }
    const dealId = active.id as string;
    const targetStageId = (over.data.current?.sortable?.containerId || over.id) as string;
    const deal = deals.find(d => d.id === dealId);
    if (!deal) { setActiveId(null); return; }
    const currentStageId = deal.stageId || stages.find(s => s.name === deal.stage)?.id;
    if (currentStageId === targetStageId) { setActiveId(null); return; }
    const targetStage = stages.find(s => s.id === targetStageId);
    if (!targetStage) { setActiveId(null); return; }

    // ── Stage entry requirement gate ──
    const required = stageRequirements[targetStageId] || [];
    if (required.length > 0) {
      const missingFields = required.filter(f => {
        const val = (deal as any)[f];
        return val === null || val === undefined || val === '' || val === 0;
      });
      if (missingFields.length > 0) {
        const labels: Record<string, string> = {
          amount: 'Deal Value', probability: 'Probability', expectedCloseDate: 'Close Date',
          primaryContactId: 'Primary Contact', companyId: 'Company',
          ddExpirationDate: 'DD Expiration', psaSignedDate: 'PSA Date',
        };
        const readable = missingFields.map(f => labels[f] || f).join(', ');
        toast({
          title: "⛔ Stage requirements not met",
          description: `To move to "${targetStage.name}", complete: ${readable}`,
          variant: "destructive",
          duration: 5000,
        });
        setActiveId(null);
        return;
      }
    }

    updateDealMutation.mutate({ dealId, stageId: targetStageId, stage: targetStage.name, fromStageId: currentStageId });
    setActiveId(null);
  };

  const handleDealClick = (deal: DealWithRelations) => { setSelectedDeal(deal); setIsDealFormOpen(true); };
  const handleAddNewDeal = () => { setSelectedDeal(null); setIsDealFormOpen(true); };
  const handleCloseDealForm = () => { setIsDealFormOpen(false); setSelectedDeal(null); };

  const hasActiveFilters = filters.commissionMin || filters.commissionMax || filters.hasCommission ||
    filters.priorities.length > 0 || filters.closingThisMonth || filters.isRotting;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Simplified mode: render SimpleDealTracker instead of Kanban
  if (simplifiedMode) {
    return (
      <>
        <SimpleDealTracker
          onSwitchToKanban={() => useDisplayMode.getState().toggleSimplifiedMode()}
          onAddDeal={handleAddNewDeal}
          onDealClick={handleDealClick}
        />
        <DealFormModal isOpen={isDealFormOpen} onClose={handleCloseDealForm} deal={selectedDeal} />
      </>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900" data-testid="pipeline-title">
              Sales Pipeline
            </h1>
            {pipelines.length > 0 && (
              <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                <SelectTrigger className="w-48 h-9" data-testid="select-pipeline">
                  <SelectValue placeholder="Select pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* ── Controls Bar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            {/* Search */}
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search deals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-8 text-sm"
                data-testid="input-search-deals"
              />
            </div>

            {/* Asset Class Filter */}
            <AssetClassSelect
              value={activeAssetClass}
              onValueChange={setActiveAssetClass}
              allowAll
              allLabel="All Asset Classes"
              className="w-40 h-8 text-sm"
            />

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-32 h-8 text-sm">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="value">By Value</SelectItem>
                <SelectItem value="date">By Close Date</SelectItem>
                <SelectItem value="priority">By Priority</SelectItem>
                <SelectItem value="age">By Stage Age</SelectItem>
              </SelectContent>
            </Select>

            {/* View Toggle */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              {[
                { key: "kanban" as const, icon: LayoutGrid, label: "Kanban" },
                { key: "list" as const, icon: List, label: "List" },
                { key: "map" as const, icon: Map, label: "Map" },
              ].map(v => (
                <Button
                  key={v.key}
                  variant="ghost"
                  size="sm"
                  className={`h-8 text-xs rounded-none border-r last:border-r-0 ${viewMode === v.key ? "bg-gray-100 font-medium" : ""}`}
                  onClick={() => setViewMode(v.key)}
                >
                  <v.icon className="w-3.5 h-3.5 mr-1" />
                  {v.label}
                </Button>
              ))}
            </div>

            {/* Filter Popover */}
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline" size="sm"
                  className={`h-8 text-xs ${hasActiveFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : ''}`}
                >
                  <Filter className="w-3.5 h-3.5 mr-1" />
                  Filter
                  {hasActiveFilters && <Badge variant="secondary" className="ml-1.5 px-1 py-0 text-[10px] h-4">ON</Badge>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80" align="start">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Filter Deals</h4>

                  {/* Priority Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Priority</Label>
                    <div className="flex flex-wrap gap-2">
                      {DEAL_PRIORITIES.map(p => (
                        <label key={p.value} className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox
                            checked={filters.priorities.includes(p.value)}
                            onCheckedChange={(checked) => {
                              setFilters(prev => ({
                                ...prev,
                                priorities: checked
                                  ? [...prev.priorities, p.value]
                                  : prev.priorities.filter(v => v !== p.value),
                              }));
                            }}
                          />
                          <Badge className="text-[10px] text-white" style={{ backgroundColor: p.color }}>
                            {p.label}
                          </Badge>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Commission Range */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Commission Amount</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-gray-500">Min</Label>
                        <Input type="number" placeholder="$0" value={filters.commissionMin}
                          onChange={(e) => setFilters({ ...filters, commissionMin: e.target.value })} className="h-7 text-sm" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-gray-500">Max</Label>
                        <Input type="number" placeholder="No limit" value={filters.commissionMax}
                          onChange={(e) => setFilters({ ...filters, commissionMax: e.target.value })} className="h-7 text-sm" />
                      </div>
                    </div>
                  </div>

                  {/* Quick toggles */}
                  <div className="space-y-2">
                    {[
                      { key: 'hasCommission' as const, label: 'Has commission' },
                      { key: 'closingThisMonth' as const, label: 'Closing this month' },
                      { key: 'isRotting' as const, label: 'Rotting deals only' },
                    ].map(toggle => (
                      <label key={toggle.key} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={filters[toggle.key]}
                          onCheckedChange={(checked) => setFilters(prev => ({ ...prev, [toggle.key]: !!checked }))}
                        />
                        <span className="text-sm">{toggle.label}</span>
                      </label>
                    ))}
                  </div>

                  <Separator />
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => setFilters({
                      commissionMin: "", commissionMax: "", hasCommission: false,
                      priorities: [], closingThisMonth: false, isRotting: false,
                    })}>
                      Clear All
                    </Button>
                    <Button size="sm" onClick={() => setIsFilterOpen(false)}>Apply</Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="outline" size="sm"
              className={`h-8 text-xs ${viewMode === 'automations' ? 'bg-amber-50 border-amber-300 text-amber-700' : ''}`}
              onClick={() => setViewMode(viewMode === 'automations' ? 'kanban' : 'automations')}
            >
              <Zap className="w-3.5 h-3.5 mr-1" /> Automations
            </Button>

            <Button
              variant="outline" size="sm"
              className={`h-8 text-xs ${viewMode === 'templates' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : ''}`}
              onClick={() => setViewMode(viewMode === 'templates' ? 'kanban' : 'templates')}
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1" /> Templates
            </Button>

            <Button
              variant="outline" size="sm"
              className={`h-8 text-xs ${viewMode === 'forecast' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : ''}`}
              onClick={() => setViewMode(viewMode === 'forecast' ? 'kanban' : 'forecast')}
            >
              <TrendingUp className="w-3.5 h-3.5 mr-1" /> Forecast
            </Button>

            <Button
              variant={showNudges ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowNudges(!showNudges)}
            >
              <Zap className="h-3.5 w-3.5 mr-1" />
              Nudges
              {deals.filter(d => {
                const last = (d as any).lastActivityDate;
                return !last || (Date.now() - new Date(last).getTime()) / 86400000 > 14;
              }).length > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[9px] rounded-full px-1">
                  {deals.filter(d => {
                    const last = (d as any).lastActivityDate;
                    return !last || (Date.now() - new Date(last).getTime()) / 86400000 > 14;
                  }).length}
                </span>
              )}
            </Button>
            {selectedForComparison.size >= 2 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => setShowComparison(true)}
              >
                <BarChart3 className="h-3.5 w-3.5 mr-1" />
                Compare {selectedForComparison.size}
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setIsSettingsOpen(true)}>
              <Settings2 className="w-3.5 h-3.5 mr-1" /> Stages
            </Button>

            <Button className="bg-blue-600 hover:bg-blue-700 h-8 text-xs" size="sm" onClick={handleAddNewDeal}>
              <Plus className="w-3.5 h-3.5 mr-1" /> New Deal
            </Button>
          </div>
        </div>
      </div>

      {/* ── KPI Summary Strip ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-2">
        <div className="flex items-center gap-6 overflow-x-auto">
          {[
            { label: "Pipeline",    value: formatCompactCurrency(kpis.totalPipelineValue), color: "text-green-600", icon: DollarSign },
            { label: "Weighted",    value: formatCompactCurrency(kpis.weightedValue),      color: "text-blue-600",  icon: Target },
            { label: "Avg Size",    value: formatCompactCurrency(kpis.avgDealSize),        color: "text-purple-600", icon: BarChart3 },
            { label: "Win Rate",    value: `${kpis.winRate.toFixed(0)}%`,                  color: "text-emerald-600", icon: Award },
            { label: "Avg Stage",   value: `${kpis.avgDaysInStage}d`,                     color: "text-orange-600", icon: Timer },
            { label: "Rotting",     value: String(kpis.rottingDeals),                      color: kpis.rottingDeals > 0 ? "text-red-600" : "text-gray-500", icon: Flame },
            { label: "Closing Soon", value: String(kpis.closingThisMonth),                 color: "text-blue-600",  icon: Calendar },
            { label: "Commission",  value: formatCompactCurrency(kpis.totalCommission),    color: "text-purple-600", icon: DollarSign },
          ].map(kpi => (
            <div key={kpi.label} className="flex items-center gap-2 flex-shrink-0 py-1">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              <div>
                <p className="text-[10px] text-gray-500 font-medium leading-tight">{kpi.label}</p>
                <p className={`text-sm font-bold ${kpi.color} leading-tight`}>{kpi.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Forecast bar (mini stage breakdown) */}
        {forecastByStage.length > 0 && (
          <div className="flex items-center gap-0.5 mt-2 h-2 rounded-full overflow-hidden bg-gray-100">
            {forecastByStage.map(s => {
              const totalVal = forecastByStage.reduce((sum, fs) => sum + fs.totalValue, 0);
              const widthPct = totalVal > 0 ? Math.max((s.totalValue / totalVal) * 100, s.count > 0 ? 2 : 0) : 0;
              return (
                <TooltipProvider key={s.stageId}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${widthPct}%`, backgroundColor: s.color }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-xs font-medium">{s.name}: {s.count} deals — {formatCompactCurrency(s.totalValue)}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-hidden">
        {/* Kanban View */}
        {viewMode === "kanban" && (
          <div className="overflow-x-auto overflow-y-hidden p-4 h-full" data-testid="kanban-board">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-3 h-full">
                {stages.map(stage => (
                  <PipelineColumn
                    key={stage.id}
                    stage={stage}
                    deals={dealsByStage[stage.id] || []}
                    onDealClick={handleDealClick}
                  />
                ))}
              </div>
              <DragOverlay>
                {activeId ? (
                  <div className="opacity-80 rotate-3">
                    <DealCard deal={deals.find(d => d.id === activeId)!} onClick={() => {}} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}

        {/* Map View */}
        {viewMode === "map" && (
          <div className="flex-1 overflow-hidden" data-testid="map-view">
            <MarinaMapEmbed
              source="pipeline"
              markerColor="#FF5722"
              sourceLabel="Pipeline Deals"
              height="calc(100vh - 280px)"
              showSearch={true}
              showStateFilter={true}
              showSourceFilter={false}
              showLayerToggles={false}
              showListPanel={true}
              emptyMessage="No pipeline deals with location data found"
              onLocationClick={(loc) => {
                const deal = deals.find(d => d.id === loc.id);
                if (deal) handleDealClick(deal);
              }}
            />
          </div>
        )}

        {/* List View */}
        {viewMode === "list" && (
          <div className="flex-1 overflow-y-auto p-4" data-testid="list-view">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["Deal", "Contact", "Company", "Value", "Commission", "Stage", "Close Date", "Priority", "Days in Stage"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDeals.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center">
                        <List className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                        <h3 className="text-sm font-semibold text-gray-600 mb-1">No deals found</h3>
                        <p className="text-xs text-gray-500">Try adjusting your search or filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredDeals.map(deal => {
                      const stageInfo = stages.find(s => s.id === deal.stageId || s.name === deal.stage);
                      const daysInStage = calculateDaysInStage(deal.currentStageEnteredAt);
                      const rotting = daysInStage > (stageInfo?.rotDays || 30);
                      const priority = getPriorityConfig(deal.priority || 'medium');
                      return (
                        <tr
                          key={deal.id}
                          onClick={(e) => {
                              if (e.shiftKey) {
                                setSelectedForComparison(prev => {
                                  const next = new Set(prev);
                                  if (next.has(deal.id)) { next.delete(deal.id); } else { next.add(deal.id); }
                                  return next;
                                });
                              } else {
                                handleDealClick(deal);
                              }
                            }}
                          className={`hover:bg-gray-50 cursor-pointer transition-colors ${rotting ? 'bg-red-50/30' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {rotting && <Flame className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />}
                              <span className="text-sm font-medium text-gray-900">{deal.title}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {deal.contact ? (
                              <Link href={`/crm/contacts/${deal.contactId}`} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                <span className="text-sm text-blue-600 hover:underline">
                                  {deal.contact.firstName} {deal.contact.lastName}
                                </span>
                              </Link>
                            ) : <span className="text-sm text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {deal.company ? (
                              <Link href={`/crm/companies/${deal.companyId}`} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                <span className="text-sm text-blue-600 hover:underline">{deal.company.name}</span>
                              </Link>
                            ) : <span className="text-sm text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-semibold text-gray-900">
                              {formatCurrency(Number(deal.amount || 0))}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {Number(deal.commissionAmount || 0) > 0
                              ? <span className="text-sm font-semibold text-purple-700">{formatCurrency(Number(deal.commissionAmount))}</span>
                              : <span className="text-sm text-gray-400">—</span>
                            }
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              style={{
                                backgroundColor: `${getStageColor(stageInfo?.name || '', stageInfo?.color)}15`,
                                color: getStageColor(stageInfo?.name || '', stageInfo?.color),
                                borderColor: getStageColor(stageInfo?.name || '', stageInfo?.color),
                              }}
                              className="border text-[11px]"
                            >
                              {stageInfo?.name || deal.stage || 'Unknown'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {deal.expectedCloseDate
                              ? <span className="text-sm text-gray-700">{format(new Date(deal.expectedCloseDate), "MM/dd/yyyy")}</span>
                              : <span className="text-sm text-gray-400">—</span>
                            }
                          </td>
                          <td className="px-4 py-3">
                            <Badge className="text-[10px] text-white" style={{ backgroundColor: priority.color }}>
                              {priority.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm ${rotting ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                              {daysInStage}d
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Automations View */}
        {viewMode === "automations" && (
          <div className="flex-1 overflow-y-auto p-4" data-testid="automations-view">
            <AutomationRulesPanel />
          </div>
        )}

        {/* Templates View */}
        {viewMode === "templates" && (
          <div className="flex-1 overflow-y-auto p-4" data-testid="templates-view">
            <PipelineTemplateSelector
              pipelineId={selectedPipelineId}
              onDealCreated={() => setViewMode("kanban")}
            />
          </div>
        )}

        {/* Forecast View */}
        {viewMode === "forecast" && (
          <div className="flex-1 overflow-y-auto" data-testid="forecast-view">
            <ForecastChart pipelineId={selectedPipelineId} />
          </div>
        )}
      </div>

      {/* Modals */}
      <DealFormModal isOpen={isDealFormOpen} onClose={handleCloseDealForm} deal={selectedDeal} />
      {selectedPipelineId && (
        <PipelineSettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} pipelineId={selectedPipelineId} />
      )}
    </div>
  );
}
