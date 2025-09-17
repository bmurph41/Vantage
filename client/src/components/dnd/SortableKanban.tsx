import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableList, getSortedUpdates } from './SortableList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Types
interface KanbanItem {
  id: string;
  title: string;
  sortOrder: number;
  columnId: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
}

interface KanbanColumn {
  id: string;
  title: string;
  items: KanbanItem[];
}

interface SortableKanbanProps {
  columns: KanbanColumn[];
  onReorder: (updates: Array<{ id: string; sortOrder: number; columnId: string }>) => Promise<void>;
  renderItem?: (item: KanbanItem) => React.ReactNode;
  disabled?: boolean;
  className?: string;
}

// Default item renderer
function DefaultKanbanItem({ item }: { item: KanbanItem }) {
  return (
    <Card className="w-full shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
            {item.title}
          </h4>
          {item.priority && (
            <Badge 
              variant={item.priority === 'high' ? 'destructive' : item.priority === 'medium' ? 'default' : 'secondary'}
              className="text-xs px-1.5 py-0.5 ml-2"
            >
              {item.priority}
            </Badge>
          )}
        </div>
        {item.description && (
          <p className="text-xs text-gray-600 line-clamp-2">
            {item.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function SortableKanban({
  columns,
  onReorder,
  renderItem,
  disabled = false,
  className,
}: SortableKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const { toast } = useToast();

  // Configure sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Find active item across all columns
  const activeItem = activeId ? 
    columns.flatMap(col => col.items).find(item => item.id === activeId) : 
    null;

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const itemId = event.active.id as string;
    setActiveId(itemId);
    
    // Find which column the item belongs to
    const column = columns.find(col => 
      col.items.some(item => item.id === itemId)
    );
    setActiveColumn(column?.id || null);
  }, [columns]);

  // Handle drag over for visual feedback
  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Could add visual feedback for drop zones here
  }, []);

  // Handle drag end with cross-column support
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      setActiveColumn(null);
      return;
    }

    const activeItemId = active.id as string;
    const overId = over.id as string;

    // Find source and target information
    const sourceColumn = columns.find(col => 
      col.items.some(item => item.id === activeItemId)
    );
    
    const sourceItem = sourceColumn?.items.find(item => item.id === activeItemId);
    
    if (!sourceColumn || !sourceItem) {
      setActiveId(null);
      setActiveColumn(null);
      return;
    }

    // Determine if we're dropping on an item or a column
    let targetColumnId: string;
    let targetIndex: number;

    // Check if dropping on another item
    const targetItem = columns.flatMap(col => col.items).find(item => item.id === overId);
    if (targetItem) {
      // Dropping on an item - find its column and position
      const targetColumn = columns.find(col => 
        col.items.some(item => item.id === overId)
      );
      targetColumnId = targetColumn!.id;
      targetIndex = targetColumn!.items.findIndex(item => item.id === overId);
    } else {
      // Dropping on a column (assume it's a column ID)
      targetColumnId = overId;
      targetIndex = columns.find(col => col.id === overId)?.items.length || 0;
    }

    // If dropping in the same position, do nothing
    if (sourceColumn.id === targetColumnId && sourceItem.id === overId) {
      setActiveId(null);
      setActiveColumn(null);
      return;
    }

    try {
      // Calculate new positions
      const updates: Array<{ id: string; sortOrder: number; columnId: string }> = [];

      if (sourceColumn.id === targetColumnId) {
        // Same column reorder
        const columnItems = [...sourceColumn.items];
        const oldIndex = columnItems.findIndex(item => item.id === activeItemId);
        const newIndex = targetItem ? targetIndex : columnItems.length;
        
        const reorderedItems = arrayMove(columnItems, oldIndex, newIndex);
        
        // Generate sort updates
        reorderedItems.forEach((item, index) => {
          updates.push({
            id: item.id,
            sortOrder: (index + 1) * 10,
            columnId: targetColumnId,
          });
        });
      } else {
        // Cross-column move
        const targetColumn = columns.find(col => col.id === targetColumnId);
        if (!targetColumn) return;

        // Remove from source and add to target
        const updatedSourceItems = sourceColumn.items.filter(item => item.id !== activeItemId);
        const updatedTargetItems = [...targetColumn.items];
        
        // Insert at target position
        updatedTargetItems.splice(targetIndex, 0, { ...sourceItem, columnId: targetColumnId });

        // Update sort orders for source column
        updatedSourceItems.forEach((item, index) => {
          updates.push({
            id: item.id,
            sortOrder: (index + 1) * 10,
            columnId: sourceColumn.id,
          });
        });

        // Update sort orders for target column
        updatedTargetItems.forEach((item, index) => {
          updates.push({
            id: item.id,
            sortOrder: (index + 1) * 10,
            columnId: targetColumnId,
          });
        });
      }

      await onReorder(updates);
    } catch (error) {
      console.error('Failed to reorder kanban items:', error);
      toast({
        title: "Reorder Failed",
        description: "Failed to save the new order. Please try again.",
        variant: "destructive",
      });
    }

    setActiveId(null);
    setActiveColumn(null);
  }, [columns, onReorder, toast]);

  // Handle column-level reordering
  const handleColumnReorder = useCallback(async (columnId: string, updates: Array<{ id: string; sortOrder: number }>) => {
    // Convert to the expected format with columnId
    const columnUpdates = updates.map(update => ({
      ...update,
      columnId,
    }));
    
    await onReorder(columnUpdates);
  }, [onReorder]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        className={cn(
          "flex gap-6 overflow-x-auto pb-4",
          className
        )}
        data-testid="sortable-kanban"
      >
        {columns.map((column) => (
          <div
            key={column.id}
            className="flex-shrink-0 w-80"
            data-testid={`kanban-column-${column.id}`}
          >
            <Card className="h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-900 flex items-center justify-between">
                  {column.title}
                  <Badge variant="outline" className="text-xs">
                    {column.items.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <SortableList
                  items={column.items}
                  renderItem={(item) => 
                    renderItem ? renderItem(item) : <DefaultKanbanItem item={item} />
                  }
                  onReorder={(updates) => handleColumnReorder(column.id, updates)}
                  disabled={disabled}
                  className="min-h-[200px] space-y-2"
                />
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Drag Overlay */}
      <DragOverlay
        adjustScale={false}
        dropAnimation={{
          duration: 300,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {activeItem && (
          <div className="bg-white border-2 border-blue-300 shadow-2xl rounded-lg transform rotate-2 ring-2 ring-blue-100 ring-opacity-50 w-80">
            {renderItem ? renderItem(activeItem) : <DefaultKanbanItem item={activeItem} />}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default SortableKanban;