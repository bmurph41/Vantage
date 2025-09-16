import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Download, Mail, Eye, FileText, Calendar } from "lucide-react";
import type { Task, Project } from "@shared/schema";
import { format, parseISO, addDays, differenceInDays, isValid } from "date-fns";
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  project?: Project;
}

const COLUMN_OPTIONS = [
  { id: 'title', label: 'Task Title', defaultChecked: true },
  { id: 'description', label: 'Description', defaultChecked: true },
  { id: 'assignee', label: 'Task Owner', defaultChecked: true },
  { id: 'companyHired', label: 'Company Hired', defaultChecked: true },
  { id: 'status', label: 'Status', defaultChecked: true },
  { id: 'priority', label: 'Priority', defaultChecked: false },
  { id: 'deadline', label: 'Deadline', defaultChecked: true },
  { id: 'orderedAt', label: 'Ordered Date', defaultChecked: true },
  { id: 'startDate', label: 'Scheduled Date', defaultChecked: true },
  { id: 'completedAt', label: 'Completion Date', defaultChecked: true },
  { id: 'cost', label: 'Cost', defaultChecked: true },
  { id: 'paymentStatus', label: 'Payment Status', defaultChecked: false },
  { id: 'repName', label: 'Rep Name', defaultChecked: false },
  { id: 'repEmail', label: 'Rep Email', defaultChecked: false },
  { id: 'repPhone', label: 'Rep Phone', defaultChecked: false },
  { id: 'notes', label: 'Notes', defaultChecked: false },
];

