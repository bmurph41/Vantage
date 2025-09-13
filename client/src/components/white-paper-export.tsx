import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';
import type { Project, Task, ProjectSettings } from '@shared/schema';

interface WhitePaperProps {
  project: Project;
  tasks: Task[];
  settings?: ProjectSettings | null;
}

// Define styles for the PDF
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.4,
  },
  coverPage: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '80%',
    textAlign: 'center',
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 20,
  },
  coverSubtitle: {
    fontSize: 18,
    color: '#4a5568',
    marginBottom: 10,
  },
  coverDate: {
    fontSize: 14,
    color: '#718096',
    marginTop: 30,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 20,
    borderBottom: '2 solid #e2e8f0',
    paddingBottom: 10,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 12,
    backgroundColor: '#f7fafc',
    padding: 8,
    borderLeft: '4 solid #4299e1',
    paddingLeft: 12,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4a5568',
    marginBottom: 8,
    marginTop: 15,
  },
  text: {
    fontSize: 11,
    color: '#2d3748',
    marginBottom: 8,
    lineHeight: 1.5,
  },
  bold: {
    fontWeight: 'bold',
  },
  // Enhanced KPI Dashboard styles
  kpiGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  kpiCard: {
    width: '47%',
    padding: 14,
    marginBottom: 12,
    backgroundColor: 'white',
    borderRadius: 6,
    border: '1.5 solid #e2e8f0',
    boxShadow: '0 1 3 rgba(0,0,0,0.04)',
  },
  kpiNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#4a5568',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  kpiSubtext: {
    fontSize: 10,
    color: '#718096',
    marginTop: 4,
  },
  // Progress visualization
  progressContainer: {
    marginTop: 10,
    height: 10,
    backgroundColor: '#e2e8f0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#38a169',
    borderRadius: 5,
  },
  progressFillWarning: {
    backgroundColor: '#d69e2e',
  },
  progressFillDanger: {
    backgroundColor: '#e53e3e',
  },
  // Risk indicator styles
  riskIndicator: {
    fontSize: 10,
    fontWeight: 'bold',
    padding: 4,
    borderRadius: 3,
    color: 'white',
    textAlign: 'center',
    marginTop: 5,
  },
  riskLow: {
    backgroundColor: '#38a169',
  },
  riskMedium: {
    backgroundColor: '#d69e2e',
  },
  riskHigh: {
    backgroundColor: '#e53e3e',
  },
  taskRow: {
    display: 'flex',
    flexDirection: 'row',
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 3,
  },
  taskTitle: {
    flex: 2,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1a365d',
  },
  taskDetail: {
    flex: 1,
    fontSize: 9,
    color: '#4a5568',
  },
  statusBadge: {
    fontSize: 8,
    padding: 3,
    borderRadius: 2,
    textAlign: 'center',
    color: 'white',
    fontWeight: 'bold',
  },
  statusCompleted: {
    backgroundColor: '#38a169',
  },
  statusInProgress: {
    backgroundColor: '#3182ce',
  },
  statusNotStarted: {
    backgroundColor: '#718096',
  },
  contactItem: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#f7fafc',
    borderRadius: 4,
    border: '1 solid #e2e8f0',
  },
  contactTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 4,
  },
  contactDetail: {
    fontSize: 10,
    color: '#4a5568',
    marginBottom: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 9,
    color: '#a0aec0',
    borderTop: '1 solid #e2e8f0',
    paddingTop: 10,
  },
  pageBreak: {
    marginTop: 40,
  },
  // Timeline styles
  timelineContainer: {
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: '#f8fafc',
    border: '1 solid #e2e8f0',
    borderRadius: 6,
    padding: 16,
  },
  timelineItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    position: 'relative',
  },
  timelineLastItem: {
    marginBottom: 0,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4299e1',
    marginRight: 12,
    border: '2 solid #ffffff',
    boxShadow: '0 0 0 2px #e2e8f0',
  },
  timelineContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  timelineDate: {
    fontSize: 11,
    color: '#4a5568',
    fontWeight: 'normal',
  },
  timelineLine: {
    position: 'absolute',
    left: 5,
    top: 12,
    bottom: -15,
    width: 2,
    backgroundColor: '#e2e8f0',
  },
});

