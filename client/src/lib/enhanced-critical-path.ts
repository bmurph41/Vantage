import { parseISO, addDays, differenceInDays, startOfDay } from "date-fns";
import type { Task, Project, ProjectSettings, TaskDependency } from "@shared/schema";
import { effectiveStart, effectiveDue, daysBetween, addBusinessDays, tzNow } from "./date-utils";

// Enhanced interfaces for backward compatibility
export interface EnhancedDependency {
  predecessorId: string;
  successorId: string;
  type: "FS" | "SS" | "FF" | "SF";
  lagDays: number;
  isActive: boolean;
  source: "legacy" | "enhanced"; // Track source for debugging
}

export interface EnhancedCriticalPathNode {
  taskId: string;
  task: Task;
  earliestStart: Date;
  earliestFinish: Date;
  latestStart: Date;
  latestFinish: Date;
  float: number; // Slack time in days
  isCritical: boolean;
  duration: number; // Duration in days (potentially PERT calculated)
  estimationType: "fixed" | "pert"; // How duration was calculated
  constraints: {
    earliestStart?: Date;
    requiredFinish?: Date;
  };
}

export interface EnhancedCriticalPathResult {
  nodes: Map<string, EnhancedCriticalPathNode>;
  criticalPath: string[]; // Array of task IDs on the critical path
  projectDuration: number; // Total project duration in days
  projectStart: Date;
  projectEnd: Date;
  dependencySources: {
    legacy: number; // Count of legacy dependencies used
    enhanced: number; // Count of enhanced dependencies used
  };
}

/**
 * Enhanced Critical Path Method with backward compatibility
 * 
 * Features:
 * - Reads from both legacy dependencies array and enhanced task_dependencies table
 * - Supports all dependency types (FS/SS/FF/SF) with lag days
 * - PERT estimation using optimistic/mostLikely/pessimistic days
 * - Constraint handling for earliest start and required finish
 * - 100% backward compatibility with existing projects
 */
