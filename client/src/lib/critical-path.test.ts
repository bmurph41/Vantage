import { calculateCriticalPath } from './critical-path';
import type { Task, Project, ProjectSettings } from '../../../shared/schema';

// Test utility to create a mock task
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
    // Assuming durationDays is a calculated property from the template
    durationDays
  } as Task & { durationDays: number };
}

// Test project
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

// Test settings
const mockSettings: ProjectSettings = {
  projectId: 'test-project',
  useBusinessDays: false,
  holidayCalendar: 'us_federal',
  notificationsJson: {},
  ndaRequired: false
};

// Test function
export function testCriticalPath() {

  // Test Case 1: Simple linear dependency chain
  const linearTasks = [
    createMockTask('A', 'Task A', [], 3),      // 3 days, no deps
    createMockTask('B', 'Task B', ['A'], 2),   // 2 days, depends on A  
    createMockTask('C', 'Task C', ['B'], 4)    // 4 days, depends on B
  ];

  try {
    const result1 = calculateCriticalPath(linearTasks, mockProject, mockSettings);
    
    // All tasks should be critical in a linear chain
    linearTasks.forEach(task => {
      const node = result1.nodes.get(task.id);
      if (node) {
      }
    });
  } catch (error) {
    console.error('❌ Linear test failed:', error);
  }

  // Test Case 2: Parallel tasks with different durations
  const parallelTasks = [
    createMockTask('A', 'Task A', [], 2),      // 2 days, no deps
    createMockTask('B', 'Task B', ['A'], 3),   // 3 days, depends on A
    createMockTask('C', 'Task C', ['A'], 4),   // 4 days, depends on A  
    createMockTask('D', 'Task D', ['C'], 2)    // 2 days, depends on C
  ];

  try {
    const result2 = calculateCriticalPath(parallelTasks, mockProject, mockSettings);
    
    parallelTasks.forEach(task => {
      const node = result2.nodes.get(task.id);
      if (node) {
      }
    });
  } catch (error) {
    console.error('❌ Parallel test failed:', error);
  }

  // Test Case 3: Complex dependency network
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

  try {
    const result3 = calculateCriticalPath(complexTasks, mockProject, mockSettings);
    
    complexTasks.forEach(task => {
      const node = result3.nodes.get(task.id);
      if (node) {
      }
    });
  } catch (error) {
    console.error('❌ Complex test failed:', error);
  }

}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testCriticalPath = testCriticalPath;
}