// Format currency values
const formatCurrency = (value: string): string => {
  if (!value) return "N/A";
  
  if (value.startsWith("$")) return value;
  
  const numericValue = value.replace(/[^\d.]/g, "");
  if (!numericValue || numericValue === ".") return "N/A";
  
  const number = parseFloat(numericValue);
  if (isNaN(number)) return value;
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(number);
};

// Format dates safely
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "N/A";
  try {
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'MMMM d, yyyy') : "N/A";
  } catch {
    return "N/A";
  }
};

// Get status badge style
const getStatusStyle = (status: string) => {
  switch (status) {
    case 'completed':
      return [styles.statusBadge, styles.statusCompleted];
    case 'in_progress':
    case 'engaged':
    case 'scheduled':
      return [styles.statusBadge, styles.statusInProgress];
    default:
      return [styles.statusBadge, styles.statusNotStarted];
  }
};

// Format status text
const formatStatus = (status: string): string => {
  switch (status) {
    case 'not_started':
      return 'Not Started';
    case 'in_progress':
      return 'In Progress';
    case 'engaged':
      return 'Engaged';
    case 'scheduled':
      return 'Scheduled';
    case 'completed':
      return 'Completed';
    default:
      return status;
  }
};

// Calculate KPIs and metrics
const calculateProjectKPIs = (project: Project, tasks: Task[]) => {
  const today = new Date();
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress' || t.status === 'engaged' || t.status === 'scheduled').length;
  const notStartedTasks = tasks.filter(t => t.status === 'not_started').length;
  
  // Calculate completion percentage
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  // Calculate total cost
  const totalCost = tasks.reduce((sum, task) => {
    if (task.cost) {
      const cleanCost = task.cost.replace(/[$,]/g, '').trim();
      const numericCost = parseFloat(cleanCost);
      return sum + (isNaN(numericCost) ? 0 : numericCost);
    }
    return sum;
  }, 0);
  
  // Calculate days to DD expiration
  let daysToExpiration = null;
  let expirationRisk = 'low';
  if (project.ddExpirationDate) {
    try {
      const expirationDate = parseISO(project.ddExpirationDate);
      if (isValid(expirationDate)) {
        daysToExpiration = differenceInDays(expirationDate, today);
        if (daysToExpiration < 0) {
          expirationRisk = 'high';
        } else if (daysToExpiration <= 7) {
          expirationRisk = 'high';
        } else if (daysToExpiration <= 30) {
          expirationRisk = 'medium';
        }
      }
    } catch {
      // Handle invalid date
    }
  }
  
  // Find overdue tasks (tasks with deadlines in the past)
  const overdueTasks = tasks.filter(task => {
    if (!task.deadline) return false;
    try {
      const deadline = parseISO(task.deadline);
      return isValid(deadline) && differenceInDays(today, deadline) > 0 && task.status !== 'completed';
    } catch {
      return false;
    }
  });
  
  // Find upcoming critical deadlines (within 7 days)
  const upcomingDeadlines = tasks.filter(task => {
    if (!task.deadline || task.status === 'completed') return false;
    try {
      const deadline = parseISO(task.deadline);
      if (!isValid(deadline)) return false;
      const daysUntilDeadline = differenceInDays(deadline, today);
      return daysUntilDeadline >= 0 && daysUntilDeadline <= 7;
    } catch {
      return false;
    }
  });
  
  // Calculate overall project risk with improved logic
  let overallRisk = 'low';
  if (overdueTasks.length > 3 || (daysToExpiration !== null && daysToExpiration >= 0 && daysToExpiration < 3) || completionRate < 25) {
    overallRisk = 'high';
  } else if (overdueTasks.length >= 1 || (daysToExpiration !== null && daysToExpiration >= 3 && daysToExpiration <= 7) || (completionRate >= 25 && completionRate < 75)) {
    overallRisk = 'medium';
  }
  
  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    notStartedTasks,
    completionRate,
    totalCost,
    daysToExpiration,
    expirationRisk,
    overdueTasks,
    upcomingDeadlines,
    overallRisk
  };
};

