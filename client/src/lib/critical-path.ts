import { parseISO, addDays, differenceInDays, startOfDay } from "date-fns";
import type { Task, Project, ProjectSettings } from "@shared/schema";
import { effectiveStart, effectiveDue, daysBetween, addBusinessDays, tzNow } from "./date-utils";

export interface CriticalPathNode {
  taskId: string;
  task: Task;
  earliestStart: Date;
  earliestFinish: Date;
  latestStart: Date;
  latestFinish: Date;
  float: number; // Slack time in days
  isCritical: boolean;
  duration: number; // Duration in days
}

export interface CriticalPathResult {
  nodes: Map<string, CriticalPathNode>;
  criticalPath: string[]; // Array of task IDs on the critical path
  projectDuration: number; // Total project duration in days
  projectStart: Date;
  projectEnd: Date;
}

/**
 * Calculates the critical path for a set of tasks using the Critical Path Method (CPM)
 * 
 * The algorithm performs:
 * 1. Dependency validation and topological sorting
 * 2. Forward pass: Calculate earliest start/finish times
 * 3. Backward pass: Calculate latest start/finish times  
 * 4. Float calculation and critical path identification
 */
export function calculateCriticalPath(
  tasks: Task[], 
  project: Project, 
  settings?: ProjectSettings | null
): CriticalPathResult {
  // Filter tasks that have timeline information
  // Keep completed tasks in the graph to preserve dependency constraints
  const validTasks = tasks.filter(task => task.showOnTimeline);

  if (validTasks.length === 0) {
    const now = tzNow('America/New_York');
    return {
      nodes: new Map(),
      criticalPath: [],
      projectDuration: 0,
      projectStart: now,
      projectEnd: now
    };
  }

  // Build dependency graph and validate
  const dependencyGraph = buildDependencyGraph(validTasks);
  const sortedTasks = topologicalSort(validTasks, dependencyGraph);
  
  if (!sortedTasks) {
    throw new Error('Circular dependency detected in task dependencies');
  }

  // Calculate task durations and effective dates
  const taskDurations = new Map<string, number>();
  const taskStartDates = new Map<string, Date>();
  const taskEndDates = new Map<string, Date>();

  for (const task of validTasks) {
    if (task.status === 'completed' && task.completedAt) {
      // For completed tasks, use actual completion date
      const completedDate = typeof task.completedAt === 'string' ? parseISO(task.completedAt) : task.completedAt;
      taskDurations.set(task.id, 0); // Completed tasks have zero remaining duration
      taskStartDates.set(task.id, completedDate);
      taskEndDates.set(task.id, completedDate);
    } else {
      // For non-completed tasks, use planned dates
      const startDate = effectiveStart(task, { ...project, settings });
      const endDate = effectiveDue(task, { ...project, settings });
      const duration = Math.max(1, daysBetween(startDate, endDate, settings?.useBusinessDays, settings?.holidayCalendar));

      taskDurations.set(task.id, duration);
      taskStartDates.set(task.id, startDate);
      taskEndDates.set(task.id, endDate);
    }
  }

  // Forward pass: Calculate earliest start and finish times
  const earliestTimes = forwardPass(sortedTasks, dependencyGraph, taskDurations, taskStartDates, settings);
  
  // Backward pass: Calculate latest start and finish times
  const latestTimes = backwardPass(sortedTasks, dependencyGraph, taskDurations, earliestTimes, settings);

  // Build result nodes with critical path analysis
  const nodes = new Map<string, CriticalPathNode>();
  const criticalTasks: string[] = [];

  for (const task of validTasks) {
    const earliest = earliestTimes.get(task.id)!;
    const latest = latestTimes.get(task.id)!;
    const duration = taskDurations.get(task.id)!;
    const float = Math.max(0, differenceInDays(latest.start, earliest.start));
    const isCritical = float < 0.5; // Consider critical if float is less than half a day

    const node: CriticalPathNode = {
      taskId: task.id,
      task,
      earliestStart: earliest.start,
      earliestFinish: earliest.finish,
      latestStart: latest.start,
      latestFinish: latest.finish,
      float,
      isCritical,
      duration
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

  return {
    nodes,
    criticalPath: traceCriticalPath(criticalTasks, dependencyGraph, nodes),
    projectDuration,
    projectStart: new Date(projectStart),
    projectEnd: new Date(projectEnd)
  };
}

/**
 * Build adjacency list representation of task dependencies
 */
function buildDependencyGraph(tasks: Task[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  
  for (const task of tasks) {
    const dependencies = task.dependencies || [];
    // Filter out invalid dependencies (empty strings, non-existent tasks)
    const validDeps = dependencies.filter(depId => 
      depId && depId.trim() !== '' && tasks.some(t => t.id === depId)
    );
    graph.set(task.id, validDeps);
  }
  
  return graph;
}

/**
 * Perform topological sort using Kahn's algorithm to detect cycles and order tasks
 */
function topologicalSort(tasks: Task[], dependencyGraph: Map<string, string[]>): Task[] | null {
  const inDegree = new Map<string, number>();
  const taskMap = new Map<string, Task>();
  
  // Initialize in-degree and task map
  for (const task of tasks) {
    inDegree.set(task.id, 0);
    taskMap.set(task.id, task);
  }

  // Calculate in-degrees
  dependencyGraph.forEach((dependencies, taskId) => {
    // taskId depends on each dependency, so taskId has incoming edges from each dependency
    // Therefore, taskId's in-degree equals the number of its dependencies
    inDegree.set(taskId, dependencies.length);
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
    // Find all tasks that depend on the current task
    dependencyGraph.forEach((dependencies, successorId) => {
      if (dependencies.includes(currentId)) {
        inDegree.set(successorId, inDegree.get(successorId)! - 1);
        if (inDegree.get(successorId) === 0) {
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
 * Forward pass: Calculate earliest start and finish times
 */
function forwardPass(
  sortedTasks: Task[], 
  dependencyGraph: Map<string, string[]>, 
  taskDurations: Map<string, number>,
  taskStartDates: Map<string, Date>,
  settings?: ProjectSettings | null
): Map<string, { start: Date; finish: Date }> {
  const earliestTimes = new Map<string, { start: Date; finish: Date }>();

  for (const task of sortedTasks) {
    const dependencies = dependencyGraph.get(task.id) || [];
    const duration = taskDurations.get(task.id)!;
    
    let earliestStart: Date;

    if (dependencies.length === 0) {
      // No dependencies - use the task's natural start date
      earliestStart = taskStartDates.get(task.id)!;
    } else {
      // Find the latest finish time among all dependencies
      let latestDependencyFinish = new Date(0);
      for (const depId of dependencies) {
        const depTimes = earliestTimes.get(depId);
        if (depTimes && depTimes.finish > latestDependencyFinish) {
          latestDependencyFinish = depTimes.finish;
        }
      }
      
      // Start after the latest dependency finishes, but not before natural start
      const naturalStart = taskStartDates.get(task.id)!;
      earliestStart = latestDependencyFinish > naturalStart ? latestDependencyFinish : naturalStart;
    }

    const earliestFinish = duration === 0 
      ? earliestStart // Completed tasks finish when they start
      : settings?.useBusinessDays 
        ? addBusinessDays(earliestStart, duration, settings.holidayCalendar)
        : addDays(earliestStart, duration);
    
    earliestTimes.set(task.id, {
      start: earliestStart,
      finish: earliestFinish
    });
  }

  return earliestTimes;
}

/**
 * Backward pass: Calculate latest start and finish times
 */
function backwardPass(
  sortedTasks: Task[], 
  dependencyGraph: Map<string, string[]>, 
  taskDurations: Map<string, number>,
  earliestTimes: Map<string, { start: Date; finish: Date }>,
  settings?: ProjectSettings | null
): Map<string, { start: Date; finish: Date }> {
  const latestTimes = new Map<string, { start: Date; finish: Date }>();
  
  // Build reverse dependency graph (successors)
  const successors = new Map<string, string[]>();
  for (const task of sortedTasks) {
    successors.set(task.id, []);
  }
  
  dependencyGraph.forEach((dependencies, taskId) => {
    for (const depId of dependencies) {
      const successorList = successors.get(depId) || [];
      successorList.push(taskId);
      successors.set(depId, successorList);
    }
  });

  // Process tasks in reverse topological order
  const reversedTasks = [...sortedTasks].reverse();

  for (const task of reversedTasks) {
    const taskSuccessors = successors.get(task.id) || [];
    const duration = taskDurations.get(task.id)!;
    
    let latestFinish: Date;

    if (taskSuccessors.length === 0) {
      // No successors - latest finish is the earliest finish (end of critical path)
      latestFinish = earliestTimes.get(task.id)!.finish;
    } else {
      // Find the earliest start time among all successors
      let earliestSuccessorStart = new Date(8640000000000000); // Max date
      for (const succId of taskSuccessors) {
        const succTimes = latestTimes.get(succId);
        if (succTimes && succTimes.start < earliestSuccessorStart) {
          earliestSuccessorStart = succTimes.start;
        }
      }
      latestFinish = earliestSuccessorStart;
    }

    const latestStart = duration === 0
      ? latestFinish // Completed tasks start when they finish
      : settings?.useBusinessDays
        ? addBusinessDays(latestFinish, -duration, settings.holidayCalendar)
        : addDays(latestFinish, -duration);
    
    latestTimes.set(task.id, {
      start: latestStart,
      finish: latestFinish
    });
  }

  return latestTimes;
}

/**
 * Trace the actual critical path using a deterministic approach to find the longest zero-float chain
 */
function traceCriticalPath(
  criticalTasks: string[], 
  dependencyGraph: Map<string, string[]>,
  nodes: Map<string, CriticalPathNode>
): string[] {
  if (criticalTasks.length === 0) return [];

  // Build a subgraph containing only critical tasks and their dependencies
  const criticalGraph = new Map<string, string[]>();
  for (const taskId of criticalTasks) {
    const dependencies = dependencyGraph.get(taskId) || [];
    const criticalDeps = dependencies.filter(depId => criticalTasks.includes(depId));
    criticalGraph.set(taskId, criticalDeps);
  }

  // Find the longest path through the critical graph using dynamic programming
  const longestPaths = new Map<string, { length: number; path: string[] }>();
  const visited = new Set<string>();

  function calculateLongestPath(taskId: string): { length: number; path: string[] } {
    if (visited.has(taskId)) {
      return longestPaths.get(taskId) || { length: 0, path: [] };
    }

    visited.add(taskId);
    const dependencies = criticalGraph.get(taskId) || [];

    if (dependencies.length === 0) {
      // No dependencies - this is a start node with path length 1
      const result = { length: 1, path: [taskId] };
      longestPaths.set(taskId, result);
      return result;
    }

    // Find the longest path among all dependencies and extend it
    let maxLength = 0;
    let bestPath: string[] = [];

    for (const depId of dependencies) {
      const depResult = calculateLongestPath(depId);
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

  // If we found a path, validate it's a complete chain, otherwise fall back to chronological order
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
 * Get critical path information for a specific task
 */
export function getTaskCriticalInfo(taskId: string, criticalPathResult: CriticalPathResult): CriticalPathNode | null {
  return criticalPathResult.nodes.get(taskId) || null;
}

/**
 * Check if a task is on the critical path
 */
export function isTaskCritical(taskId: string, criticalPathResult: CriticalPathResult): boolean {
  return criticalPathResult.criticalPath.includes(taskId);
}

/**
 * Get all tasks with float less than a specified number of days
 */
export function getNearCriticalTasks(criticalPathResult: CriticalPathResult, maxFloatDays: number = 2): CriticalPathNode[] {
  return Array.from(criticalPathResult.nodes.values())
    .filter(node => node.float <= maxFloatDays)
    .sort((a, b) => a.float - b.float);
}