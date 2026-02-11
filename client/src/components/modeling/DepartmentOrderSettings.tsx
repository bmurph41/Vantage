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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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

function SortableList({ items, onReorder }: { items: string[]; onReorder: (items: string[]) => void }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.indexOf(active.id as string);
    const newIndex = items.indexOf(over.id as string);
    const newOrder = [...items];
    newOrder.splice(oldIndex, 1);
    newOrder.splice(newIndex, 0, active.id as string);
    onReorder(newOrder);
  };

  return (
    <div className="space-y-1.5">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {items.map((dept, idx) => (
            <SortableDeptItem key={dept} id={dept} index={idx} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface DepartmentOrderSettingsProps {
  revenueCogsOrder: string[];
  expensesOrder: string[];
  onUpdateRevenueCogsOrder: (newOrder: string[]) => void;
  onUpdateExpensesOrder: (newOrder: string[]) => void;
  onResetRevenueCogsOrder: () => void;
  onResetExpensesOrder: () => void;
}

export function DepartmentOrderSettings({
  revenueCogsOrder,
  expensesOrder,
  onUpdateRevenueCogsOrder,
  onUpdateExpensesOrder,
  onResetRevenueCogsOrder,
  onResetExpensesOrder,
}: DepartmentOrderSettingsProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'revenueCogs' | 'expenses'>('revenueCogs');
  const [localRevCogsOrder, setLocalRevCogsOrder] = useState<string[]>(revenueCogsOrder);
  const [localExpensesOrder, setLocalExpensesOrder] = useState<string[]>(expensesOrder);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setLocalRevCogsOrder([...revenueCogsOrder]);
      setLocalExpensesOrder([...expensesOrder]);
    }
    setOpen(isOpen);
  };

  const handleSave = () => {
    onUpdateRevenueCogsOrder(localRevCogsOrder);
    onUpdateExpensesOrder(localExpensesOrder);
    setOpen(false);
  };

  const handleReset = () => {
    if (activeTab === 'revenueCogs') {
      onResetRevenueCogsOrder();
      setLocalRevCogsOrder([...revenueCogsOrder]);
    } else {
      onResetExpensesOrder();
      setLocalExpensesOrder([...expensesOrder]);
    }
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
            Drag and drop departments to set your preferred display order. Revenue & COGS share the same order; Expenses has its own.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="revenueCogs" className="flex-1 text-xs">Revenue & COGS</TabsTrigger>
            <TabsTrigger value="expenses" className="flex-1 text-xs">Expenses</TabsTrigger>
          </TabsList>
          <TabsContent value="revenueCogs" className="mt-3 max-h-[350px] overflow-y-auto">
            <SortableList items={localRevCogsOrder} onReorder={setLocalRevCogsOrder} />
          </TabsContent>
          <TabsContent value="expenses" className="mt-3 max-h-[350px] overflow-y-auto">
            <SortableList items={localExpensesOrder} onReorder={setLocalExpensesOrder} />
          </TabsContent>
        </Tabs>
        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset {activeTab === 'revenueCogs' ? 'Revenue & COGS' : 'Expenses'}
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
