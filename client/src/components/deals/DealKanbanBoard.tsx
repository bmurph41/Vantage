import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SortableKanban } from '@/components/dnd/SortableKanban';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Calendar, AlertTriangle, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Deal, Contact, Company, PipelineStage } from '@shared/schema';
import { format, differenceInDays } from 'date-fns';
import { formatCurrency } from '@/lib/utils';

type DealWithRelations = Deal & { contact?: Contact | null; company?: Company | null };

interface DealKanbanBoardProps {
  deals: DealWithRelations[];
  stages: PipelineStage[];
  onDealClick: (deal: DealWithRelations) => void;
}

function DealCard({ deal, onDealClick }: { deal: DealWithRelations; onDealClick: (deal: DealWithRelations) => void }) {
  const daysInStage = deal.currentStageEnteredAt 
    ? differenceInDays(new Date(), new Date(deal.currentStageEnteredAt))
    : 0;
  
  const isStale = daysInStage > 14;
  const isOverdue = deal.expectedCloseDate && new Date(deal.expectedCloseDate) < new Date();

  return (
    <Card 
      className="w-full shadow-sm hover:shadow-md transition-all cursor-pointer group"
      onClick={() => onDealClick(deal)}
      data-testid={`kanban-deal-${deal.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">
            {deal.title}
          </h4>
          {deal.priority && (
            <Badge 
              variant={deal.priority === 'high' || deal.priority === 'critical' ? 'destructive' : deal.priority === 'medium' ? 'default' : 'secondary'}
              className="text-xs px-1.5 py-0.5 shrink-0"
            >
              {deal.priority}
            </Badge>
          )}
        </div>

        {deal.company && (
          <p className="text-xs text-gray-600 mb-2 truncate">
            {deal.company.name}
          </p>
        )}

        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
          <DollarSign className="h-3.5 w-3.5 text-green-600" />
          {formatCurrency(Number(deal.amount) || 0)}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          {deal.expectedCloseDate && (
            <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600' : ''}`}>
              <Calendar className="h-3 w-3" />
              {format(new Date(deal.expectedCloseDate), 'MMM d')}
              {isOverdue && <AlertTriangle className="h-3 w-3" />}
            </div>
          )}
          
          <div className={`flex items-center gap-1 ${isStale ? 'text-amber-600' : ''}`}>
            <Clock className="h-3 w-3" />
            {daysInStage}d
          </div>
        </div>

        {deal.contact && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
            <div className="w-5 h-5 bg-gray-400 rounded-full flex items-center justify-center text-white text-[10px] font-medium">
              {deal.contact.firstName?.[0]?.toUpperCase()}{deal.contact.lastName?.[0]?.toUpperCase()}
            </div>
            <span className="text-xs text-gray-600 truncate">
              {deal.contact.firstName} {deal.contact.lastName}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DealKanbanBoard({ deals, stages, onDealClick }: DealKanbanBoardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateDealsMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; stageId: string; stageOrder: number }>) => {
      const promises = updates.map(update => 
        apiRequest(`/api/crm/deals/${update.id}`, {
          method: 'PUT',
          body: JSON.stringify({ 
            stageId: update.stageId,
            stageOrder: update.stageOrder,
          }),
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/deals'] });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to move deal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const sortedStages = useMemo(() => {
    return [...stages]
      .filter(s => s.isActive !== false)
      .sort((a, b) => a.stageOrder - b.stageOrder);
  }, [stages]);

  const columns = useMemo(() => {
    return sortedStages.map(stage => {
      const stageDeals = deals
        .filter(d => d.stageId === stage.id && !d.isClosed)
        .sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0));

      const totalValue = stageDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

      return {
        id: stage.id,
        title: stage.name,
        color: stage.color || '#3B82F6',
        probability: stage.probability || 0,
        totalValue,
        items: stageDeals.map(deal => ({
          id: deal.id,
          title: deal.title,
          sortOrder: deal.stageOrder || 0,
          columnId: stage.id,
          priority: deal.priority as 'low' | 'medium' | 'high' | undefined,
          deal,
        })),
      };
    });
  }, [sortedStages, deals]);

  const handleReorder = async (updates: Array<{ id: string; sortOrder: number; columnId: string }>) => {
    const dealUpdates = updates.map(update => ({
      id: update.id,
      stageId: update.columnId,
      stageOrder: update.sortOrder,
    }));

    await updateDealsMutation.mutateAsync(dealUpdates);
  };

  return (
    <div className="overflow-x-auto pb-4" data-testid="deal-kanban-board">
      <div className="flex gap-4 min-w-max">
        {columns.map((column) => (
          <div
            key={column.id}
            className="flex-shrink-0 w-72"
            data-testid={`kanban-column-${column.id}`}
          >
            <div className="bg-gray-50 rounded-lg border border-gray-200">
              <div 
                className="p-3 border-b border-gray-200"
                style={{ borderTopColor: column.color, borderTopWidth: '3px', borderTopStyle: 'solid', borderTopLeftRadius: '0.5rem', borderTopRightRadius: '0.5rem' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {column.title}
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    {column.items.length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{column.probability}% probability</span>
                  <span className="font-medium text-gray-700">{formatCurrency(column.totalValue)}</span>
                </div>
              </div>

              <div className="p-2 min-h-[300px] max-h-[calc(100vh-320px)] overflow-y-auto">
                <div className="space-y-2">
                  {column.items.map((item) => (
                    <DealCard 
                      key={item.id}
                      deal={(item as any).deal}
                      onDealClick={onDealClick}
                    />
                  ))}
                  {column.items.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-xs">
                      No deals in this stage
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DealKanbanBoard;