export function calculateEnhancedCriticalPath(
  tasks: Task[], 
  project: Project, 
  settings?: ProjectSettings | null,
  enhancedDependencies?: TaskDependency[] | null
): EnhancedCriticalPathResult {
  // Filter tasks that have timeline information
  const validTasks = tasks.filter(task => task.showOnTimeline);

  if (validTasks.length === 0) {
    const now = tzNow('America/New_York');
    return {
      nodes: new Map(),
      criticalPath: [],
      projectDuration: 0,
      projectStart: now,
      projectEnd: now,
      dependencySources: { legacy: 0, enhanced: 0 }
    };
  }

  // Build unified dependency graph from both sources
  const unifiedDependencies = buildUnifiedDependencyGraph(validTasks, enhancedDependencies);
  const dependencyGraph = buildEnhancedDependencyGraph(unifiedDependencies);
  const sortedTasks = topologicalSortEnhanced(validTasks, dependencyGraph);
  
  if (!sortedTasks) {
    throw new Error('Circular dependency detected in task dependencies');
  }

  // Calculate task durations with PERT support
  const taskDurations = new Map<string, { duration: number; type: "fixed" | "pert" }>();
  const taskStartDates = new Map<string, Date>();
  const taskEndDates = new Map<string, Date>();
  const taskConstraints = new Map<string, { earliestStart?: Date; requiredFinish?: Date }>();

  for (const task of validTasks) {
    // Extract constraints
    const constraints: { earliestStart?: Date; requiredFinish?: Date } = {};
    if (task.earliestStart) {
      constraints.earliestStart = typeof task.earliestStart === 'string' ? parseISO(task.earliestStart) : task.earliestStart;
    }
    if (task.requiredFinish) {
      constraints.requiredFinish = typeof task.requiredFinish === 'string' ? parseISO(task.requiredFinish) : task.requiredFinish;
    }
    taskConstraints.set(task.id, constraints);

    if (task.status === 'completed' && task.completedAt) {
      // For completed tasks, use actual completion date
      const completedDate = typeof task.completedAt === 'string' ? parseISO(task.completedAt) : task.completedAt;
      taskDurations.set(task.id, { duration: 0, type: "fixed" }); // Completed tasks have zero remaining duration
      taskStartDates.set(task.id, completedDate);
      taskEndDates.set(task.id, completedDate);
    } else {
      // For non-completed tasks, calculate duration with PERT support
      const durationResult = calculateTaskDuration(task, { ...project, settings });
      taskDurations.set(task.id, durationResult);

      const startDate = effectiveStart(task, { ...project, settings });
      const endDate = effectiveDue(task, { ...project, settings });
      
      taskStartDates.set(task.id, startDate);
      taskEndDates.set(task.id, endDate);
    }
  }

  // Enhanced forward pass with dependency types and lags
  const earliestTimes = enhancedForwardPass(sortedTasks, dependencyGraph, taskDurations, taskStartDates, taskConstraints, settings);
  
  // Enhanced backward pass with dependency types and lags  
  const latestTimes = enhancedBackwardPass(sortedTasks, dependencyGraph, taskDurations, earliestTimes, taskConstraints, settings);

  // Build result nodes with enhanced analysis
  const nodes = new Map<string, EnhancedCriticalPathNode>();
  const criticalTasks: string[] = [];

  for (const task of validTasks) {
    const earliest = earliestTimes.get(task.id)!;
    const latest = latestTimes.get(task.id)!;
    const durationInfo = taskDurations.get(task.id)!;
    const constraints = taskConstraints.get(task.id)!;
    const float = Math.max(0, differenceInDays(latest.start, earliest.start));
    const isCritical = float < 0.5; // Consider critical if float is less than half a day

    const node: EnhancedCriticalPathNode = {
      taskId: task.id,
      task,
      earliestStart: earliest.start,
      earliestFinish: earliest.finish,
      latestStart: latest.start,
      latestFinish: latest.finish,
      float,
      isCritical,
      duration: durationInfo.duration,
      estimationType: durationInfo.type,
      constraints
    };

    nodes.set(task.id, node);
    
    if (isCritical) {
      criticalTasks.push(task.id);
    }
  }

  // Calculate overall project metrics
  const projectStart = Math.min(...Array.from(earliestTimes.values()).map(t => t.start.getTime()));
  const projectEnd = Math.max(...Array.from(earliestTimes.values()).map(t => t.finish.getTime()));
  const projectDuration = Math.max(1, differenceInDays(new Date(projectEnd), new Date(projectStart)));

  // Count dependency sources
  let legacyCount = 0;
  let enhancedCount = 0;
  unifiedDependencies.forEach(dep => {
    if (dep.source === "legacy") legacyCount++;
    else enhancedCount++;
  });

  return {
    nodes,
    criticalPath: traceEnhancedCriticalPath(criticalTasks, dependencyGraph, nodes),
    projectDuration,
    projectStart: new Date(projectStart),
    projectEnd: new Date(projectEnd),
    dependencySources: { legacy: legacyCount, enhanced: enhancedCount }
  };
}

/**
 * Build unified dependency graph from both legacy array and enhanced table
 */
function buildUnifiedDependencyGraph(
  tasks: Task[], 
  enhancedDependencies?: TaskDependency[] | null
): EnhancedDependency[] {
  const unified: EnhancedDependency[] = [];
  const taskIds = new Set(tasks.map(t => t.id));
  
  // Process legacy dependencies from task.dependencies array
  for (const task of tasks) {
    const legacyDeps = task.dependencies || [];
    for (const depId of legacyDeps) {
      if (depId && depId.trim() !== '' && taskIds.has(depId)) {
        unified.push({
          predecessorId: depId,
          successorId: task.id,
          type: "FS", // Legacy dependencies are always Finish-to-Start
          lagDays: 0, // Legacy dependencies have no lag
          isActive: true,
          source: "legacy"
        });
      }
    }
  }

  // Process enhanced dependencies from task_dependencies table
  if (enhancedDependencies) {
    for (const dep of enhancedDependencies) {
      // Only include active dependencies for tasks that exist in our current task set
      if (dep.isActive && taskIds.has(dep.successorId) && taskIds.has(dep.predecessorId)) {
        unified.push({
          predecessorId: dep.predecessorId,
          successorId: dep.successorId,
          type: dep.type as "FS" | "SS" | "FF" | "SF",
          lagDays: dep.lagDays,
          isActive: dep.isActive,
          source: "enhanced"
        });
      }
    }
  }

  return unified;
}

