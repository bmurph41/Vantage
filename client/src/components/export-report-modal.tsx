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
import { format } from "date-fns";

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
        return 'Calculated'; // Would need deadline calculation logic
      case 'orderedAt':
        return task.orderedAt ? format(new Date(task.orderedAt), 'MMM d, yyyy') : '-';
      case 'startDate':
        return task.startDate ? format(new Date(task.startDate), 'MMM d, yyyy') : '-';
      case 'completedAt':
        return task.completedAt ? format(new Date(task.completedAt), 'MMM d, yyyy') : '-';
      case 'cost':
        return task.cost || '-';
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

  const handleDownload = () => {
    // TODO: Implement PDF/CSV generation and download
    console.log('Downloading report...', {
      format: reportFormat,
      tasks: filteredTasks.length,
      columns: selectedColumns.size,
      includeTimeline
    });
  };

  const handleEmail = () => {
    // TODO: Implement email functionality
    console.log('Emailing report...', {
      to: emailTo,
      subject: emailSubject,
      message: emailMessage,
      format: reportFormat,
      tasks: filteredTasks.length,
      columns: selectedColumns.size,
      includeTimeline
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Export Report</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="select">Select Data</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="export">Export & Send</TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Task Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Select Tasks</CardTitle>
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Select Columns</CardTitle>
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Additional Options</CardTitle>
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

          <TabsContent value="preview" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Report Preview</h3>
              <div className="text-sm text-muted-foreground">
                {filteredTasks.length} tasks, {visibleColumns.length} columns
              </div>
            </div>

            <div className="border rounded-lg overflow-auto max-h-96">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted">
                    {visibleColumns.map((column) => (
                      <th key={column.id} className="px-4 py-2 text-left text-sm font-semibold">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-muted/50">
                      {visibleColumns.map((column) => (
                        <td key={column.id} className="px-4 py-2 text-sm">
                          {formatCellValue(task, column.id)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {includeTimeline && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Timeline Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/30 p-4 rounded text-center text-sm text-muted-foreground">
                    Timeline visualization will be included in the final report
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="export" className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Download */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Download className="h-5 w-5" />
                    <span>Download Report</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Generate and download the report to your device.
                  </p>
                  <Button onClick={handleDownload} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download {reportFormat.toUpperCase()}
                  </Button>
                </CardContent>
              </Card>

              {/* Email */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Mail className="h-5 w-5" />
                    <span>Email Report</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-to">Email To</Label>
                    <Input
                      id="email-to"
                      type="email"
                      placeholder="recipient@example.com"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-subject">Subject</Label>
                    <Input
                      id="email-subject"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-message">Message</Label>
                    <Textarea
                      id="email-message"
                      rows={3}
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleEmail} 
                    className="w-full"
                    disabled={!emailTo}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Export Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Selected Tasks:</span> {filteredTasks.length}
                  </div>
                  <div>
                    <span className="font-medium">Selected Columns:</span> {visibleColumns.length}
                  </div>
                  <div>
                    <span className="font-medium">Include Timeline:</span> {includeTimeline ? 'Yes' : 'No'}
                  </div>
                  <div>
                    <span className="font-medium">Format:</span> {reportFormat.toUpperCase()}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex space-x-2">
            {currentTab === 'select' && (
              <Button onClick={() => setCurrentTab('preview')}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            )}
            {currentTab === 'preview' && (
              <>
                <Button variant="outline" onClick={() => setCurrentTab('select')}>
                  Back
                </Button>
                <Button onClick={() => setCurrentTab('export')}>
                  Continue to Export
                </Button>
              </>
            )}
            {currentTab === 'export' && (
              <Button variant="outline" onClick={() => setCurrentTab('preview')}>
                Back to Preview
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}