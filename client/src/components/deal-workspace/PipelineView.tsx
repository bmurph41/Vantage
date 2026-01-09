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
import { 
  DollarSign, Calendar, User, Building2, Edit2, Check, X, ArrowUpDown
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Deal, Contact, Company, PipelineStage, Pipeline } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";

type DealWithRelations = Deal & {
  contact?: Contact | null;
  company?: Company | null;
};

interface PipelineViewProps {
  searchQuery: string;
  onEditDeal: (deal: Deal) => void;
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "critical": return "bg-red-500";
    case "high": return "bg-orange-500";
    case "medium": return "bg-yellow-500";
    case "low": return "bg-green-500";
    default: return "bg-gray-500";
  }
};

const getStageColor = (stageName: string, stageColor?: string | null) => {
  if (stageColor) return stageColor;
  switch (stageName.toLowerCase()) {
    case "lead": return "#6366f1";
    case "qualified": return "#8b5cf6";
    case "proposal": return "#3b82f6";
    case "negotiation": return "#f59e0b";
    case "closed_won":
    case "closed won": return "#10b981";
    case "closed_lost":
    case "closed lost": return "#ef4444";
    default: return "#6b7280";
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
        className={`cursor-grab active:cursor-grabbing hover:shadow-lg transition-all duration-200 ${isDragging ? "shadow-2xl border-blue-400" : "hover:border-blue-200"}`}
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-gray-900 line-clamp-2">
              {deal.title}
            </h4>

            <div className="flex items-center space-x-1">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-lg font-bold text-green-700">
                {formatCurrency(Number(deal.amount) || 0)}
              </span>
            </div>

            {(deal.company || deal.contact) && (
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                {deal.company && (
                  <div className="flex items-center space-x-1">
                    <Building2 className="h-3 w-3" />
                    <span className="truncate">{deal.company.name}</span>
                  </div>
                )}
                {deal.contact && (
                  <div className="flex items-center space-x-1">
                    <User className="h-3 w-3" />
                    <span className="truncate">
                      {deal.contact.firstName} {deal.contact.lastName}
                    </span>
                  </div>
                )}
              </div>
            )}

            {deal.expectedCloseDate && (
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <Calendar className="h-3 w-3" />
                <span>{format(new Date(deal.expectedCloseDate), "MMM d, yyyy")}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              {deal.priority && (
                <Badge variant="outline" className="text-xs">
                  <div className={`w-2 h-2 rounded-full mr-1.5 ${getPriorityColor(deal.priority)}`} />
                  {deal.priority}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface StageColumnProps {
  stage: PipelineStage;
  deals: DealWithRelations[];
  onDealClick: (deal: DealWithRelations) => void;
  onUpdateStageName: (stageId: string, name: string) => void;
}

function StageColumn({ stage, deals, onDealClick, onUpdateStageName }: StageColumnProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(stage.name);
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const totalValue = deals.reduce((sum, deal) => sum + (Number(deal.amount) || 0), 0);

  const handleSaveName = () => {
    if (editedName.trim() && editedName !== stage.name) {
      onUpdateStageName(stage.id, editedName.trim());
    }
    setIsEditingName(false);
  };

  return (
    <div
      className="flex flex-col w-72 min-w-72 bg-white rounded-xl shadow-sm border border-gray-200"
      style={{ borderTopColor: getStageColor(stage.name, stage.color), borderTopWidth: '3px' }}
    >
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-1">
          {isEditingName ? (
            <div className="flex items-center gap-1 flex-1">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="h-7 text-sm font-semibold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
              />
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleSaveName}>
                <Check className="h-4 w-4 text-green-600" />
              </Button>
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setIsEditingName(false)}>
                <X className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          ) : (
            <>
              <h3 className="font-semibold text-gray-900 text-sm truncate">
                {stage.name.replace(/_/g, " ")}
              </h3>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 opacity-0 hover:opacity-100 transition-opacity"
                onClick={() => setIsEditingName(true)}
              >
                <Edit2 className="h-3 w-3 text-gray-500" />
              </Button>
              <Badge variant="secondary" className="text-xs">
                {deals.length}
              </Badge>
            </>
          )}
        </div>
        <div className="text-xs font-medium text-gray-600">
          {formatCurrency(totalValue)}
        </div>
      </div>

      <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`p-3 min-h-[500px] flex-1 transition-colors ${isOver ? "bg-blue-50" : "bg-gray-50"}`}
        >
          {deals.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              {isOver ? "Drop here" : "No deals"}
            </div>
          ) : (
            deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} onClick={() => onDealClick(deal)} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function PipelineView({ searchQuery, onEditDeal }: PipelineViewProps) {
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [sortBy, setSortBy] = useState("value");
  const [activeId, setActiveId] = useState<string | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const { data: pipelines = [] } = useQuery<Pipeline[]>({
    queryKey: ["/api/pipelines"],
  });

  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      setSelectedPipelineId(pipelines[0].id);
    }
  }, [pipelines, selectedPipelineId]);

  const { data: allStages = [] } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  const stages = useMemo(() => {
    return allStages
      .filter((stage) => stage.pipelineId === selectedPipelineId || (!stage.pipelineId && selectedPipelineId === ""))
      .sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0));
  }, [allStages, selectedPipelineId]);

  const { data: deals = [], isLoading } = useQuery<DealWithRelations[]>({
    queryKey: ["/api/deals"],
  });

  const updateDealMutation = useMutation({
    mutationFn: async ({ dealId, stageId, stage }: { dealId: string; stageId: string; stage: string }) => {
      const response = await apiRequest("PUT", `/api/deals/${dealId}`, { 
        stageId, 
        stage,
        pipelineId: selectedPipelineId || null 
      });
      return await response.json();
    },
    onMutate: async ({ dealId, stageId, stage }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/deals"] });
      const previousDeals = queryClient.getQueryData(["/api/deals"]);
      queryClient.setQueryData(["/api/deals"], (old: DealWithRelations[] = []) =>
        old.map((deal) => deal.id === dealId ? { ...deal, stageId, stage, pipelineId: selectedPipelineId || null } : deal)
      );
      return { previousDeals };
    },
    onError: (err, variables, context) => {
      if (context?.previousDeals) {
        queryClient.setQueryData(["/api/deals"], context.previousDeals);
      }
      toast({ title: "Failed to update deal", variant: "destructive" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({ title: "Deal updated successfully" });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ stageId, name }: { stageId: string; name: string }) => {
      const response = await apiRequest("PUT", `/api/pipeline-stages/${stageId}`, { name });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stages"] });
      toast({ title: "Stage updated successfully" });
    },
  });

  const filteredDeals = useMemo(() => {
    let filtered = deals.filter((deal) => {
      if (deal.isClosed) return false;
      
      const matchesSearch = !searchQuery || 
        deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.contact?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.contact?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.company?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesSearch;
    });

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
  }, [deals, searchQuery, sortBy]);

  const dealsByStage = useMemo(() => {
    const grouped: Record<string, DealWithRelations[]> = {};
    stages.forEach((stage) => {
      grouped[stage.id] = filteredDeals.filter((deal) => {
        if (deal.stageId) return deal.stageId === stage.id;
        return deal.stage === stage.name;
      });
    });
    return grouped;
  }, [stages, filteredDeals]);

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

    updateDealMutation.mutate({
      dealId,
      stageId: targetStageId,
      stage: targetStage.name,
    });

    setActiveId(null);
  };

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-3 border-b bg-white">
        {pipelines.length > 0 && (
          <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
            <SelectTrigger className="w-48 h-8" data-testid="select-pipeline">
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
        
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-36 h-8 text-sm" data-testid="select-sort">
            <ArrowUpDown className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="value">By Value</SelectItem>
            <SelectItem value="date">By Date</SelectItem>
            <SelectItem value="priority">By Priority</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-x-auto p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 min-w-max">
            {stages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage[stage.id] || []}
                onDealClick={onEditDeal}
                onUpdateStageName={(stageId, name) => updateStageMutation.mutate({ stageId, name })}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDeal ? (
              <Card className="w-72 shadow-2xl rotate-3 border-blue-400">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-sm text-gray-900">{activeDeal.title}</h4>
                  <div className="flex items-center space-x-1 mt-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-lg font-bold text-green-700">
                      {formatCurrency(Number(activeDeal.amount) || 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
