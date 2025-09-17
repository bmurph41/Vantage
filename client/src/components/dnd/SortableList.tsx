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
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Types
interface SortableItem {
  id: string;
  sortOrder: number;
}

interface SortableListProps<T extends SortableItem> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  onReorder: (updates: Array<{ id: string; sortOrder: number }>) => Promise<void>;
  axis?: 'y' | 'x';
  disabled?: boolean;
  className?: string;
}

interface SortableItemWrapperProps {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
}

// Utility function to generate decimal sort values with proper spacing
export function getSortedUpdates(oldOrderIds: string[], newOrderIds: string[]): Array<{ id: string; sortOrder: number }> {
  const updates: Array<{ id: string; sortOrder: number }> = [];
  
  // Generate new sort values starting at 10 and spacing by 10
  newOrderIds.forEach((id, index) => {
    const newSortOrder = (index + 1) * 10;
    updates.push({ id, sortOrder: newSortOrder });
  });
  
  return updates;
}

// Individual sortable item wrapper with drag handle
function SortableItemWrapper({ id, children, disabled }: SortableItemWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative flex items-center gap-2 min-h-[56px] select-none touch-none",
        isDragging && "cursor-grabbing"
      )}
      data-testid={`sortable-item-${id}`}
    >
      {/* Drag Handle */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-8 w-8 p-0 cursor-grab hover:bg-gray-100 flex-shrink-0",
          isDragging && "cursor-grabbing",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        {...attributes}
        {...listeners}
        aria-label="Reorder item"
        aria-pressed={isDragging}
        tabIndex={disabled ? -1 : 0}
        disabled={disabled}
        data-testid={`drag-handle-${id}`}
      >
        <GripVertical className="h-4 w-4 text-gray-400" />
      </Button>
      
      {/* Item Content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}

// Main SortableList component
export function SortableList<T extends SortableItem>({
  items,
  renderItem,
  onReorder,
  axis = 'y',
  disabled = false,
  className,
}: SortableListProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const { toast } = useToast();

  // Configure sensors for mouse, touch, and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum distance to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // Handle drag end with optimistic updates
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);
      
      // Optimistic update: reorder locally first
      const reorderedItems = arrayMove(items, oldIndex, newIndex);
      const oldOrderIds = items.map(item => item.id);
      const newOrderIds = reorderedItems.map(item => item.id);
      
      // Generate sort updates with decimal spacing
      const sortUpdates = getSortedUpdates(oldOrderIds, newOrderIds);
      
      try {
        // Apply optimistic update and persist to server
        await onReorder(sortUpdates);
      } catch (error) {
        console.error('Failed to reorder items:', error);
        toast({
          title: "Reorder Failed",
          description: "Failed to save the new order. Please try again.",
          variant: "destructive",
        });
      }
    }

    // Reset drag state
    setActiveId(null);
  }, [items, onReorder, toast]);

  // Get the active item for drag overlay
  const activeItem = activeId ? items.find(item => item.id === activeId) : null;

  // Choose sorting strategy based on axis
  const strategy = axis === 'x' ? horizontalListSortingStrategy : verticalListSortingStrategy;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext 
        items={items.map(item => item.id)} 
        strategy={strategy}
      >
        <ul
          className={cn(
            "flex gap-2",
            axis === 'y' ? "flex-col" : "flex-row flex-wrap",
            className
          )}
          data-testid="sortable-list"
        >
          {items.map((item) => (
            <li key={item.id} className="list-none">
              <SortableItemWrapper id={item.id} disabled={disabled}>
                {renderItem(item)}
              </SortableItemWrapper>
            </li>
          ))}
        </ul>
      </SortableContext>

      {/* Drag Overlay */}
      <DragOverlay
        adjustScale={false}
        dropAnimation={{
          duration: 300,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {activeItem && (
          <div className="bg-white border-2 border-blue-300 shadow-2xl rounded-lg p-3 transform rotate-1 ring-2 ring-blue-100 ring-opacity-50 drop-shadow-sm">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-blue-500" />
              <div className="min-w-0 flex-1">
                {renderItem(activeItem)}
              </div>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default SortableList;