/**
 * Build enhanced dependency graph with type and lag information
 */
function buildEnhancedDependencyGraph(
  unifiedDependencies: EnhancedDependency[]
): Map<string, EnhancedDependency[]> {
  const graph = new Map<string, EnhancedDependency[]>();
  
  // Group dependencies by successor task
  for (const dep of unifiedDependencies) {
    const existing = graph.get(dep.successorId) || [];
    existing.push(dep);
    graph.set(dep.successorId, existing);
  }
  
  return graph;
}

/**
 * Enhanced topological sort that handles all dependency types
 */
function topologicalSortEnhanced(
  tasks: Task[], 
  dependencyGraph: Map<string, EnhancedDependency[]>
): Task[] | null {
  const inDegree = new Map<string, number>();
  const taskMap = new Map<string, Task>();
  
  // Initialize in-degree and task map
  for (const task of tasks) {
    inDegree.set(task.id, 0);
    taskMap.set(task.id, task);
  }

  // Calculate in-degrees based on dependencies
  dependencyGraph.forEach((dependencies, successorId) => {
    inDegree.set(successorId, dependencies.length);
  });

  // Find tasks with no dependencies (in-degree 0)
  const queue: string[] = [];
  inDegree.forEach((degree, taskId) => {
    if (degree === 0) {
      queue.push(taskId);
    }
  });

  const result: Task[] = [];
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentTask = taskMap.get(currentId)!;
    result.push(currentTask);

    // Remove edges from current task to its successors
    dependencyGraph.forEach((dependencies, successorId) => {
      const remainingDeps = dependencies.filter(dep => dep.predecessorId !== currentId);
      if (remainingDeps.length !== dependencies.length) {
        dependencyGraph.set(successorId, remainingDeps);
        inDegree.set(successorId, remainingDeps.length);
        if (remainingDeps.length === 0) {
          queue.push(successorId);
        }
      }
    });
  }

  // Check for cycles
  if (result.length !== tasks.length) {
    return null; // Circular dependency detected
  }

  return result;
}

/**
 * Calculate task duration with PERT support
 */
function calculateTaskDuration(
  task: Task, 
  projectWithSettings: Project & { settings?: ProjectSettings | null }
): { duration: number; type: "fixed" | "pert" } {
  // Check if PERT estimates are available
  if (task.optimisticDays && task.mostLikelyDays && task.pessimisticDays) {
    // Calculate PERT estimate: (Optimistic + 4*Most Likely + Pessimistic) / 6
    const pertDuration = (task.optimisticDays + 4 * task.mostLikelyDays + task.pessimisticDays) / 6;
    return { duration: Math.max(1, Math.round(pertDuration)), type: "pert" };
  }

  // Fall back to standard duration calculation
  const startDate = effectiveStart(task, projectWithSettings);
  const endDate = effectiveDue(task, projectWithSettings);
  const duration = Math.max(1, daysBetween(startDate, endDate, projectWithSettings.settings?.useBusinessDays, projectWithSettings.settings?.holidayCalendar));
  
  return { duration, type: "fixed" };
}

/**
 * Enhanced forward pass with dependency types, lags, and constraints
 */
