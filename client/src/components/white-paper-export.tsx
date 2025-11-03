import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import { format, parseISO, isValid, differenceInCalendarDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { setDeadlineTo5PM } from '@/lib/date-utils';
import type { Project, DDTask, ProjectSettings, Risk } from '@shared/schema';

export type ReportAudience = 'internal' | 'investor' | 'lender' | 'partner' | 'attorney';

interface WhitePaperProps {
  project: Project;
  tasks: DDTask[];
  risks: Risk[];
  riskAnalytics: any;
  settings?: ProjectSettings | null;
  audience?: ReportAudience;
}

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
  coverPage: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    margin: -54,
    padding: 80,
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    color: '#003366',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  coverSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  coverDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 40,
    textAlign: 'center',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    marginTop: 20,
  },
  text: {
    fontSize: 11,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 1.5,
  },
  bold: {
    fontWeight: 'bold',
    color: '#1f2937',
  },
  // Clean KPI Dashboard styles
  kpiGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  kpiCard: {
    width: '23%',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  kpiNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 4,
    lineHeight: 1.0,
  },
  kpiLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: 'normal',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiSubtext: {
    fontSize: 9,
    color: '#9ca3af',
    marginTop: 4,
    lineHeight: 1.2,
  },
  // Clean progress visualization
  progressContainer: {
    marginTop: 8,
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#003366',
    borderRadius: 3,
  },
  progressFillWarning: {
    backgroundColor: '#f59e0b',
  },
  progressFillDanger: {
    backgroundColor: '#dc2626',
  },
  // Clean risk indicators
  riskIndicator: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 3,
    color: 'white',
    textAlign: 'center',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  riskLow: {
    backgroundColor: '#16a34a',
  },
  riskMedium: {
    backgroundColor: '#ea580c',
  },
  riskHigh: {
    backgroundColor: '#dc2626',
  },
  // Clean status cards
  statusCard: {
    width: '48%',
    padding: 20,
    marginBottom: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    textAlign: 'center',
  },
  statusNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 6,
    lineHeight: 1,
    color: '#003366',
  },
  statusLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: 'normal',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  taskRow: {
    display: 'flex',
    flexDirection: 'row',
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  taskTitle: {
    flex: 2,
    fontSize: 10,
    fontWeight: 'medium',
    color: '#1f2937',
  },
  taskDetail: {
    flex: 1,
    fontSize: 10,
    color: '#6b7280',
  },
  statusBadge: {
    fontSize: 9,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    textAlign: 'center',
    fontWeight: 'medium',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statusCompleted: {
    backgroundColor: '#ecfdf5',
    color: '#166534',
  },
  statusInProgress: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  statusEngaged: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  statusNotStarted: {
    backgroundColor: '#f3f4f6',
    color: '#4b5563',
  },
  contactItem: {
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#003366',
    marginBottom: 8,
  },
  contactDetail: {
    fontSize: 11,
    color: '#4b5563',
    marginBottom: 3,
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 54,
    right: 54,
    textAlign: 'center',
    fontSize: 9,
    color: '#9ca3af',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    borderTopStyle: 'solid',
  },
  confidentialHeader: {
    position: 'absolute',
    top: 20,
    left: 54,
    right: 54,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#003366',
    backgroundColor: '#f9fafb',
    padding: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pageBreak: {
    marginTop: 40,
  },
  // Clean timeline design
  timelineContainer: {
    marginTop: 20,
    marginBottom: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 20,
  },
  timelineItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  timelineLastItem: {
    marginBottom: 0,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#003366',
    marginRight: 12,
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
    fontWeight: 'medium',
    color: '#1f2937',
  },
  timelineDate: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: 'normal',
  },
  timelineLine: {
    position: 'absolute',
    left: 4,
    top: 12,
    bottom: -16,
    width: 1,
    backgroundColor: '#d1d5db',
  },
  // Clean executive summary styles
  executivePage: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 54,
    paddingVertical: 54,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.5,
  },
  executiveHeader: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#003366',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: 0.5,
  },
  confidentialBanner: {
    backgroundColor: '#003366',
    color: 'white',
    textAlign: 'center',
    padding: 10,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 24,
    borderRadius: 3,
  },
  executiveSection: {
    marginBottom: 32,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
  },
  executiveSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 25,
    backgroundColor: '#1e3a8a',
    padding: 18,
    paddingLeft: 25,
    borderRadius: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  keyInsight: {
    backgroundColor: '#f0f9ff',
    borderWidth: 2,
    borderColor: '#7dd3fc',
    borderStyle: 'solid',
    borderRadius: 8,
    padding: 25,
    marginBottom: 25,
    borderLeftWidth: 6,
    borderLeftColor: '#003366', // Dark blue as specified in guidance
    borderLeftStyle: 'solid',
  },
  keyInsightTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  keyInsightText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 1.7,
  },
  decisionBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'solid',
    borderRadius: 8,
    padding: 25,
    marginTop: 30,
    borderLeftWidth: 6,
    borderLeftColor: '#f59e0b',
    borderLeftStyle: 'solid',
  },
  decisionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d97706',
    marginBottom: 18,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionItem: {
    marginBottom: 12,
    paddingLeft: 15,
  },
  actionBullet: {
    color: '#dc2626',
    fontWeight: 'bold',
    marginRight: 8,
  },
  
  // Top Risks Section Styles
  topRisksContainer: {
    marginBottom: 30,
  },
  topRiskCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'solid',
    borderRadius: 10,
    padding: 20,
    marginBottom: 15,
    position: 'relative',
  },
  riskRankBadge: {
    position: 'absolute',
    top: -5,
    right: 15,
    backgroundColor: '#dc2626',
    color: 'white',
    borderRadius: 15,
    width: 30,
    height: 30,
    textAlign: 'center',
    lineHeight: 1.8,
    fontSize: 14,
    fontWeight: 'bold',
  },
  topRiskTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    marginRight: 40,
  },
  topRiskMetrics: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 6,
  },
  riskMetricItem: {
    textAlign: 'center',
    flex: 1,
  },
  riskMetricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  topRiskMetricLabel: {
    fontSize: 10,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mitigationPreview: {
    fontSize: 11,
    color: '#4b5563',
    lineHeight: 1.4,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    borderTopStyle: 'solid',
    paddingTop: 10,
    marginTop: 10,
  },

  // Enhanced Risk Management Styles
  riskRegisterContainer: {
    marginTop: 24,
    marginBottom: 24,
  },
  riskCard: {
    width: '100%',
    padding: 18,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'solid',
    minHeight: 120,
  },
  riskHeader: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  riskTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a202c',
    flex: 1,
    marginRight: 16,
  },
  riskRating: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    color: 'white',
    textAlign: 'center',
    minWidth: 70,
    textTransform: 'uppercase',
  },
  riskCritical: {
    backgroundColor: '#dc2626',
  },
  riskHighRating: {
    backgroundColor: '#ea580c',
  },
  riskMediumRating: {
    backgroundColor: '#d97706',
  },
  riskLowRating: {
    backgroundColor: '#059669',
  },
  riskDescription: {
    fontSize: 11,
    color: '#374151',
    lineHeight: 1.5,
    marginBottom: 10,
  },
  riskMetrics: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    borderTopStyle: 'solid',
  },
  riskMetric: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 4,
  },
  riskMetricLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  detailRiskMetricValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111827',
  },
  // Heat Map Styles
  heatMapContainer: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: 24,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'solid',
    borderRadius: 8,
    padding: 16,
  },
  heatMapTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  heatMapGrid: {
    display: 'flex',
    flexDirection: 'column',
  },
  heatMapRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  heatMapCell: {
    width: 45,
    height: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'solid',
    borderRadius: 3,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    marginRight: 2,
  },
  heatMapLabelRow: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: 'bold',
    textAlign: 'center',
    width: 45,
  },
  heatMapLabelCol: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: 'bold',
    textAlign: 'center',
    width: 80,
    marginRight: 8,
  },
  // Risk Category Distribution
  categoryGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  categoryCard: {
    width: '47%',
    padding: 14,
    marginRight: 20,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'solid',
    textAlign: 'center',
    minHeight: 80,
  },
  categoryTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 6,
  },
  categoryCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  categorySubtext: {
    fontSize: 10,
    color: '#6b7280',
  },
  // Methodology Section Styles
  methodologySection: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'solid',
    borderRadius: 8,
    padding: 18,
    marginBottom: 24,
  },
  methodologyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 14,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#cbd5e1',
    borderBottomStyle: 'solid',
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  methodologyStep: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  methodologyNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  methodologyContent: {
    flex: 1,
  },
  methodologyStepTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  methodologyStepText: {
    fontSize: 10,
    color: '#475569',
    lineHeight: 1.4,
  },
  // Mitigation Strategy Styles
  mitigationContainer: {
    marginBottom: 16,
    padding: 14,
    backgroundColor: '#fefefe',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'solid',
    borderRadius: 6,
  },
  mitigationHeader: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mitigationTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  mitigationStatus: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
    color: 'white',
    textTransform: 'uppercase',
  },
  mitigationImplemented: {
    backgroundColor: '#10b981',
  },
  mitigationInProgress: {
    backgroundColor: '#3b82f6',
  },
  mitigationPlanned: {
    backgroundColor: '#f59e0b',
  },
  mitigationText: {
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.4,
    marginBottom: 8,
  },
  mitigationMetrics: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    borderTopStyle: 'solid',
  },
  mitigationMetric: {
    flex: 1,
    textAlign: 'center',
  },
  mitigationMetricLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  mitigationMetricValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#111827',
  },
  // Executive Risk Summary Styles
  executiveRiskCard: {
    width: '100%',
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'solid',
  },
  executiveRiskHeader: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  executiveRiskIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    marginRight: 10,
  },
  executiveRiskTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#dc2626',
    flex: 1,
  },
  executiveRiskPriority: {
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
    backgroundColor: '#dc2626',
    color: 'white',
  },
  executiveRiskDescription: {
    fontSize: 11,
    color: '#374151',
    lineHeight: 1.4,
    marginBottom: 8,
  },
  executiveRiskAction: {
    fontSize: 10,
    color: '#059669',
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  // Document Classification Styles
  confidentialBadge: {
    backgroundColor: '#000000',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    textAlign: 'center',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  documentNumber: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 15,
  },
  // Table Formatting Styles
  tableHeader: {
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    borderBottomStyle: 'solid',
    padding: 12,
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#000000',
  },
  tableCell: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    borderBottomStyle: 'solid',
  },
  // Contact Grid (2-column)
  contactGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  contactGridItem: {
    width: '47%',
    marginRight: 25,
    marginBottom: 20,
  },
  // Timeline Grid (4-column)
  timelineGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  timelineGridItem: {
    width: '22%',
    marginRight: 20,
    marginBottom: 15,
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
    if (!isValid(date)) return "N/A";
    
    // Use EST timezone for consistent date formatting
    return formatInTimeZone(date, 'America/New_York', 'MMMM d, yyyy');
  } catch {
    return "N/A";
  }
};