// Get risk indicator style and text
const getRiskIndicator = (risk: string) => {
  switch (risk) {
    case 'high':
      return { style: [styles.riskIndicator, styles.riskHigh], text: 'HIGH RISK' };
    case 'medium':
      return { style: [styles.riskIndicator, styles.riskMedium], text: 'MEDIUM RISK' };
    default:
      return { style: [styles.riskIndicator, styles.riskLow], text: 'LOW RISK' };
  }
};

// Calculate timeline health indicators
const calculateTimelineHealth = (project: Project) => {
  const today = new Date();
  const milestones = [];
  
  // PSA Signed Date
  if (project.psaSignedDate) {
    try {
      const psaDate = parseISO(project.psaSignedDate);
      if (isValid(psaDate)) {
        milestones.push({
          name: 'PSA Signed',
          date: psaDate,
          dateString: project.psaSignedDate,
          status: 'completed',
          daysFromToday: differenceInDays(today, psaDate)
        });
      }
    } catch {
      // Handle invalid date
    }
  }
  
  // DD Expiration Date
  if (project.ddExpirationDate) {
    try {
      const ddDate = parseISO(project.ddExpirationDate);
      if (isValid(ddDate)) {
        const daysFromToday = differenceInDays(ddDate, today);
        let status = 'upcoming';
        if (daysFromToday < 0) status = 'overdue';
        else if (daysFromToday <= 7) status = 'urgent';
        
        milestones.push({
          name: 'Due Diligence Expiration',
          date: ddDate,
          dateString: project.ddExpirationDate,
          status,
          daysFromToday
        });
      }
    } catch {
      // Handle invalid date
    }
  }
  
  // Closing Date
  if (project.closingDate) {
    try {
      const closingDate = parseISO(project.closingDate);
      if (isValid(closingDate)) {
        const daysFromToday = differenceInDays(closingDate, today);
        let status = 'upcoming';
        if (daysFromToday < 0) status = 'overdue';
        else if (daysFromToday <= 14) status = 'urgent';
        
        milestones.push({
          name: 'Target Closing Date',
          date: closingDate,
          dateString: project.closingDate,
          status,
          daysFromToday
        });
      }
    } catch {
      // Handle invalid date
    }
  }
  
  return milestones.sort((a, b) => a.date.getTime() - b.date.getTime());
};

// Group tasks by category
const groupTasksByCategory = (tasks: Task[]) => {
  const categories: { [key: string]: Task[] } = {};
  
  tasks.forEach(task => {
    // Extract category from title or description, or create a default category
    let category = 'General Tasks';
    
    // Try to infer category from task title
    const title = task.title.toLowerCase();
    if (title.includes('environmental') || title.includes('phase i') || title.includes('phase ii') || title.includes('wetland')) {
      category = 'Environmental Due Diligence';
    } else if (title.includes('marine') || title.includes('water') || title.includes('dock') || title.includes('pier') || title.includes('bathymetric')) {
      category = 'Marine & Water Quality';
    } else if (title.includes('structural') || title.includes('property') || title.includes('survey') || title.includes('geotechnical') || title.includes('alta')) {
      category = 'Structural & Property Inspections';
    } else if (title.includes('permit') || title.includes('regulatory') || title.includes('zoning') || title.includes('compliance')) {
      category = 'Regulatory & Permits';
    } else if (title.includes('financial') || title.includes('audit') || title.includes('appraisal') || title.includes('valuation')) {
      category = 'Financial & Legal';
    } else if (title.includes('insurance') || title.includes('title') || title.includes('legal') || title.includes('attorney')) {
      category = 'Insurance & Title';
    }
    
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(task);
  });
  
  return categories;
};

