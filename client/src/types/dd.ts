import type { Project, ProjectSettings, Task, TaskTemplate, ProjectTemplate } from "@shared/schema";

export interface ProjectWithDetails {
  project: Project;
  settings: ProjectSettings | null;
  tasks: Task[];
}

export interface TaskProgress {
  task: Task;
  effectiveStart: Date;
  effectiveDue: Date;
  elapsed: number;
  remaining: number;
  total: number;
  percentComplete: number;
  isOverdue: boolean;
  isCompleted: boolean;
  isNotStarted: boolean;
}

export interface TimelineGranularity {
  value: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  label: string;
  days: number;
}

export const TIMELINE_GRANULARITIES: TimelineGranularity[] = [
  { value: 'daily', label: 'Daily', days: 1 },
  { value: 'weekly', label: 'Weekly', days: 7 },
  { value: 'biweekly', label: 'Biweekly', days: 14 },
  { value: 'monthly', label: 'Monthly', days: 30 },
];

export interface TaskFilter {
  status?: string;
  assignee?: string;
  overdue?: boolean;
  criticalPath?: boolean;
  search?: string;
}
