import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProgressBar, ProgressLegend } from "./progress-bar";
import { TimelineNotes } from "./timeline-notes";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, parseISO, isToday, isPast, isFuture, differenceInDays, startOfDay, differenceInCalendarDays } from "date-fns";
import { StickyNote } from "lucide-react";
import type { Task, Project, ProjectSettings } from "@shared/schema";
import { TIMELINE_GRANULARITIES } from "@/types/dd";
import { tzNow, getProjectBounds, getProjectTimelineTicks, percentOfRange, clampDate } from "@/lib/date-utils";
import { calculateCriticalPath, isTaskCritical, getNearCriticalTasks, type CriticalPathResult } from "@/lib/critical-path";
import { useQuery } from "@tanstack/react-query";

interface TimelineViewProps {
  tasks: Task[];
  project: Project;
  settings?: ProjectSettings | null;
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

export function TimelineView({ tasks, project, settings }: TimelineViewProps) {
  const [granularity, setGranularity] = useState('weekly');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [notesDialogTaskId, setNotesDialogTaskId] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);


  const selectedGranularity = TIMELINE_GRANULARITIES.find(g => g.value === granularity) || TIMELINE_GRANULARITIES[1];

  // Get fixed project timeline bounds (PSA Signed Date to Closing Date)
  const { start: timelineStart, end: timelineEnd } = useMemo(() => 
    getProjectBounds(project), 
    [project.psaSignedDate, project.closingDate, project.createdAt]
  );
  const today = startOfDay(tzNow('America/New_York'));

  // Memoize timeline tasks and task IDs to stabilize dependencies
  const timelineTasks = useMemo(() => tasks.filter(t => t.showOnTimeline), [tasks]);
  const taskIds = useMemo(() => timelineTasks.map(t => t.id), [timelineTasks]);
  
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

  // Generate visible ticks between project bounds based on granularity
  const visibleTicks = useMemo(() => 
    getProjectTimelineTicks(project, granularity), 
    [project, granularity]
  );

  // Calculate critical path when tasks or showCriticalPath changes
  const criticalPathResult = useMemo(() => {
    if (!showCriticalPath) return null;
    
    try {
      return calculateCriticalPath(tasks, project, settings);
    } catch (error) {
      console.warn('Critical path calculation failed:', error);
      return null;
    }
  }, [tasks, project, settings, showCriticalPath]);

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
            </div>
          </div>