function enhancedForwardPass(
  sortedTasks: Task[], 
  dependencyGraph: Map<string, EnhancedDependency[]>, 
  taskDurations: Map<string, { duration: number; type: "fixed" | "pert" }>,
  taskStartDates: Map<string, Date>,
  taskConstraints: Map<string, { earliestStart?: Date; requiredFinish?: Date }>,
  settings?: ProjectSettings | null
): Map<string, { start: Date; finish: Date }> {
  const earliestTimes = new Map<string, { start: Date; finish: Date }>();

  for (const task of sortedTasks) {
    const dependencies = dependencyGraph.get(task.id) || [];
    const durationInfo = taskDurations.get(task.id)!;
    const constraints = taskConstraints.get(task.id)!;
    
    let earliestStart: Date;

    if (dependencies.length === 0) {
      // No dependencies - use the task's natural start date
      earliestStart = taskStartDates.get(task.id)!;
    } else {
      // Calculate earliest start based on dependencies with their types and lags
      let maxRequiredStart = new Date(0);
      
      for (const dep of dependencies) {
        const predTimes = earliestTimes.get(dep.predecessorId);
        if (!predTimes) continue;

        let requiredStart: Date;
        
        // Calculate required start based on dependency type
        switch (dep.type) {
          case "FS": // Finish-to-Start: successor starts after predecessor finishes
            requiredStart = settings?.useBusinessDays 
              ? addBusinessDays(predTimes.finish, dep.lagDays, settings.holidayCalendar)
              : addDays(predTimes.finish, dep.lagDays);
            break;
          case "SS": // Start-to-Start: successor starts after predecessor starts  
            requiredStart = settings?.useBusinessDays 
              ? addBusinessDays(predTimes.start, dep.lagDays, settings.holidayCalendar)
              : addDays(predTimes.start, dep.lagDays);
            break;
          case "FF": // Finish-to-Finish: successor finishes after predecessor finishes
            const predFinishPlusLag = settings?.useBusinessDays 
              ? addBusinessDays(predTimes.finish, dep.lagDays, settings.holidayCalendar)
              : addDays(predTimes.finish, dep.lagDays);
            // Work backwards from required finish to get required start
            requiredStart = settings?.useBusinessDays 
              ? addBusinessDays(predFinishPlusLag, -durationInfo.duration, settings.holidayCalendar)
              : addDays(predFinishPlusLag, -durationInfo.duration);
            break;
          case "SF": // Start-to-Finish: successor finishes after predecessor starts
            const predStartPlusLag = settings?.useBusinessDays 
              ? addBusinessDays(predTimes.start, dep.lagDays, settings.holidayCalendar)
              : addDays(predTimes.start, dep.lagDays);
            // Work backwards from required finish to get required start
            requiredStart = settings?.useBusinessDays 
              ? addBusinessDays(predStartPlusLag, -durationInfo.duration, settings.holidayCalendar)
              : addDays(predStartPlusLag, -durationInfo.duration);
            break;
        }

        if (requiredStart > maxRequiredStart) {
          maxRequiredStart = requiredStart;
        }
      }
      
      // Use the later of dependency-driven start and natural start
      const naturalStart = taskStartDates.get(task.id)!;
      earliestStart = maxRequiredStart > naturalStart ? maxRequiredStart : naturalStart;
    }

    // Apply earliest start constraint if present
    if (constraints.earliestStart && constraints.earliestStart > earliestStart) {
      earliestStart = constraints.earliestStart;
    }

    const earliestFinish = durationInfo.duration === 0 
      ? earliestStart // Completed tasks finish when they start
      : settings?.useBusinessDays 
        ? addBusinessDays(earliestStart, durationInfo.duration, settings.holidayCalendar)
        : addDays(earliestStart, durationInfo.duration);
    
    earliestTimes.set(task.id, {
      start: earliestStart,
      finish: earliestFinish
    });
  }

  return earliestTimes;
}

/**
 * Enhanced backward pass with dependency types, lags, and constraints
 */
