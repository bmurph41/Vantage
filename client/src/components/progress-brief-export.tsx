import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { format, differenceInDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { setDeadlineTo5PM } from '@/lib/date-utils';
import type { Project, Task } from '@shared/schema';

interface ProgressBriefProps {
  project: Project;
  tasks: Task[];
}

// Concise styles for Progress Brief - Email-friendly design
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.4,
  },
  header: {
    backgroundColor: '#1e3a8a',
    color: '#ffffff',
    padding: 16,
    margin: -24,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.9,
  },
  headerMeta: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.8,
  },
  metricsGrid: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricCard: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'solid',
    width: '23%',
    textAlign: 'center',
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 9,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    borderBottomStyle: 'solid',
    paddingBottom: 4,
  },
  text: {
    fontSize: 11,
    color: '#374151',
    marginBottom: 6,
    lineHeight: 1.4,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statusBadge: {
    padding: '2 6',
    fontSize: 8,
    fontWeight: 'bold',
    borderRadius: 2,
    textTransform: 'uppercase',
  },
  statusHigh: {
    backgroundColor: '#fca5a5',
    color: '#7f1d1d',
  },
  statusMedium: {
    backgroundColor: '#fed7aa',
    color: '#9a3412',
  },
  statusLow: {
    backgroundColor: '#bbf7d0',
    color: '#14532d',
  },
  taskItem: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 2,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'solid',
  },
  taskTitle: {
    fontSize: 10,
    color: '#374151',
    flex: 1,
  },
  taskDeadline: {
    fontSize: 9,
    color: '#6b7280',
    width: '25%',
    textAlign: 'right',
  },
  insightBox: {
    backgroundColor: '#eff6ff',
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
    borderLeftStyle: 'solid',
    padding: 12,
    marginBottom: 12,
  },
  insightText: {
    fontSize: 10,
    color: '#1e40af',
    lineHeight: 1.3,
    fontStyle: 'italic',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 24,
    right: 24,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    borderTopStyle: 'solid',
    paddingTop: 8,
  },
});

// Calculate brief metrics for Progress Brief
const calculateBriefMetrics = (project: Project, tasks: Task[]) => {
  const todayEST = setDeadlineTo5PM(new Date());
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  // Calculate days to DD expiration
  const daysToExpiration = project.ddExpirationDate 
    ? differenceInDays(setDeadlineTo5PM(project.ddExpirationDate), todayEST)
    : null;
  
  // Find overdue tasks
  const overdueTasks = tasks.filter(task => {
    if (!task.deadline || task.status === 'completed') return false;
    try {
      const deadline = setDeadlineTo5PM(task.deadline);
      return differenceInDays(todayEST, deadline) > 0;
    } catch {
      return false;
    }
  });

  // Find upcoming critical tasks (next 7 days)
  const upcomingTasks = tasks.filter(task => {
    if (!task.deadline || task.status === 'completed') return false;
    try {
      const deadline = setDeadlineTo5PM(task.deadline);
      const daysUntil = differenceInDays(deadline, todayEST);
      return daysUntil >= 0 && daysUntil <= 7;
    } catch {
      return false;
    }
  });

  return {
    totalTasks,
    completedTasks,
    completionRate,
    daysToExpiration,
    overdueTasks,
    upcomingTasks,
  };
};

// Generate executive insight for Progress Brief
const generateBriefInsight = (project: Project, metrics: any): string => {
  const { completionRate, daysToExpiration, overdueTasks } = metrics;
  
  if (overdueTasks.length > 0) {
    return `Project requires immediate attention with ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}. Current ${completionRate}% completion rate${daysToExpiration ? ` with ${daysToExpiration} days to DD expiration` : ''} demands accelerated execution to maintain transaction timeline.`;
  }
  
  if (completionRate >= 80) {
    return `Project execution is performing exceptionally well at ${completionRate}% completion${daysToExpiration ? ` with ${daysToExpiration} days remaining to DD expiration` : ''}. Strong momentum positions us favorably for successful transaction closing.`;
  }
  
  if (completionRate >= 60) {
    return `Solid progress at ${completionRate}% completion${daysToExpiration ? ` with ${daysToExpiration} days to DD expiration` : ''}. Strategic focus on critical path items will strengthen our position for the remaining timeline.`;
  }
  
  return `Current ${completionRate}% completion rate${daysToExpiration ? ` with ${daysToExpiration} days to DD expiration` : ''} requires immediate strategic intervention and resource reallocation to ensure transaction objectives remain achievable.`;
};

