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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, 
  Plus, 
  LayoutGrid, 
  List, 
  SlidersHorizontal,
  DollarSign,
  Calendar,
  User,
  Building2,
  TrendingUp,
  Filter,
  ArrowUpDown,
  Settings2,
  Edit2,
  Check,
  X,
  ExternalLink,
  Timer,
  AlertTriangle,
  Target,
  BarChart3,
  Award,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import DealFormModal from "@/components/modals/deal-form-modal";
import PipelineSettingsModal from "@/components/modals/pipeline-settings-modal";
import type { Deal, Contact, Company, PipelineStage, Pipeline } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import MarinaMapEmbed from "@/components/marina-map/MarinaMapEmbed";
import { Map } from "lucide-react";

type DealWithRelations = Deal & {
  contact?: Contact | null;
  company?: Company | null;
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "critical":
      return "bg-red-500";
    case "high":
      return "bg-orange-500";
    case "medium":
      return "bg-yellow-500";
    case "low":
      return "bg-green-500";
    default:
      return "bg-gray-500";
  }
};

const getPriorityVariant = (priority: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (priority) {
    case "critical":
    case "high":
      return "destructive";
    case "medium":
      return "default";
    case "low":
      return "secondary";
    default:
      return "outline";
  }
};

const getInitials = (firstName?: string, lastName?: string) => {
  if (!firstName && !lastName) return "U";
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
};