function enhancedBackwardPass(
  sortedTasks: Task[], 
  dependencyGraph: Map<string, EnhancedDependency[]>, 
  taskDurations: Map<string, { duration: number; type: "fixed" | "pert" }>,
  earliestTimes: Map<string, { start: Date; finish: Date }>,
  taskConstraints: Map<string, { earliestStart?: Date; requiredFinish?: Date }>,
  settings?: ProjectSettings | null
): Map<string, { start: Date; finish: Date }> {
  const latestTimes = new Map<string, { start: Date; finish: Date }>();
  
  // Build reverse dependency graph (successors)
  const successors = new Map<string, EnhancedDependency[]>();
  for (const task of sortedTasks) {
    successors.set(task.id, []);
  }
  
  dependencyGraph.forEach((dependencies, successorId) => {
    for (const dep of dependencies) {
      const successorList = successors.get(dep.predecessorId) || [];
      successorList.push({
        ...dep,
        // Reverse the relationship for backward pass
        predecessorId: dep.successorId,
        successorId: dep.predecessorId
      });
      successors.set(dep.predecessorId, successorList);
    }
  });

  // Process tasks in reverse topological order
  const reversedTasks = [...sortedTasks].reverse();

  for (const task of reversedTasks) {
    const taskSuccessors = successors.get(task.id) || [];
    const durationInfo = taskDurations.get(task.id)!;
    const constraints = taskConstraints.get(task.id)!;
    
    let latestFinish: Date;

    if (taskSuccessors.length === 0) {
      // No successors - latest finish is the earliest finish (end of critical path)
      latestFinish = earliestTimes.get(task.id)!.finish;
    } else {
      // Calculate latest finish based on successors with their types and lags
      let minRequiredFinish = new Date(8640000000000000); // Max date
      
      for (const succ of taskSuccessors) {
        const succTimes = latestTimes.get(succ.predecessorId); // Note: reversed relationship
        if (!succTimes) continue;

        let requiredFinish: Date;
        
        // Calculate required finish based on dependency type (reversed logic)
        switch (succ.type) {
          case "FS": // Finish-to-Start: predecessor must finish before successor starts
            requiredFinish = settings?.useBusinessDays 
              ? addBusinessDays(succTimes.start, -succ.lagDays, settings.holidayCalendar)
              : addDays(succTimes.start, -succ.lagDays);
            break;
          case "SS": // Start-to-Start: predecessor must start before successor starts
            const succStart = succTimes.start;
            const predRequiredStart = settings?.useBusinessDays 
              ? addBusinessDays(succStart, -succ.lagDays, settings.holidayCalendar)
              : addDays(succStart, -succ.lagDays);
            requiredFinish = settings?.useBusinessDays 
              ? addBusinessDays(predRequiredStart, durationInfo.duration, settings.holidayCalendar)
              : addDays(predRequiredStart, durationInfo.duration);
            break;
          case "FF": // Finish-to-Finish: predecessor must finish before successor finishes
            requiredFinish = settings?.useBusinessDays 
              ? addBusinessDays(succTimes.finish, -succ.lagDays, settings.holidayCalendar)
              : addDays(succTimes.finish, -succ.lagDays);
            break;
          case "SF": // Start-to-Finish: predecessor must start before successor finishes
            const succFinish = succTimes.finish;
            const predRequiredStart2 = settings?.useBusinessDays 
              ? addBusinessDays(succFinish, -succ.lagDays, settings.holidayCalendar)
              : addDays(succFinish, -succ.lagDays);
            requiredFinish = settings?.useBusinessDays 
              ? addBusinessDays(predRequiredStart2, durationInfo.duration, settings.holidayCalendar)
              : addDays(predRequiredStart2, durationInfo.duration);
            break;
        }

        if (requiredFinish < minRequiredFinish) {
          minRequiredFinish = requiredFinish;
        }
      }
      
      latestFinish = minRequiredFinish;
    }

    // Apply required finish constraint if present
    if (constraints.requiredFinish && constraints.requiredFinish < latestFinish) {
      latestFinish = constraints.requiredFinish;
    }

    const latestStart = durationInfo.duration === 0
      ? latestFinish // Completed tasks start when they finish
      : settings?.useBusinessDays
        ? addBusinessDays(latestFinish, -durationInfo.duration, settings.holidayCalendar)
        : addDays(latestFinish, -durationInfo.duration);
    
    latestTimes.set(task.id, {
      start: latestStart,
      finish: latestFinish
    });
  }

  return latestTimes;
}

/**
 * Trace the enhanced critical path
 */