// PDF Styles
const styles = StyleSheet.create({
  page: { fontSize: 10, padding: 30, fontFamily: 'Helvetica' },
  header: { fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  subheader: { fontSize: 14, fontWeight: 'bold', marginBottom: 10 },
  text: { fontSize: 10, marginBottom: 5 },
  table: { width: 'auto', borderStyle: 'solid', borderWidth: 1, borderRightWidth: 0, borderBottomWidth: 0 },
  tableRow: { flexDirection: 'row' },
  tableColHeader: { width: 'auto', borderStyle: 'solid', borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0, padding: 4, backgroundColor: '#f3f4f6', fontWeight: 'bold' },
  tableCol: { width: 'auto', borderStyle: 'solid', borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0, padding: 4 },
  tableCellHeader: { fontSize: 9, fontWeight: 'bold' },
  tableCell: { fontSize: 8 },
});

// PDF Document Component
const PDFReport = ({ filteredTasks, visibleColumns, project, formatCellValueForExport }: {
  filteredTasks: Task[];
  visibleColumns: typeof COLUMN_OPTIONS;
  project?: Project;
  formatCellValueForExport: (task: Task, columnId: string) => string;
}) => (
  <Document>
    <Page size="A4" style={styles.page} orientation="landscape">
      <Text style={styles.header}>Due Diligence Report</Text>
      <Text style={styles.text}>Project: {project?.name || 'N/A'}</Text>
      <Text style={styles.text}>Generated: {format(new Date(), 'MMM d, yyyy h:mm a')}</Text>
      <Text style={styles.text}>Total Tasks: {filteredTasks.length}</Text>
      
      <View style={[styles.table, { marginTop: 20 }]}>
        <View style={styles.tableRow}>
          {visibleColumns.map((col) => (
            <View key={col.id} style={[styles.tableColHeader, { width: `${100/visibleColumns.length}%` }]}>
              <Text style={styles.tableCellHeader}>{col.label}</Text>
            </View>
          ))}
        </View>
        {filteredTasks.map((task) => (
          <View style={styles.tableRow} key={task.id}>
            {visibleColumns.map((col) => (
              <View key={col.id} style={[styles.tableCol, { width: `${100/visibleColumns.length}%` }]}>
                <Text style={styles.tableCell}>{formatCellValueForExport(task, col.id)}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </Page>
  </Document>
);

export function ExportReportModal({ isOpen, onClose, tasks, project }: ExportReportModalProps) {
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set(tasks.map(t => t.id)));
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(COLUMN_OPTIONS.filter(col => col.defaultChecked).map(col => col.id))
  );
  const [includeTimeline, setIncludeTimeline] = useState(true);
  const [reportFormat, setReportFormat] = useState<'pdf' | 'csv'>('pdf');
  const [currentTab, setCurrentTab] = useState('select');
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState(`Due Diligence Report - ${project?.name || 'Project'}`);
  const [emailMessage, setEmailMessage] = useState('Please find the attached due diligence report.');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const { toast } = useToast();

  const handleTaskSelection = (taskId: string, checked: boolean) => {
    const newSelected = new Set(selectedTasks);
    if (checked) {
      newSelected.add(taskId);
    } else {
      newSelected.delete(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleSelectAllTasks = (checked: boolean) => {
    if (checked) {
      setSelectedTasks(new Set(tasks.map(t => t.id)));
    } else {
      setSelectedTasks(new Set());
    }
  };

  const handleColumnSelection = (columnId: string, checked: boolean) => {
    const newSelected = new Set(selectedColumns);
    if (checked) {
      newSelected.add(columnId);
    } else {
      newSelected.delete(columnId);
    }
    setSelectedColumns(newSelected);
  };

  const handleSelectAllColumns = (checked: boolean) => {
    if (checked) {
      setSelectedColumns(new Set(COLUMN_OPTIONS.map(col => col.id)));
    } else {
      setSelectedColumns(new Set());
    }
  };

  const filteredTasks = tasks.filter(task => selectedTasks.has(task.id));
  const visibleColumns = COLUMN_OPTIONS.filter(col => selectedColumns.has(col.id));

  const getStatusBadge = (status: string) => {
    const statusColors = {
      to_do: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
    };
    const statusLabels = {
      to_do: 'To Do',
      scheduled: 'Scheduled',
      in_progress: 'In Progress',
      completed: 'Completed',
    };
    return (
      <Badge className={`${statusColors[status as keyof typeof statusColors]} text-xs`}>
        {statusLabels[status as keyof typeof statusLabels]}
      </Badge>
    );
  };

  // Currency formatting utility - same as in ThirdPartyReports
  const formatCurrency = (value: string): string => {
    if (!value) return "-";
    
    // If already formatted with $, return as is
    if (value.startsWith("$")) return value;
    
    // Remove any non-numeric characters except decimal points
    const numericValue = value.replace(/[^\d.]/g, "");
    
    // If empty or just a decimal point, return dash
    if (!numericValue || numericValue === ".") return "-";
    
    // Parse as number and format with commas and dollar sign
    const number = parseFloat(numericValue);
    if (isNaN(number)) return value; // Return original if can't parse
    
    // Format with dollar sign and commas, no decimal places for whole numbers
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: number % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    }).format(number);
  };

  // Calculate deadline date - same logic as in ThirdPartyReports
  const calculateDeadlineDate = (task: Task): Date => {
    const today = new Date();
    let deadlineDate: Date;
    
    // First priority: Use direct deadline field if set
    if (task.deadline) {
      deadlineDate = parseISO(task.deadline);
    } else if (task.deadlineType === 'dd_expiration' && project?.ddExpirationDate) {
      deadlineDate = parseISO(project.ddExpirationDate);
    } else if (task.deadlineType === 'days_after_psa' && task.deadlineDays && project?.psaSignedDate) {
      const psaDate = parseISO(project.psaSignedDate);
      deadlineDate = addDays(psaDate, task.deadlineDays);
    } else {
      // Enhanced fallback calculation for tasks without specific deadline types
      const startDate = task.startDate 
        ? parseISO(task.startDate) 
        : project?.psaSignedDate 
          ? addDays(parseISO(project.psaSignedDate), task.startOffsetDays || 0)
          : today;
      
      // Use smart defaults based on priority for task duration
      const defaultDuration = task.priority === 'high' ? 5 : task.priority === 'med' ? 10 : 21;
      
      deadlineDate = addDays(startDate, defaultDuration);
    }
    
    return deadlineDate;
  };

  // Export-safe formatter that returns plain text (no React components)
  const formatCellValueForExport = (task: Task, columnId: string): string => {
    switch (columnId) {
      case 'title':
        return task.title;
      case 'description':
        return task.description || '-';
      case 'assignee':
        return task.assignee || '-';
      case 'companyHired':
        return task.companyHired || '-';
      case 'status':
        // Return plain text status labels for export
        const statusLabels = {
          to_do: 'To Do',
          scheduled: 'Scheduled',
          in_progress: 'In Progress',
          completed: 'Completed',
        };
        return statusLabels[task.status as keyof typeof statusLabels] || task.status;
      case 'priority':
        // Format priority for better readability
        const priorityLabels = {
          high: 'High',
          med: 'Medium',
          low: 'Low',
        };
        return priorityLabels[task.priority as keyof typeof priorityLabels] || task.priority || '-';
      case 'deadline':
        try {
          const deadlineDate = calculateDeadlineDate(task);
          return isValid(deadlineDate) ? format(deadlineDate, 'MMM d, yyyy') : '-';
        } catch {
          return '-';
        }
      case 'orderedAt':
        return task.orderedAt ? (() => {
          try {
            const date = new Date(task.orderedAt!);
            return isValid(date) ? format(date, 'MMM d, yyyy') : '-';
          } catch {
            return '-';
          }
        })() : '-';
      case 'startDate':
        return task.dateOnSite ? (() => {
          try {
            const date = new Date(task.dateOnSite!);
            return isValid(date) ? format(date, 'MMM d, yyyy') : '-';
          } catch {
            return '-';
          }
        })() : '-';
      case 'completedAt':
        return task.completedAt ? (() => {
          try {
            const date = new Date(task.completedAt!);
            return isValid(date) ? format(date, 'MMM d, yyyy') : '-';
          } catch {
            return '-';
          }
        })() : '-';
      case 'cost':
        return formatCurrency(task.cost || '');
      case 'paymentStatus':
        // Format payment status for better readability
        const paymentStatusLabels = {
          not_paid: 'Not Paid',
          paid: 'Paid',
          pending: 'Pending',
          partial: 'Partial',
        };
        return paymentStatusLabels[task.paymentStatus as keyof typeof paymentStatusLabels] || task.paymentStatus || 'Not Paid';
      case 'repName':
        return task.repName || '-';
      case 'repEmail':
        return task.repEmail || '-';
      case 'repPhone':
        return task.repPhone || '-';
      case 'notes':
        return task.notes || '-';
      default:
        return '-';
    }
  };

  // UI formatter that returns React components for display (original function)
  const formatCellValue = (task: Task, columnId: string) => {
    switch (columnId) {
      case 'title':
        return task.title;
      case 'description':
        return task.description || '-';
      case 'assignee':
        return task.assignee || '-';
      case 'companyHired':
        return task.companyHired || '-';
      case 'status':
        return getStatusBadge(task.status);
      case 'priority':
        return task.priority;
      case 'deadline':
        try {
          const deadlineDate = calculateDeadlineDate(task);
          return isValid(deadlineDate) ? format(deadlineDate, 'MMM d, yyyy') : '-';
        } catch {
          return '-';
        }
      case 'orderedAt':
        return task.orderedAt ? (() => {
          try {
            const date = new Date(task.orderedAt!);
            return isValid(date) ? format(date, 'MMM d, yyyy') : '-';
          } catch {
            return '-';
          }
        })() : '-';
      case 'startDate':
        return task.dateOnSite ? (() => {
          try {
            const date = new Date(task.dateOnSite!);
            return isValid(date) ? format(date, 'MMM d, yyyy') : '-';
          } catch {
            return '-';
          }
        })() : '-';
      case 'completedAt':
        return task.completedAt ? (() => {
          try {
            const date = new Date(task.completedAt!);
            return isValid(date) ? format(date, 'MMM d, yyyy') : '-';
          } catch {
            return '-';
          }
        })() : '-';
      case 'cost':
        return formatCurrency(task.cost || '');
      case 'paymentStatus':
        return task.paymentStatus || 'not_paid';
      case 'repName':
        return task.repName || '-';
      case 'repEmail':
        return task.repEmail || '-';
      case 'repPhone':
        return task.repPhone || '-';
      case 'notes':
        return task.notes || '-';
      default:
        return '-';
    }
  };

  // CSV generation function
  const generateCSV = () => {
    const headers = visibleColumns.map(col => col.label);
    const rows = filteredTasks.map(task => 
      visibleColumns.map(col => formatCellValueForExport(task, col.id))
    );
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // All values from formatCellValueForExport are already strings
        return `"${cell.replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');
    
    return csvContent;
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      if (reportFormat === 'csv') {
        const csvContent = generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${project?.name || 'due-diligence'}-report.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast({
          title: "CSV Downloaded",
          description: "Your report has been downloaded successfully.",
        });
      } else {
        // Generate PDF
        const pdfDoc = <PDFReport 
          filteredTasks={filteredTasks}
          visibleColumns={visibleColumns}
          project={project}
          formatCellValueForExport={formatCellValueForExport}
        />;
        
        const blob = await pdf(pdfDoc).toBlob();
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${project?.name || 'due-diligence'}-report.pdf`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast({
          title: "PDF Downloaded",
          description: "Your report has been downloaded successfully.",
        });
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Download Failed",
        description: "There was an error generating your report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleEmail = async () => {
    if (!emailTo.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter a recipient email address.",
        variant: "destructive",
      });
      return;
    }

    setIsEmailing(true);
    try {
      let reportData: string;
      let filename: string;
      let mimeType: string;

      if (reportFormat === 'csv') {
        reportData = generateCSV();
        filename = `${project?.name || 'due-diligence'}-report.csv`;
        mimeType = 'text/csv';
      } else {
        const pdfDoc = <PDFReport 
          filteredTasks={filteredTasks}
          visibleColumns={visibleColumns}
          project={project}
          formatCellValueForExport={formatCellValueForExport}
        />;
        const blob = await pdf(pdfDoc).toBlob();
        const buffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(buffer);
        reportData = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
        filename = `${project?.name || 'due-diligence'}-report.pdf`;
        mimeType = 'application/pdf';
      }

      await apiRequest('/api/dd/send-report-email', 'POST', {
        to: emailTo,
        subject: emailSubject,
        message: emailMessage,
        reportData,
        filename,
        mimeType,
        format: reportFormat,
      });

      toast({
        title: "Email Sent",
        description: `Report has been sent to ${emailTo}`,
      });
      
      onClose();
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Email Failed",
        description: "There was an error sending your report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsEmailing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center space-x-3 text-xl font-semibold">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <span className="text-gray-900">Export Due Diligence Report</span>
              <p className="text-sm text-gray-500 font-normal mt-1">Generate and share professional reports</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-50 p-1 rounded-lg">
            <TabsTrigger value="select" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span>Select Data</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="preview" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <div className="flex items-center space-x-2">
                <Eye className="h-4 w-4" />
                <span>Preview</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="export" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <div className="flex items-center space-x-2">
                <Download className="h-4 w-4" />
                <span>Export & Send</span>
              </div>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="space-y-8 mt-6">
            <div className="grid grid-cols-2 gap-8">
              {/* Task Selection */}
              <Card className="border-2 border-gray-100 hover:border-gray-200 transition-colors">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                  <CardTitle className="text-lg font-semibold flex items-center space-x-2">
                    <div className="p-1.5 bg-blue-100 rounded-md">
                      <div className="w-4 h-4 bg-blue-600 rounded-sm"></div>
                    </div>
                    <span>Select Tasks</span>
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">Choose which tasks to include in your report</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="select-all-tasks"
                      checked={selectedTasks.size === tasks.length}
                      onCheckedChange={handleSelectAllTasks}
                    />
                    <Label htmlFor="select-all-tasks" className="font-medium">
                      Select All Tasks ({tasks.length})
                    </Label>
                  </div>
                  <Separator />
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {tasks.map((task) => (
                      <div key={task.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`task-${task.id}`}
                          checked={selectedTasks.has(task.id)}
                          onCheckedChange={(checked) => handleTaskSelection(task.id, checked as boolean)}
                        />
                        <Label htmlFor={`task-${task.id}`} className="text-sm truncate flex-1">
                          {task.title}
                        </Label>
                        {getStatusBadge(task.status)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Column Selection */}
              <Card className="border-2 border-gray-100 hover:border-gray-200 transition-colors">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                  <CardTitle className="text-lg font-semibold flex items-center space-x-2">
                    <div className="p-1.5 bg-green-100 rounded-md">
                      <div className="w-4 h-4 bg-green-600 rounded-sm"></div>
                    </div>
                    <span>Select Columns</span>
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">Choose which data fields to display</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="select-all-columns"
                      checked={selectedColumns.size === COLUMN_OPTIONS.length}
                      onCheckedChange={handleSelectAllColumns}
                    />
                    <Label htmlFor="select-all-columns" className="font-medium">
                      Select All Columns ({COLUMN_OPTIONS.length})
                    </Label>
                  </div>
                  <Separator />
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {COLUMN_OPTIONS.map((column) => (
                      <div key={column.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`column-${column.id}`}
                          checked={selectedColumns.has(column.id)}
                          onCheckedChange={(checked) => handleColumnSelection(column.id, checked as boolean)}
                        />
                        <Label htmlFor={`column-${column.id}`} className="text-sm">
                          {column.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Additional Options */}
            <Card className="border-2 border-gray-100 hover:border-gray-200 transition-colors">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 border-b">
                <CardTitle className="text-lg font-semibold flex items-center space-x-2">
                  <div className="p-1.5 bg-purple-100 rounded-md">
                    <div className="w-4 h-4 bg-purple-600 rounded-sm"></div>
                  </div>
                  <span>Export Options</span>
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">Configure report format and additional features</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-timeline"
                    checked={includeTimeline}
                    onCheckedChange={(checked) => setIncludeTimeline(checked as boolean)}
                  />
                  <Label htmlFor="include-timeline" className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>Include Timeline Visualization</span>
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label>Report Format</Label>
                  <Select value={reportFormat} onValueChange={(value) => setReportFormat(value as 'pdf' | 'csv')}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF Report</SelectItem>
                      <SelectItem value="csv">CSV Export</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="space-y-6 mt-6">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6 border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Report Preview</h3>
                  <p className="text-sm text-gray-600 mt-1">Review your report before exporting</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border shadow-sm">
                  <div className="text-sm font-medium text-gray-900">{filteredTasks.length} tasks</div>
                  <div className="text-xs text-gray-500">{visibleColumns.length} columns</div>
                </div>
              </div>
            </div>

            <div className="border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-white overflow-auto max-h-96">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
                      {visibleColumns.map((column) => (
                        <th key={column.id} className="px-4 py-3 text-left text-sm font-semibold tracking-wide">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTasks.map((task, index) => (
                      <tr key={task.id} className={`hover:bg-blue-50 transition-colors ${
                        index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                      }`}>
                        {visibleColumns.map((column) => (
                          <td key={column.id} className="px-4 py-3 text-sm text-gray-900">
                            {formatCellValue(task, column.id)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {includeTimeline && (
              <Card className="border-2 border-blue-100 bg-blue-50/30">
                <CardHeader className="border-b border-blue-200">
                  <CardTitle className="text-base font-semibold flex items-center space-x-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <span>Timeline Visualization</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="bg-gradient-to-r from-blue-100 to-indigo-100 p-6 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-center space-x-3">
                      <Calendar className="h-8 w-8 text-blue-600" />
                      <div className="text-center">
                        <div className="text-sm font-medium text-blue-800">Timeline visualization will be included</div>
                        <div className="text-xs text-blue-600 mt-1">Professional Gantt-style timeline with milestones</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="export" className="space-y-8 mt-6">
            <div className="grid grid-cols-2 gap-8">
              {/* Download */}
              <Card className="border-2 border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-200">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                  <CardTitle className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Download className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <span className="text-lg font-semibold">Download Report</span>
                      <p className="text-sm text-gray-600 font-normal mt-1">Save to your device</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      Generate a professional {reportFormat.toUpperCase()} report with your selected data and download it directly to your device.
                    </p>
                  </div>
                  <Button onClick={handleDownload} disabled={isDownloading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-medium transition-colors">
                    <Download className="h-4 w-4 mr-2" />
                    {isDownloading ? 'Generating Report...' : `Download ${reportFormat.toUpperCase()} Report`}
                  </Button>
                </CardContent>
              </Card>

              {/* Email */}
              <Card className="border-2 border-gray-100 hover:border-green-200 hover:shadow-lg transition-all duration-200">
                <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                  <CardTitle className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Mail className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <span className="text-lg font-semibold">Email Report</span>
                      <p className="text-sm text-gray-600 font-normal mt-1">Send directly to recipients</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  <div className="space-y-2">
                    <Label htmlFor="email-to" className="text-sm font-medium text-gray-700">Recipient Email</Label>
                    <Input
                      id="email-to"
                      type="email"
                      placeholder="Enter recipient email address"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      className="border-gray-300 focus:border-green-500 focus:ring-green-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-subject" className="text-sm font-medium text-gray-700">Subject Line</Label>
                    <Input
                      id="email-subject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="border-gray-300 focus:border-green-500 focus:ring-green-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-message" className="text-sm font-medium text-gray-700">Message</Label>
                    <Textarea
                      id="email-message"
                      rows={3}
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      className="border-gray-300 focus:border-green-500 focus:ring-green-500 resize-none"
                      placeholder="Add a personal message..."
                    />
                  </div>
                  <Button 
                    onClick={handleEmail} 
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-3 rounded-lg font-medium transition-colors"
                    disabled={!emailTo || isEmailing}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    {isEmailing ? 'Sending Email...' : 'Send Report via Email'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Summary */}
            <Card className="border-2 border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="flex items-center space-x-2 text-lg font-semibold">
                  <div className="p-1.5 bg-gray-200 rounded-md">
                    <FileText className="h-4 w-4 text-gray-700" />
                  </div>
                  <span>Export Summary</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white p-4 rounded-lg border shadow-sm">
                    <div className="text-2xl font-bold text-blue-600">{filteredTasks.length}</div>
                    <div className="text-sm text-gray-600">Selected Tasks</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border shadow-sm">
                    <div className="text-2xl font-bold text-green-600">{visibleColumns.length}</div>
                    <div className="text-sm text-gray-600">Data Columns</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border shadow-sm">
                    <div className="text-lg font-semibold text-purple-600">{includeTimeline ? 'Included' : 'Not Included'}</div>
                    <div className="text-sm text-gray-600">Timeline Chart</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border shadow-sm">
                    <div className="text-lg font-semibold text-orange-600">{reportFormat.toUpperCase()}</div>
                    <div className="text-sm text-gray-600">Export Format</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-6 border-t border-gray-200 bg-gray-50 px-6 py-4 -mx-6 -mb-6 rounded-b-lg">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="px-6 py-2 border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </Button>
          <div className="flex space-x-3">
            {currentTab === 'select' && (
              <Button 
                onClick={() => setCurrentTab('preview')}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors rounded-lg"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Report
              </Button>
            )}
            {currentTab === 'preview' && (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentTab('select')}
                  className="px-6 py-2 border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  ← Back to Selection
                </Button>
                <Button 
                  onClick={() => setCurrentTab('export')}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium transition-colors rounded-lg"
                >
                  Continue to Export →
                </Button>
              </>
            )}
            {currentTab === 'export' && (
              <Button 
                variant="outline" 
                onClick={() => setCurrentTab('preview')}
                className="px-6 py-2 border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
              >
                ← Back to Preview
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}