// Get status badge style
const getStatusStyle = (status: string) => {
  switch (status) {
    case 'completed':
      return [styles.statusBadge, styles.statusCompleted];
    case 'engaged':
      return [styles.statusBadge, styles.statusEngaged];
    case 'in_progress':
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
  // Use EST timezone with 5:00 PM cutoff for consistent date calculations
  const todayEST = setDeadlineTo5PM(new Date());
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
  
  // Calculate days to DD expiration using EST timezone with 5:00 PM cutoff
  let daysToExpiration = null;
  let expirationRisk = 'low';
  if (project.ddExpirationDate) {
    try {
      const expirationDate = setDeadlineTo5PM(project.ddExpirationDate);
      if (isValid(expirationDate)) {
        daysToExpiration = differenceInCalendarDays(expirationDate, todayEST);
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
      const deadline = setDeadlineTo5PM(task.deadline);
      return isValid(deadline) && differenceInCalendarDays(todayEST, deadline) > 0 && task.status !== 'completed';
    } catch {
      return false;
    }
  });
  
  // Find upcoming critical deadlines (within 7 days)
  const upcomingDeadlines = tasks.filter(task => {
    if (!task.deadline || task.status === 'completed') return false;
    try {
      const deadline = setDeadlineTo5PM(task.deadline);
      if (!isValid(deadline)) return false;
      const daysUntilDeadline = differenceInCalendarDays(deadline, todayEST);
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
  // Use EST timezone with 5:00 PM cutoff for consistent date calculations
  const todayEST = setDeadlineTo5PM(new Date());
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
          daysFromToday: differenceInCalendarDays(todayEST, psaDate)
        });
      }
    } catch {
      // Handle invalid date
    }
  }
  
  // DD Expiration Date
  if (project.ddExpirationDate) {
    try {
      const ddDate = setDeadlineTo5PM(project.ddExpirationDate);
      if (isValid(ddDate)) {
        const daysFromToday = differenceInCalendarDays(ddDate, todayEST);
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
      const closingDate = setDeadlineTo5PM(project.closingDate);
      if (isValid(closingDate)) {
        const daysFromToday = differenceInCalendarDays(closingDate, todayEST);
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
    taskNames: Set<string>;
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
          taskNames: new Set(),
          representatives: [],
          assignees: new Set()
        });
      }
      
      const company = companyMap.get(companyName)!;
      
      // Add task name
      if (task.title && task.title.trim()) {
        company.taskNames.add(task.title.trim());
      }
      
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
        const taskDeadline = setDeadlineTo5PM(task.deadline);
        if (!isValid(taskDeadline)) return false; // Exclude tasks with invalid deadlines
        
        // Only include tasks with deadlines on or before DD expiration
        return differenceInCalendarDays(ddDate, taskDeadline) >= 0;
      } catch {
        return false; // Exclude tasks with deadline parsing errors
      }
    })
    .sort((a, b) => {
      // Sort by deadline (earliest first)
      try {
        const dateA = setDeadlineTo5PM(a.deadline!);
        const dateB = setDeadlineTo5PM(b.deadline!);
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

// Enhanced Risk Analysis Functions

interface RiskFactor {
  id: string;
  title: string;
  description: string;
  category: 'Timeline' | 'Financial' | 'Regulatory' | 'Environmental' | 'Market' | 'Operational' | 'Technical';
  impact: number; // 1-5 scale
  likelihood: number; // 1-5 scale
  riskScore: number; // impact × likelihood
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  quantifiedImpact: {
    financial: {
      best: number;
      mostLikely: number;
      worst: number;
    };
    schedule: {
      best: number; // days
      mostLikely: number;
      worst: number;
    };
  };
  rationale: string;
  dependencies: string[];
  mitigation: {
    strategy: string;
    status: 'Planned' | 'In Progress' | 'Implemented';
    effectiveness: number; // 1-5 scale
    residualRisk: number; // post-mitigation risk score
    owner: string;
    timeline: string;
    budget: number;
  };
  triggers: string[];
  relatedTasks: string[];
}

// Calculate risk score and level
const calculateRiskScore = (impact: number, likelihood: number): { score: number, level: 'Low' | 'Medium' | 'High' | 'Critical' } => {
  const score = impact * likelihood;
  let level: 'Low' | 'Medium' | 'High' | 'Critical';
  
  if (score >= 20) level = 'Critical';
  else if (score >= 15) level = 'High';
  else if (score >= 10) level = 'Medium';
  else level = 'Low';
  
  return { score, level };
};

// Comprehensive Risk Analysis Engine
const analyzeProjectRisks = (project: Project, tasks: Task[]): RiskFactor[] => {
  const today = new Date();
  const risks: RiskFactor[] = [];
  
  // 1. Timeline Risk Analysis
  const timelineRisks = analyzeTimelineRisks(project, tasks, today);
  risks.push(...timelineRisks);
  
  // 2. Financial Risk Analysis
  const financialRisks = analyzeFinancialRisks(project, tasks);
  risks.push(...financialRisks);
  
  // 3. Regulatory Risk Analysis
  const regulatoryRisks = analyzeRegulatoryRisks(tasks);
  risks.push(...regulatoryRisks);
  
  // 4. Environmental Risk Analysis
  const environmentalRisks = analyzeEnvironmentalRisks(tasks);
  risks.push(...environmentalRisks);
  
  // 5. Operational Risk Analysis
  const operationalRisks = analyzeOperationalRisks(tasks);
  risks.push(...operationalRisks);
  
  // 6. Market Risk Analysis
  const marketRisks = analyzeMarketRisks(project, tasks);
  risks.push(...marketRisks);
  
  // Sort by risk score (highest first) and return top risks
  return risks
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10); // Return top 10 risks for analysis
};

// Timeline Risk Analysis
const analyzeTimelineRisks = (project: Project, tasks: Task[], today: Date): RiskFactor[] => {
  const risks: RiskFactor[] = [];
  
  // DD Expiration Risk
  if (project.ddExpirationDate) {
    try {
      const ddDate = parseISO(project.ddExpirationDate);
      if (isValid(ddDate)) {
        const daysToExpiration = differenceInCalendarDays(ddDate, today);
        const incompleteTasks = tasks.filter(t => t.status !== 'completed').length;
        
        let impact = 5;
        let likelihood = 1;
        
        if (daysToExpiration < 0) {
          likelihood = 5; // Already expired
        } else if (daysToExpiration <= 7) {
          likelihood = 4;
        } else if (daysToExpiration <= 30) {
          likelihood = 3;
        } else if (daysToExpiration <= 60) {
          likelihood = 2;
        }
        
        // Adjust likelihood based on completion rate
        const completionRate = tasks.length > 0 ? (tasks.filter(t => t.status === 'completed').length / tasks.length) : 1;
        if (completionRate < 0.5) likelihood = Math.min(5, likelihood + 1);
        
        const { score, level } = calculateRiskScore(impact, likelihood);
        
        risks.push({
          id: 'TIMELINE_001',
          title: 'Due Diligence Period Expiration',
          description: `Risk of not completing all due diligence tasks before the ${formatDate(project.ddExpirationDate)} deadline.`,
          category: 'Timeline',
          impact,
          likelihood,
          riskScore: score,
          riskLevel: level,
          quantifiedImpact: {
            financial: {
              best: 50000,
              mostLikely: 150000,
              worst: 500000
            },
            schedule: {
              best: 0,
              mostLikely: 30,
              worst: 90
            }
          },
          rationale: `With ${incompleteTasks} tasks remaining and ${daysToExpiration >= 0 ? daysToExpiration : 'expired'} days to expiration, there is significant risk of timeline overrun.`,
          dependencies: ['All pending due diligence tasks'],
          mitigation: {
            strategy: 'Accelerate critical path tasks, negotiate extension if needed, prioritize show-stopper items',
            status: likelihood >= 4 ? 'In Progress' : 'Planned',
            effectiveness: 3,
            residualRisk: Math.max(1, score - 5),
            owner: 'Project Manager',
            timeline: '7-14 days',
            budget: 25000
          },
          triggers: ['Tasks falling behind schedule', 'New critical findings', 'Vendor delays'],
          relatedTasks: tasks.filter(t => t.status !== 'completed').map(t => t.title)
        });
      }
    } catch {
      // Handle invalid date
    }
  }
  
  // Critical Path Delay Risk
  const overdueTasks = tasks.filter(task => {
    if (!task.deadline || task.status === 'completed') return false;
    try {
      const deadline = setDeadlineTo5PM(task.deadline);
      return isValid(deadline) && differenceInCalendarDays(today, deadline) > 0;
    } catch {
      return false;
    }
  });
  
  if (overdueTasks.length > 0) {
    const impact = Math.min(5, 2 + overdueTasks.length);
    const likelihood = 4;
    const { score, level } = calculateRiskScore(impact, likelihood);
    
    risks.push({
      id: 'TIMELINE_002',
      title: 'Critical Path Task Delays',
      description: `${overdueTasks.length} tasks are currently overdue, creating cascading delays.`,
      category: 'Timeline',
      impact,
      likelihood,
      riskScore: score,
      riskLevel: level,
      quantifiedImpact: {
        financial: {
          best: overdueTasks.length * 5000,
          mostLikely: overdueTasks.length * 15000,
          worst: overdueTasks.length * 35000
        },
        schedule: {
          best: overdueTasks.length * 2,
          mostLikely: overdueTasks.length * 5,
          worst: overdueTasks.length * 10
        }
      },
      rationale: `Overdue tasks often create bottlenecks and dependencies that exponentially impact the overall timeline.`,
      dependencies: overdueTasks.map(t => t.title),
      mitigation: {
        strategy: 'Resource reallocation, vendor acceleration, parallel task execution where possible',
        status: 'In Progress',
        effectiveness: 3,
        residualRisk: score - 6,
        owner: 'Project Manager',
        timeline: 'Immediate',
        budget: overdueTasks.length * 10000
      },
      triggers: ['Task deadline misses', 'Resource unavailability', 'Vendor delays'],
      relatedTasks: overdueTasks.map(t => t.title)
    });
  }
  
  return risks;
};

// Financial Risk Analysis
const analyzeFinancialRisks = (project: Project, tasks: Task[]): RiskFactor[] => {
  const risks: RiskFactor[] = [];
  
  // Budget Overrun Risk
  const totalBudget = tasks.reduce((sum, task) => {
    if (task.cost) {
      const cleanCost = task.cost.replace(/[$,]/g, '').trim();
      const numericCost = parseFloat(cleanCost);
      return sum + (isNaN(numericCost) ? 0 : numericCost);
    }
    return sum;
  }, 0);
  
  if (totalBudget > 0) {
    // Assess budget risk based on completion vs spend rate
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const completedBudget = completedTasks.reduce((sum, task) => {
      if (task.cost) {
        const cleanCost = task.cost.replace(/[$,]/g, '').trim();
        const numericCost = parseFloat(cleanCost);
        return sum + (isNaN(numericCost) ? 0 : numericCost);
      }
      return sum;
    }, 0);
    
    const burnRate = completedTasks.length > 0 ? completedBudget / completedTasks.length : 0;
    const remainingTasks = tasks.filter(t => t.status !== 'completed').length;
    const projectedTotal = completedBudget + (burnRate * remainingTasks);
    
    let impact = 3;
    let likelihood = 2;
    
    if (projectedTotal > totalBudget * 1.3) {
      impact = 5;
      likelihood = 4;
    } else if (projectedTotal > totalBudget * 1.15) {
      impact = 4;
      likelihood = 3;
    }
    
    const { score, level } = calculateRiskScore(impact, likelihood);
    
    risks.push({
      id: 'FINANCIAL_001',
      title: 'Due Diligence Budget Overrun',
      description: `Risk of exceeding planned due diligence budget of ${formatCurrency(totalBudget.toString())}.`,
      category: 'Financial',
      impact,
      likelihood,
      riskScore: score,
      riskLevel: level,
      quantifiedImpact: {
        financial: {
          best: totalBudget * 0.05,
          mostLikely: totalBudget * 0.20,
          worst: totalBudget * 0.50
        },
        schedule: {
          best: 0,
          mostLikely: 7,
          worst: 21
        }
      },
      rationale: `Current spending trajectory suggests potential budget overrun. Projected total: ${formatCurrency(projectedTotal.toString())}`,
      dependencies: ['Remaining task execution', 'Vendor pricing changes', 'Scope creep'],
      mitigation: {
        strategy: 'Enhanced budget monitoring, vendor renegotiation, scope prioritization',
        status: 'Planned',
        effectiveness: 3,
        residualRisk: score - 4,
        owner: 'Finance Manager',
        timeline: '2-3 weeks',
        budget: 5000
      },
      triggers: ['Vendor cost increases', 'Additional work discovery', 'Timeline extensions'],
      relatedTasks: tasks.filter(t => t.cost && parseFloat(t.cost.replace(/[$,]/g, '')) > 0).map(t => t.title)
    });
  }
  
  return risks;
};

// Regulatory Risk Analysis
const analyzeRegulatoryRisks = (tasks: Task[]): RiskFactor[] => {
  const risks: RiskFactor[] = [];
  
  const regulatoryTasks = tasks.filter(task => {
    const title = task.title.toLowerCase();
    return title.includes('permit') || title.includes('regulatory') || 
           title.includes('compliance') || title.includes('zoning') ||
           title.includes('environmental') || title.includes('epa') ||
           title.includes('wetland') || title.includes('phase i') ||
           title.includes('phase ii');
  });
  
  if (regulatoryTasks.length > 0) {
    const incompleteRegulatory = regulatoryTasks.filter(t => t.status !== 'completed');
    const impact = 4; // Regulatory issues can be deal breakers
    const likelihood = incompleteRegulatory.length > 0 ? 3 : 2;
    const { score, level } = calculateRiskScore(impact, likelihood);
    
    risks.push({
      id: 'REGULATORY_001',
      title: 'Environmental & Regulatory Compliance',
      description: `Risk of discovering environmental issues or regulatory non-compliance that could impact transaction.`,
      category: 'Regulatory',
      impact,
      likelihood,
      riskScore: score,
      riskLevel: level,
      quantifiedImpact: {
        financial: {
          best: 25000,
          mostLikely: 200000,
          worst: 2000000
        },
        schedule: {
          best: 0,
          mostLikely: 45,
          worst: 180
        }
      },
      rationale: `Environmental and regulatory risks are common in real estate transactions and can result in significant remediation costs or deal cancellation.`,
      dependencies: regulatoryTasks.map(t => t.title),
      mitigation: {
        strategy: 'Thorough Phase I/II environmental assessments, permit verification, regulatory compliance audit',
        status: incompleteRegulatory.length > 0 ? 'In Progress' : 'Implemented',
        effectiveness: 4,
        residualRisk: score - 8,
        owner: 'Environmental Consultant',
        timeline: '4-8 weeks',
        budget: 50000
      },
      triggers: ['Contamination discovery', 'Permit violations', 'Regulatory changes'],
      relatedTasks: regulatoryTasks.map(t => t.title)
    });
  }
  
  return risks;
};

// Environmental Risk Analysis
const analyzeEnvironmentalRisks = (tasks: Task[]): RiskFactor[] => {
  const risks: RiskFactor[] = [];
  
  const environmentalTasks = tasks.filter(task => {
    const title = task.title.toLowerCase();
    return title.includes('environmental') || title.includes('phase i') || 
           title.includes('phase ii') || title.includes('contamination') ||
           title.includes('soil') || title.includes('groundwater') ||
           title.includes('wetland') || title.includes('hazmat');
  });
  
  const marineWaterTasks = tasks.filter(task => {
    const title = task.title.toLowerCase();
    return title.includes('marine') || title.includes('water') || 
           title.includes('dock') || title.includes('pier') ||
           title.includes('bathymetric') || title.includes('sediment');
  });
  
  if (marineWaterTasks.length > 0) {
    const impact = 4;
    const likelihood = 3; // Marine environments have higher environmental risk
    const { score, level } = calculateRiskScore(impact, likelihood);
    
    risks.push({
      id: 'ENVIRONMENTAL_001',
      title: 'Marine Environment Contamination',
      description: `Risk of marine contamination discovery that could require extensive remediation.`,
      category: 'Environmental',
      impact,
      likelihood,
      riskScore: score,
      riskLevel: level,
      quantifiedImpact: {
        financial: {
          best: 100000,
          mostLikely: 500000,
          worst: 3000000
        },
        schedule: {
          best: 30,
          mostLikely: 90,
          worst: 365
        }
      },
      rationale: `Marine environments are particularly susceptible to contamination from fuel, oil, and other maritime activities. Remediation is complex and expensive.`,
      dependencies: marineWaterTasks.map(t => t.title),
      mitigation: {
        strategy: 'Comprehensive marine environmental assessment, sediment testing, water quality analysis',
        status: 'In Progress',
        effectiveness: 3,
        residualRisk: score - 6,
        owner: 'Marine Environmental Specialist',
        timeline: '6-12 weeks',
        budget: 75000
      },
      triggers: ['Contamination detection', 'Regulatory intervention', 'Community concerns'],
      relatedTasks: marineWaterTasks.map(t => t.title)
    });
  }
  
  return risks;
};

// Operational Risk Analysis
const analyzeOperationalRisks = (tasks: Task[]): RiskFactor[] => {
  const risks: RiskFactor[] = [];
  
  // Vendor Dependency Risk
  const vendorTasks = tasks.filter(t => t.companyHired && t.companyHired.trim() !== '');
  const uniqueVendors = new Set(vendorTasks.map(t => t.companyHired!.trim()));
  
  if (uniqueVendors.size > 0) {
    const criticalVendors = Array.from(uniqueVendors).filter(vendor => {
      const vendorTaskCount = vendorTasks.filter(t => t.companyHired?.trim() === vendor).length;
      return vendorTaskCount >= 2; // Vendors with multiple tasks are critical
    });
    
    if (criticalVendors.length > 0) {
      const impact = 3;
      const likelihood = 2;
      const { score, level } = calculateRiskScore(impact, likelihood);
      
      risks.push({
        id: 'OPERATIONAL_001',
        title: 'Key Vendor Dependencies',
        description: `Heavy reliance on ${criticalVendors.length} key vendors could create bottlenecks if they experience delays.`,
        category: 'Operational',
        impact,
        likelihood,
        riskScore: score,
        riskLevel: level,
        quantifiedImpact: {
          financial: {
            best: 10000,
            mostLikely: 50000,
            worst: 200000
          },
          schedule: {
            best: 5,
            mostLikely: 14,
            worst: 45
          }
        },
        rationale: `Vendor capacity constraints, quality issues, or delays can cascade through dependent tasks.`,
        dependencies: criticalVendors,
        mitigation: {
          strategy: 'Backup vendor identification, enhanced vendor management, parallel execution where possible',
          status: 'Planned',
          effectiveness: 3,
          residualRisk: score - 3,
          owner: 'Procurement Manager',
          timeline: '1-2 weeks',
          budget: 15000
        },
        triggers: ['Vendor delays', 'Quality issues', 'Resource conflicts'],
        relatedTasks: vendorTasks.filter(t => criticalVendors.includes(t.companyHired!.trim())).map(t => t.title)
      });
    }
  }
  
  return risks;
};

// Market Risk Analysis
const analyzeMarketRisks = (project: Project, tasks: Task[]): RiskFactor[] => {
  const risks: RiskFactor[] = [];
  
  // Market Condition Risk (generic assessment based on timeline)
  const today = new Date();
  let marketExposure = 2; // Default low market risk
  
  if (project.ddExpirationDate) {
    try {
      const ddDate = parseISO(project.ddExpirationDate);
      if (isValid(ddDate)) {
        const daysToExpiration = differenceInCalendarDays(ddDate, today);
        if (daysToExpiration > 90) marketExposure = 3; // Longer exposure to market changes
      }
    } catch {
      // Handle invalid date
    }
  }
  
  const impact = 3;
  const likelihood = marketExposure;
  const { score, level } = calculateRiskScore(impact, likelihood);
  
  risks.push({
    id: 'MARKET_001',
    title: 'Market Condition Changes',
    description: `Risk of adverse market condition changes affecting property value or financing during due diligence period.`,
    category: 'Market',
    impact,
    likelihood,
    riskScore: score,
    riskLevel: level,
    quantifiedImpact: {
      financial: {
        best: 0,
        mostLikely: 100000,
        worst: 1000000
      },
      schedule: {
        best: 0,
        mostLikely: 0,
        worst: 30
      }
    },
    rationale: `Extended due diligence periods expose the transaction to market volatility in interest rates, property values, and financing availability.`,
    dependencies: ['Market conditions', 'Interest rate environment', 'Financing availability'],
    mitigation: {
      strategy: 'Rate locks, financing pre-approval, market monitoring, accelerated timeline',
      status: 'Planned',
      effectiveness: 2,
      residualRisk: score - 2,
      owner: 'Finance Manager',
      timeline: 'Ongoing',
      budget: 5000
    },
    triggers: ['Interest rate changes', 'Market downturn', 'Financing issues'],
    relatedTasks: ['Financing arrangements', 'Appraisal completion']
  });
  
  return risks;
};

// Risk Category Analysis
const analyzeRiskCategories = (risks: RiskFactor[]) => {
  const categories = {
    Timeline: risks.filter(r => r.category === 'Timeline'),
    Financial: risks.filter(r => r.category === 'Financial'),
    Regulatory: risks.filter(r => r.category === 'Regulatory'),
    Environmental: risks.filter(r => r.category === 'Environmental'),
    Operational: risks.filter(r => r.category === 'Operational'),
    Market: risks.filter(r => r.category === 'Market'),
    Technical: risks.filter(r => r.category === 'Technical')
  };
  
  const categoryStats = Object.entries(categories).map(([name, categoryRisks]) => ({
    name,
    count: categoryRisks.length,
    avgRiskScore: categoryRisks.length > 0 ? categoryRisks.reduce((sum, r) => sum + r.riskScore, 0) / categoryRisks.length : 0,
    highRiskCount: categoryRisks.filter(r => r.riskLevel === 'High' || r.riskLevel === 'Critical').length,
    totalFinancialImpact: categoryRisks.reduce((sum, r) => sum + r.quantifiedImpact.financial.mostLikely, 0)
  }));
  
  return {
    categories,
    categoryStats: categoryStats.sort((a, b) => b.avgRiskScore - a.avgRiskScore)
  };
};

export const WhitePaperDocument = ({ project, tasks, risks, riskAnalytics, settings }: WhitePaperProps) => {
  // Use real Risk data instead of legacy mock data, with defensive checks
  // Use EST timezone for consistent date formatting throughout PDF
  const currentDate = formatInTimeZone(new Date(), 'America/New_York', 'MMMM d, yyyy');
  const currentTimestamp = formatInTimeZone(new Date(), 'America/New_York', 'MMMM d, yyyy \'at\' h:mm a zzz');
  
  // Ensure risks is an array, provide empty array as fallback
  const safeRisks = Array.isArray(risks) ? risks : [];
  const safeRiskAnalytics = riskAnalytics || {
    categoryDistribution: [],
    categoryStats: [],
    heatMapData: [],
    topRisks: [],
    mitigationStrategies: []
  };
  
  // Get Top 3 risks by highest risk score (data-driven)
  const top3Risks = safeRisks
    .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
    .slice(0, 3);
  
  // Calculate comprehensive project metrics with safe risk data
  const totalCostAtRisk = safeRisks.reduce((sum, risk) => sum + (risk.impactCostUSD || 0), 0);
  const totalScheduleAtRisk = safeRisks.reduce((sum, risk) => sum + (risk.impactScheduleDays || 0), 0);
  const highRiskCount = safeRisks.filter(r => (r.riskScore || 0) > 15).length;
  const mediumRiskCount = safeRisks.filter(r => (r.riskScore || 0) >= 8 && (r.riskScore || 0) <= 15).length;
  const lowRiskCount = safeRisks.filter(r => (r.riskScore || 0) < 8).length;
  
  // Calculate task metrics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  // Calculate days to DD expiration
  const daysToExpiration = project.ddExpirationDate 
    ? differenceInCalendarDays(setDeadlineTo5PM(project.ddExpirationDate), setDeadlineTo5PM(new Date()))
    : null;
  
  // Generate risk heatmap data from real Risk data with safety checks
  const generateRiskHeatMap = () => {
    const heatMap = Array(5).fill(null).map(() => Array(5).fill(0));
    const heatMapDetails: any[][][] = Array(5).fill(null).map(() => Array(5).fill(null).map(() => [] as any[]));
    
    safeRisks.forEach(risk => {
      const likelihood = parseInt(risk.likelihood || '1');
      const impact = parseInt(risk.impact || '1');
      if (likelihood >= 1 && likelihood <= 5 && impact >= 1 && impact <= 5) {
        const row = 5 - impact; // Flip for display (high impact at top)
        const col = likelihood - 1; // Convert to 0-based index
        heatMap[row][col]++;
        (heatMapDetails[row][col] as any[]).push({
          name: risk.name || 'Unknown Risk',
          score: risk.riskScore || 0,
          category: risk.category || 'operational'
        });
      }
    });
    
    return { heatMap, heatMapDetails };
  };
  
  const { heatMap, heatMapDetails } = generateRiskHeatMap();
  
  // Calculate additional task metrics for KPIs
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const notStartedTasks = tasks.filter(t => t.status === 'not_started').length;
  const overdueTasks = tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'completed');
  const upcomingDeadlines = tasks.filter(t => {
    if (!t.deadline) return false;
    const dueDate = new Date(t.deadline);
    const now = new Date();
    const daysDiff = differenceInCalendarDays(dueDate, now);
    return daysDiff >= 0 && daysDiff <= 7;
  });
  
  // Calculate total cost from tasks
  const totalCost = tasks.reduce((sum, task) => {
    if (task.cost) {
      const cleanCost = task.cost.replace(/[$,]/g, '').trim();
      const numericCost = parseFloat(cleanCost);
      return sum + (isNaN(numericCost) ? 0 : numericCost);
    }
    return sum;
  }, 0);
  
  // Define KPIs object with all required metrics
  const kpis = {
    totalCost,
    totalTasks,
    completedTasks,
    inProgressTasks,
    notStartedTasks,
    overdueTasks,
    upcomingDeadlines
  };
  
  // Create top 3 executive risks with proper structure
  const top3ExecutiveRisks = top3Risks.map(risk => ({
    id: risk.id,
    title: risk.name,
    description: risk.description || 'No description provided',
    riskLevel: risk.riskScore > 15 ? 'Critical' : risk.riskScore >= 8 ? 'High' : 'Medium',
    riskScore: risk.riskScore,
    quantifiedImpact: {
      financial: {
        best: risk.impactCostUSD ? Math.round(risk.impactCostUSD * 0.7) : 0,
        mostLikely: risk.impactCostUSD || 0,
        worst: risk.impactCostUSD ? Math.round(risk.impactCostUSD * 1.5) : 0
      }
    },
    mitigation: {
      strategy: risk.mitigationPlan || 'Mitigation plan to be developed'
    },
    // Add other required properties
    rationale: risk.description || 'Risk assessment pending',
    dependencies: [],
    triggers: []
  }));
  
  // Define other missing variables with safe defaults
  const heatMapData = heatMap;
  const riskAnalysis = {
    categoryDistribution: Array.isArray(safeRiskAnalytics.categoryDistribution) ? safeRiskAnalytics.categoryDistribution : [],
    categoryStats: Array.isArray(safeRiskAnalytics.categoryStats) ? safeRiskAnalytics.categoryStats : []
  };
  const top5Risks = safeRisks.sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0)).slice(0, 5);
  const companyContacts = [{
    name: project.seller || 'Seller Company',
    representatives: [{ name: 'Contact Person', title: 'Representative', email: 'contact@company.com' }]
  }];
  
  return (
    <Document>
      {/* Executive Summary Page 1 - Data-Driven Board Presentation */}
      <Page size="LETTER" style={styles.executivePage}>
        <View style={styles.confidentialBanner}>
          <Text>CONFIDENTIAL - BOARD EXECUTIVE SUMMARY</Text>
        </View>
        
        <Text style={styles.executiveHeader}>
          Due Diligence Summary Report
        </Text>
        <Text style={styles.coverSubtitle}>{project.name.replace(/\s*DD\s*$/i, '').trim()}</Text>
        <Text style={styles.coverDate}>{currentDate}</Text>

        {/* Key Risk Insights Section */}
        <View style={styles.executiveSection}>
          <Text style={styles.executiveSectionTitle}>Key Risk Assessment</Text>
          
          <View style={styles.keyInsight}>
            <Text style={styles.keyInsightTitle}>Project Status & Risk Summary</Text>
            <Text style={styles.keyInsightText}>
              • {completedTasks}/{totalTasks} due diligence tasks completed ({completionRate}% complete)
              {daysToExpiration ? `\n• ${daysToExpiration > 0 ? daysToExpiration : 0} days until DD expiration` : ''}
              {safeRisks.length > 0 ? `\n• ${safeRisks.length} risks identified with ${highRiskCount} high-severity requiring immediate action` : '\n• Risk assessment in progress - preliminary data shown'}
              {totalCostAtRisk > 0 ? `\n• ${formatCurrency(totalCostAtRisk.toString())} total financial exposure identified` : ''}
            </Text>
          </View>

          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiNumber}>${(totalCostAtRisk / 1000000).toFixed(1)}M</Text>
              <Text style={styles.kpiLabel}>Total Cost at Risk</Text>
              <Text style={styles.kpiSubtext}>
                Potential financial exposure across all identified risks
              </Text>
            </View>
            
            <View style={styles.kpiCard}>
              <Text style={styles.kpiNumber}>{totalScheduleAtRisk}</Text>
              <Text style={styles.kpiLabel}>Days Schedule at Risk</Text>
              <Text style={styles.kpiSubtext}>
                Maximum potential project delay exposure
              </Text>
            </View>
            
            <View style={styles.kpiCard}>
              <Text style={styles.kpiNumber}>{highRiskCount}</Text>
              <Text style={styles.kpiLabel}>High-Severity Risks</Text>
              <Text style={styles.kpiSubtext}>
                Score {'>'}15 requiring immediate mitigation
              </Text>
            </View>
            
            <View style={styles.kpiCard}>
              <Text style={styles.kpiNumber}>{completionRate}%</Text>
              <Text style={styles.kpiLabel}>DD Task Completion</Text>
              <Text style={styles.kpiSubtext}>
                {completedTasks} of {totalTasks} due diligence tasks completed
              </Text>
            </View>
          </View>
        </View>

        {/* Top 3 Risks - Auto-Selected by Highest Risk Score */}
        <View style={styles.executiveSection}>
          <Text style={styles.executiveSectionTitle}>
            Top 3 Critical Risks (Auto-Selected by Risk Score = Likelihood × Impact)
          </Text>
          
          <View style={styles.topRisksContainer}>
            {top3Risks.length > 0 ? top3Risks.map((risk, index) => (
              <View key={risk.id} style={styles.topRiskCard}>
                <View style={styles.riskRankBadge}>
                  <Text style={{ color: 'white', fontSize: 14, fontWeight: 'bold' }}>
                    #{index + 1}
                  </Text>
                </View>
                
                <Text style={styles.topRiskTitle}>{risk.name}</Text>
                
                <View style={styles.topRiskMetrics}>
                  <View style={styles.riskMetricItem}>
                    <Text style={styles.riskMetricValue}>{risk.riskScore}</Text>
                    <Text style={styles.topRiskMetricLabel}>Risk Score</Text>
                  </View>
                  <View style={styles.riskMetricItem}>
                    <Text style={styles.riskMetricValue}>
                      ${((risk.impactCostUSD || 0) / 1000).toLocaleString()}K
                    </Text>
                    <Text style={styles.topRiskMetricLabel}>Cost at Risk</Text>
                  </View>
                  <View style={styles.riskMetricItem}>
                    <Text style={styles.riskMetricValue}>{risk.impactScheduleDays || 0}</Text>
                    <Text style={styles.topRiskMetricLabel}>Schedule Risk</Text>
                  </View>
                  <View style={styles.riskMetricItem}>
                    <Text style={styles.riskMetricValue}>{risk.owner}</Text>
                    <Text style={styles.topRiskMetricLabel}>Risk Owner</Text>
                  </View>
                </View>
                
                {risk.mitigationPlan && (
                  <Text style={styles.mitigationPreview}>
                    <Text style={styles.bold}>Mitigation: </Text>
                    {risk.mitigationPlan.length > 120 
                      ? `${risk.mitigationPlan.substring(0, 120)}...` 
                      : risk.mitigationPlan}
                  </Text>
                )}
                
                {risk.targetDate && (
                  <Text style={styles.mitigationPreview}>
                    <Text style={styles.bold}>Target Completion: </Text>
                    {formatDate(risk.targetDate)}
                  </Text>
                )}
              </View>
            )) : (
              <View style={styles.keyInsight}>
                <Text style={styles.keyInsightTitle}>No Critical Risks Identified</Text>
                <Text style={styles.keyInsightText}>
                  Risk assessment is pending or no high-severity risks have been identified at this time.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Decision Asks */}
        <View style={styles.decisionBox}>
          <Text style={styles.decisionTitle}>Required Board Actions</Text>
          
          <View style={styles.actionItem}>
            <Text style={styles.actionBullet}>•</Text>
            <Text style={styles.keyInsightText}>
              <Text style={styles.bold}>APPROVE: </Text>
              ${(top3Risks.reduce((sum, r) => sum + (r.mitigationCostUSD || 0), 0) / 1000).toLocaleString()}K mitigation budget for {highRiskCount} high-severity risks
            </Text>
          </View>
          
          <View style={styles.actionItem}>
            <Text style={styles.actionBullet}>•</Text>
            <Text style={styles.keyInsightText}>
              <Text style={styles.bold}>DECIDE: </Text>
              Accept {totalScheduleAtRisk}-day schedule risk OR authorize accelerated timeline
            </Text>
          </View>
          
          {daysToExpiration !== null && daysToExpiration >= 0 && daysToExpiration < 30 && (
            <View style={styles.actionItem}>
              <Text style={styles.actionBullet}>•</Text>
              <Text style={styles.keyInsightText}>
                <Text style={styles.bold}>URGENT: </Text>
                DD expires in {daysToExpiration} days - authorize extension OR accelerate closure
              </Text>
            </View>
          )}
          
          {completionRate < 80 && (
            <View style={styles.actionItem}>
              <Text style={styles.actionBullet}>•</Text>
              <Text style={styles.keyInsightText}>
                <Text style={styles.bold}>RESOURCE: </Text>
                Authorize additional resources to complete remaining {totalTasks - completedTasks} DD tasks
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => 
          `CONFIDENTIAL - Board Executive Summary | Page ${pageNumber} of ${totalPages} | Generated ${currentTimestamp}`
        } />
      </Page>

      {/* Risk Heatmap & Analytics Page */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.header}>Risk Analysis & Visualization</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risk Distribution Analysis</Text>
          
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiNumber}>{highRiskCount}</Text>
              <Text style={styles.kpiLabel}>High Risk (Score &gt;15)</Text>
              <Text style={styles.kpiSubtext}>
                Immediate board attention required
              </Text>
            </View>
            
            <View style={styles.kpiCard}>
              <Text style={styles.kpiNumber}>{mediumRiskCount}</Text>
              <Text style={styles.kpiLabel}>Medium Risk (Score 8-15)</Text>
              <Text style={styles.kpiSubtext}>
                Active monitoring and mitigation
              </Text>
            </View>
            
            <View style={styles.kpiCard}>
              <Text style={styles.kpiNumber}>{lowRiskCount}</Text>
              <Text style={styles.kpiLabel}>Low Risk (Score &lt;8)</Text>
              <Text style={styles.kpiSubtext}>
                Standard management protocols
              </Text>
            </View>
            
            <View style={styles.kpiCard}>
              <Text style={styles.kpiNumber}>
                {daysToExpiration !== null ? 
                  (daysToExpiration >= 0 ? daysToExpiration : 'EXPIRED') : 
                  'N/A'
                }
              </Text>
              <Text style={styles.kpiLabel}>Days to DD Expiration</Text>
              <Text style={styles.kpiSubtext}>
                {daysToExpiration !== null && daysToExpiration >= 0 ? 
                  `Expires ${formatDate(project.ddExpirationDate || '')}` : 
                  daysToExpiration !== null && daysToExpiration < 0 ?
                    'Due diligence period expired' :
                    'No expiration date set'
                }
              </Text>
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

        <Text style={styles.footer}>
          Confidential Due Diligence Report - {project.name} | Page 2
        </Text>
      </Page>

      {/* Timeline & Schedule Health */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.header}>DD Timeline</Text>

        <View style={[styles.section, { marginBottom: 24 }]}>
          <Text style={styles.sectionTitle}>Task Status Breakdown</Text>
          <View style={styles.kpiGrid}>
            <View style={styles.statusCard}>
              <Text style={[styles.statusNumber, { color: '#10b981' }]}>{kpis.completedTasks}</Text>
              <Text style={styles.statusLabel}>Completed</Text>
            </View>
            
            <View style={styles.statusCard}>
              <Text style={[styles.statusNumber, { color: '#3b82f6' }]}>{kpis.inProgressTasks}</Text>
              <Text style={styles.statusLabel}>In Progress</Text>
            </View>
            
            <View style={styles.statusCard}>
              <Text style={[styles.statusNumber, { color: '#6b7280' }]}>{kpis.notStartedTasks}</Text>
              <Text style={styles.statusLabel}>Not Started</Text>
            </View>
            
            <View style={styles.statusCard}>
              <Text style={[styles.statusNumber, { color: '#1f2937' }]}>{kpis.totalTasks}</Text>
              <Text style={styles.statusLabel}>Total Tasks</Text>
            </View>
          </View>
        </View>

        {/* Executive Risk Summary - Top 3 Critical Risks */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top 3 Critical Risks Requiring Board Attention</Text>
          {top3ExecutiveRisks.length > 0 ? top3ExecutiveRisks.map((risk, index) => (
            <View key={risk.id} style={styles.executiveRiskCard}>
              <View style={styles.executiveRiskHeader}>
                <View style={styles.executiveRiskIcon} />
                <Text style={styles.executiveRiskTitle}>#{index + 1}: {risk.title}</Text>
                <Text style={styles.executiveRiskPriority}>{risk.riskLevel.toUpperCase()}</Text>
              </View>
              <Text style={styles.executiveRiskDescription}>
                {risk.description}
              </Text>
              <Text style={styles.text}>
                <Text style={styles.bold}>Financial Impact: </Text>
                {formatCurrency(risk.quantifiedImpact.financial.mostLikely.toString())} 
                (Range: {formatCurrency(risk.quantifiedImpact.financial.best.toString())} - {formatCurrency(risk.quantifiedImpact.financial.worst.toString())})
              </Text>
              <Text style={styles.executiveRiskAction}>
                → Recommended Action: {risk.mitigation.strategy}
              </Text>
            </View>
          )) : (
            <View style={styles.keyInsight}>
              <Text style={styles.keyInsightTitle}>Risk Assessment Pending</Text>
              <Text style={styles.keyInsightText}>
                Critical risk analysis is in progress. No high-severity risks have been identified at this time.
              </Text>
            </View>
          )}
          
          <View style={[styles.kpiCard, { backgroundColor: '#fef3c7', border: '2 solid #f59e0b' }]}>
            <Text style={[styles.kpiLabel, { color: '#92400e' }]}>Board Approval Required</Text>
            <Text style={[styles.text, { fontSize: 10, color: '#92400e' }]}>
              Total aggregate risk exposure: {formatCurrency(
                top3ExecutiveRisks.reduce((sum, r) => sum + r.quantifiedImpact.financial.mostLikely, 0).toString()
              )}
              {top3ExecutiveRisks.some(r => r.riskLevel === 'Critical' || r.riskLevel === 'High') && 
                ' • Immediate mitigation funding approval recommended'}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Confidential Due Diligence Report - {project.name} | Page 2
        </Text>
      </Page>

      {/* Timeline & Schedule Health */}
      <Page size="LETTER" style={styles.page}>
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
                  task.deadline === project.ddExpirationDate
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
      <Page size="LETTER" style={styles.page}>
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
              {companyContacts.map((company, index) => (
                <View key={index} style={{ marginBottom: 8, paddingLeft: 10 }}>
                  <Text style={[styles.contactDetail, { fontWeight: 'bold', marginBottom: 2 }]}>
                    {company.name || 'Unknown Company'}
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
                          {(rep as any).phone && (
                            <Text style={styles.contactDetail}>Phone: {(rep as any).phone}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {(company as any).address && ((company as any).address.street || (company as any).address.city || (company as any).address.state) && (
                    <View style={{ marginLeft: 10 }}>
                      <Text style={styles.contactDetail}>
                        Address: {[
                          (company as any).address.street && (company as any).address.suite 
                            ? `${(company as any).address.street}, ${(company as any).address.suite}`
                            : (company as any).address.street,
                          (company as any).address.city,
                          (company as any).address.state,
                          (company as any).address.zip
                        ].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  )}
                  
                  {(company as any).assignees && (company as any).assignees.size > 0 && (
                    <View style={{ marginLeft: 10 }}>
                      <Text style={styles.contactDetail}>
                        Assignees: {Array.from((company as any).assignees).join(', ')}
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

      {/* Risk Selection Methodology */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.header}>Risk Selection Methodology</Text>
        
        <View style={styles.methodologySection}>
          <Text style={styles.methodologyTitle}>Systematic Risk Identification & Prioritization Framework</Text>
          
          <View style={styles.methodologyStep}>
            <Text style={styles.methodologyNumber}>1</Text>
            <View style={styles.methodologyContent}>
              <Text style={styles.methodologyStepTitle}>Comprehensive Risk Discovery</Text>
              <Text style={styles.methodologyStepText}>
                Systematic analysis of project data including task timelines, vendor dependencies, regulatory requirements, 
                environmental factors, and market conditions. Each potential risk source is catalogued and documented.
              </Text>
            </View>
          </View>
          
          <View style={styles.methodologyStep}>
            <Text style={styles.methodologyNumber}>2</Text>
            <View style={styles.methodologyContent}>
              <Text style={styles.methodologyStepTitle}>Impact × Likelihood Assessment</Text>
              <Text style={styles.methodologyStepText}>
                Each identified risk is evaluated using a 5×5 matrix scoring impact (1-5) and likelihood (1-5). 
                Impact considers financial, schedule, and strategic consequences. Likelihood is based on historical data, 
                current conditions, and expert judgment.
              </Text>
            </View>
          </View>
          
          <View style={styles.methodologyStep}>
            <Text style={styles.methodologyNumber}>3</Text>
            <View style={styles.methodologyContent}>
              <Text style={styles.methodologyStepTitle}>Quantified Financial Impact Analysis</Text>
              <Text style={styles.methodologyStepText}>
                Three-point estimation (best/most likely/worst case) for financial impact based on comparable projects, 
                vendor quotes, and regulatory precedents. Schedule impacts quantified in days with downstream effects calculated.
              </Text>
            </View>
          </View>
          
          <View style={styles.methodologyStep}>
            <Text style={styles.methodologyNumber}>4</Text>
            <View style={styles.methodologyContent}>
              <Text style={styles.methodologyStepTitle}>Risk Interdependency Mapping</Text>
              <Text style={styles.methodologyStepText}>
                Analysis of risk relationships and cascade effects. Identification of trigger events and dependency chains 
                that could amplify individual risk impacts across the project portfolio.
              </Text>
            </View>
          </View>
          
          <View style={styles.methodologyStep}>
            <Text style={styles.methodologyNumber}>5</Text>
            <View style={styles.methodologyContent}>
              <Text style={styles.methodologyStepTitle}>Final Prioritization & Selection</Text>
              <Text style={styles.methodologyStepText}>
                Risks ranked by composite score (Impact × Likelihood × Interdependency Factor). Top 5 represent 
                the highest priority risks requiring active management and board oversight based on potential 
                to impact project success.
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.subsectionTitle}>Risk Assessment Criteria</Text>
          <View style={styles.categoryGrid}>
            <View style={styles.categoryCard}>
              <Text style={styles.categoryTitle}>Impact Scale</Text>
              <Text style={[styles.categorySubtext, { textAlign: 'left' }]}>
                1: Minimal impact{'\n'}
                2: Minor impact{'\n'}
                3: Moderate impact{'\n'}
                4: Major impact{'\n'}
                5: Severe/Critical impact
              </Text>
            </View>
            <View style={styles.categoryCard}>
              <Text style={styles.categoryTitle}>Likelihood Scale</Text>
              <Text style={[styles.categorySubtext, { textAlign: 'left' }]}>
                1: Very unlikely (&lt;10%){'\n'}
                2: Unlikely (10-30%){'\n'}
                3: Possible (30-50%){'\n'}
                4: Likely (50-80%){'\n'}
                5: Very likely (&gt;80%)
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>
          Confidential Due Diligence Report - {project.name} | Page 5
        </Text>
      </Page>

      {/* Risk Heat Map & Category Analysis */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.header}>Risk Analysis Dashboard</Text>
        
        {/* Risk Heat Map */}
        <View style={styles.heatMapContainer}>
          <Text style={styles.heatMapTitle}>Risk Heat Map - Impact vs Likelihood</Text>
          
          {/* Heat Map Legend Row */}
          <View style={styles.heatMapRow}>
            <Text style={styles.heatMapLabelCol}></Text>
            {[1, 2, 3, 4, 5].map(likelihood => (
              <Text key={likelihood} style={styles.heatMapLabelRow}>{likelihood}</Text>
            ))}
          </View>
          
          {/* Heat Map Grid */}
          <View style={styles.heatMapGrid}>
            {heatMapData.map((row, impactIndex) => (
              <View key={impactIndex} style={styles.heatMapRow}>
                <Text style={styles.heatMapLabelCol}>Impact {5 - impactIndex}</Text>
                {row.map((cellValue, likelihoodIndex) => {
                  const riskScore = (5 - impactIndex) * (likelihoodIndex + 1);
                  let cellColor = '#ffffff';
                  if (riskScore >= 20) cellColor = '#dc2626';
                  else if (riskScore >= 15) cellColor = '#ea580c';
                  else if (riskScore >= 10) cellColor = '#d97706';
                  else if (riskScore >= 5) cellColor = '#eab308';
                  else cellColor = '#22c55e';
                  
                  return (
                    <View key={likelihoodIndex} style={[styles.heatMapCell, { backgroundColor: cellColor }]}>
                      <Text style={{ fontSize: 8, color: riskScore >= 10 ? 'white' : 'black', fontWeight: 'bold' }}>
                        {cellValue > 0 ? cellValue : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
          
          {/* Legend */}
          <View style={{ marginTop: 12, display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
            <Text style={{ fontSize: 8, color: '#374151' }}>Low (1-4)</Text>
            <Text style={{ fontSize: 8, color: '#374151' }}>Medium (5-9)</Text>
            <Text style={{ fontSize: 8, color: '#374151' }}>High (10-14)</Text>
            <Text style={{ fontSize: 8, color: '#374151' }}>Very High (15-19)</Text>
            <Text style={{ fontSize: 8, color: '#374151' }}>Critical (20-25)</Text>
          </View>
        </View>

        {/* Risk Category Distribution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Risk Category Distribution</Text>
          <View style={styles.categoryGrid}>
            {riskAnalysis.categoryStats.map((category: any) => (
              <View key={category.name} style={styles.categoryCard}>
                <Text style={styles.categoryTitle}>{category.name}</Text>
                <Text style={styles.categoryCount}>{category.count}</Text>
                <Text style={styles.categorySubtext}>
                  Avg Score: {category.avgRiskScore.toFixed(1)}{'\n'}
                  High Risk: {category.highRiskCount}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer}>
          Confidential Due Diligence Report - {project.name} | Page 6
        </Text>
      </Page>

      {/* Top-5 Risk Register */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.header}>Top-5 Risk Register</Text>
        
        <View style={styles.riskRegisterContainer}>
          {top5Risks.length > 0 ? top5Risks.map((risk, index) => (
            <View key={risk.id} style={styles.riskCard}>
              <View style={styles.riskHeader}>
                <Text style={styles.riskTitle}>#{index + 1}: {risk.name}</Text>
                <Text style={[
                  styles.riskRating,
                  (risk.riskScore || 0) > 15 ? styles.riskCritical :
                  (risk.riskScore || 0) >= 8 ? styles.riskHighRating :
                  (risk.riskScore || 0) >= 4 ? styles.riskMediumRating :
                  styles.riskLowRating
                ]}>
                  {(risk.riskScore || 0) > 15 ? 'Critical' : (risk.riskScore || 0) >= 8 ? 'High' : (risk.riskScore || 0) >= 4 ? 'Medium' : 'Low'}
                </Text>
              </View>
              
              <Text style={styles.riskDescription}>{risk.description}</Text>
              
              <Text style={[styles.text, { fontSize: 10, marginBottom: 8 }]}>
                <Text style={styles.bold}>Selection Rationale: </Text>{risk.description || 'No rationale provided'}
              </Text>
              
              <View style={styles.riskMetrics}>
                <View style={styles.riskMetric}>
                  <Text style={styles.riskMetricLabel}>Impact</Text>
                  <Text style={styles.riskMetricValue}>{risk.impact}/5</Text>
                </View>
                <View style={styles.riskMetric}>
                  <Text style={styles.riskMetricLabel}>Likelihood</Text>
                  <Text style={styles.riskMetricValue}>{risk.likelihood}/5</Text>
                </View>
                <View style={styles.riskMetric}>
                  <Text style={styles.riskMetricLabel}>Risk Score</Text>
                  <Text style={styles.riskMetricValue}>{risk.riskScore}</Text>
                </View>
                <View style={styles.riskMetric}>
                  <Text style={styles.riskMetricLabel}>Financial Impact</Text>
                  <Text style={styles.riskMetricValue}>
                    {formatCurrency((risk.impactCostUSD || 0).toString())}
                  </Text>
                </View>
              </View>
            </View>
          )) : (
            <View style={styles.keyInsight}>
              <Text style={styles.keyInsightTitle}>No Risks in Register</Text>
              <Text style={styles.keyInsightText}>
                Risk assessment is pending or no risks have been identified requiring detailed analysis at this time.
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.footer}>
          Confidential Due Diligence Report - {project.name} | Page 7
        </Text>
      </Page>

      {/* Risk Mitigation Strategies */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.header}>Risk Mitigation Strategies</Text>
        
        <View style={styles.section}>
          {top5Risks.length > 0 ? top5Risks.map((risk, index) => (
            <View key={risk.id} style={styles.mitigationContainer}>
              <View style={styles.mitigationHeader}>
                <Text style={styles.mitigationTitle}>#{index + 1}: {risk.name}</Text>
                <Text style={[
                  styles.mitigationStatus,
                  risk.status === 'closed' ? styles.mitigationImplemented :
                  risk.status === 'mitigating' ? styles.mitigationInProgress :
                  styles.mitigationPlanned
                ]}>
                  {risk.status === 'closed' ? 'Implemented' : risk.status === 'mitigating' ? 'In Progress' : 'Planned'}
                </Text>
              </View>
              
              <Text style={styles.mitigationText}>
                <Text style={styles.bold}>Strategy: </Text>{risk.mitigationPlan || 'No strategy defined'}
              </Text>
              
              <Text style={styles.mitigationText}>
                <Text style={styles.bold}>Owner: </Text>{risk.mitigationOwner || risk.owner} | 
                <Text style={styles.bold}> Timeline: </Text>{risk.targetDate ? new Date(risk.targetDate).toLocaleDateString() : 'No timeline'} | 
                <Text style={styles.bold}> Budget: </Text>{formatCurrency((risk.mitigationCostUSD || 0).toString())}
              </Text>
              
              <View style={styles.mitigationMetrics}>
                <View style={styles.mitigationMetric}>
                  <Text style={styles.mitigationMetricLabel}>Effectiveness</Text>
                  <Text style={styles.mitigationMetricValue}>{risk.residualLikelihood || risk.likelihood}/5</Text>
                </View>
                <View style={styles.mitigationMetric}>
                  <Text style={styles.mitigationMetricLabel}>Residual Risk</Text>
                  <Text style={styles.mitigationMetricValue}>{(risk.residualLikelihood && risk.residualImpact) ? parseInt(risk.residualLikelihood) * parseInt(risk.residualImpact) : risk.riskScore || 0}</Text>
                </View>
                <View style={styles.mitigationMetric}>
                  <Text style={styles.mitigationMetricLabel}>Dependencies</Text>
                  <Text style={styles.mitigationMetricValue}>0</Text>
                </View>
              </View>
              
              <Text style={[styles.mitigationText, { fontSize: 9, fontStyle: 'italic' }]}>
                <Text style={styles.bold}>Key Triggers: </Text>Market conditions, regulatory changes
              </Text>
            </View>
          )) : (
            <View style={styles.keyInsight}>
              <Text style={styles.keyInsightTitle}>No Mitigation Strategies Required</Text>
              <Text style={styles.keyInsightText}>
                No risks have been identified that require specific mitigation strategies at this time.
              </Text>
            </View>
          )}
        </View>
        
        <View style={[styles.kpiCard, { backgroundColor: '#ecfdf5', border: '1 solid #10b981' }]}>
          <Text style={[styles.kpiLabel, { color: '#047857' }]}>Total Mitigation Investment</Text>
          <Text style={[styles.kpiNumber, { fontSize: 24, color: '#047857' }]}>
            {formatCurrency(top5Risks.reduce((sum, r) => sum + (r.mitigationCostUSD || 0), 0).toString())}
          </Text>
          <Text style={[styles.kpiSubtext, { color: '#047857' }]}>
            Expected risk reduction: {top5Risks.reduce((sum, r) => sum + Math.max(0, (r.riskScore || 0) - ((r.residualLikelihood && r.residualImpact) ? parseInt(r.residualLikelihood) * parseInt(r.residualImpact) : (r.riskScore || 0) * 0.7)), 0).toFixed(1)} points
          </Text>
        </View>

        <Text style={styles.footer}>
          Confidential Due Diligence Report - {project.name} | Page 8
        </Text>
      </Page>

    </Document>
  );
};

// Function to generate and download the comprehensive risk analysis PDF
export const generateWhitePaperPDF = async (
  project: Project,
  tasks: Task[],
  risks: Risk[],
  riskAnalytics: any,
  settings?: ProjectSettings | null
): Promise<void> => {
  try {
    console.log('Starting comprehensive risk analysis PDF generation for project:', project.name);
    console.log('Number of tasks:', tasks.length);
    console.log('Number of risks:', risks.length);
    console.log('Risk analytics:', riskAnalytics);
    
    const doc = <WhitePaperDocument 
      project={project} 
      tasks={tasks} 
      risks={risks} 
      riskAnalytics={riskAnalytics} 
      settings={settings} 
    />;
    console.log('Comprehensive risk analysis PDF document created');
    
    const asPdf = pdf(doc);
    console.log('PDF instance created');
    
    const blob = await asPdf.toBlob();
    console.log('PDF blob generated:', blob.size, 'bytes');
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name} DD Summary.pdf`; // Professional naming as specified in guidance
    link.click();
    
    URL.revokeObjectURL(url);
    console.log('Comprehensive risk analysis PDF download initiated successfully');
  } catch (error) {
    console.error('Detailed PDF generation error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available');
    console.error('Project data:', { name: project.name, id: project.id });
    console.error('Tasks count:', tasks.length);
    console.error('Risks count:', risks.length);
    throw error; // Re-throw to trigger the toast error message
  }
};