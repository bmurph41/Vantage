import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProgressBar, ProgressLegend } from "./progress-bar";
import { CompactProgressIndicator } from "./compact-progress-indicator";
import { TimelineNotes } from "./timeline-notes";
import { DocumentRequirementsManagement } from "./document-requirements-management";
import { useTaskDocumentCompletionStatus } from "@/hooks/use-document-requirements";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, parseISO, isToday, isPast, isFuture, differenceInDays, startOfDay, differenceInCalendarDays } from "date-fns";
import { StickyNote, GripVertical, FileText, Shield, ChevronUp, ChevronDown } from "lucide-react";
import type { Task, Project, ProjectSettings } from "@shared/schema";
import { TIMELINE_GRANULARITIES } from "@/types/dd";
import { tzNow, getProjectBounds, getProjectTimelineTicks, percentOfRange, clampDate, setDeadlineTo5PM } from "@/lib/date-utils";
import { calculateUnifiedCriticalPath, isTaskCritical, getNearCriticalTasks, type CriticalPathResult } from "@/lib/critical-path-unified";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useProjectTaskDependencies } from "@/hooks/use-task-dependencies";
import { ChevronTaskReorder } from "./chevron-task-reorder";
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
  type Active,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TimelineViewProps {
  tasks: Task[];
  project: Project;
  settings?: ProjectSettings | null;
  onTaskClick?: (taskId: string) => void;
}

// Smart leader lines component
interface LinesLayerProps {
  headerRef: React.RefObject<HTMLDivElement>;
  contentRef: React.RefObject<HTMLDivElement>;
}

function useLeaderLines(headerRef: React.RefObject<HTMLDivElement>, contentRef: React.RefObject<HTMLDivElement>) {
  const [lines, setLines] = useState<Array<{ x: number; segments: Array<{ top: number; height: number }> }>>([]);

  const computeLines = useCallback(() => {
    if (!headerRef.current || !contentRef.current) return;

    requestAnimationFrame(() => {
      const headerGrid = headerRef.current;
      const contentContainer = contentRef.current;
      if (!headerGrid || !contentContainer) return;

      const headerRect = headerGrid.getBoundingClientRect();
      const contentRect = contentContainer.getBoundingClientRect();
      
      // Get header cells (date cells)
      const headerCells = Array.from(headerGrid.children) as HTMLElement[];
      const maxLines = Math.min(12, headerCells.length);
      
      // Calculate line X positions
      const lineXPositions = headerCells.slice(0, maxLines).map(cell => {
        const cellRect = cell.getBoundingClientRect();
        return cellRect.left + cellRect.width / 2 - contentRect.left;
      });

      // Find all obstacles within the timeline area only
      const timelineSection = contentContainer.querySelector('[data-timeline-section]') as HTMLElement;
      const obstacles = timelineSection ? 
        Array.from(timelineSection.querySelectorAll('.leader-obstacle')) as HTMLElement[] :
        [];
      
      const startY = headerRect.bottom - contentRect.top + 5; // Start just below header
      
      // End at the bottom of the timeline section (progress bars area), not the entire page
      const timelineBottom = timelineSection ? 
        timelineSection.getBoundingClientRect().bottom - contentRect.top :
        startY + 200; // Fallback height if timeline section not found
      const endY = Math.min(timelineBottom + 10, startY + 300); // Limit maximum height

      const newLines = lineXPositions.map(x => {
        // Find obstacles that intersect this line
        const lineObstacles = obstacles
          .map(obstacle => {
            const rect = obstacle.getBoundingClientRect();
            const relativeTop = rect.top - contentRect.top;
            const relativeBottom = rect.bottom - contentRect.top;
            
            // Check if obstacle horizontally intersects with line (with padding)
            const leftBound = rect.left - contentRect.left - 6;
            const rightBound = rect.right - contentRect.left + 6;
            
            if (x >= leftBound && x <= rightBound) {
              return {
                top: Math.max(0, relativeTop - 4),
                bottom: relativeBottom + 4
              };
            }
            return null;
          })
          .filter(Boolean)
          .sort((a, b) => a!.top - b!.top);

        // Merge overlapping obstacles
        const mergedObstacles: Array<{ top: number; bottom: number }> = [];
        lineObstacles.forEach(obstacle => {
          if (!obstacle) return;
          const last = mergedObstacles[mergedObstacles.length - 1];
          if (last && obstacle.top <= last.bottom) {
            last.bottom = Math.max(last.bottom, obstacle.bottom);
          } else {
            mergedObstacles.push(obstacle);
          }
        });

        // Create line segments between obstacles
        const segments: Array<{ top: number; height: number }> = [];
        let currentY = startY;

        mergedObstacles.forEach(obstacle => {
          if (currentY < obstacle.top) {
            const height = obstacle.top - currentY;
            if (height >= 2) { // Minimum segment height
              segments.push({ top: currentY, height });
            }
          }
          currentY = Math.max(currentY, obstacle.bottom);
        });

        // Add final segment if there's space
        if (currentY < endY) {
          const height = endY - currentY;
          if (height >= 2) {
            segments.push({ top: currentY, height });
          }
        }

        return { x, segments };
      });

      setLines(newLines);
    });
  }, [headerRef, contentRef]);

  useEffect(() => {
    computeLines();

    // Set up observers for dynamic updates
    const resizeObserver = new ResizeObserver(computeLines);
    const mutationObserver = new MutationObserver(computeLines);

    if (headerRef.current) resizeObserver.observe(headerRef.current);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
      mutationObserver.observe(contentRef.current, { 
        childList: true, 
        subtree: true, 
        attributes: true, 
        attributeFilter: ['class', 'style'] 
      });
    }

    // Debounced window resize
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(computeLines, 16);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [computeLines]);

  return lines;
}

function LinesLayer({ headerRef, contentRef }: LinesLayerProps) {
  const lines = useLeaderLines(headerRef, contentRef);

  return (
    <div 
      className="absolute pointer-events-none z-0" 
      style={{ 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        clipPath: 'inset(0 0 0 0)' // Ensure lines stay within the container
      }}
      aria-hidden="true"
    >
      {lines.map((line, lineIndex) =>
        line.segments.map((segment, segmentIndex) => (
          <div
            key={`${lineIndex}-${segmentIndex}`}
            className="absolute w-px bg-gray-300/80"
            style={{
              left: line.x,
              top: segment.top,
              height: segment.height,
            }}
          />
        ))
      )}
    </div>
  );
}