function traceEnhancedCriticalPath(
  criticalTasks: string[], 
  dependencyGraph: Map<string, EnhancedDependency[]>,
  nodes: Map<string, EnhancedCriticalPathNode>
): string[] {
  if (criticalTasks.length === 0) return [];

  // Build a subgraph containing only critical tasks and their dependencies
  const criticalGraph = new Map<string, EnhancedDependency[]>();
  for (const taskId of criticalTasks) {
    const dependencies = dependencyGraph.get(taskId) || [];
    const criticalDeps = dependencies.filter(dep => criticalTasks.includes(dep.predecessorId));
    criticalGraph.set(taskId, criticalDeps);
  }

  // Find the longest path through the critical graph
  const longestPaths = new Map<string, { length: number; path: string[] }>();
  const visited = new Set<string>();

  function calculateLongestPath(taskId: string): { length: number; path: string[] } {
    if (visited.has(taskId)) {
      return longestPaths.get(taskId) || { length: 0, path: [] };
    }

    visited.add(taskId);
    const dependencies = criticalGraph.get(taskId) || [];

    if (dependencies.length === 0) {
      const result = { length: 1, path: [taskId] };
      longestPaths.set(taskId, result);
      return result;
    }

    let maxLength = 0;
    let bestPath: string[] = [];

    for (const dep of dependencies) {
      const depResult = calculateLongestPath(dep.predecessorId);
      if (depResult.length > maxLength) {
        maxLength = depResult.length;
        bestPath = [...depResult.path];
      }
    }

    const result = { length: maxLength + 1, path: [...bestPath, taskId] };
    longestPaths.set(taskId, result);
    return result;
  }

  // Calculate longest paths for all critical tasks
  for (const taskId of criticalTasks) {
    calculateLongestPath(taskId);
  }

  // Find the task with the overall longest path
  let globalMaxLength = 0;
  let criticalPath: string[] = [];

  for (const taskId of criticalTasks) {
    const pathInfo = longestPaths.get(taskId);
    if (pathInfo && pathInfo.length > globalMaxLength) {
      globalMaxLength = pathInfo.length;
      criticalPath = pathInfo.path;
    }
  }

  if (criticalPath.length > 0) {
    return criticalPath;
  }

  // Fallback: return critical tasks in chronological order
  return criticalTasks.sort((a, b) => {
    const nodeA = nodes.get(a)!;
    const nodeB = nodes.get(b)!;
    return nodeA.earliestStart.getTime() - nodeB.earliestStart.getTime();
  });
}

/**
 * Backward compatible wrapper that uses the original interface
 * This maintains 100% compatibility with existing code
 */
export function calculateCriticalPathEnhanced(
  tasks: Task[], 
  project: Project, 
  settings?: ProjectSettings | null,
  enhancedDependencies?: TaskDependency[] | null
) {
  const result = calculateEnhancedCriticalPath(tasks, project, settings, enhancedDependencies);
  
  // Convert to original interface format for backward compatibility
  return {
    nodes: new Map(Array.from(result.nodes.entries()).map(([id, node]) => [
      id, 
      {
        taskId: node.taskId,
        task: node.task,
        earliestStart: node.earliestStart,
        earliestFinish: node.earliestFinish,
        latestStart: node.latestStart,
        latestFinish: node.latestFinish,
        float: node.float,
        isCritical: node.isCritical,
        duration: node.duration
      }
    ])),
    criticalPath: result.criticalPath,
    projectDuration: result.projectDuration,
    projectStart: result.projectStart,
    projectEnd: result.projectEnd
  };
}

/**
 * Get enhanced critical path information for a specific task
 */
export function getEnhancedTaskCriticalInfo(taskId: string, criticalPathResult: EnhancedCriticalPathResult): EnhancedCriticalPathNode | null {
  return criticalPathResult.nodes.get(taskId) || null;
}

/**
 * Check if a task is on the enhanced critical path
 */
export function isEnhancedTaskCritical(taskId: string, criticalPathResult: EnhancedCriticalPathResult): boolean {
  return criticalPathResult.criticalPath.includes(taskId);
}

/**
 * Get dependency source statistics for debugging/monitoring
 */
export function getDependencySourceStats(criticalPathResult: EnhancedCriticalPathResult): {
  legacy: number;
  enhanced: number;
  total: number;
  migrationProgress: number; // Percentage of dependencies using enhanced format
} {
  const { legacy, enhanced } = criticalPathResult.dependencySources;
  const total = legacy + enhanced;
  const migrationProgress = total > 0 ? Math.round((enhanced / total) * 100) : 0;
  
  return { legacy, enhanced, total, migrationProgress };
}