// Progress Brief Document Component
export const ProgressBriefDocument = ({ project, tasks }: ProgressBriefProps) => {
  const currentTimestamp = formatInTimeZone(new Date(), 'America/New_York', 'MMMM d, yyyy \'at\' h:mm a zzz');
  const metrics = calculateBriefMetrics(project, tasks);
  const executiveInsight = generateBriefInsight(project, metrics);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>PROGRESS BRIEF</Text>
          <Text style={styles.headerSubtitle}>{project.name}</Text>
          <Text style={styles.headerMeta}>Generated {currentTimestamp}</Text>
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{metrics.completionRate}%</Text>
            <Text style={styles.metricLabel}>Complete</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{metrics.completedTasks}/{metrics.totalTasks}</Text>
            <Text style={styles.metricLabel}>Tasks Done</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{metrics.overdueTasks.length}</Text>
            <Text style={styles.metricLabel}>Overdue</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{metrics.daysToExpiration ?? 'N/A'}</Text>
            <Text style={styles.metricLabel}>Days Left</Text>
          </View>
        </View>

        {/* Executive Insight */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>
          <View style={styles.insightBox}>
            <Text style={styles.insightText}>{executiveInsight}</Text>
          </View>
        </View>

        {/* Critical Tasks */}
        {metrics.overdueTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Overdue Tasks Requiring Immediate Action</Text>
            {metrics.overdueTasks.slice(0, 5).map((task) => (
              <View key={task.id} style={styles.taskItem}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskDeadline}>
                  {task.deadline ? format(setDeadlineTo5PM(task.deadline), 'MMM d') : 'No date'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Upcoming Tasks */}
        {metrics.upcomingTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Critical Tasks - Next 7 Days</Text>
            {metrics.upcomingTasks.slice(0, 8).map((task) => (
              <View key={task.id} style={styles.taskItem}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskDeadline}>
                  {task.deadline ? format(setDeadlineTo5PM(task.deadline), 'MMM d') : 'No date'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Risk Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risk Status</Text>
          <Text style={styles.text}>
            <Text style={styles.boldText}>Schedule Risk: </Text>
            {metrics.overdueTasks.length > 0 ? 'HIGH - Immediate action required' : 
             metrics.upcomingTasks.length > 3 ? 'MEDIUM - Monitor closely' : 
             'LOW - On track'}
          </Text>
          <Text style={styles.text}>
            <Text style={styles.boldText}>Completion Trend: </Text>
            {metrics.completionRate >= 80 ? 'Excellent momentum' :
             metrics.completionRate >= 60 ? 'Steady progress' :
             'Needs acceleration'}
          </Text>
        </View>

        {/* Next Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Immediate Next Actions</Text>
          {metrics.overdueTasks.length > 0 ? (
            <Text style={styles.text}>• Prioritize and complete {metrics.overdueTasks.length} overdue task{metrics.overdueTasks.length > 1 ? 's' : ''}</Text>
          ) : (
            <Text style={styles.text}>• Maintain current execution velocity</Text>
          )}
          {metrics.upcomingTasks.length > 0 && (
            <Text style={styles.text}>• Prepare resources for {metrics.upcomingTasks.length} upcoming task{metrics.upcomingTasks.length > 1 ? 's' : ''}</Text>
          )}
          {metrics.completionRate < 80 && (
            <Text style={styles.text}>• Review resource allocation and timeline optimization</Text>
          )}
          {metrics.daysToExpiration && metrics.daysToExpiration < 30 && (
            <Text style={styles.text}>• Consider DD extension if critical items remain incomplete</Text>
          )}
        </View>

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => 
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
    link.download = `Progress_Brief_${project.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error generating Progress Brief PDF:', error);
    throw error;
  }
};