// Sortable Task Item Component
interface SortableTaskItemProps {
  task: Task;
  project: Project;
  settings?: ProjectSettings | null;
  isCritical: boolean;
  criticalInfo: any;
  isNearingDeadline: boolean;
  deadlineUrgency: 'completed' | 'overdue' | 'urgent' | 'warning' | 'normal';
  showCriticalPath: boolean;
  onOpenNotes: (taskId: string) => void;
  getTaskNoteCount: (taskId: string) => number;
  onTaskClick?: (taskId: string) => void;
  isDragOver?: boolean;
  isActive?: boolean;
  useChevronControls?: boolean;
  sortedTasks?: Task[];
  onMoveTaskUp?: (taskId: string) => void;
  onMoveTaskDown?: (taskId: string) => void;
}

function SortableTaskItem({
  task,
  project,
  settings,
  isCritical,
  criticalInfo,
  isNearingDeadline,
  deadlineUrgency,
  showCriticalPath,
  onOpenNotes,
  getTaskNoteCount,
  onTaskClick,
  isDragOver = false,
  isActive = false,
  useChevronControls = false,
  sortedTasks = [],
  onMoveTaskUp,
  onMoveTaskDown
}: SortableTaskItemProps) {
  const [docRequirementsDialogOpen, setDocRequirementsDialogOpen] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const {
    totalRequirements,
    verifiedCount,
    hasBlockingIssues,
    canComplete
  } = useTaskDocumentCompletionStatus(task.id);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.6 : 1,
    scale: isDragging ? '1.02' : '1',
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg p-3 border transition-all duration-200 ${
        isDragging
          ? 'bg-white border-blue-300 shadow-2xl ring-2 ring-blue-200 ring-opacity-50'
          : isDragOver
            ? 'bg-blue-50 border-blue-200 shadow-lg scale-105 transform'
            : isCritical 
              ? 'bg-red-50 border-red-200 shadow-md' 
              : deadlineUrgency === 'overdue' || deadlineUrgency === 'urgent'
                ? 'bg-red-50 border-red-200 shadow-sm'
                : deadlineUrgency === 'warning'
                  ? 'bg-orange-50 border-orange-200 shadow-sm'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:shadow-sm'
      }`}
      data-testid={`sortable-task-${task.id}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {/* Conditional Reorder Controls */}
          {useChevronControls && onMoveTaskUp && onMoveTaskDown ? (
            <ChevronTaskReorder
              taskId={task.id}
              taskIndex={sortedTasks.findIndex((t: Task) => t.id === task.id)}
              totalTasks={sortedTasks.length}
              onMoveUp={onMoveTaskUp}
              onMoveDown={onMoveTaskDown}
            />
          ) : (
            /* Enhanced Drag Handle */
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-3 -m-1 rounded-lg hover:bg-blue-100 hover:shadow-md transition-all duration-200 group border-2 border-transparent hover:border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 touch-none select-none"
              data-testid={`drag-handle-${task.id}`}
              title="Click and drag to reorder • Hold to grab"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col space-y-0.5">
                <div className="flex space-x-0.5">
                  <div className="w-1 h-1 bg-gray-400 group-hover:bg-blue-500 rounded-full transition-colors duration-200"></div>
                  <div className="w-1 h-1 bg-gray-400 group-hover:bg-blue-500 rounded-full transition-colors duration-200"></div>
                </div>
                <div className="flex space-x-0.5">
                  <div className="w-1 h-1 bg-gray-400 group-hover:bg-blue-500 rounded-full transition-colors duration-200"></div>
                  <div className="w-1 h-1 bg-gray-400 group-hover:bg-blue-500 rounded-full transition-colors duration-200"></div>
                </div>
                <div className="flex space-x-0.5">
                  <div className="w-1 h-1 bg-gray-400 group-hover:bg-blue-500 rounded-full transition-colors duration-200"></div>
                  <div className="w-1 h-1 bg-gray-400 group-hover:bg-blue-500 rounded-full transition-colors duration-200"></div>
                </div>
              </div>
            </div>
          )}
          <span className={`w-2 h-2 rounded-full ${
            isCritical ? 'bg-red-500' :
            task.status === 'completed' ? 'bg-green-500' :
            task.status === 'in_progress' ? 'bg-blue-500' :
            task.status === 'scheduled' ? 'bg-blue-600' :
            'bg-gray-400'
          }`} />
          <span className={`text-sm font-medium leader-obstacle ${
            isCritical ? 'text-red-900' : 'text-gray-900'
          }`}>{task.title}</span>
          {isCritical && (
            <Badge variant="destructive" className="text-xs px-2 py-0.5">
              Critical
            </Badge>
          )}
          {showCriticalPath && criticalInfo && criticalInfo.float > 0 && criticalInfo.float <= 2 && (
            <Badge variant="outline" className="text-xs px-2 py-0.5 text-amber-700 border-amber-300">
              Near Critical ({Math.round(criticalInfo.float)}d float)
            </Badge>
          )}
          {isNearingDeadline && !isCritical && (
            <Badge variant="outline" className="text-xs px-2 py-0.5 text-amber-700 border-amber-300 bg-amber-50">
              Due Soon ({(() => {
                const today = startOfDay(tzNow('America/New_York'));
                const deadline = setDeadlineTo5PM(task.deadline!);
                const days = differenceInCalendarDays(deadline, today);
                return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`;
              })()})
            </Badge>
          )}
          {/* Document Status Indicator */}
          {totalRequirements > 0 && (
            <div className="flex items-center space-x-1">
              {hasBlockingIssues && (
                <Shield className="h-3 w-3 text-red-500" />
              )}
              <Badge variant="outline" className={`text-xs px-2 py-0.5 ${
                hasBlockingIssues 
                  ? 'text-red-700 border-red-300 bg-red-50' 
                  : canComplete 
                    ? 'text-green-700 border-green-300 bg-green-50'
                    : 'text-orange-700 border-orange-300 bg-orange-50'
              }`}>
                <FileText className="h-3 w-3 mr-1" />
                {verifiedCount}/{totalRequirements} Docs
              </Badge>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {showCriticalPath && criticalInfo && (
            <div className="text-xs text-gray-600">
              Float: <strong>{Math.round(criticalInfo.float)}d</strong>
            </div>
          )}
          <div className="text-xs text-gray-600">
            {task.assignee || 'Unassigned'}
          </div>
          {/* Document Requirements Button */}
          {totalRequirements > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-colors"
              onClick={() => setDocRequirementsDialogOpen(true)}
              data-testid={`button-documents-${task.id}`}
            >
              <FileText className="h-3 w-3 mr-1" />
              Documents
            </Button>
          )}
          {/* Simple Note Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors relative"
            onClick={() => onOpenNotes(task.id)}
            data-testid={`button-notes-${task.id}`}
          >
            <StickyNote className="h-3 w-3 mr-1" />
            Notes
            {(() => {
              const noteCount = getTaskNoteCount(task.id);
              if (noteCount > 0) {
                return (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center shadow-md">
                    {noteCount > 9 ? '9+' : noteCount}
                  </span>
                );
              }
              return null;
            })()}
          </Button>
        </div>
        
        {/* Document Requirements Dialog */}
        <Dialog open={docRequirementsDialogOpen} onOpenChange={setDocRequirementsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden" data-testid={`dialog-documents-${task.id}`}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Document Requirements - {task.title}
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
              <DocumentRequirementsManagement 
                taskId={task.id} 
                showHeader={false}
                compact={true}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="mt-3">
        <CompactProgressIndicator 
          task={task} 
          project={project} 
          settings={settings}
          onTaskClick={onTaskClick}
          className={`shadow-sm ${
            isCritical ? 'ring-2 ring-red-200' : ''
          }`}
        />
      </div>
    </div>
  );
}

export function TimelineView({ tasks, project, settings, onTaskClick }: TimelineViewProps) {
  const [granularity, setGranularity] = useState('weekly');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [notesDialogTaskId, setNotesDialogTaskId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [useChevronControls, setUseChevronControls] = useState(false); // Toggle for reordering UI
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const taskCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Enhanced drag and drop sensors with better sensitivity and touch support
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement to start drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );


  // Bulletproof drag-and-drop like Trello/Linear - NO CACHE INVALIDATION CONFLICTS
  const updateSortOrderMutation = useMutation({
    mutationFn: async (sortUpdates: Array<{ id: string; sortOrder: number }>) => {
      const response = await apiRequest("PATCH", `/api/dd/projects/${project.id}/tasks/bulk-sort-order`, sortUpdates);
      return response.json();
    },
    onMutate: async (sortUpdates: Array<{ id: string; sortOrder: number }>) => {
      // Cancel all outgoing requests to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['/api/dd/projects', project.id] });

      // Get current data from BOTH cache keys that need updating
      const previousTasks = queryClient.getQueryData(['/api/dd/projects', project.id, 'tasks']);
      const previousProject = queryClient.getQueryData(['/api/dd/projects', project.id]);

      // Create update map for efficient lookups
      const sortMap = new Map(sortUpdates.map(update => [update.id, update.sortOrder]));

      // Update function - apply to both caches
      const updateTasksArray = (oldTasks: Task[] | undefined) => {
        if (!oldTasks) return oldTasks;
        
        // Apply sort updates
        const updatedTasks = oldTasks.map(task => ({
          ...task,
          sortOrder: sortMap.has(task.id) ? sortMap.get(task.id)! : task.sortOrder
        }));

        // Simple sort by sortOrder (server now guarantees this order)
        return [...updatedTasks].sort((a, b) => {
          if (a.sortOrder === null || a.sortOrder === undefined) return 1;
          if (b.sortOrder === null || b.sortOrder === undefined) return -1;
          return a.sortOrder - b.sortOrder;
        });
      };

      // Update tasks cache
      queryClient.setQueryData(['/api/dd/projects', project.id, 'tasks'], updateTasksArray);

      // Update project cache (if it exists and has tasks field)
      queryClient.setQueryData(['/api/dd/projects', project.id], (oldProject: any) => {
        if (!oldProject || !oldProject.tasks) return oldProject;
        return {
          ...oldProject,
          tasks: updateTasksArray(oldProject.tasks)
        };
      });

      return { previousTasks, previousProject };
    },
    onError: (err, sortUpdates, context) => {
      console.error('Drag and drop failed:', err);
      
      // Rollback both caches
      if (context?.previousTasks) {
        queryClient.setQueryData(['/api/dd/projects', project.id, 'tasks'], context.previousTasks);
      }
      if (context?.previousProject) {
        queryClient.setQueryData(['/api/dd/projects', project.id], context.previousProject);
      }

      toast({
        title: "Reorder Failed",
        description: "Could not save new order. Please try again.",
        variant: "destructive",
      });
    },
    // NO onSuccess toasts - silent like Trello/Linear
    // NO onSettled invalidation - optimistic updates stay until explicit refresh
  });

  const selectedGranularity = TIMELINE_GRANULARITIES.find(g => g.value === granularity) || TIMELINE_GRANULARITIES[1];

  // Get fixed project timeline bounds (PSA Signed Date to Closing Date)
  const { start: timelineStart, end: timelineEnd } = useMemo(() => 
    getProjectBounds(project), 
    [project.psaSignedDate, project.closingDate, project.createdAt]
  );
  const today = startOfDay(tzNow('America/New_York'));

  // Memoize timeline tasks and task IDs to stabilize dependencies
  const timelineTasks = useMemo(() => tasks.filter(t => t.showOnTimeline), [tasks]);
  
  // Enhanced sorting logic that considers custom sortOrder
  const sortedTasks = useMemo(() => {
    return [...timelineTasks].sort((a, b) => {
      // First priority: Use custom sortOrder if both tasks have it set
      if (a.sortOrder !== null && a.sortOrder !== undefined && 
          b.sortOrder !== null && b.sortOrder !== undefined) {
        return a.sortOrder - b.sortOrder;
      }
      
      // Second priority: Tasks with custom sortOrder come first
      if (a.sortOrder !== null && a.sortOrder !== undefined) return -1;
      if (b.sortOrder !== null && b.sortOrder !== undefined) return 1;
      
      // Final fallback: Sort by deadline (existing logic)
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1; // Tasks without deadlines go to the end
      if (!b.deadline) return -1; // Tasks without deadlines go to the end
      
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
  }, [timelineTasks]);

  // Chevron-based reordering functions (defined after sortedTasks)
  const handleMoveTaskUp = useCallback((taskId: string) => {
    const currentIndex = sortedTasks.findIndex(task => task.id === taskId);
    if (currentIndex > 0) {
      const newTasks = [...sortedTasks];
      [newTasks[currentIndex], newTasks[currentIndex - 1]] = [newTasks[currentIndex - 1], newTasks[currentIndex]];
      
      const sortOrderUpdates = newTasks.map((task, index) => ({
        id: task.id,
        sortOrder: index
      }));
      
      updateSortOrderMutation.mutate(sortOrderUpdates);
    }
  }, [sortedTasks, updateSortOrderMutation]);

  const handleMoveTaskDown = useCallback((taskId: string) => {
    const currentIndex = sortedTasks.findIndex(task => task.id === taskId);
    if (currentIndex < sortedTasks.length - 1) {
      const newTasks = [...sortedTasks];
      [newTasks[currentIndex], newTasks[currentIndex + 1]] = [newTasks[currentIndex + 1], newTasks[currentIndex]];
      
      const sortOrderUpdates = newTasks.map((task, index) => ({
        id: task.id,
        sortOrder: index
      }));
      
      updateSortOrderMutation.mutate(sortOrderUpdates);
    }
  }, [sortedTasks, updateSortOrderMutation]);

  // Handle drag start event
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // Handle drag over event for visual feedback
  const handleDragOver = useCallback((event: DragOverEvent) => {
    setDragOverId(event.over?.id as string || null);
  }, []);

  // Handle drag end event
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedTasks.findIndex(task => task.id === active.id);
      const newIndex = sortedTasks.findIndex(task => task.id === over.id);
      
      const reorderedTasks = arrayMove(sortedTasks, oldIndex, newIndex);
      
      // Create sort order updates based on new positions
      const sortUpdates = reorderedTasks.map((task, index) => ({
        id: task.id,
        sortOrder: index + 1
      }));
      
      updateSortOrderMutation.mutate(sortUpdates);
    }

    // Reset drag state
    setActiveId(null);
    setDragOverId(null);
  }, [sortedTasks, updateSortOrderMutation]);

  // Handle task click to open edit modal or scroll to task card
  const handleTaskClick = useCallback((taskId: string) => {
    if (onTaskClick) {
      onTaskClick(taskId);
    } else {
      // Fallback to scroll behavior if no onTaskClick handler provided
      const taskElement = taskCardRefs.current.get(taskId);
      if (taskElement) {
        taskElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'nearest'
        });
        // Add a subtle highlight effect
        taskElement.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.5)';
        setTimeout(() => {
          taskElement.style.boxShadow = '';
        }, 2000);
      }
    }
  }, [onTaskClick]);
  
  const taskIds = useMemo(() => sortedTasks.map(t => t.id), [sortedTasks]);
  
  // Create a stable query key that doesn't change when taskIds array reference changes
  const taskIdsKey = useMemo(() => taskIds.sort().join(','), [taskIds]);
  
  // Create a map to store note counts for each task
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});

  // Fetch notes for all timeline tasks - always call useQuery to avoid hooks violation
  const noteQueries = useQuery({
    queryKey: ['timeline-notes-batch', taskIdsKey],
    queryFn: async () => {
      if (taskIds.length === 0) return [];
      
      const results = await Promise.all(
        taskIds.map(async (taskId) => {
          try {
            const response = await fetch(`/api/dd/tasks/${taskId}/timeline-notes`);
            const notes = await response.json();
            return { taskId, count: Array.isArray(notes) ? notes.length : 0 };
          } catch (error) {
            console.warn(`Failed to fetch notes for task ${taskId}:`, error);
            return { taskId, count: 0 };
          }
        })
      );
      return results;
    },
    // Always enable the query but return empty array when no tasks
    enabled: true,
  });

  // Update note counts when query data changes
  useEffect(() => {
    if (noteQueries.data && Array.isArray(noteQueries.data)) {
      const counts = noteQueries.data.reduce((acc, { taskId, count }) => {
        acc[taskId] = count;
        return acc;
      }, {} as Record<string, number>);
      setNoteCounts(counts);
    }
  }, [noteQueries.data]);

  const getTaskNoteCount = (taskId: string) => {
    return noteCounts[taskId] || 0;
  };

  // Get the currently dragged task for the overlay
  const activeTask = activeId ? sortedTasks.find(task => task.id === activeId) : null;

  // Generate visible ticks between project bounds based on granularity
  const visibleTicks = useMemo(() => 
    getProjectTimelineTicks(project, granularity), 
    [project, granularity]
  );

  // Fetch enhanced task dependencies for the project
  const { 
    data: enhancedDependencies, 
    isLoading: dependenciesLoading, 
    error: dependenciesError 
  } = useProjectTaskDependencies(project.id);

  // Calculate critical path when tasks, enhanced dependencies, or showCriticalPath changes
  const criticalPathResult = useMemo(() => {
    if (!showCriticalPath) return null;
    
    try {
      // Use unified critical path with enhanced dependencies when available
      // If enhanced dependencies fail to load, fallback to legacy mode
      const options = {
        enhancedDependencies: dependenciesError ? null : enhancedDependencies,
        enableEnhancedFeatures: !dependenciesError,
      };
      
      return calculateUnifiedCriticalPath(tasks, project, settings, options);
    } catch (error) {
      console.warn('Critical path calculation failed:', error);
      
      // Fallback: try legacy mode if enhanced mode fails
      try {
        return calculateUnifiedCriticalPath(tasks, project, settings, {
          enhancedDependencies: null,
          enableEnhancedFeatures: false,
        });
      } catch (fallbackError) {
        console.error('Both enhanced and legacy critical path calculations failed:', fallbackError);
        return null;
      }
    }
  }, [tasks, project, settings, showCriticalPath, enhancedDependencies, dependenciesError]);

  // Get milestone position along timeline (0-100%)
  const getMilestonePosition = (dateString: string) => {
    const date = parseISO(dateString);
    return percentOfRange(date, timelineStart, timelineEnd);
  };

  return (
    <div className="space-y-6" data-testid="timeline-view">
      {/* Professional Header */}
      <Card className="shadow-sm">
        <CardContent className="p-6 relative" ref={contentRef}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-1">Project Timeline</h1>
              <p className="text-gray-600">Due diligence milestones and task tracking</p>
            </div>
            <div className="flex items-center space-x-3">
              <Select value={granularity} onValueChange={setGranularity}>
                <SelectTrigger className="w-32" data-testid="select-granularity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMELINE_GRANULARITIES.map(g => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={showCriticalPath ? "default" : "outline"}
                size="sm"
                onClick={() => setShowCriticalPath(!showCriticalPath)}
                data-testid="button-critical-path"
              >
                Critical Path
                {showCriticalPath && criticalPathResult && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {criticalPathResult.criticalPath.length}
                  </Badge>
                )}
              </Button>
              
              <Button
                variant={useChevronControls ? "default" : "outline"}
                size="sm"
                onClick={() => setUseChevronControls(!useChevronControls)}
                data-testid="button-reorder-mode"
                title={useChevronControls ? "Switch to drag & drop" : "Switch to arrow controls"}
              >
                {useChevronControls ? <ChevronUp className="h-4 w-4 mr-1" /> : <GripVertical className="h-4 w-4 mr-1" />}
                {useChevronControls ? "Arrow Controls" : "Drag & Drop"}
              </Button>
            </div>
          </div>

          {/* Project Timeline Headers - Moved above milestone sections */}
          <div className="mb-6 relative">
            <div className="relative w-full h-12 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg border border-gray-300/60 shadow-sm overflow-hidden" ref={headerRef}>
              {/* Dynamic Start and End labels */}
              <div className="absolute left-0 top-0 bottom-0 flex items-center px-3 bg-gradient-to-r from-blue-100 to-blue-50 text-blue-800 text-xs font-semibold border-r border-blue-200/70 z-10 shadow-sm">
                {format(timelineStart, 'M/d/yy')}
              </div>
              <div className="absolute right-0 top-0 bottom-0 flex items-center px-3 bg-gradient-to-l from-green-100 to-green-50 text-green-800 text-xs font-semibold border-l border-green-200/70 z-10 shadow-sm">
                {format(timelineEnd, 'M/d/yy')}
              </div>
              
              {/* Visible tick marks based on granularity - exclude start/end to prevent overlap */}
              {visibleTicks
                .filter(date => {
                  const position = percentOfRange(date, timelineStart, timelineEnd);
                  // Filter out dates too close to start (0%) or end (100%) to prevent overlap
                  return position > 8 && position < 92;
                })
                .map((date, index) => {
                  const position = percentOfRange(date, timelineStart, timelineEnd);
                  const isCurrentPeriod = isToday(date);
                  
                  return (
                    <div 
                      key={index}
                      className={`absolute top-0 bottom-0 flex flex-col justify-center items-center transform -translate-x-1/2 ${
                        granularity === 'monthly' 
                          ? `px-3 mx-1 rounded-lg border transition-all duration-200 hover:shadow-md z-20 ${
                              isCurrentPeriod 
                                ? 'bg-blue-100 text-blue-800 border-blue-300 font-semibold shadow-sm' 
                                : index % 2 === 0 
                                  ? 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100' 
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`
                          : `px-1 ${isCurrentPeriod ? 'bg-blue-50 text-blue-700 font-medium rounded z-20' : 'text-gray-600 z-10'}`
                      }`}
                      style={{ left: `${position}%` }}
                      data-testid={`timeline-date-${index}`}
                    >
                      <div className={`whitespace-nowrap ${
                        granularity === 'monthly' ? 'text-sm font-medium' : 'text-xs'
                      }`}>
                        {format(date, 
                          granularity === 'daily' ? 'MMM d' : 
                          granularity === 'monthly' ? 'MMM' : 
                          granularity === 'weekly' || granularity === 'biweekly' ? 'M/d' : 
                          'M/d'
                        )}
                      </div>
                      {granularity === 'monthly' && (
                        <div className="text-xs text-gray-500 font-normal">
                          {format(date, 'yyyy')}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
            {/* Smart Leader Lines Layer - contained within this timeline section */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
              <LinesLayer headerRef={headerRef} contentRef={contentRef} />
            </div>
            {/* Today Vertical Line - Only show if today is within timeline bounds */}
            {(() => {
              // Only show Today line if today is within or after the timeline start
              if (today >= timelineStart && today <= timelineEnd) {
                const todayPosition = percentOfRange(today, timelineStart, timelineEnd);
                return (
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-blue-500 shadow-lg z-30 pointer-events-none"
                    style={{ 
                      left: `${todayPosition}%`,
                      height: '100%'
                    }}
                    data-testid="today-line"
                  />
                );
              }
              return null;
            })()}

            {/* PSA Start Badge - Show when today is before timeline start */}
            {today < timelineStart && (
              <div className="absolute left-0 top-0 bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-br-md border border-green-200 z-40">
                PSA Signed: {format(timelineStart, 'M/d/yy')}
              </div>
            )}
          </div>

          {/* Overall Progress Bar */}
          {project.closingDate && (
            <div className="mb-6" data-timeline-section>
              <div className="rounded-lg p-4 border bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300/60 shadow-sm ring-1 ring-gray-200/40">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className="w-3 h-3 rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-sm border border-green-300/50" />
                    <h3 className="text-sm font-semibold text-gray-900 leader-obstacle">
                      Overall Progress to Closing
                    </h3>
                  </div>
                  <div className="text-xs text-gray-600">
                    {(() => {
                      // Use the same timeline bounds as the main timeline for perfect alignment
                      const startDate = timelineStart;
                      const closingDate = timelineEnd;
                      
                      if (today >= closingDate) return '100% - Closing reached';
                      
                      const totalDays = Math.max(1, differenceInCalendarDays(closingDate, startDate));
                      const elapsedDays = Math.max(0, Math.min(totalDays, differenceInCalendarDays(today < closingDate ? today : closingDate, startDate)));
                      const percentage = Math.round((elapsedDays / totalDays) * 100);
                      
                      return `${percentage}% elapsed`;
                    })()}
                  </div>
                </div>
                
                <div className="h-8 bg-gray-100 rounded-lg overflow-hidden relative shadow-inner">
                  {(() => {
                    // Use the same timeline bounds as the main timeline for perfect alignment
                    const startDate = timelineStart;
                    const closingDate = timelineEnd;
                    
                    // Calculate positions within timeline 
                    const startPos = percentOfRange(startDate, timelineStart, timelineEnd);
                    const endPos = percentOfRange(closingDate, timelineStart, timelineEnd);
                    const todayPos = percentOfRange(today, timelineStart, timelineEnd);
                    
                    // Progress bar spans full duration from PSA to closing
                    const barWidth = Math.max(1, endPos - startPos);
                    
                    // Determine project status
                    const isCompleted = today >= closingDate;
                    const isNotStarted = today < startDate;
                    
                    // Calculate elapsed and remaining widths
                    let elapsedWidth = 0;
                    let remainingWidth = 0;
                    
                    if (isCompleted) {
                      elapsedWidth = barWidth; // Full bar is elapsed
                      remainingWidth = 0;
                    } else if (isNotStarted) {
                      elapsedWidth = 0; // No elapsed time
                      remainingWidth = barWidth; // Full bar is remaining
                    } else {
                      // In progress: elapsed from start to today (never past closing), remaining from today to closing
                      elapsedWidth = Math.max(0, Math.min(todayPos, endPos) - startPos);
                      remainingWidth = Math.max(0, endPos - Math.min(todayPos, endPos));
                    }
                    
                    return (
                      <>
                        {/* Overall progress bar container - spans full PSA to closing duration */}
                        <div 
                          className="h-full bg-white rounded-lg overflow-hidden shadow-md border border-gray-300/60 absolute ring-1 ring-gray-200/40"
                          style={{
                            left: `${startPos}%`,
                            width: `${barWidth}%`
                          }}
                        >
                          {/* Elapsed time section (PSA start to today) - solid green */}
                          {elapsedWidth > 0 && (
                            <div 
                              className="h-full bg-green-600 absolute"
                              style={{
                                left: '0%',
                                width: `${(elapsedWidth / barWidth) * 100}%`
                              }}
                            />
                          )}
                          
                          {/* Remaining time section (today to closing) - striped pattern */}
                          {remainingWidth > 0 && !isCompleted && (
                            <div 
                              className="h-full bg-green-50 absolute relative overflow-hidden"
                              style={{
                                left: `${(elapsedWidth / barWidth) * 100}%`,
                                width: `${(remainingWidth / barWidth) * 100}%`
                              }}
                            >
                              {/* Diagonal striped pattern for remaining time */}
                              <div 
                                className="absolute inset-0 bg-green-200"
                                style={{
                                  backgroundImage: `repeating-linear-gradient(
                                    45deg,
                                    transparent,
                                    transparent 4px,
                                    rgba(255,255,255,0.4) 4px,
                                    rgba(255,255,255,0.4) 8px
                                  )`
                                }}
                              />
                            </div>
                          )}
                        </div>
                        
                        {/* Start marker - Enhanced */}
                        <div 
                          className="absolute -top-2 z-40 group cursor-pointer transform -translate-x-1/2"
                          style={{ left: `${startPos}%` }}
                          data-testid="progress-start-marker"
                        >
                          <div className="w-4 h-12 rounded-full shadow-xl bg-gradient-to-b from-green-400 via-green-500 to-green-700 border-2 border-green-300/60 ring-2 ring-green-200/40 hover:scale-110 transition-all duration-300 hover:shadow-2xl" />
                          <div className="absolute top-14 left-1/2 transform -translate-x-1/2 bg-gradient-to-br from-white to-gray-50/95 backdrop-blur-sm border-2 border-green-200/80 rounded-xl px-4 py-3 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 ring-1 ring-green-100/60">
                            <div className="text-sm font-bold text-green-700 mb-1">Project Start</div>
                            <div className="text-xs text-gray-600 font-medium">{format(project.psaSignedDate ? parseISO(project.psaSignedDate) : new Date(project.createdAt), 'MMM d, yyyy')}</div>
                            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gradient-to-br from-white to-gray-50/95 border-t-2 border-l-2 border-green-200/80 rotate-45"></div>
                          </div>
                        </div>
                        
                        {/* End marker - Enhanced */}
                        <div 
                          className="absolute -top-2 z-40 group cursor-pointer transform -translate-x-1/2"
                          style={{ left: `${endPos}%` }}
                          data-testid="progress-end-marker"
                        >
                          <div className="w-4 h-12 rounded-full shadow-xl bg-gradient-to-b from-red-400 via-red-500 to-red-700 border-2 border-red-300/60 ring-2 ring-red-200/40 hover:scale-110 transition-all duration-300 hover:shadow-2xl" />
                          <div className="absolute top-14 left-1/2 transform -translate-x-1/2 bg-gradient-to-br from-white to-gray-50/95 backdrop-blur-sm border-2 border-red-200/80 rounded-xl px-4 py-3 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 ring-1 ring-red-100/60">
                            <div className="text-sm font-bold text-red-700 mb-1">Closing Date</div>
                            <div className="text-xs text-gray-600 font-medium">{format(parseISO(project.closingDate), 'MMM d, yyyy')}</div>
                            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gradient-to-br from-white to-gray-50/95 border-t-2 border-l-2 border-red-200/80 rotate-45"></div>
                          </div>
                        </div>

                        {/* Milestone Markers with Hover Labels */}
                        {project.psaSignedDate && (
                          <div 
                            className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 group cursor-pointer"
                            style={{ left: "0%" }}
                            data-testid="milestone-psa"
                          >
                            <div className="w-4 h-4 bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 rounded-full border-3 border-white shadow-xl hover:scale-150 transition-all duration-300 hover:shadow-2xl ring-2 ring-blue-200/60 hover:ring-blue-300/80" />
                            <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-br from-white to-blue-50/95 backdrop-blur-sm border-2 border-blue-200/80 rounded-xl px-4 py-3 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 ring-1 ring-blue-100/60">
                              <div className="text-sm font-bold text-blue-700 mb-1 flex items-center">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                                PSA Signed
                              </div>
                              <div className="text-xs text-gray-600 font-medium">{format(parseISO(project.psaSignedDate), 'MMM d, yyyy')}</div>
                              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gradient-to-br from-white to-blue-50/95 border-t-2 border-l-2 border-blue-200/80 rotate-45"></div>
                            </div>
                          </div>
                        )}
                        {project.ddExpirationDate && (
                          <div 
                            className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 group cursor-pointer"
                            style={{ left: `${getMilestonePosition(project.ddExpirationDate)}%` }}
                            data-testid="milestone-dd-expiration"
                          >
                            <div className="w-4 h-4 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 rounded-full border-3 border-white shadow-xl hover:scale-150 transition-all duration-300 hover:shadow-2xl ring-2 ring-amber-200/60 hover:ring-amber-300/80" />
                            <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-br from-white to-amber-50/95 backdrop-blur-sm border-2 border-amber-200/80 rounded-xl px-4 py-3 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 ring-1 ring-amber-100/60">
                              <div className="text-sm font-bold text-amber-700 mb-1 flex items-center">
                                <div className="w-2 h-2 bg-amber-500 rounded-full mr-2"></div>
                                DD Expiration
                              </div>
                              <div className="text-xs text-gray-600 font-medium">{format(parseISO(project.ddExpirationDate), 'MMM d, yyyy')}</div>
                              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gradient-to-br from-white to-amber-50/95 border-t-2 border-l-2 border-amber-200/80 rotate-45"></div>
                            </div>
                          </div>
                        )}
                        {project.closingDate && (
                          <div 
                            className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 group cursor-pointer"
                            style={{ left: "100%" }}
                            data-testid="milestone-closing"
                          >
                            <div className="w-4 h-4 bg-gradient-to-br from-green-400 via-green-500 to-green-600 rounded-full border-3 border-white shadow-xl hover:scale-150 transition-all duration-300 hover:shadow-2xl ring-2 ring-green-200/60 hover:ring-green-300/80" />
                            <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-gradient-to-br from-white to-green-50/95 backdrop-blur-sm border-2 border-green-200/80 rounded-xl px-4 py-3 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 ring-1 ring-green-100/60">
                              <div className="text-sm font-bold text-green-700 mb-1 flex items-center">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                Closing
                              </div>
                              <div className="text-xs text-gray-600 font-medium">{format(parseISO(project.closingDate), 'MMM d, yyyy')}</div>
                              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gradient-to-br from-white to-green-50/95 border-t-2 border-l-2 border-green-200/80 rotate-45"></div>
                            </div>
                          </div>
                        )}
                        
                        {/* Task Dots */}
                        {tasks.filter(t => t.showOnTimeline && t.deadline).map((task) => (
                          <div
                            key={task.id}
                            className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 group cursor-pointer"
                            style={{ left: `${getMilestonePosition(task.deadline!)}%` }}
                            data-testid={`task-dot-${task.id}`}
                          >
                            <div className={`w-3 h-3 rounded-full border-3 border-white shadow-xl hover:scale-175 transition-all duration-300 hover:shadow-2xl ring-2 ${
                              task.status === 'completed' ? 'bg-gradient-to-br from-green-400 via-green-500 to-green-600 ring-green-200/60 hover:ring-green-300/80' :
                              task.status === 'in_progress' ? 'bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 ring-blue-200/60 hover:ring-blue-300/80' :
                              task.status === 'scheduled' ? 'bg-gradient-to-br from-indigo-400 via-indigo-500 to-indigo-600 ring-indigo-200/60 hover:ring-indigo-300/80' :
                              'bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600 ring-gray-200/60 hover:ring-gray-300/80'
                            }`} />
                            <div className={`absolute top-8 left-1/2 transform -translate-x-1/2 backdrop-blur-sm border-2 rounded-xl px-4 py-3 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 ring-1 ${
                              task.status === 'completed' ? 'bg-gradient-to-br from-white to-green-50/95 border-green-200/80 ring-green-100/60' :
                              task.status === 'in_progress' ? 'bg-gradient-to-br from-white to-blue-50/95 border-blue-200/80 ring-blue-100/60' :
                              task.status === 'scheduled' ? 'bg-gradient-to-br from-white to-indigo-50/95 border-indigo-200/80 ring-indigo-100/60' :
                              'bg-gradient-to-br from-white to-gray-50/95 border-gray-200/80 ring-gray-100/60'
                            }`}>
                              <div className={`text-sm font-bold mb-1 flex items-center ${
                                task.status === 'completed' ? 'text-green-700' :
                                task.status === 'in_progress' ? 'text-blue-700' :
                                task.status === 'scheduled' ? 'text-indigo-700' :
                                'text-gray-700'
                              }`}>
                                <div className={`w-2 h-2 rounded-full mr-2 ${
                                  task.status === 'completed' ? 'bg-green-500' :
                                  task.status === 'in_progress' ? 'bg-blue-500' :
                                  task.status === 'scheduled' ? 'bg-indigo-500' :
                                  'bg-gray-500'
                                }`}></div>
                                {task.title}
                              </div>
                              <div className="text-xs text-gray-600 font-medium">{format(parseISO(task.deadline!), 'MMM d, yyyy')}</div>
                              <div className={`text-xs font-medium mt-1 ${
                                task.status === 'completed' ? 'text-green-600' :
                                task.status === 'in_progress' ? 'text-blue-600' :
                                task.status === 'scheduled' ? 'text-indigo-600' :
                                'text-gray-600'
                              }`}>
                                {task.status === 'completed' ? '✓ Completed' :
                                 task.status === 'in_progress' ? '⟳ In Progress' :
                                 task.status === 'scheduled' ? '📅 Scheduled' :
                                 '⏸️ Not Started'
                                }
                              </div>
                              <div className={`absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 border-t-2 border-l-2 rotate-45 ${
                                task.status === 'completed' ? 'bg-gradient-to-br from-white to-green-50/95 border-green-200/80' :
                                task.status === 'in_progress' ? 'bg-gradient-to-br from-white to-blue-50/95 border-blue-200/80' :
                                task.status === 'scheduled' ? 'bg-gradient-to-br from-white to-indigo-50/95 border-indigo-200/80' :
                                'bg-gradient-to-br from-white to-gray-50/95 border-gray-200/80'
                              }`}></div>
                            </div>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Critical Path Summary */}
          {showCriticalPath && criticalPathResult && (
            <div className="mb-6" data-timeline-section>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-amber-800 leader-obstacle">
                    Critical Path Analysis
                  </h3>
                  <div className="flex items-center space-x-4 text-xs text-amber-700">
                    <span>Project Duration: <strong>{criticalPathResult.projectDuration} days</strong></span>
                    <span>Critical Tasks: <strong>{criticalPathResult.criticalPath.length}</strong></span>
                  </div>
                </div>
                <div className="text-xs text-amber-700">
                  <strong>Critical Path:</strong> Tasks that cannot be delayed without affecting the project completion date.
                </div>
              </div>
            </div>
          )}

          {/* Task Progress Bars with Drag and Drop */}
          {sortedTasks.length > 0 && (
            <div className="mb-6" data-timeline-section>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-6">
                    {sortedTasks.map((task) => {
                      const isCritical = showCriticalPath && criticalPathResult ? isTaskCritical(task.id, criticalPathResult) : false;
                      const criticalInfo = showCriticalPath && criticalPathResult ? criticalPathResult.nodes.get(task.id) : null;
                      
                      // Calculate deadline urgency levels for box coloring
                      const deadlineUrgency = (() => {
                        if (task.status === 'completed') return 'completed';
                        if (!task.deadline) return 'normal';
                        
                        const today = startOfDay(tzNow('America/New_York'));
                        const deadline = setDeadlineTo5PM(task.deadline);
                        const daysUntilDeadline = differenceInCalendarDays(deadline, today);
                        
                        if (daysUntilDeadline < 0) return 'overdue';
                        if (daysUntilDeadline <= 5) return 'urgent';
                        if (daysUntilDeadline >= 6 && daysUntilDeadline <= 14) return 'warning';
                        return 'normal';
                      })();
                      
                      // Legacy prop for backward compatibility
                      const isNearingDeadline = deadlineUrgency === 'urgent' || deadlineUrgency === 'warning';
                      
                      return (
                        <div
                          key={task.id}
                          ref={(el) => {
                            if (el) {
                              taskCardRefs.current.set(task.id, el);
                            } else {
                              taskCardRefs.current.delete(task.id);
                            }
                          }}
                        >
                          <SortableTaskItem
                            task={task}
                            project={project}
                            settings={settings}
                            isCritical={isCritical}
                            criticalInfo={criticalInfo}
                            isNearingDeadline={isNearingDeadline}
                            deadlineUrgency={deadlineUrgency}
                            showCriticalPath={showCriticalPath}
                            onOpenNotes={setNotesDialogTaskId}
                            getTaskNoteCount={getTaskNoteCount}
                            onTaskClick={handleTaskClick}
                            isDragOver={dragOverId === task.id}
                            isActive={activeId === task.id}
                            useChevronControls={useChevronControls}
                            sortedTasks={sortedTasks}
                            onMoveTaskUp={handleMoveTaskUp}
                            onMoveTaskDown={handleMoveTaskDown}
                          />
                        </div>
                      );
                    })}
                  </div>
                </SortableContext>
                
                {/* Enhanced Drag Overlay */}
                <DragOverlay
                  adjustScale={false}
                  dropAnimation={{
                    duration: 300,
                    easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                  }}
                >
                  {activeTask && (
                    <div className="bg-white border-2 border-blue-300 shadow-2xl rounded-lg p-3 transform rotate-3 ring-4 ring-blue-100 ring-opacity-50 backdrop-blur-sm">
                      <div className="flex items-center space-x-2">
                        <div className="flex flex-col space-y-0.5 opacity-50">
                          <div className="flex space-x-0.5">
                            <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                            <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                          </div>
                          <div className="flex space-x-0.5">
                            <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                            <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                          </div>
                          <div className="flex space-x-0.5">
                            <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                            <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                          </div>
                        </div>
                        <span className={`w-2 h-2 rounded-full ${
                          activeTask.status === 'completed' ? 'bg-green-500' :
                          activeTask.status === 'in_progress' ? 'bg-blue-500' :
                          activeTask.status === 'scheduled' ? 'bg-blue-600' :
                          'bg-gray-400'
                        }`} />
                        <span className="text-sm font-medium text-gray-900">{activeTask.title}</span>
                        <Badge variant="outline" className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200">
                          {activeTask.assignee || 'Unassigned'}
                        </Badge>
                      </div>
                      <div className="mt-2 opacity-60">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-300"
                            style={{ width: '75%' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Timeline Legend</h4>
            <ProgressLegend />
          </div>
        </CardContent>
      </Card>

      {/* Timeline Notes Dialog */}
      <Dialog open={!!notesDialogTaskId} onOpenChange={() => setNotesDialogTaskId(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden" data-testid="dialog-timeline-notes">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              Timeline Notes
              {notesDialogTaskId && (() => {
                const task = tasks.find(t => t.id === notesDialogTaskId);
                return task ? ` - ${task.title}` : '';
              })()}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {notesDialogTaskId && (() => {
              const task = tasks.find(t => t.id === notesDialogTaskId);
              return task ? (
                <TimelineNotes taskId={task.id} taskTitle={task.title} />
              ) : null;
            })()}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}