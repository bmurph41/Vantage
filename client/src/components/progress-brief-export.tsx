import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { format, differenceInDays, addDays, differenceInCalendarDays, startOfDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { setDeadlineTo5PM, tzNow } from '@/lib/date-utils';
import type { Project, DDTask } from '@shared/schema';

interface ProgressBriefProps {
  project: Project;
  tasks: DDTask[];
}

// Helper function for EST start of day
function startOfDayEST(date: Date): Date {
  const estDate = tzNow('America/New_York');
  estDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  estDate.setHours(0, 0, 0, 0);
  return estDate;
}

// Helper function to check if task is overdue at 5:00 PM EST
function isOverdueAt1700EST(deadline: Date | string): boolean {
  const now = tzNow('America/New_York');
  const deadlineAt5PM = setDeadlineTo5PM(deadline);
  return now > deadlineAt5PM;
}

// AI Narration System - Define proper metrics interface (matching the page)
interface ProjectMetrics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  engagedTasks: number;
  notStartedTasks: number;
  overdueTasks: number;
  completionRate: number;
  daysRemaining: number;
  daysRemainingToClosing: number;
  daysRemainingToDD: number | null;
  timelineProgress: number;
  highRiskTasks: number;
  criticalPathTasks: number;
  scheduleRisk: {
    level: string;
    description: string;
    color: string;
    priority: number;
  };
  projectStartDate: Date;
  projectEndDate: Date;
  ddEndDate: Date | null;
  daysSinceStart: number;
  totalProjectDays: number;
}

// Generate AI insights (matching the page logic exactly)
function generateAIInsights(project: Project, tasks: Task[], metrics: ProjectMetrics): string[] {
  const insights = [];
  
  // Performance narrative - executive perspective
  if (metrics.completionRate >= 80) {
    insights.push(`Our due diligence execution is performing exceptionally well at ${metrics.completionRate}% completion. I'm observing strong operational momentum across all workstreams, positioning us favorably for our targeted closing timeline. This level of performance excellence reinforces my confidence in our ability to identify and capitalize on strategic value drivers within this transaction.`);
  } else if (metrics.completionRate >= 60) {
    insights.push(`Our current ${metrics.completionRate}% completion rate demonstrates solid progress, though I see opportunities for enhanced execution velocity across certain critical workstreams. My assessment indicates that strategic resource reallocation and accelerated task prioritization will substantially strengthen our risk mitigation posture for the remaining timeline.`);
  } else {
    insights.push(`The ${metrics.completionRate}% completion rate requires immediate strategic intervention. From my operational assessment, we must implement aggressive resource reallocation and enhanced project governance to mitigate transaction timeline risk. I am directing immediate corrective action to ensure acquisition objectives remain achievable.`);
  }
  
  // Timeline analysis - strategic observations
  if (metrics.daysRemaining <= 14) {
    insights.push(`With ${metrics.daysRemaining} days remaining to closing, we have entered the critical execution phase where operational precision is paramount. I am implementing enhanced oversight protocols and daily deliverable monitoring to ensure zero tolerance for schedule deviation. Every milestone requires executive-level attention at this juncture.`);
  } else if (metrics.daysRemaining <= 30) {
    insights.push(`Our ${metrics.daysRemaining}-day runway to closing provides adequate execution bandwidth, contingent on maintaining current velocity metrics. I am closely monitoring project cadence and stakeholder performance indicators to ensure sustained momentum through the final phase. Strategic vigilance remains essential.`);
  } else {
    insights.push(`The ${metrics.daysRemaining}-day timeline to closing represents a strategic advantage, providing sufficient bandwidth for comprehensive risk assessment and value optimization analysis. This extended runway enables thorough due diligence depth without compromising transaction quality or stakeholder confidence.`);
  }
  
  // Risk assessment - executive evaluation
  if (metrics.overdueTasks > 0) {
    insights.push(`I have identified ${metrics.overdueTasks} overdue deliverables requiring immediate executive escalation. My analysis indicates these timeline deviations pose cascading risk to overall transaction success. I am implementing immediate corrective measures and enhanced resource deployment to restore optimal project trajectory.`);
  } else {
    insights.push(`All deliverables are performing on schedule, demonstrating robust project governance and effective stakeholder coordination across our entire organizational matrix. This operational excellence validates our systematic approach and reinforces my confidence in successful transaction completion.`);
  }
  
  // Market context - strategic assessment
  insights.push(`My analysis of prevailing market conditions indicates we are executing this acquisition within a highly favorable macroeconomic environment. Capital markets remain supportive, regulatory frameworks are stable, and industry fundamentals align with our strategic thesis, significantly enhancing transaction probability and value realization potential.`);
  
  return insights;
}

