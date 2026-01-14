import { describe, it, expect } from 'vitest';
import { calculateCriticalPath } from './critical-path';
import type { Task, Project, ProjectSettings } from '../../../shared/schema';

function createMockTask(
  id: string, 
  title: string, 
  dependencies: string[] = [], 
  durationDays: number = 5,
  showOnTimeline: boolean = true
): Task {
  return {
    id,
    projectId: 'test-project',
    title,
    description: `Test task: ${title}`,
    startStrategy: 'offset',
    startDate: null,
    startOffsetDays: 0,
    deadlineType: 'days_after_psa',
    deadlineDays: durationDays,
    deadline: null,
    assignee: null,
    companyHired: null,
    repName: null,
    repEmail: null,
    repPhone: null,
    companyAddress: null,
    companySuite: null,
    companyCity: null,
    companyState: null,
    companyZip: null,
    priority: 'med',
    status: 'not_started',
    dateEngaged: null,
    paymentStatus: 'not_paid',
    completedAt: null,
    dateOnSite: null,
    requiresOnSiteInspection: false,
    orderedAt: null,
    dependencies,
    baselineStart: null,
    baselineDue: null,
    manuallyLocked: false,
    cost: null,
    notes: null,
    showOnTimeline,
    sortOrder: null,
    taskOwner: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    durationDays
  } as Task & { durationDays: number };
}

const mockProject: Project = {
  id: 'test-project',
  orgId: 'test-org',
  name: 'Test Project',
  description: 'Test project for critical path',
  anchorType: 'psa',
  psaSignedDate: '2024-01-01',
  ddExpirationDate: '2024-03-01',
  closingDate: '2024-04-01',
  ddPeriodDays: 60,
  hasExtensions: false,
  extensionCount: 0,
  extensionDays: [],
  daysToClosing: 90,
  tz: 'America/New_York',
  createdBy: 'test-user',
  createdAt: new Date('2024-01-01')
};

const mockSettings: ProjectSettings = {
  projectId: 'test-project',
  useBusinessDays: false,
  holidayCalendar: 'us_federal',
  notificationsJson: {},
  ndaRequired: false
};

describe('calculateCriticalPath', () => {
  describe('linear dependency chain', () => {
    const linearTasks = [
      createMockTask('A', 'Task A', [], 3),
      createMockTask('B', 'Task B', ['A'], 2),
      createMockTask('C', 'Task C', ['B'], 4)
    ];

    it('calculates critical path for linear dependencies', () => {
      const result = calculateCriticalPath(linearTasks, mockProject, mockSettings);
      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
    });

    it('marks all tasks as critical in linear chain', () => {
      const result = calculateCriticalPath(linearTasks, mockProject, mockSettings);
      linearTasks.forEach(task => {
        const node = result.nodes.get(task.id);
        expect(node).toBeDefined();
        if (node) {
          expect(node.isCritical).toBe(true);
        }
      });
    });
  });

  describe('parallel tasks with different durations', () => {
    const parallelTasks = [
      createMockTask('A', 'Task A', [], 2),
      createMockTask('B', 'Task B', ['A'], 3),
      createMockTask('C', 'Task C', ['A'], 4),
      createMockTask('D', 'Task D', ['C'], 2)
    ];

    it('handles parallel task branches', () => {
      const result = calculateCriticalPath(parallelTasks, mockProject, mockSettings);
      expect(result).toBeDefined();
      expect(result.nodes.size).toBe(4);
    });

    it('identifies critical path through longest branch', () => {
      const result = calculateCriticalPath(parallelTasks, mockProject, mockSettings);
      const nodeC = result.nodes.get('C');
      const nodeD = result.nodes.get('D');
      expect(nodeC?.isCritical).toBe(true);
      expect(nodeD?.isCritical).toBe(true);
    });
  });

  describe('complex dependency network', () => {
    const complexTasks = [
      createMockTask('Start', 'Project Start', [], 1),
      createMockTask('Design', 'Design Phase', ['Start'], 5),
      createMockTask('Dev1', 'Development 1', ['Design'], 3),
      createMockTask('Dev2', 'Development 2', ['Design'], 4),
      createMockTask('Test1', 'Testing 1', ['Dev1'], 2),
      createMockTask('Test2', 'Testing 2', ['Dev2'], 3),
      createMockTask('Integration', 'Integration', ['Test1', 'Test2'], 2),
      createMockTask('Deploy', 'Deployment', ['Integration'], 1)
    ];

    it('calculates critical path for complex network', () => {
      const result = calculateCriticalPath(complexTasks, mockProject, mockSettings);
      expect(result).toBeDefined();
      expect(result.nodes.size).toBe(8);
    });

    it('identifies start as critical', () => {
      const result = calculateCriticalPath(complexTasks, mockProject, mockSettings);
      const startNode = result.nodes.get('Start');
      expect(startNode?.isCritical).toBe(true);
    });

    it('identifies design as critical', () => {
      const result = calculateCriticalPath(complexTasks, mockProject, mockSettings);
      const designNode = result.nodes.get('Design');
      expect(designNode?.isCritical).toBe(true);
    });

    it('identifies deploy as critical', () => {
      const result = calculateCriticalPath(complexTasks, mockProject, mockSettings);
      const deployNode = result.nodes.get('Deploy');
      expect(deployNode?.isCritical).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles empty task list', () => {
      const result = calculateCriticalPath([], mockProject, mockSettings);
      expect(result.nodes.size).toBe(0);
    });

    it('handles single task', () => {
      const singleTask = [createMockTask('Only', 'Only Task', [], 5)];
      const result = calculateCriticalPath(singleTask, mockProject, mockSettings);
      expect(result.nodes.size).toBe(1);
      const node = result.nodes.get('Only');
      expect(node?.isCritical).toBe(true);
    });
  });
});