          {/* Project Timeline Headers - Moved above milestone sections */}
          <div className="mb-6 relative">
            <div className="relative w-full h-12 bg-gray-50 rounded border overflow-hidden" ref={headerRef}>
              {/* Dynamic Start and End labels */}
              <div className="absolute left-0 top-0 bottom-0 flex items-center px-2 bg-blue-100 text-blue-800 text-xs font-medium border-r border-blue-200 z-10">
                {format(timelineStart, 'M/d/yy')}
              </div>
              <div className="absolute right-0 top-0 bottom-0 flex items-center px-2 bg-green-100 text-green-800 text-xs font-medium border-l border-green-200 z-10">
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
              <div className="rounded-lg p-3 border bg-gray-50 border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <h3 className="text-sm font-medium text-gray-900 leader-obstacle">
                      Overall Progress to Closing
                    </h3>
                  </div>
                  <div className="text-xs text-gray-600">
                    {(() => {
                      const timezone = 'America/New_York';
                      const today = startOfDay(tzNow(timezone));
                      const startDate = startOfDay(parseISO(project.psaSignedDate || (project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt) || new Date().toISOString()));
                      const closingDate = startOfDay(parseISO(project.closingDate));
                      
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
                    const timezone = 'America/New_York';
                    const today = startOfDay(tzNow(timezone));
                    const startDate = startOfDay(parseISO(project.psaSignedDate || (project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt) || new Date().toISOString()));
                    const closingDate = startOfDay(parseISO(project.closingDate));
                    
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
                      // In progress: elapsed from start to today, remaining from today to deadline
                      elapsedWidth = Math.max(0, todayPos - startPos);
                      remainingWidth = Math.max(0, endPos - todayPos);
                    }
                    
                    return (
                      <>
                        {/* Overall progress bar container - spans full PSA to closing duration */}
                        <div 
                          className="h-full bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 absolute"
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
                          
                          {/* Remaining time section (today to closing) - lighter green */}
                          {remainingWidth > 0 && !isCompleted && (
                            <div 
                              className="h-full bg-green-200 opacity-60 absolute"
                              style={{
                                left: `${(elapsedWidth / barWidth) * 100}%`,
                                width: `${(remainingWidth / barWidth) * 100}%`
                              }}
                            />
                          )}
                        </div>
                        
                        {/* Start marker */}
                        <div 
                          className="absolute -top-1 w-1 h-10 rounded-full shadow-sm bg-green-600"
                          style={{ left: `${startPos}%` }}
                        />
                        
                        {/* End marker */}
                        <div 
                          className="absolute -top-1 w-1 h-10 rounded-full shadow-sm bg-green-600"
                          style={{ left: `${endPos}%` }}
                        />
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

          {/* Task Progress Bars */}
          {tasks.filter(t => t.showOnTimeline).length > 0 && (
            <div className="mb-6 space-y-6" data-timeline-section>
              {tasks.filter(t => t.showOnTimeline).map((task) => {
                const isCritical = showCriticalPath && criticalPathResult ? isTaskCritical(task.id, criticalPathResult) : false;
                const criticalInfo = showCriticalPath && criticalPathResult ? criticalPathResult.nodes.get(task.id) : null;
                
                return (
                  <div key={task.id} className={`rounded-lg p-3 border transition-all duration-200 ${
                    isCritical 
                      ? 'bg-red-50 border-red-200 shadow-md' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
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
                        {/* Simple Note Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors relative"
                          onClick={() => setNotesDialogTaskId(task.id)}
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
                    </div>
                    <div className="mt-6">
                      <ProgressBar 
                        task={task} 
                        project={project} 
                        settings={settings}
                        className={`shadow-sm ${
                          isCritical ? 'ring-2 ring-red-200' : ''
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Simple Timeline Track */}
          <div className="relative mb-6">
            <div className="h-2 bg-gray-200 rounded-full relative overflow-hidden">
              {/* Milestone Markers with Hover Labels */}
              {project.psaSignedDate && (
                <div 
                  className="absolute top-0 transform -translate-x-1/2 z-10 group cursor-pointer"
                  style={{ left: "0%" }}
                  data-testid="milestone-psa"
                >
                  <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-sm -mt-1 hover:scale-110 transition-transform" />
                  <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                    <div className="text-xs font-medium text-blue-600">PSA Signed</div>
                    <div className="text-xs text-gray-600">{format(parseISO(project.psaSignedDate), 'MMM d, yyyy')}</div>
                  </div>
                </div>
              )}
              {project.ddExpirationDate && (
                <div 
                  className="absolute top-0 transform -translate-x-1/2 z-10 group cursor-pointer"
                  style={{ left: `${getMilestonePosition(project.ddExpirationDate)}%` }}
                  data-testid="milestone-dd-expiration"
                >
                  <div className="w-4 h-4 bg-amber-500 rounded-full border-2 border-white shadow-sm -mt-1 hover:scale-110 transition-transform" />
                  <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                    <div className="text-xs font-medium text-amber-600">DD Expiration</div>
                    <div className="text-xs text-gray-600">{format(parseISO(project.ddExpirationDate), 'MMM d, yyyy')}</div>
                  </div>
                </div>
              )}
              {project.closingDate && (
                <div 
                  className="absolute top-0 transform -translate-x-1/2 z-10 group cursor-pointer"
                  style={{ left: "100%" }}
                  data-testid="milestone-closing"
                >
                  <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-sm -mt-1 hover:scale-110 transition-transform" />
                  <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                    <div className="text-xs font-medium text-green-600">Closing</div>
                    <div className="text-xs text-gray-600">{format(parseISO(project.closingDate), 'MMM d, yyyy')}</div>
                  </div>
                </div>
              )}
              
              {/* Task Dots */}
              {tasks.filter(t => t.showOnTimeline && t.deadline).map((task) => (
                <div
                  key={task.id}
                  className="absolute top-0 transform -translate-x-1/2 z-10 group cursor-pointer"
                  style={{ left: `${getMilestonePosition(task.deadline!)}%` }}
                  data-testid={`task-dot-${task.id}`}
                >
                  <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm -mt-0.5 hover:scale-110 transition-transform ${
                    task.status === 'completed' ? 'bg-green-500' :
                    task.status === 'in_progress' ? 'bg-blue-500' :
                    task.status === 'scheduled' ? 'bg-blue-600' :
                    'bg-gray-400'
                  }`} />
                  <div className="absolute top-5 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                    <div className="text-xs font-medium text-gray-900">{task.title}</div>
                    <div className="text-xs text-gray-600">{format(parseISO(task.deadline!), 'MMM d, yyyy')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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