// Extract unique companies hired from tasks
const getUniqueCompaniesHired = (tasks: Task[]): string[] => {
  const companies = new Set<string>();
  tasks.forEach(task => {
    if (task.companyHired && task.companyHired.trim()) {
      companies.add(task.companyHired.trim());
    }
  });
  return Array.from(companies).sort();
};

// Extract detailed company contact information
const getCompanyContacts = (tasks: Task[]) => {
  const companyMap = new Map<string, {
    name: string;
    representatives: {
      name?: string;
      email?: string;
      phone?: string;
    }[];
    address?: {
      street?: string;
      suite?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
    assignees: Set<string>;
  }>();

  tasks.forEach(task => {
    if (task.companyHired && task.companyHired.trim()) {
      const companyName = task.companyHired.trim();
      
      if (!companyMap.has(companyName)) {
        companyMap.set(companyName, {
          name: companyName,
          representatives: [],
          assignees: new Set()
        });
      }
      
      const company = companyMap.get(companyName)!;
      
      // Add representative if available
      if (task.repName || task.repEmail || task.repPhone) {
        const existingRep = company.representatives.find(rep => 
          rep.name === task.repName || rep.email === task.repEmail
        );
        
        if (!existingRep) {
          company.representatives.push({
            name: task.repName || undefined,
            email: task.repEmail || undefined,
            phone: task.repPhone || undefined
          });
        }
      }
      
      // Add address if available
      if (task.companyAddress || task.companyCity || task.companyState) {
        company.address = {
          street: task.companyAddress || undefined,
          suite: task.companySuite || undefined,
          city: task.companyCity || undefined,
          state: task.companyState || undefined,
          zip: task.companyZip || undefined
        };
      }
      
      // Add assignee if available
      if (task.assignee && task.assignee.trim()) {
        company.assignees.add(task.assignee.trim());
      }
    }
  });

  return Array.from(companyMap.values()).sort((a, b) => a.name.localeCompare(b.name));
};

// Get tasks that need to be completed by DD expiration
const getTasksByDDExpiration = (tasks: Task[], ddExpirationDate: string | null): Task[] => {
  if (!ddExpirationDate) return [];
  
  try {
    const ddDate = parseISO(ddExpirationDate);
    if (!isValid(ddDate)) return [];
    
    return tasks.filter(task => {
      // Only include incomplete tasks
      if (task.status === 'completed') return false;
      
      // For this enhanced filter, only include tasks that have valid deadlines
      if (!task.deadline || task.deadline.trim() === '') return false;
      
      try {
        const taskDeadline = parseISO(task.deadline);
        if (!isValid(taskDeadline)) return false; // Exclude tasks with invalid deadlines
        
        // Only include tasks with deadlines on or before DD expiration
        return differenceInDays(ddDate, taskDeadline) >= 0;
      } catch {
        return false; // Exclude tasks with deadline parsing errors
      }
    })
    .sort((a, b) => {
      // Sort by deadline (earliest first)
      try {
        const dateA = parseISO(a.deadline!);
        const dateB = parseISO(b.deadline!);
        return dateA.getTime() - dateB.getTime();
      } catch {
        return 0;
      }
    })
    .slice(0, 10); // Limit to first 10 tasks
  } catch {
    return [];
  }
};

export const WhitePaperDocument = ({ project, tasks, settings }: WhitePaperProps) => {
  // Calculate comprehensive KPIs and metrics
  const kpis = calculateProjectKPIs(project, tasks);
  const timelineHealth = calculateTimelineHealth(project);
  const categorizedTasks = groupTasksByCategory(tasks);
  const companiesHired = getUniqueCompaniesHired(tasks);
  const companyContacts = getCompanyContacts(tasks);
  const ddTasks = getTasksByDDExpiration(tasks, project.ddExpirationDate);
  const currentDate = format(new Date(), 'MMMM d, yyyy');
  const overallRiskIndicator = getRiskIndicator(kpis.overallRisk);
  
  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverPage}>
          <Text style={styles.coverTitle}>Due Diligence Report</Text>
          <Text style={styles.coverSubtitle}>{project.name}</Text>
          {project.description && (
            <Text style={styles.text}>{project.description}</Text>
          )}
          <Text style={styles.coverDate}>{currentDate}</Text>
        </View>
        <Text style={styles.footer}>
          Confidential Due Diligence Report - {project.name}
        </Text>
      </Page>

      {/* Executive KPI Dashboard */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Executive Summary</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deal Overview</Text>
          <Text style={styles.text}>
            <Text style={styles.bold}>Deal:</Text> {project.name}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiNumber}>{kpis.completionRate}%</Text>
              <Text style={styles.kpiLabel}>Completion Rate</Text>
              <Text style={styles.kpiSubtext}>{kpis.completedTasks} of {kpis.totalTasks} tasks completed</Text>
              <View style={styles.progressContainer}>
                <View style={[styles.progressFill, { width: `${kpis.completionRate}%` }]} />
              </View>
            </View>
            
            <View style={styles.kpiCard}>
              <Text style={styles.kpiNumber}>
                {kpis.daysToExpiration !== null ? 
                  (kpis.daysToExpiration >= 0 ? kpis.daysToExpiration : 'EXPIRED') : 
                  'N/A'
                }
              </Text>
              <Text style={styles.kpiLabel}>Days to DD Expiration</Text>
              <Text style={styles.kpiSubtext}>
                {kpis.daysToExpiration !== null && kpis.daysToExpiration >= 0 ? 
                  `Expires ${formatDate(project.ddExpirationDate)}` : 
                  kpis.daysToExpiration !== null && kpis.daysToExpiration < 0 ?
                    'Due diligence period expired' :
                    'No expiration date set'
                }
              </Text>
              <View style={getRiskIndicator(kpis.expirationRisk).style}>
                <Text>{getRiskIndicator(kpis.expirationRisk).text}</Text>
              </View>
            </View>
            
            <View style={styles.kpiCard}>
              <Text style={styles.kpiNumber}>{formatCurrency(kpis.totalCost.toString())}</Text>
              <Text style={styles.kpiLabel}>Total Cost</Text>
              <Text style={styles.kpiSubtext}>Estimated due diligence expenses</Text>
            </View>
            
            <View style={styles.kpiCard}>
              <Text style={styles.kpiNumber}>{kpis.overdueTasks.length}</Text>
              <Text style={styles.kpiLabel}>Overdue Tasks</Text>
              <Text style={styles.kpiSubtext}>
                {kpis.upcomingDeadlines.length} tasks due within 7 days
              </Text>
              {kpis.overdueTasks.length > 0 && (
                <View style={getRiskIndicator('high').style}>
                  <Text>ATTENTION REQUIRED</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={[styles.section, { marginBottom: 15 }]}>
          <Text style={styles.sectionTitle}>Task Status Breakdown</Text>
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { padding: 12, marginBottom: 10 }]}>
              <Text style={[styles.kpiNumber, { fontSize: 24, marginBottom: 4 }]}>{kpis.completedTasks}</Text>
              <Text style={styles.kpiLabel}>Completed</Text>
            </View>
            
            <View style={[styles.kpiCard, { padding: 12, marginBottom: 10 }]}>
              <Text style={[styles.kpiNumber, { fontSize: 24, marginBottom: 4 }]}>{kpis.inProgressTasks}</Text>
              <Text style={styles.kpiLabel}>In Progress</Text>
            </View>
            
            <View style={[styles.kpiCard, { padding: 12, marginBottom: 10 }]}>
              <Text style={[styles.kpiNumber, { fontSize: 24, marginBottom: 4 }]}>{kpis.notStartedTasks}</Text>
              <Text style={styles.kpiLabel}>Not Started</Text>
            </View>
            
            <View style={[styles.kpiCard, { padding: 12, marginBottom: 10 }]}>
              <Text style={[styles.kpiNumber, { fontSize: 24, marginBottom: 4 }]}>{kpis.totalTasks}</Text>
              <Text style={styles.kpiLabel}>Total Tasks</Text>
            </View>
          </View>
        </View>


        <Text style={styles.footer}>
          Confidential Due Diligence Report - {project.name} | Page 2
        </Text>
      </Page>

      {/* Timeline & Schedule Health */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>DD Timeline</Text>
        
        <View style={styles.section}>
          {(() => {
            // Build milestones from project dates and task deadlines
            const milestones: Array<{ name: string; date: string; tasks: Task[] }> = [];
            
            // Add project milestone dates
            if (project.psaSignedDate) {
              milestones.push({ 
                name: 'PSA Signed', 
                date: project.psaSignedDate, 
                tasks: []
              });
            }
            if (project.ddExpirationDate) {
              milestones.push({ 
                name: 'DD Expiration', 
                date: project.ddExpirationDate, 
                tasks: tasks.filter(task => 
                  task.deadline === project.ddExpirationDate ||
                  task.deadlineType === 'dd_expiration'
                )
              });
            }
            if (project.closingDate) {
              milestones.push({ 
                name: 'Target Closing Date', 
                date: project.closingDate, 
                tasks: tasks.filter(task => task.deadline === project.closingDate)
              });
            }
            
            // Add unique task deadlines that aren't already covered
            const existingDates = new Set(milestones.map(m => m.date));
            const uniqueTaskDeadlines = Array.from(new Set(
              tasks
                .filter(task => task.deadline && !existingDates.has(task.deadline))
                .map(task => task.deadline!)
            )).sort();
            
            uniqueTaskDeadlines.forEach(deadline => {
              const tasksForDate = tasks.filter(task => task.deadline === deadline);
              if (tasksForDate.length > 0) {
                milestones.push({
                  name: `Task Deadline`,
                  date: deadline,
                  tasks: tasksForDate
                });
              }
            });
            
            // Sort milestones by date
            milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            return milestones.length === 0 ? (
              <Text style={styles.text}>No project milestones defined.</Text>
            ) : (
              milestones.map((milestone, index) => (
                <View key={index} style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={[styles.timelineLabel, { fontSize: 14, fontWeight: 'bold' }]}>
                      {milestone.name}
                    </Text>
                    <Text style={[styles.timelineDate, { marginLeft: 10 }]}>
                      {formatDate(milestone.date)}
                    </Text>
                  </View>
                  
                  {milestone.tasks.length > 0 && (
                    <View style={{ marginLeft: 20 }}>
                      {/* Column Headers */}
                      <View style={{ flexDirection: 'row', marginBottom: 8, paddingBottom: 4, borderBottom: '1 solid #e2e8f0' }}>
                        <Text style={[styles.text, { flex: 3, fontWeight: 'bold', fontSize: 10 }]}>DD Task</Text>
                        <Text style={[styles.text, { flex: 2, fontWeight: 'bold', fontSize: 10 }]}>Task Owner</Text>
                        <Text style={[styles.text, { flex: 2, fontWeight: 'bold', fontSize: 10 }]}>Company Hired</Text>
                        <Text style={[styles.text, { flex: 1, fontWeight: 'bold', fontSize: 10 }]}>Cost</Text>
                        <Text style={[styles.text, { flex: 1, fontWeight: 'bold', fontSize: 10 }]}>Status</Text>
                      </View>
                      
                      {/* Task Rows */}
                      {milestone.tasks.map((task) => (
                        <View key={task.id} style={{ flexDirection: 'row', marginBottom: 6, paddingVertical: 4 }}>
                          <Text style={[styles.text, { flex: 3, fontSize: 9 }]}>{task.title}</Text>
                          <Text style={[styles.text, { flex: 2, fontSize: 9 }]}>{task.assignee || 'Unassigned'}</Text>
                          <Text style={[styles.text, { flex: 2, fontSize: 9 }]}>{task.companyHired || 'Internal'}</Text>
                          <Text style={[styles.text, { flex: 1, fontSize: 9 }]}>{task.companyHired ? formatCurrency(task.cost || '') : '---'}</Text>
                          <View style={{ flex: 1 }}>
                            <View style={getStatusStyle(task.status)}>
                              <Text style={{ fontSize: 8 }}>{formatStatus(task.status)}</Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))
            );
          })()}
          
        </View>

        <Text style={styles.footer}>
          Confidential Due Diligence Report - {project.name} | Page 3
        </Text>
      </Page>

      {/* Key Contacts */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Key Contacts</Text>
        
        <View style={styles.section}>
          {(project.seller && project.seller.length > 0) && (
            <View style={styles.contactItem}>
              <Text style={styles.contactTitle}>Seller</Text>
              {project.seller.map((contact, index) => (
                <Text key={index} style={styles.contactDetail}>{contact}</Text>
              ))}
            </View>
          )}
          
          {(project.ourAttorney && project.ourAttorney.length > 0) && (
            <View style={styles.contactItem}>
              <Text style={styles.contactTitle}>Our Attorney</Text>
              {project.ourAttorney.map((contact, index) => (
                <Text key={index} style={styles.contactDetail}>{contact}</Text>
              ))}
            </View>
          )}
          
          {project.titleInsuranceCompany && (
            <View style={styles.contactItem}>
              <Text style={styles.contactTitle}>Title Insurance Company</Text>
              <Text style={styles.contactDetail}>{project.titleInsuranceCompany}</Text>
            </View>
          )}
          
          {project.lender && (
            <View style={styles.contactItem}>
              <Text style={styles.contactTitle}>Lender</Text>
              <Text style={styles.contactDetail}>{project.lender}</Text>
            </View>
          )}
          
          {companyContacts.length > 0 && (
            <View style={styles.contactItem}>
              <Text style={styles.contactTitle}>Third-Party Companies</Text>
              {companyContacts.map((company, index) => (
                <View key={index} style={{ marginBottom: 8, paddingLeft: 10 }}>
                  <Text style={[styles.contactDetail, { fontWeight: 'bold', marginBottom: 2 }]}>
                    {company.name}
                  </Text>
                  
                  {company.representatives.length > 0 && (
                    <View style={{ marginLeft: 10 }}>
                      {company.representatives.map((rep, repIndex) => (
                        <View key={repIndex} style={{ marginBottom: 4 }}>
                          {rep.name && (
                            <Text style={styles.contactDetail}>Contact: {rep.name}</Text>
                          )}
                          {rep.email && (
                            <Text style={styles.contactDetail}>Email: {rep.email}</Text>
                          )}
                          {rep.phone && (
                            <Text style={styles.contactDetail}>Phone: {rep.phone}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {company.address && (company.address.street || company.address.city || company.address.state) && (
                    <View style={{ marginLeft: 10 }}>
                      <Text style={styles.contactDetail}>
                        Address: {[
                          company.address.street && company.address.suite 
                            ? `${company.address.street}, ${company.address.suite}`
                            : company.address.street,
                          company.address.city,
                          company.address.state,
                          company.address.zip
                        ].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  )}
                  
                  {company.assignees.size > 0 && (
                    <View style={{ marginLeft: 10 }}>
                      <Text style={styles.contactDetail}>
                        Assignees: {Array.from(company.assignees).join(', ')}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        <Text style={styles.footer}>
          Confidential Due Diligence Report - {project.name} | Page 4
        </Text>
      </Page>

    </Document>
  );
};

// Function to generate and download the PDF
export const generateWhitePaperPDF = async (
  project: Project,
  tasks: Task[],
  settings?: ProjectSettings | null
): Promise<void> => {
  const doc = <WhitePaperDocument project={project} tasks={tasks} settings={settings} />;
  const asPdf = pdf(doc);
  const blob = await asPdf.toBlob();
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.name}-Due-Diligence-Report.pdf`;
  link.click();
  
  URL.revokeObjectURL(url);
};