const calculateDaysInStage = (currentStageEnteredAt?: Date | string | null) => {
  if (!currentStageEnteredAt) return 0;
  const enteredDate = new Date(currentStageEnteredAt);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - enteredDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getStageColor = (stageName: string, stageColor?: string | null) => {
  if (stageColor) return stageColor;
  
  switch (stageName.toLowerCase()) {
    case "lead":
      return "#6366f1";
    case "qualified":
      return "#8b5cf6";
    case "proposal":
      return "#3b82f6";
    case "negotiation":
      return "#f59e0b";
    case "closed_won":
    case "closed won":
      return "#10b981";
    case "closed_lost":
    case "closed lost":
      return "#ef4444";
    default:
      return "#6b7280";
  }
};

interface DealCardProps {
  deal: DealWithRelations;
  onClick: () => void;
}

function DealCard({ deal, onClick }: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`mb-3 ${isDragging ? "opacity-50 scale-105 rotate-2" : ""}`}
      data-testid={`deal-card-${deal.id}`}
    >
      <Card
        className={`
          cursor-grab active:cursor-grabbing hover:shadow-lg transition-all duration-200
          ${isDragging ? "shadow-2xl border-blue-400" : "hover:border-blue-200"}
        `}
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Deal Title */}
            <h4 
              className="font-semibold text-sm text-gray-900 line-clamp-2"
              data-testid={`deal-title-${deal.id}`}
            >
              {deal.title}
            </h4>

            {/* Deal Value */}
            <div 
              className="flex items-center space-x-1"
              data-testid={`deal-value-${deal.id}`}
            >
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-lg font-bold text-green-700">
                {formatCurrency(Number(deal.amount) || 0)}
              </span>
            </div>

            {/* Company/Contact */}
            {(deal.company || deal.contact) && (
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                {deal.company && (
                  <div 
                    className="flex items-center space-x-1"
                    data-testid={`deal-company-${deal.id}`}
                  >
                    <Building2 className="h-3 w-3" />
                    <span className="truncate">{deal.company.name}</span>
                  </div>
                )}
                {deal.contact && (
                  <div 
                    className="flex items-center space-x-1"
                    data-testid={`deal-contact-${deal.id}`}
                  >
                    <User className="h-3 w-3" />
                    <span className="truncate">
                      {deal.contact.firstName} {deal.contact.lastName}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Commission Amount */}
            {deal.commissionAmount && Number(deal.commissionAmount) > 0 && (
              <div 
                className="flex items-center space-x-1 text-xs text-purple-600 font-medium bg-purple-50 px-2 py-1 rounded"
                data-testid={`deal-commission-${deal.id}`}
                title="Commission"
              >
                <DollarSign className="h-3 w-3" />
                <span>{formatCurrency(Number(deal.commissionAmount))} comm.</span>
              </div>
            )}

            {/* Days in Current Stage */}
            {deal.currentStageEnteredAt && (
              <div 
                className="flex items-center space-x-1 text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded"
                data-testid={`deal-days-in-stage-${deal.id}`}
                title="Days in current stage"
              >
                <Calendar className="h-3 w-3" />
                <span>{calculateDaysInStage(deal.currentStageEnteredAt)} {calculateDaysInStage(deal.currentStageEnteredAt) === 1 ? 'day' : 'days'} in stage</span>
              </div>
            )}

            {/* Expected Close Date */}
            {deal.expectedCloseDate && (
              <div 
                className="flex items-center space-x-1 text-xs text-gray-500"
                data-testid={`deal-close-date-${deal.id}`}
              >
                <Calendar className="h-3 w-3" />
                <span>{format(new Date(deal.expectedCloseDate), "MMM dd, yyyy")}</span>
              </div>
            )}

            {/* Priority Badge & Owner */}
            <div className="flex items-center justify-between">
              {deal.priority && (
                <Badge 
                  variant={getPriorityVariant(deal.priority)}
                  className="text-xs"
                  data-testid={`deal-priority-${deal.id}`}
                >
                  {deal.priority}
                </Badge>
              )}
              
              {/* Deal Owner Avatar */}
              <div 
                className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-sm"
                data-testid={`deal-owner-${deal.id}`}
                title={deal.contact ? `${deal.contact.firstName || ''} ${deal.contact.lastName || ''}`.trim() || "Deal Owner" : "Deal Owner"}
              >
                {getInitials(deal.contact?.firstName, deal.contact?.lastName)}
              </div>
            </div>

            {/* Cross-Module Links */}
            {(deal.contactId || deal.companyId || deal.propertyId) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {deal.contactId && (
                  <Link
                    href={`/crm/contacts/${deal.contactId}`}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors">
                      <User className="h-2.5 w-2.5 mr-0.5" />
                      Contact
                      <ExternalLink className="h-2 w-2 ml-0.5" />
                    </Badge>
                  </Link>
                )}
                {deal.companyId && (
                  <Link
                    href={`/crm/companies/${deal.companyId}`}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-purple-50 hover:border-purple-300 transition-colors">
                      <Building2 className="h-2.5 w-2.5 mr-0.5" />
                      Company
                      <ExternalLink className="h-2 w-2 ml-0.5" />
                    </Badge>
                  </Link>
                )}
                {deal.propertyId && (
                  <Link
                    href={`/crm/properties/${deal.propertyId}`}
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-green-50 hover:border-green-300 transition-colors">
                      <Building2 className="h-2.5 w-2.5 mr-0.5" />
                      Property
                      <ExternalLink className="h-2 w-2 ml-0.5" />
                    </Badge>
                  </Link>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface PipelineColumnProps {
  stage: PipelineStage;
  deals: DealWithRelations[];
  onDealClick: (deal: DealWithRelations) => void;
}

function PipelineColumn({ stage, deals, onDealClick }: PipelineColumnProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(stage.name);
  const { toast } = useToast();

  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const totalValue = deals.reduce((sum, deal) => sum + Number(deal.amount || 0), 0);

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

  const handleCancelEdit = () => {
    setEditedName(stage.name);
    setIsEditingName(false);
  };

  return (
    <div
      className="flex-shrink-0 w-80 bg-white rounded-lg border border-gray-200 shadow-sm"
      data-testid={`pipeline-column-${stage.name.replace(/\s+/g, "-").toLowerCase()}`}
    >
      {/* Column Header */}
      <div 
        className="px-4 py-3 border-b border-gray-200"
        style={{ 
          backgroundColor: `${getStageColor(stage.name, stage.color)}15`,
          borderTopColor: getStageColor(stage.name, stage.color),
          borderTopWidth: "3px",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: getStageColor(stage.name, stage.color) }}
            />
            {isEditingName ? (
              <div className="flex items-center gap-1 flex-1">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="h-7 text-sm font-semibold"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                  data-testid={`input-edit-stage-${stage.name.replace(/\s+/g, "-").toLowerCase()}`}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={handleSaveName}
                  data-testid={`button-save-stage-${stage.name.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={handleCancelEdit}
                  data-testid={`button-cancel-stage-${stage.name.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ) : (
              <>
                <h3 
                  className="font-semibold text-gray-900 text-sm truncate"
                  data-testid={`stage-name-${stage.name.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {stage.name.replace(/_/g, " ")}
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 opacity-0 hover:opacity-100 transition-opacity"
                  onClick={() => setIsEditingName(true)}
                  data-testid={`button-edit-stage-name-${stage.name.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  <Edit2 className="h-3 w-3 text-gray-500" />
                </Button>
                <Badge 
                  variant="secondary" 
                  className="text-xs"
                  data-testid={`stage-count-${stage.name.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {deals.length}
                </Badge>
              </>
            )}
          </div>
        </div>
        <div 
          className="text-xs font-medium text-gray-600"
          data-testid={`stage-value-${stage.name.replace(/\s+/g, "-").toLowerCase()}`}
        >
          {formatCurrency(totalValue)}
        </div>
        {deals.length > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-1">
            <Timer className="h-3 w-3" />
            <span>
              Avg {Math.round(deals.reduce((sum, d) => sum + calculateDaysInStage(d.currentStageEnteredAt), 0) / deals.length)}d in stage
            </span>
          </div>
        )}
      </div>

      {/* Drop Zone */}
      <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`p-3 min-h-[600px] transition-colors ${
            isOver ? "bg-blue-50" : "bg-gray-50"
          }`}
          data-testid={`stage-drop-zone-${stage.name.replace(/\s+/g, "-").toLowerCase()}`}
        >
          {deals.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              {isOver ? "Drop here" : "No deals"}
            </div>
          ) : (
            deals.map((deal) => (
              <DealCard 
                key={deal.id} 
                deal={deal} 
                onClick={() => onDealClick(deal)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function Pipeline() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [sortBy, setSortBy] = useState("value");
  const [viewMode, setViewMode] = useState<"kanban" | "list" | "map">("kanban");
  const [isDealFormOpen, setIsDealFormOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<DealWithRelations | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    commissionMin: "",
    commissionMax: "",
    hasCommission: false,
  });
  const { toast} = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch pipelines
  const { data: pipelines = [] } = useQuery<Pipeline[]>({
    queryKey: ["/api/pipelines"],
  });

  // Set default pipeline
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      setSelectedPipelineId(pipelines[0].id);
    }
  }, [pipelines, selectedPipelineId]);

  // Fetch pipeline stages
  const { data: allStages = [] } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  // Filter stages for selected pipeline
  const stages = useMemo(() => {
    return allStages
      .filter((stage) => 
        stage.pipelineId === selectedPipelineId || 
        (!stage.pipelineId && selectedPipelineId === "")
      )
      .sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0));
  }, [allStages, selectedPipelineId]);

  // Fetch deals
  const { data: deals = [], isLoading } = useQuery<DealWithRelations[]>({
    queryKey: ["/api/deals"],
  });

  // Update deal mutation
  const updateDealMutation = useMutation({
    mutationFn: async ({ dealId, stageId, stage }: { dealId: string; stageId: string; stage: string }) => {
      const response = await apiRequest("PUT", `/api/deals/${dealId}`, { 
        stageId, 
        stage,
        pipelineId: selectedPipelineId || null 
      });
      const data = await response.json();
      return data;
    },
    onMutate: async ({ dealId, stageId, stage }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/deals"] });

      // Snapshot previous value
      const previousDeals = queryClient.getQueryData(["/api/deals"]);

      // Optimistically update both stageId and stage
      queryClient.setQueryData(["/api/deals"], (old: DealWithRelations[] = []) =>
        old.map((deal) =>
          deal.id === dealId ? { ...deal, stageId, stage, pipelineId: selectedPipelineId || null } : deal
        )
      );

      return { previousDeals };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousDeals) {
        queryClient.setQueryData(["/api/deals"], context.previousDeals);
      }
      toast({
        title: "Failed to update deal",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({
        title: "Deal updated successfully",
      });
    },
  });

  // Filter and sort deals
  const filteredDeals = useMemo(() => {
    let filtered = deals.filter((deal) => {
      const matchesSearch =
        deal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.contact?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.contact?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.company?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Commission filters
      const commissionAmount = Number(deal.commissionAmount || 0);
      const matchesCommissionMin = !filters.commissionMin || commissionAmount >= Number(filters.commissionMin);
      const matchesCommissionMax = !filters.commissionMax || commissionAmount <= Number(filters.commissionMax);
      const matchesHasCommission = !filters.hasCommission || commissionAmount > 0;

      return matchesSearch && matchesCommissionMin && matchesCommissionMax && matchesHasCommission;
    });

    // Sort deals
    if (sortBy === "value") {
      filtered.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
    } else if (sortBy === "date") {
      filtered.sort((a, b) => {
        const dateA = a.expectedCloseDate ? new Date(a.expectedCloseDate).getTime() : 0;
        const dateB = b.expectedCloseDate ? new Date(b.expectedCloseDate).getTime() : 0;
        return dateB - dateA;
      });
    } else if (sortBy === "priority") {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      filtered.sort((a, b) => {
        const priorityA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4;
        const priorityB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4;
        return priorityA - priorityB;
      });
    }

    return filtered;
  }, [deals, searchTerm, sortBy, filters]);

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const grouped: Record<string, DealWithRelations[]> = {};
    
    stages.forEach((stage) => {
      grouped[stage.id] = filteredDeals.filter((deal) => {
        if (deal.stageId) {
          return deal.stageId === stage.id;
        }
        // Fallback to legacy stage name
        return deal.stage === stage.name;
      });
    });
    
    return grouped;
  }, [stages, filteredDeals]);

  const pipelineKpis = useMemo(() => {
    const isOpenDeal = (deal: DealWithRelations) => {
      const stageName = (deal.stage || "").toLowerCase().replace(/[_\s]/g, "");
      return stageName !== "closedwon" && stageName !== "won" && stageName !== "closedlost" && stageName !== "lost";
    };
    const isWonDeal = (deal: DealWithRelations) => {
      const stageName = (deal.stage || "").toLowerCase().replace(/[_\s]/g, "");
      return stageName === "closedwon" || stageName === "won";
    };
    const isLostDeal = (deal: DealWithRelations) => {
      const stageName = (deal.stage || "").toLowerCase().replace(/[_\s]/g, "");
      return stageName === "closedlost" || stageName === "lost";
    };

    const openDeals = deals.filter(isOpenDeal);
    const wonDeals = deals.filter(isWonDeal);
    const lostDeals = deals.filter(isLostDeal);

    const totalPipelineValue = openDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const weightedValue = openDeals.reduce((sum, d) => {
      const amount = Number(d.amount || 0);
      const prob = (d.probability ?? 10) / 100;
      return sum + amount * prob;
    }, 0);
    const avgDealSize = openDeals.length > 0 ? totalPipelineValue / openDeals.length : 0;
    const totalClosed = wonDeals.length + lostDeals.length;
    const winRate = totalClosed > 0 ? (wonDeals.length / totalClosed) * 100 : 0;
    const avgDaysInStage = openDeals.length > 0
      ? Math.round(openDeals.reduce((sum, d) => sum + calculateDaysInStage(d.currentStageEnteredAt), 0) / openDeals.length)
      : 0;
    const dealsAtRisk = openDeals.filter(d => calculateDaysInStage(d.currentStageEnteredAt) > 30).length;

    return { totalPipelineValue, weightedValue, avgDealSize, winRate, avgDaysInStage, dealsAtRisk };
  }, [deals]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const dealId = active.id as string;
    
    // Get target stage ID from the container (column) ID
    // This works whether dropping on empty space or on another deal
    const targetStageId = (over.data.current?.sortable?.containerId || over.id) as string;

    const deal = deals.find((d) => d.id === dealId);
    if (!deal) {
      setActiveId(null);
      return;
    }

    const currentStageId = deal.stageId || stages.find((s) => s.name === deal.stage)?.id;
    if (currentStageId === targetStageId) {
      setActiveId(null);
      return;
    }

    const targetStage = stages.find((s) => s.id === targetStageId);
    if (!targetStage) {
      setActiveId(null);
      return;
    }

    // Perform optimistic update immediately
    updateDealMutation.mutate({
      dealId,
      stageId: targetStageId,
      stage: targetStage.name,
    });

    // Clear drag overlay immediately - optimistic update handles the transition
    setActiveId(null);
  };

  const handleDealClick = (deal: DealWithRelations) => {
    setSelectedDeal(deal);
    setIsDealFormOpen(true);
  };

  const handleAddNewDeal = () => {
    setSelectedDeal(null);
    setIsDealFormOpen(true);
  };

  const handleCloseDealForm = () => {
    setIsDealFormOpen(false);
    setSelectedDeal(null);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Main Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900" data-testid="pipeline-title">
              Sales Pipeline
            </h1>
            {/* Pipeline Selector */}
            {pipelines.length > 0 && (
              <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                <SelectTrigger className="w-48" data-testid="select-pipeline">
                  <SelectValue placeholder="Select pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* Controls Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left controls */}
          <div className="flex items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search deals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9 text-sm"
                data-testid="input-search-deals"
              />
            </div>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-36 h-9 text-sm" data-testid="select-sort">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="value">By Value</SelectItem>
                <SelectItem value="date">By Date</SelectItem>
                <SelectItem value="priority">By Priority</SelectItem>
              </SelectContent>
            </Select>

            {/* View Toggle */}
            <div className="flex items-center border border-gray-300 rounded-md">
              <Button
                variant="ghost"
                size="sm"
                className={`rounded-r-none h-9 text-sm ${viewMode === "kanban" ? "bg-gray-100" : ""}`}
                onClick={() => setViewMode("kanban")}
                data-testid="button-view-kanban"
              >
                <LayoutGrid className="w-4 h-4 mr-1" />
                Kanban
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`border-l h-9 text-sm ${viewMode === "list" ? "bg-gray-100" : ""}`}
                onClick={() => setViewMode("list")}
                data-testid="button-view-list"
              >
                <List className="w-4 h-4 mr-1" />
                List
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`rounded-l-none border-l h-9 text-sm ${viewMode === "map" ? "bg-gray-100" : ""}`}
                onClick={() => setViewMode("map")}
                data-testid="button-view-map"
              >
                <Map className="w-4 h-4 mr-1" />
                Map
              </Button>
            </div>

            {/* Filter Popover */}
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={`h-9 text-sm ${(filters.commissionMin || filters.commissionMax || filters.hasCommission) ? 'bg-blue-50 border-blue-300' : ''}`} 
                  data-testid="button-filter"
                >
                  <Filter className="w-4 h-4 mr-1" />
                  Filter
                  {(filters.commissionMin || filters.commissionMax || filters.hasCommission) && (
                    <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">Active</Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="start">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm mb-3">Filter Deals</h4>
                  </div>

                  {/* Commission Range */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Commission Amount</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-gray-500">Min</Label>
                        <Input
                          type="number"
                          placeholder="$0"
                          value={filters.commissionMin}
                          onChange={(e) => setFilters({ ...filters, commissionMin: e.target.value })}
                          className="h-8"
                          data-testid="input-commission-min"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Max</Label>
                        <Input
                          type="number"
                          placeholder="No limit"
                          value={filters.commissionMax}
                          onChange={(e) => setFilters({ ...filters, commissionMax: e.target.value })}
                          className="h-8"
                          data-testid="input-commission-max"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 mt-2">
                      <Checkbox
                        id="has-commission"
                        checked={filters.hasCommission}
                        onCheckedChange={(checked) => 
                          setFilters({ ...filters, hasCommission: checked as boolean })
                        }
                        data-testid="checkbox-has-commission"
                      />
                      <Label htmlFor="has-commission" className="text-sm cursor-pointer">
                        Only show deals with commission
                      </Label>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFilters({ commissionMin: "", commissionMax: "", hasCommission: false });
                      }}
                      data-testid="button-clear-filters"
                    >
                      Clear All
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setIsFilterOpen(false)}
                      data-testid="button-apply-filters"
                    >
                      Apply Filters
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Pipeline Settings Button */}
            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 text-sm" 
              onClick={() => setIsSettingsOpen(true)}
              data-testid="button-pipeline-settings"
            >
              <Settings2 className="w-4 h-4 mr-1" />
              Manage Stages
            </Button>

            {/* Add Deal Button */}
            <Button 
              className="bg-blue-600 hover:bg-blue-700 h-9 text-sm" 
              size="sm"
              onClick={handleAddNewDeal}
              data-testid="button-add-deal"
            >
              <Plus className="w-4 h-4 mr-1" />
              New Deal
            </Button>
          </div>
        </div>
      </div>

      {/* Pipeline KPI Summary Bar */}
      {!isLoading && (
        <div className="bg-gray-100 border-b border-gray-200 px-6 py-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-gray-500">Total Pipeline</span>
                  <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
                    <DollarSign className="h-3.5 w-3.5 text-green-600" />
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(pipelineKpis.totalPipelineValue)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-gray-500">Weighted Value</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Target className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(pipelineKpis.weightedValue)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-gray-500">Avg Deal Size</span>
                  <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
                    <BarChart3 className="h-3.5 w-3.5 text-purple-600" />
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(pipelineKpis.avgDealSize)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-gray-500">Win Rate</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Award className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-900">{pipelineKpis.winRate.toFixed(1)}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-gray-500">Avg Days in Stage</span>
                  <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Timer className="h-3.5 w-3.5 text-orange-600" />
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-900">{pipelineKpis.avgDaysInStage}d</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-gray-500">Deals at Risk</span>
                  <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-900">{pipelineKpis.dealsAtRisk}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {/* Kanban View */}
        {viewMode === "kanban" && (
          <div className="overflow-x-auto overflow-y-hidden p-6 h-full" data-testid="kanban-board">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex space-x-4 h-full">
                {stages.map((stage) => (
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
                    <DealCard
                      deal={deals.find((d) => d.id === activeId)!}
                      onClick={() => {}}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}

        {/* List View */}
        {viewMode === "map" && (
          <div className="flex-1 overflow-hidden" data-testid="map-view">
            <MarinaMapEmbed
              source="pipeline"
              markerColor="#FF5722"
              sourceLabel="Pipeline Deals"
              height="calc(100vh - 220px)"
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

        {viewMode === "list" && (
          <div className="flex-1 overflow-y-auto p-6" data-testid="list-view">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Close Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredDeals.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <List className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">No deals found</h3>
                        <p className="text-gray-500">Try adjusting your search or filters.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredDeals.map((deal) => {
                      const stageInfo = stages.find(s => s.id === deal.stageId || s.name === deal.stage);
                      return (
                        <tr 
                          key={deal.id} 
                          onClick={() => handleDealClick(deal)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          data-testid={`list-deal-${deal.id}`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{deal.title}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {deal.contact ? (
                              deal.contactId ? (
                                <Link
                                  href={`/crm/contacts/${deal.contactId}`}
                                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                >
                                  <div className="flex items-center space-x-2 hover:text-blue-600 transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                                      {getInitials(deal.contact.firstName, deal.contact.lastName)}
                                    </div>
                                    <span className="text-sm text-gray-900 hover:text-blue-600">
                                      {deal.contact.firstName} {deal.contact.lastName}
                                    </span>
                                    <ExternalLink className="h-3 w-3 text-gray-400" />
                                  </div>
                                </Link>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                                    {getInitials(deal.contact.firstName, deal.contact.lastName)}
                                  </div>
                                  <span className="text-sm text-gray-900">
                                    {deal.contact.firstName} {deal.contact.lastName}
                                  </span>
                                </div>
                              )
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {deal.company ? (
                              deal.companyId ? (
                                <Link
                                  href={`/crm/companies/${deal.companyId}`}
                                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                >
                                  <div className="flex items-center space-x-2 hover:text-blue-600 transition-colors">
                                    <Building2 className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm text-gray-900 hover:text-blue-600">{deal.company.name}</span>
                                    <ExternalLink className="h-3 w-3 text-gray-400" />
                                  </div>
                                </Link>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <Building2 className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm text-gray-900">{deal.company.name}</span>
                                </div>
                              )
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-1">
                              <DollarSign className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-semibold text-gray-900">
                                {formatCurrency(Number(deal.amount || 0))}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {deal.commissionAmount && Number(deal.commissionAmount) > 0 ? (
                              <div className="flex items-center space-x-1">
                                <DollarSign className="w-4 h-4 text-purple-500" />
                                <span className="text-sm font-semibold text-purple-700">
                                  {formatCurrency(Number(deal.commissionAmount))}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <Badge 
                              style={{ 
                                backgroundColor: `${getStageColor(stageInfo?.name || deal.stage || '', stageInfo?.color)}20`,
                                color: getStageColor(stageInfo?.name || deal.stage || '', stageInfo?.color),
                                borderColor: getStageColor(stageInfo?.name || deal.stage || '', stageInfo?.color)
                              }}
                              className="border"
                            >
                              {stageInfo?.name || deal.stage || 'Unknown'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            {deal.expectedCloseDate ? (
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-900">
                                  {format(new Date(deal.expectedCloseDate), "MMM d, yyyy")}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={getPriorityVariant(deal.priority)}>
                              {deal.priority}
                            </Badge>
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
      </div>

      {/* Deal Form Modal */}
      <DealFormModal
        isOpen={isDealFormOpen}
        onClose={handleCloseDealForm}
        deal={selectedDeal}
      />

      {/* Pipeline Settings Modal */}
      {selectedPipelineId && (
        <PipelineSettingsModal
          open={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          pipelineId={selectedPipelineId}
        />
      )}
    </div>
  );
}
