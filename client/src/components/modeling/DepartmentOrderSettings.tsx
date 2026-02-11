import { useState } from 'react';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, RotateCcw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SortableDeptItemProps {
  id: string;
  index: number;
}

function SortableDeptItem({ id, index }: SortableDeptItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-md border bg-background ${
        isDragging ? 'opacity-50 shadow-lg ring-2 ring-primary/30' : 'hover:bg-muted/50'
      }`}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-xs text-muted-foreground w-5">{index + 1}.</span>
      <span className="text-sm font-medium flex-1">{id}</span>
    </div>
  );
}

interface DepartmentOrderSettingsProps {
  departmentOrder: string[];
  onUpdateOrder: (newOrder: string[]) => void;
  onResetOrder: () => void;
}

export function DepartmentOrderSettings({
  departmentOrder,
  onUpdateOrder,
  onResetOrder,
}: DepartmentOrderSettingsProps) {
  const [open, setOpen] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[]>(departmentOrder);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setLocalOrder([...departmentOrder]);
    }
    setOpen(isOpen);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localOrder.indexOf(active.id as string);
    const newIndex = localOrder.indexOf(over.id as string);
    const newOrder = [...localOrder];
    newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, active.id as string);
    setLocalOrder(newOrder);
  };

  const handleSave = () => {
    onUpdateOrder(localOrder);
    setOpen(false);
  };

  const handleReset = () => {
    onResetOrder();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Settings2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Dept. Order</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Customize department display order</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Department Display Order</DialogTitle>
          <DialogDescription>
            Drag and drop departments to set your preferred display order. This order will be saved and applied each time you view the P&L.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-2 max-h-[400px] overflow-y-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
              {localOrder.map((dept, idx) => (
                <SortableDeptItem key={dept} id={dept} index={idx} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Default
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save Order</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
