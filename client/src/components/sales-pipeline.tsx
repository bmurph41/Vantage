import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar, Clock, DollarSign, TrendingUp, Filter, Plus, MoreHorizontal, User, Settings, LayoutGrid, Edit, Trash2, Search, List, Grid3x3, HelpCircle, Sliders, Target, BarChart3, Users, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import DealFormModal from '@/components/modals/deal-form-modal';
import type { Deal, Contact, Company, PipelineStage, Pipeline } from '@shared/schema';

// Types
type DealWithRelations = Deal & { 
  contact?: Contact | null; 
  company?: Company | null; 
};

interface SalesPipelineProps {
  showFullView?: boolean;
}

// Utility functions
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount);
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'critical': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-yellow-500';
    case 'low': return 'bg-green-500';
    default: return 'bg-gray-500';
  }
};

const getInitials = (firstName?: string, lastName?: string) => {
  if (!firstName && !lastName) return 'U';
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
};

const DealCard = ({ deal, onEdit, onDelete }: { 
  deal: DealWithRelations; 
  onEdit: (deal: DealWithRelations) => void;
  onDelete: (deal: DealWithRelations) => void;
}) => {
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

  const getContactInitials = (contact?: Contact | null) => {
    if (!contact) return 'D';
    return `${contact.firstName?.[0] || ''}${contact.lastName?.[0] || ''}`.toUpperCase();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`mb-3 ${
        isDragging 
          ? 'rotate-2 scale-105 shadow-2xl z-50 opacity-80' 
          : ''
      }`}
      data-testid={`deal-card-${deal.id}`}
    >
      <Card className={`
        group relative bg-gradient-to-br from-white to-gray-50 border border-gray-200 
        shadow-md hover:shadow-lg hover:shadow-blue-100/50
        transition-all duration-300 cursor-grab active:cursor-grabbing
        hover:scale-[1.02] hover:-translate-y-1
        ${isDragging 
          ? 'border-blue-400 shadow-xl shadow-blue-200/50 bg-gradient-to-br from-blue-50 to-white' 
          : 'hover:border-blue-200'
        }
      `}>
            <CardContent className="p-5">
              {/* Deal Title */}
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-sm text-gray-900 leading-tight line-clamp-2 pr-2" 
                    data-testid={`deal-title-${deal.id}`}>
                  {deal.title}
                </h4>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-all duration-200 p-1 h-7 w-7 hover:bg-blue-50 hover:text-blue-600 rounded-full" 
                            data-testid={`deal-menu-${deal.id}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem 
                      onClick={() => onEdit(deal)}
                      className="cursor-pointer text-xs"
                      data-testid={`deal-edit-${deal.id}`}
                    >
                      <Edit className="h-3 w-3 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onDelete(deal)}
                      className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 text-xs"
                      data-testid={`deal-delete-${deal.id}`}
                    >
                      <Trash2 className="h-3 w-3 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Company/Organization Name */}
              {deal.company && (
                <div className="mb-3" data-testid={`deal-company-${deal.id}`}>
                  <div className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                    <span className="text-xs font-medium">
                      {deal.company.name}
                    </span>
                  </div>
                </div>
              )}

              {/* Deal Value */}
              <div className="mb-4" data-testid={`deal-amount-${deal.id}`}>
                <div className="flex items-center space-x-1">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-lg font-bold text-green-700">
                    {formatCurrency(Number(deal.amount) || 0)}
                  </span>
                </div>
              </div>

              {/* Contact Person with Avatar */}
              {deal.contact && (
                <div className="flex items-center justify-between" data-testid={`deal-contact-${deal.id}`}>
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-sm">
                      {getContactInitials(deal.contact)}
                    </div>
                    <span className="text-xs text-gray-600 font-medium truncate">    
                      {deal.contact.firstName} {deal.contact.lastName}
                    </span>
                  </div>
                  {deal.priority && (
                    <div className={`w-2 h-2 rounded-full ${getPriorityColor(deal.priority)}`} title={`${deal.priority} priority`}></div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
  );
};


const PipelineColumn = ({ stage, deals, onAddDeal, onEditDeal, onDeleteDeal }: { 
  stage: PipelineStage; 
  deals: DealWithRelations[]; 
  onAddDeal: (stageId: string) => void;
  onEditDeal: (deal: DealWithRelations) => void;
  onDeleteDeal: (deal: DealWithRelations) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const totalValue = deals.reduce((sum, deal) => sum + Number(deal.amount), 0);

  return (
    <div className="flex-shrink-0 w-80 bg-gradient-to-b from-white to-gray-50/50 rounded-xl border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300" 
         data-testid={`pipeline-column-${stage.name.replace(/\s+/g, '-').toLowerCase()}`}>
      {/* Enhanced Column Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-t-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color || '#3B82F6' }}></div>
            <h3 className="font-semibold text-gray-900 text-sm capitalize" data-testid={`stage-name-${stage.name.replace(/\s+/g, '-').toLowerCase()}`}>
              {stage.name.replace('_', ' ')}
            </h3>
            <div className="bg-white border border-gray-200 text-gray-700 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm" 
                 data-testid={`stage-count-${stage.name.replace(/\s+/g, '-').toLowerCase()}`}>
              {deals.length}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-600 font-medium" data-testid={`stage-value-${stage.name.replace(/\s+/g, '-').toLowerCase()}`}>
            Total: {formatCurrency(totalValue)}
          </div>
          {stage.probability && (
            <div className="text-xs text-gray-500 flex items-center space-x-1">
              <Target className="h-3 w-3" />
              <span>{stage.probability}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Drop Zone */}
      <SortableContext items={deals.map(deal => deal.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`p-4 min-h-[500px] transition-all duration-300 rounded-b-xl ${
            isOver 
              ? 'bg-gradient-to-b from-blue-50 to-blue-100/30 border-t-2 border-blue-300' 
              : 'bg-transparent'
          } ${deals.length === 0 ? 'flex items-center justify-center' : ''}`}
          data-testid={`stage-drop-zone-${stage.name.replace(/\s+/g, '-').toLowerCase()}`}
        >
          {deals.length === 0 && !isOver && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <Plus className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-3">No deals yet</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs h-8 px-4 border-dashed border-2 hover:border-solid hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all duration-200"
                onClick={() => onAddDeal(stage.id)}
                data-testid={`add-deal-${stage.name.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Deal
              </Button>
            </div>
          )}
          
          {isOver && deals.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-blue-300 border-dashed animate-pulse">
                <Zap className="h-10 w-10 text-blue-600" />
              </div>
              <p className="text-blue-600 font-semibold text-sm">Drop deal here!</p>
              <p className="text-blue-500 text-xs mt-1">Release to move to this stage</p>
            </div>
          )}
          
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} onEdit={onEditDeal} onDelete={onDeleteDeal} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
};

