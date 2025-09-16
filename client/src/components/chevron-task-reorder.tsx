import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown } from "lucide-react";

interface ChevronTaskReorderProps {
  taskId: string;
  taskIndex: number;
  totalTasks: number;
  onMoveUp: (taskId: string) => void;
  onMoveDown: (taskId: string) => void;
}

export function ChevronTaskReorder({ 
  taskId, 
  taskIndex, 
  totalTasks, 
  onMoveUp, 
  onMoveDown 
}: ChevronTaskReorderProps) {
  const isFirst = taskIndex === 0;
  const isLast = taskIndex === totalTasks - 1;

  return (
    <div className="flex flex-col items-center space-y-1">
      <Button
        size="sm"
        variant="ghost"
        className={`h-6 w-6 p-0 hover:bg-blue-100 transition-colors ${
          isFirst ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'
        }`}
        onClick={() => !isFirst && onMoveUp(taskId)}
        disabled={isFirst}
        title={isFirst ? "Already at top" : "Move task up"}
        data-testid={`move-up-${taskId}`}
      >
        <ChevronUp className="h-3 w-3" />
      </Button>
      
      <Button
        size="sm"
        variant="ghost"
        className={`h-6 w-6 p-0 hover:bg-blue-100 transition-colors ${
          isLast ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'
        }`}
        onClick={() => !isLast && onMoveDown(taskId)}
        disabled={isLast}
        title={isLast ? "Already at bottom" : "Move task down"}
        data-testid={`move-down-${taskId}`}
      >
        <ChevronDown className="h-3 w-3" />
      </Button>
    </div>
  );
}