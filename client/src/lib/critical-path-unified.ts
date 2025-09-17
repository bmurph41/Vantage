import { calculateCriticalPath, type CriticalPathResult } from "./critical-path";

export { type CriticalPathResult } from "./critical-path";
import { calculateEnhancedCriticalPath, type EnhancedCriticalPathResult } from "./enhanced-critical-path";
import type { Task, Project, ProjectSettings, TaskDependency } from "@shared/schema";

/**
 * Unified Critical Path Interface
 * 
 * This provides a seamless backward-compatible interface that automatically:
 * 1. Uses enhanced engine when enhanced dependencies are available
 * 2. Falls back to legacy engine for existing simple projects
 * 3. Maintains 100% backward compatibility with existing code
 * 4. Provides enhanced features transparently when data supports it
 */

export interface UnifiedCriticalPathOptions {
  /** Enhanced task dependencies from the database (optional) */
  enhancedDependencies?: TaskDependency[] | null;
  /** Force use of enhanced engine even without enhanced dependencies */
  forceEnhanced?: boolean;
  /** Enable enhanced features detection and usage */
  enableEnhancedFeatures?: boolean;
}

/**
 * Unified critical path calculation that automatically chooses the best engine
 */
export function calculateUnifiedCriticalPath(
  tasks: Task[], 
  project: Project, 
  settings?: ProjectSettings | null,
  options: UnifiedCriticalPathOptions = {}
): CriticalPathResult {
  const { 
    enhancedDependencies = null, 
    forceEnhanced = false,
    enableEnhancedFeatures = true 
  } = options;

  // Detect if enhanced features should be used
  const shouldUseEnhanced = forceEnhanced || 
    (enableEnhancedFeatures && (
      enhancedDependencies && enhancedDependencies.length > 0 || // Has enhanced dependencies
      tasks.some(task => hasEnhancedTaskFeatures(task)) // Has enhanced task features
    ));

  if (shouldUseEnhanced) {
    // Use enhanced engine and convert to backward-compatible format
    const enhancedResult = calculateEnhancedCriticalPath(tasks, project, settings, enhancedDependencies);
    
    return {
      nodes: new Map(Array.from(enhancedResult.nodes.entries()).map(([id, node]) => [
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
      criticalPath: enhancedResult.criticalPath,
      projectDuration: enhancedResult.projectDuration,
      projectStart: enhancedResult.projectStart,
      projectEnd: enhancedResult.projectEnd
    };
  } else {
    // Use legacy engine for simple projects
    return calculateCriticalPath(tasks, project, settings);
  }
}

/**
 * Check if a task has enhanced features that would benefit from the enhanced engine
 */
function hasEnhancedTaskFeatures(task: Task): boolean {
  return !!(
    task.optimisticDays ||
    task.mostLikelyDays ||
    task.pessimisticDays ||
    task.earliestStart ||
    task.requiredFinish
  );
}

/**
 * Get enhanced critical path result if available, otherwise return null
 * This allows consumers to access enhanced features when available
 */
export function getEnhancedCriticalPathResult(
  tasks: Task[], 
  project: Project, 
  settings?: ProjectSettings | null,
  options: UnifiedCriticalPathOptions = {}
): EnhancedCriticalPathResult | null {
  const { enhancedDependencies = null, enableEnhancedFeatures = true } = options;

  const shouldUseEnhanced = enableEnhancedFeatures && (
    enhancedDependencies && enhancedDependencies.length > 0 ||
    tasks.some(task => hasEnhancedTaskFeatures(task))
  );

  if (shouldUseEnhanced) {
    return calculateEnhancedCriticalPath(tasks, project, settings, enhancedDependencies);
  }

  return null;
}

/**
 * Backward compatible wrapper for existing timeline view component
 * This maintains the exact same interface as the original functions
 */

export function isTaskCritical(taskId: string, criticalPathResult: CriticalPathResult): boolean {
  return criticalPathResult.criticalPath.includes(taskId);
}

export function getTaskCriticalInfo(taskId: string, criticalPathResult: CriticalPathResult) {
  return criticalPathResult.nodes.get(taskId) || null;
}

export function getNearCriticalTasks(criticalPathResult: CriticalPathResult, maxFloatDays: number = 2) {
  return Array.from(criticalPathResult.nodes.values())
    .filter(node => node.float <= maxFloatDays)
    .sort((a, b) => a.float - b.float);
}

/**
 * Enhanced feature detection for UI components
 */
export interface FeatureDetectionResult {
  hasEnhancedDependencies: boolean;
  hasEnhancedTaskFeatures: boolean;
  hasPertEstimates: boolean;
  hasConstraints: boolean;
  migrationProgress: number; // 0-100 percentage
}

export function detectEnhancedFeatures(
  tasks: Task[],
  enhancedDependencies?: TaskDependency[] | null
): FeatureDetectionResult {
  const hasEnhancedDependencies = !!(enhancedDependencies && enhancedDependencies.length > 0);
  const tasksWithEnhanced = tasks.filter(hasEnhancedTaskFeatures);
  const hasEnhancedTaskFeaturesDetected = tasksWithEnhanced.length > 0;
  
  const tasksWithPert = tasks.filter(task => 
    task.optimisticDays && task.mostLikelyDays && task.pessimisticDays
  );
  const hasPertEstimates = tasksWithPert.length > 0;
  
  const tasksWithConstraints = tasks.filter(task => 
    task.earliestStart || task.requiredFinish
  );
  const hasConstraints = tasksWithConstraints.length > 0;
  
  // Calculate migration progress based on enhanced features usage
  const totalTasks = tasks.length;
  const enhancedTasks = tasksWithEnhanced.length;
  const legacyDepsCount = tasks.reduce((sum, task) => sum + (task.dependencies?.length || 0), 0);
  const enhancedDepsCount = enhancedDependencies?.length || 0;
  const totalDeps = legacyDepsCount + enhancedDepsCount;
  
  let migrationProgress = 0;
  if (totalTasks > 0 && totalDeps > 0) {
    const taskProgress = (enhancedTasks / totalTasks) * 50; // Tasks contribute 50%
    const depProgress = totalDeps > 0 ? (enhancedDepsCount / totalDeps) * 50 : 0; // Deps contribute 50%
    migrationProgress = Math.round(taskProgress + depProgress);
  }

  return {
    hasEnhancedDependencies,
    hasEnhancedTaskFeatures: hasEnhancedTaskFeaturesDetected,
    hasPertEstimates,
    hasConstraints,
    migrationProgress
  };
}

/**
 * Migration helper for gradually converting legacy dependencies to enhanced format
 */
export interface MigrationSuggestion {
  taskId: string;
  taskTitle: string;
  suggestions: string[];
  priority: "high" | "medium" | "low";
}

export function getMigrationSuggestions(
  tasks: Task[],
  enhancedDependencies?: TaskDependency[] | null
): MigrationSuggestion[] {
  const suggestions: MigrationSuggestion[] = [];
  const enhancedTaskIds = new Set(
    enhancedDependencies?.map(dep => dep.successorId) || []
  );

  for (const task of tasks) {
    const taskSuggestions: string[] = [];
    let priority: "high" | "medium" | "low" = "low";

    // Check for legacy dependencies that could be enhanced
    if (task.dependencies && task.dependencies.length > 0 && !enhancedTaskIds.has(task.id)) {
      taskSuggestions.push("Convert simple dependencies to enhanced format with dependency types");
      priority = "medium";
    }

    // Check for missing PERT estimates on tasks with high priority or long duration
    if (task.priority === "high" && !task.optimisticDays) {
      taskSuggestions.push("Add PERT estimates (optimistic/most likely/pessimistic) for better duration planning");
      priority = "high";
    }

    // Check for missing constraints on critical tasks
    if (task.priority === "high" && !task.earliestStart && !task.requiredFinish) {
      taskSuggestions.push("Consider adding time constraints (earliest start or required finish)");
      priority = priority === "high" ? "high" : "medium";
    }

    if (taskSuggestions.length > 0) {
      suggestions.push({
        taskId: task.id,
        taskTitle: task.title,
        suggestions: taskSuggestions,
        priority
      });
    }
  }

  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}