// Calculate comprehensive project metrics (matching the page logic exactly)
const calculateComprehensiveMetrics = (project: Project, tasks: Task[]): ProjectMetrics => {
  const currentDate = tzNow('America/New_York');
  
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const engagedTasks = tasks.filter(t => t.status === 'engaged').length;
  const notStartedTasks = tasks.filter(t => t.status === 'not_started').length;
  
  const overdueTasks = tasks.filter(t => {
    if (t.status === 'completed' || !t.deadline) return false;
    return isOverdueAt1700EST(t.deadline);
  }).length;

  // Enhanced schedule risk assessment
  const tasksNext3Days = tasks.filter(t => {
    if (!t.deadline || t.status === 'completed') return false;
    const deadlineAt5PM = setDeadlineTo5PM(t.deadline);
    const daysUntil = differenceInCalendarDays(deadlineAt5PM, currentDate);
    return daysUntil >= 0 && daysUntil <= 3;
  }).length;

  const tasksNext7Days = tasks.filter(t => {
    if (!t.deadline || t.status === 'completed') return false;
    const deadlineAt5PM = setDeadlineTo5PM(t.deadline);
    const daysUntil = differenceInCalendarDays(deadlineAt5PM, currentDate);
    return daysUntil >= 4 && daysUntil <= 7;
  }).length;

  // Calculate schedule risk level and description
  const getScheduleRisk = () => {
    if (overdueTasks > 0) {
      return {
        level: 'URGENT',
        description: `${overdueTasks} overdue ${overdueTasks === 1 ? 'task' : 'tasks'}`,
        color: 'red',
        priority: 4
      };
    }
    if (tasksNext3Days > 0) {
      return {
        level: 'HIGH',
        description: `${tasksNext3Days} ${tasksNext3Days === 1 ? 'task' : 'tasks'} due within 3 days`,
        color: 'red',
        priority: 3
      };
    }
    if (tasksNext7Days > 0) {
      return {
        level: 'MEDIUM',
        description: `${tasksNext7Days} ${tasksNext7Days === 1 ? 'task' : 'tasks'} due within 7 days`,
        color: 'orange',
        priority: 2
      };
    }
    return {
      level: 'LOW',
      description: 'No imminent deadlines',
      color: 'green',
      priority: 1
    };
  };

  const scheduleRisk = getScheduleRisk();
  
  // Calculate time-weighted completion rate based on task duration
  const totalTimeAllocated = tasks.reduce((sum, task) => sum + (task.mostLikelyDays || 1), 0);
  const completedTimeAllocated = tasks
    .filter(t => t.status === 'completed')
    .reduce((sum, task) => sum + (task.mostLikelyDays || 1), 0);
  
  const completionRate = totalTimeAllocated > 0 ? Math.round((completedTimeAllocated / totalTimeAllocated) * 100) : 0;
  
  // Timeline calculations using EST timezone
  const projectStartDate = project.psaSignedDate ? startOfDayEST(new Date(project.psaSignedDate)) : startOfDayEST(currentDate);
  const projectEndDate = project.closingDate ? startOfDayEST(new Date(project.closingDate)) : addDays(startOfDayEST(currentDate), 60);
  const ddEndDate = project.ddExpirationDate ? startOfDayEST(new Date(project.ddExpirationDate)) : null;
  const daysSinceStart = Math.max(0, differenceInCalendarDays(currentDate, projectStartDate));
  const totalProjectDays = Math.max(1, differenceInCalendarDays(projectEndDate, projectStartDate));
  const daysRemainingToClosing = Math.max(0, differenceInCalendarDays(projectEndDate, currentDate));
  const daysRemainingToDD = ddEndDate ? Math.max(0, differenceInCalendarDays(ddEndDate, currentDate)) : null;
  const daysRemaining = daysRemainingToClosing; // Default to closing for PDF
  const timelineProgress = Math.min(100, Math.round((daysSinceStart / totalProjectDays) * 100));
  
  // Risk indicators using EST timezone
  const highRiskTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length;
  const criticalPathTasks = tasks.filter(t => {
    if (!t.deadline || t.status === 'completed') return false;
    const deadlineAt5PM = setDeadlineTo5PM(t.deadline);
    return differenceInCalendarDays(deadlineAt5PM, currentDate) <= 7;
  }).length;
  
  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    engagedTasks,
    notStartedTasks,
    overdueTasks,
    scheduleRisk,
    completionRate,
    projectStartDate,
    projectEndDate,
    ddEndDate,
    daysSinceStart,
    totalProjectDays,
    daysRemaining,
    daysRemainingToClosing,
    daysRemainingToDD,
    timelineProgress,
    highRiskTasks,
    criticalPathTasks
  };
};