export default function SalesPipeline({ showFullView = false }: SalesPipelineProps) {
  const queryClient = useQueryClient();
  const [isDealFormOpen, setIsDealFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealWithRelations | null>(null);
  const [newDealStageId, setNewDealStageId] = useState<string>('');
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const { toast } = useToast();

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Fetch pipelines
  const { data: pipelines = [] } = useQuery<Pipeline[]>({
    queryKey: ['/api/pipelines'],
  });

  // Set default pipeline when pipelines are loaded
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipelineId) {
      setSelectedPipelineId(pipelines[0].id);
    }
  }, [pipelines, selectedPipelineId]);

  // Fetch pipeline stages for selected pipeline
  const { data: allStages = [] } = useQuery<PipelineStage[]>({
    queryKey: ['/api/pipeline-stages'],
  });

  // Filter stages for selected pipeline
  const stages = allStages.filter(stage => 
    stage.pipelineId === selectedPipelineId || (!stage.pipelineId && selectedPipelineId === '')
  );

  // Fetch deals
  const { data: deals = [], isLoading } = useQuery<DealWithRelations[]>({
    queryKey: ['/api/deals'],
  });

  // Update deal stage mutation
  const updateDealMutation = useMutation({
    mutationFn: ({ dealId, stageId, pipelineId }: { dealId: string; stageId: string; pipelineId?: string }) => {
      // Find the stage to get legacy stage name for backward compatibility
      const stage = allStages.find(s => s.id === stageId);
      const updateData: any = { stageId };
      
      // Include pipelineId if provided
      if (pipelineId) {
        updateData.pipelineId = pipelineId;
      }
      
      // Include legacy stage name for backward compatibility
      if (stage) {
        updateData.stage = stage.name;
      }
      
      return apiRequest('PUT', `/api/deals/${dealId}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      toast({ title: "Deal updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update deal", variant: "destructive" });
    },
  });

  // Delete deal mutation
  const deleteDealMutation = useMutation({
    mutationFn: async (dealId: string) => {
      return await apiRequest('DELETE', `/api/deals/${dealId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      toast({ title: "Deal deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete deal", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Group deals by stage ID (with fallback to legacy stage name)
  const dealsByStage = stages.reduce((acc: Record<string, DealWithRelations[]>, stage: PipelineStage) => {
    // Use stageId as the key for grouping
    acc[stage.id] = deals.filter((deal: DealWithRelations) => {
      // First try to match by stageId (new approach)
      if (deal.stageId) {
        return deal.stageId === stage.id;
      }
      // Fallback to legacy stage name matching for backward compatibility
      return deal.stage === stage.name;
    });
    return acc;
  }, {});

  // Pipeline statistics
  const totalPipelineValue = deals.reduce((sum: number, deal: DealWithRelations) => sum + Number(deal.amount), 0);
  const totalDeals = deals.length;
  const avgDealSize = totalDeals > 0 ? totalPipelineValue / totalDeals : 0;
  const weightedValue = deals.reduce((sum: number, deal: DealWithRelations) => sum + (Number(deal.amount) * (deal.probability || 0) / 100), 0);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const dealId = active.id as string;
    const targetStageId = over.id as string;

    // Find the deal being moved
    const deal = deals.find((d: DealWithRelations) => d.id === dealId);
    if (!deal) return;

    // Check if deal is already in target stage
    const currentStageId = deal.stageId || 
      stages.find(s => s.name === deal.stage)?.id;
    if (currentStageId === targetStageId) return;

    // Update the deal stage
    updateDealMutation.mutate({ 
      dealId, 
      stageId: targetStageId,
      pipelineId: selectedPipelineId
    });
  };

  const handleAddDeal = (stageId: string) => {
    setNewDealStageId(stageId);
    setEditingDeal(null);
    setIsDealFormOpen(true);
  };

  const handleEditDeal = (deal: DealWithRelations) => {
    setEditingDeal(deal);
    setNewDealStageId('');
    setIsDealFormOpen(true);
  };

  const handleDeleteDeal = (deal: DealWithRelations) => {
    if (confirm(`Are you sure you want to delete the deal "${deal.title}"? This action cannot be undone.`)) {
      deleteDealMutation.mutate(deal.id);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`${showFullView ? 'h-full bg-gradient-to-br from-gray-50 to-gray-100' : ''}`} data-testid="sales-pipeline">
      {showFullView && (
        <>
          {/* Enhanced Header */}
          <div className="bg-gradient-to-r from-white to-blue-50/30 border-b border-gray-200 px-6 py-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-md">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900" data-testid="pipeline-title">Sales Pipeline</h1>
                </div>
                <div className="flex items-center space-x-2">
                  <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input 
                    placeholder="Search deals..." 
                    className="pl-10 w-72 h-10 text-sm border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg shadow-sm"
                    data-testid="search-deals"
                  />
                </div>
                
                {/* View Toggle */}
                <div className="flex items-center border border-gray-300 rounded-lg shadow-sm">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-9 px-3 text-xs rounded-r-none border-r border-gray-300 hover:bg-gray-50"
                    data-testid="table-view-button"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-9 px-3 text-xs rounded-l-none bg-blue-50 text-blue-700 hover:bg-blue-100"
                    data-testid="board-view-button"
                  >
                    <Grid3x3 className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Filter Button */}
                <Button variant="outline" size="sm" className="h-9 text-xs shadow-sm hover:shadow-md transition-shadow" data-testid="filter-button">
                  <Sliders className="h-4 w-4 mr-2" />
                  Filter
                </Button>
                
                {/* Add Deal Button */}
                <Button 
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 h-9 text-xs shadow-md hover:shadow-lg transition-all duration-200" 
                  size="sm" 
                  onClick={() => {
                    setNewDealStageId('');
                    setIsDealFormOpen(true);
                  }}
                  data-testid="add-deal-button"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Deal
                </Button>
              </div>
            </div>

            {/* Pipeline Statistics Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-white to-green-50/30 border border-green-200/50 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Total Value</p>
                      <p className="text-2xl font-bold text-green-700">{formatCurrency(totalPipelineValue)}</p>
                    </div>
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-white to-blue-50/30 border border-blue-200/50 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Active Deals</p>
                      <p className="text-2xl font-bold text-blue-700">{totalDeals}</p>
                    </div>
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Target className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-white to-purple-50/30 border border-purple-200/50 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-purple-600 uppercase tracking-wide">Avg Deal Size</p>
                      <p className="text-2xl font-bold text-purple-700">{formatCurrency(avgDealSize)}</p>
                    </div>
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-white to-orange-50/30 border border-orange-200/50 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-orange-600 uppercase tracking-wide">Weighted Value</p>
                      <p className="text-2xl font-bold text-orange-700">{formatCurrency(weightedValue)}</p>
                    </div>
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Enhanced Pipeline Board */}
      <div className={`p-8 overflow-x-auto bg-gradient-to-br from-gray-50 to-gray-100/50 ${showFullView ? 'flex-1' : ''}`} 
           data-testid="pipeline-board">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex space-x-6 min-w-max pb-8">
            {stages
              .sort((a: PipelineStage, b: PipelineStage) => a.stageOrder - b.stageOrder)
              .map((stage: PipelineStage) => (
                <PipelineColumn
                  key={stage.id}
                  stage={stage}
                  deals={dealsByStage[stage.id] || []}
                  onAddDeal={handleAddDeal}
                  onEditDeal={handleEditDeal}
                  onDeleteDeal={handleDeleteDeal}
                />
              ))}
          </div>
          
          <DragOverlay>
            {activeId ? (
              <div className="rotate-2 scale-110 drop-shadow-2xl">
                <DealCard
                  deal={deals.find(d => d.id === activeId)!}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <DealFormModal
        isOpen={isDealFormOpen}
        onClose={() => {
          setIsDealFormOpen(false);
          setEditingDeal(null);
          setNewDealStageId('');
        }}
        deal={editingDeal}
        defaultStage={newDealStageId}
      />
    </div>
  );
}
