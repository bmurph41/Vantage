import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { format, parseISO, isValid } from 'date-fns';
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
    height: '100%',
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
    marginBottom: 25,
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
  summaryGrid: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryItem: {
    flex: 1,
    padding: 12,
    margin: 4,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    border: '1 solid #e2e8f0',
  },
  summaryNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2b6cb0',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 10,
    color: '#718096',
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

export const WhitePaperDocument = ({ project, tasks, settings }: WhitePaperProps) => {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress' || t.status === 'engaged' || t.status === 'scheduled').length;
  const notStartedTasks = tasks.filter(t => t.status === 'not_started').length;
  
  // Calculate total cost
  const totalCost = tasks.reduce((sum, task) => {
    if (task.cost) {
      const cleanCost = task.cost.replace(/[$,]/g, '').trim();
      const numericCost = parseFloat(cleanCost);
      return sum + (isNaN(numericCost) ? 0 : numericCost);
    }
    return sum;
  }, 0);

  const categorizedTasks = groupTasksByCategory(tasks);
  const currentDate = format(new Date(), 'MMMM d, yyyy');
  
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
          <Text style={styles.coverDate}>Generated on {currentDate}</Text>
        </View>
        <Text style={styles.footer}>
          Confidential Due Diligence Report - {project.name}
        </Text>
      </Page>

      {/* Executive Summary */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Executive Summary</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project Overview</Text>
          <Text style={styles.text}>
            <Text style={styles.bold}>Project Name:</Text> {project.name}
          </Text>
          {project.description && (
            <Text style={styles.text}>
              <Text style={styles.bold}>Description:</Text> {project.description}
            </Text>
          )}
          <Text style={styles.text}>
            <Text style={styles.bold}>PSA Signed Date:</Text> {formatDate(project.psaSignedDate)}
          </Text>
          <Text style={styles.text}>
            <Text style={styles.bold}>Due Diligence Expiration:</Text> {formatDate(project.ddExpirationDate)}
          </Text>
          <Text style={styles.text}>
            <Text style={styles.bold}>Target Closing Date:</Text> {formatDate(project.closingDate)}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Due Diligence Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{totalTasks}</Text>
              <Text style={styles.summaryLabel}>Total Tasks</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{completedTasks}</Text>
              <Text style={styles.summaryLabel}>Completed</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{inProgressTasks}</Text>
              <Text style={styles.summaryLabel}>In Progress</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{notStartedTasks}</Text>
              <Text style={styles.summaryLabel}>Not Started</Text>
            </View>
          </View>
          
          <Text style={styles.text}>
            <Text style={styles.bold}>Estimated Total Cost:</Text> {formatCurrency(totalCost.toString())}
          </Text>
          
          <Text style={styles.text}>
            <Text style={styles.bold}>Completion Rate:</Text> {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
          </Text>
        </View>

        <Text style={styles.footer}>
          Confidential Due Diligence Report - {project.name} | Page 2
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
        </View>

        <Text style={styles.footer}>
          Confidential Due Diligence Report - {project.name} | Page 3
        </Text>
      </Page>

      {/* Task Summary by Category */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Task Summary by Category</Text>
        
        {Object.entries(categorizedTasks).map(([category, categoryTasks]) => (
          <View key={category} style={styles.section}>
            <Text style={styles.sectionTitle}>{category}</Text>
            <Text style={styles.text}>
              <Text style={styles.bold}>Tasks:</Text> {categoryTasks.length} | 
              <Text style={styles.bold}> Completed:</Text> {categoryTasks.filter(t => t.status === 'completed').length} | 
              <Text style={styles.bold}> Total Cost:</Text> {formatCurrency(
                categoryTasks.reduce((sum, task) => {
                  if (task.cost) {
                    const cleanCost = task.cost.replace(/[$,]/g, '').trim();
                    const numericCost = parseFloat(cleanCost);
                    return sum + (isNaN(numericCost) ? 0 : numericCost);
                  }
                  return sum;
                }, 0).toString()
              )}
            </Text>
            
            {categoryTasks.slice(0, 5).map((task) => (
              <View key={task.id} style={styles.taskRow}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskDetail}>{task.assignee || 'Unassigned'}</Text>
                <Text style={styles.taskDetail}>{formatCurrency(task.cost || '')}</Text>
                <View style={getStatusStyle(task.status)}>
                  <Text>{formatStatus(task.status)}</Text>
                </View>
              </View>
            ))}
            
            {categoryTasks.length > 5 && (
              <Text style={styles.text}>
                ... and {categoryTasks.length - 5} more tasks in this category
              </Text>
            )}
          </View>
        ))}

        <Text style={styles.footer}>
          Confidential Due Diligence Report - {project.name} | Page 4
        </Text>
      </Page>

      {/* Detailed Task List */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Detailed Task List</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Due Diligence Tasks</Text>
          
          {tasks.map((task) => (
            <View key={task.id} style={styles.taskRow}>
              <View style={{ flex: 3 }}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                {task.description && (
                  <Text style={[styles.taskDetail, { fontSize: 8, marginTop: 2 }]}>
                    {task.description.length > 100 ? task.description.substring(0, 100) + '...' : task.description}
                  </Text>
                )}
              </View>
              <Text style={styles.taskDetail}>{task.assignee || 'Unassigned'}</Text>
              <Text style={styles.taskDetail}>{task.companyHired || 'N/A'}</Text>
              <Text style={styles.taskDetail}>{formatCurrency(task.cost || '')}</Text>
              <View style={getStatusStyle(task.status)}>
                <Text>{formatStatus(task.status)}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>
          Confidential Due Diligence Report - {project.name} | Page 5
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