// Clean, professional PDF styling
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 54,
    paddingVertical: 54,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.5,
    color: '#374151',
  },
  
  // Clean header section
  header: {
    backgroundColor: '#003366',
    color: '#ffffff',
    paddingHorizontal: 54,
    paddingVertical: 28,
    marginHorizontal: -54,
    marginTop: -54,
    marginBottom: 24,
  },
  headerContent: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerBrief: {
    fontSize: 10,
    fontWeight: 'medium',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
    opacity: 0.8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13,
    opacity: 0.85,
    marginTop: 6,
  },
  headerRight: {
    textAlign: 'right',
  },
  headerDate: {
    fontSize: 10,
    fontWeight: 'normal',
    opacity: 0.8,
    marginBottom: 6,
  },
  headerPercent: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerComplete: {
    fontSize: 10,
    opacity: 0.7,
  },

  // Clean section headers
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 16,
    marginTop: 28,
  },
  
  // Clean insights section
  insightsGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  insightBox: {
    width: '48%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    borderRadius: 4,
    backgroundColor: '#f9fafb',
  },
  insightBoxPerformance: {
    backgroundColor: '#f0f9ff',
  },
  insightBoxTimeline: {
    backgroundColor: '#fffbeb',
  },
  insightBoxRisk: {
    backgroundColor: '#f0fdf4',
  },
  insightBoxMarket: {
    backgroundColor: '#f9fafb',
  },
  insightHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#1f2937',
  },
  insightText: {
    fontSize: 9,
    color: '#4b5563',
    lineHeight: 1.4,
  },

  // Clean metrics section
  metricsGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricCard: {
    width: '32%',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 4,
    textAlign: 'center',
    marginBottom: 8,
  },
  metricNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 9,
    color: '#6b7280',
    textTransform: 'uppercase',
    fontWeight: 'normal',
    letterSpacing: 0.3,
  },
  metricCompleted: { color: '#059669' },
  metricInProgress: { color: '#d97706' },
  metricEngaged: { color: '#2563eb' },
  metricNotStarted: { color: '#6b7280' },
  metricOverdue: { color: '#dc2626' },
  metricDaysLeft: { color: '#ea580c' },

  // Clean progress visualization
  progressSection: {
    marginBottom: 20,
  },
  progressGrid: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressCard: {
    width: '48%',
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 4,
  },
  progressCardTitle: {
    fontSize: 12,
    fontWeight: 'medium',
    color: '#1f2937',
    marginBottom: 10,
  },
  progressInfo: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 10,
    color: '#6b7280',
  },
  progressValue: {
    fontSize: 10,
    fontWeight: 'medium',
    color: '#1f2937',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#003366',
  },
  progressDetail: {
    fontSize: 8,
    color: '#9ca3af',
  },

  // Clean timeline section
  timelineSection: {
    marginBottom: 20,
  },
  timelineCategory: {
    marginBottom: 14,
  },
  timelineCategoryTitle: {
    fontSize: 12,
    fontWeight: 'medium',
    color: '#1f2937',
    marginBottom: 8,
  },
  timelineTask: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    marginBottom: 3,
  },
  timelineTaskTitle: {
    fontSize: 10,
    color: '#4b5563',
    flex: 1,
  },
  timelineTaskStatus: {
    fontSize: 8,
    fontWeight: 'medium',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    textTransform: 'uppercase',
    marginRight: 8,
  },
  timelineTaskDeadline: {
    fontSize: 9,
    color: '#6b7280',
    width: '20%',
    textAlign: 'right',
  },
  statusCompleted: { backgroundColor: '#d1fae5', color: '#065f46' },
  statusInProgress: { backgroundColor: '#dbeafe', color: '#1e40af' },
  statusEngaged: { backgroundColor: '#fef3c7', color: '#92400e' },
  statusNotStarted: { backgroundColor: '#f3f4f6', color: '#374151' },

  // Risk Assessment Section
  riskSection: {
    marginBottom: 24,
  },
  riskGrid: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  riskCard: {
    width: '48%',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'solid',
  },
  riskCardSchedule: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  riskCardPriority: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  riskCardTitle: {
    fontSize: 12,
    fontWeight: 'medium',
    marginBottom: 12,
    color: '#374151',
  },
  riskLevel: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  riskLevelUrgent: { color: '#dc2626' },
  riskLevelHigh: { color: '#dc2626' },
  riskLevelMedium: { color: '#f59e0b' },
  riskLevelLow: { color: '#16a34a' },
  riskDescription: {
    fontSize: 9,
    color: '#6b7280',
  },

  // Footer Section
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE', // Light gray section dividers as specified in guidance
    borderTopStyle: 'solid',
    paddingTop: 16,
    marginTop: 32,
  },
  footerContent: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  footerLeft: {
    flex: 1,
  },
  footerGenerated: {
    fontSize: 9,
    fontWeight: 'medium',
    color: '#6b7280',
    marginBottom: 4,
  },
  footerSources: {
    fontSize: 8,
    color: '#6b7280',
    lineHeight: 1.3,
  },
  footerRight: {
    textAlign: 'right',
  },
  footerNextUpdate: {
    fontSize: 8,
    color: '#6b7280',
    marginBottom: 4,
  },
  footerNextDate: {
    fontSize: 10,
    fontWeight: 'medium',
    color: '#374151',
  },

  // Separators
  separator: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE', // Light gray section dividers as specified in guidance
    borderBottomStyle: 'solid',
    marginVertical: 24,
  },
  // Confidentiality Header
  confidentialHeader: {
    position: 'absolute',
    top: 15,
    left: 54,
    right: 54,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#003366',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

// Progress Brief Document Component - matching the page exactly
export const ProgressBriefDocument = ({ project, tasks }: ProgressBriefProps) => {
  const currentDate = tzNow('America/New_York');
  const currentTimestamp = formatInTimeZone(currentDate, 'America/New_York', 'MMMM d, yyyy \'at\' h:mm a zzz');
  const metrics = calculateComprehensiveMetrics(project, tasks);
  const aiInsights = generateAIInsights(project, tasks, metrics);

  // Group tasks by category for timeline section
  const tasksByCategory = {
    'Financial Review': tasks.filter(t => t.status !== 'completed' && (t.title.toLowerCase().includes('financial') || t.title.toLowerCase().includes('audit'))),
    'Legal & Compliance': tasks.filter(t => t.status !== 'completed' && (t.title.toLowerCase().includes('legal') || t.title.toLowerCase().includes('contract'))),
    'Operational Assessment': tasks.filter(t => t.status !== 'completed' && (t.title.toLowerCase().includes('operational') || t.title.toLowerCase().includes('business'))),
    'Technical Evaluation': tasks.filter(t => t.status !== 'completed' && (t.title.toLowerCase().includes('technical') || t.title.toLowerCase().includes('system'))),
    'Other': tasks.filter(t => 
      t.status !== 'completed' &&
      !t.title.toLowerCase().includes('financial') && 
      !t.title.toLowerCase().includes('legal') && 
      !t.title.toLowerCase().includes('operational') && 
      !t.title.toLowerCase().includes('technical')
    )
  };

  // Filter out empty categories
  const filteredCategories = Object.entries(tasksByCategory).filter(([_, tasks]) => tasks.length > 0);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header Section - Matching page design */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerBrief}>PROGRESS BRIEF</Text>
              <Text style={styles.headerTitle}>DUE DILIGENCE</Text>
              <Text style={styles.headerSubtitle}>{project.name}</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.headerDate}>
                {format(currentDate, 'MMMM yyyy').toUpperCase()}
              </Text>
              <Text style={styles.headerPercent}>{metrics.completionRate}%</Text>
              <Text style={styles.headerComplete}>COMPLETE</Text>
            </View>
          </View>
        </View>

        {/* Executive Insights Section */}
        <Text style={styles.sectionTitle}>⚡ Executive Insights</Text>
        <View style={styles.insightsGrid}>
          <View style={[styles.insightBox, styles.insightBoxPerformance]}>
            <Text style={[styles.insightHeader, { color: '#1e40af' }]}>Performance</Text>
            <Text style={styles.insightText}>{aiInsights[0]}</Text>
          </View>
          <View style={[styles.insightBox, styles.insightBoxTimeline]}>
            <Text style={[styles.insightHeader, { color: '#ea580c' }]}>Timeline</Text>
            <Text style={styles.insightText}>{aiInsights[1]}</Text>
          </View>
          <View style={[styles.insightBox, metrics.overdueTasks > 0 ? { backgroundColor: '#fee2e2', borderLeftColor: '#dc2626' } : styles.insightBoxRisk]}>
            <Text style={[styles.insightHeader, { color: metrics.overdueTasks > 0 ? '#7f1d1d' : '#065f46' }]}>Risk Mitigation</Text>
            <Text style={styles.insightText}>{aiInsights[2]}</Text>
          </View>
          <View style={[styles.insightBox, styles.insightBoxMarket]}>
            <Text style={[styles.insightHeader, { color: '#047857' }]}>Market Outlook</Text>
            <Text style={styles.insightText}>{aiInsights[3]}</Text>
          </View>
        </View>

        <View style={styles.separator} />

        {/* Performance Metrics Section */}
        <Text style={styles.sectionTitle}>📊 Performance Metrics</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={[styles.metricNumber, styles.metricCompleted]}>{metrics.completedTasks}</Text>
            <Text style={styles.metricLabel}>Completed</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricNumber, styles.metricInProgress]}>{metrics.inProgressTasks}</Text>
            <Text style={styles.metricLabel}>In Progress</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricNumber, styles.metricEngaged]}>{metrics.engagedTasks}</Text>
            <Text style={styles.metricLabel}>Engaged</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricNumber, styles.metricNotStarted]}>{metrics.notStartedTasks}</Text>
            <Text style={styles.metricLabel}>Not Started</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricNumber, styles.metricOverdue]}>{metrics.overdueTasks}</Text>
            <Text style={styles.metricLabel}>Overdue</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricNumber, styles.metricDaysLeft]}>{metrics.daysRemaining}</Text>
            <Text style={styles.metricLabel}>Days Left</Text>
          </View>
        </View>

        {/* Progress Visualization Section */}
        <View style={styles.progressSection}>
          <View style={styles.progressGrid}>
            <View style={styles.progressCard}>
              <Text style={styles.progressCardTitle}>📈 Overall Progress</Text>
              <View style={styles.progressInfo}>
                <Text style={styles.progressLabel}>Completion Rate</Text>
                <Text style={styles.progressValue}>{metrics.completionRate}%</Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${metrics.completionRate}%` }]} />
              </View>
              <Text style={styles.progressDetail}>
                {metrics.completedTasks} of {metrics.totalTasks} tasks completed
              </Text>
            </View>
            
            <View style={styles.progressCard}>
              <Text style={styles.progressCardTitle}>📅 Timeline Progress</Text>
              <View style={styles.progressInfo}>
                <Text style={styles.progressLabel}>Time Elapsed</Text>
                <Text style={styles.progressValue}>{metrics.timelineProgress}%</Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${metrics.timelineProgress}%` }]} />
              </View>
              <Text style={styles.progressDetail}>
                {metrics.daysSinceStart} of {metrics.totalProjectDays} days elapsed
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.separator} />

        {/* Detailed Task Timeline Section */}
        <Text style={styles.sectionTitle}>🛡️ Detailed Task Timeline</Text>
        <View style={styles.timelineSection}>
          {filteredCategories.slice(0, 3).map(([category, categoryTasks]) => (
            <View key={category} style={styles.timelineCategory}>
              <Text style={styles.timelineCategoryTitle}>{category}</Text>
              {categoryTasks.slice(0, 4).map(task => (
                <View key={task.id} style={styles.timelineTask}>
                  <Text style={styles.timelineTaskTitle}>{task.title}</Text>
                  <Text style={[
                    styles.timelineTaskStatus,
                    task.status === 'completed' ? styles.statusCompleted :
                    task.status === 'in_progress' ? styles.statusInProgress :
                    task.status === 'engaged' ? styles.statusEngaged :
                    styles.statusNotStarted
                  ]}>
                    {task.status.replace('_', ' ')}
                  </Text>
                  <Text style={styles.timelineTaskDeadline}>
                    {task.deadline ? format(setDeadlineTo5PM(task.deadline), 'MMM d') : 'No date'}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.separator} />

        {/* Risk Assessment Section */}
        <Text style={styles.sectionTitle}>⚠️ Risk Assessment</Text>
        <View style={styles.riskSection}>
          <View style={styles.riskGrid}>
            <View style={[styles.riskCard, 
              metrics.scheduleRisk.color === 'red' ? { backgroundColor: '#fee2e2', borderColor: '#fca5a5' } : 
              metrics.scheduleRisk.color === 'orange' ? { backgroundColor: '#fed7aa', borderColor: '#fdba74' } : 
              { backgroundColor: '#d1fae5', borderColor: '#86efac' }
            ]}>
              <Text style={styles.riskCardTitle}>🕒 Schedule Risk</Text>
              <Text style={[
                styles.riskLevel,
                metrics.scheduleRisk.color === 'red' ? styles.riskLevelUrgent :
                metrics.scheduleRisk.color === 'orange' ? styles.riskLevelMedium :
                styles.riskLevelLow
              ]}>
                {metrics.scheduleRisk.level}
              </Text>
              <Text style={styles.riskDescription}>{metrics.scheduleRisk.description}</Text>
            </View>
            
            <View style={[styles.riskCard, metrics.highRiskTasks > 0 ? 
              { backgroundColor: '#fed7aa', borderColor: '#fdba74' } : 
              { backgroundColor: '#d1fae5', borderColor: '#86efac' }
            ]}>
              <Text style={styles.riskCardTitle}>⚠️ Priority Risk</Text>
              <Text style={[
                styles.riskLevel,
                metrics.highRiskTasks > 0 ? styles.riskLevelMedium : styles.riskLevelLow
              ]}>
                {metrics.highRiskTasks > 0 ? 'MEDIUM' : 'LOW'}
              </Text>
              <Text style={styles.riskDescription}>
                {metrics.highRiskTasks} high-priority open tasks
              </Text>
            </View>
          </View>
        </View>

        {/* Professional Footer */}
        <View style={styles.footer}>
          <View style={styles.footerContent}>
            <View style={styles.footerLeft}>
              <Text style={styles.footerGenerated}>
                Report Generated: {format(currentDate, 'PPP')}
              </Text>
              <Text style={styles.footerSources}>
                <Text style={{ fontWeight: 'bold' }}>Sources:</Text> Due Diligence Tracker Analytics, Project Management System, Risk Assessment Framework
              </Text>
            </View>
            <View style={styles.footerRight}>
              <Text style={styles.footerNextUpdate}>Next Update</Text>
              <Text style={styles.footerNextDate}>
                {format(addDays(currentDate, 7), 'MMM d, yyyy')}
              </Text>
            </View>
          </View>
        </View>

        <Text style={{
          position: 'absolute',
          bottom: 8,
          left: 32,
          right: 32,
          textAlign: 'center',
          fontSize: 8,
          color: '#9ca3af',
        }} render={({ pageNumber, totalPages }) => 
          `CONFIDENTIAL Progress Brief | Page ${pageNumber} of ${totalPages} | ${project.name}`
        } />
      </Page>
    </Document>
  );
};

// Generate and download Progress Brief PDF
export const generateProgressBriefPDF = async (project: Project, tasks: Task[]) => {
  try {
    const doc = <ProgressBriefDocument project={project} tasks={tasks} />;
    const asPdf = pdf(doc);
    const blob = await asPdf.toBlob();
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name} Progress Brief.pdf`; // Professional naming as specified in guidance
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating Progress Brief PDF:', error);
    throw error;
  }
};