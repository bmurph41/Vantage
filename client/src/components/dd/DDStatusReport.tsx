import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ClipboardCheck, Printer, AlertTriangle, Clock, CheckCircle2,
  AlertCircle, Loader2, Shield,
} from "lucide-react";
import { format } from "date-fns";

interface DDStatusReportProps {
  projectId: string;
}

interface StatusReportData {
  project: {
    id: string;
    name: string;
    status: string;
    ddExpiration: string | null;
    closingDate: string | null;
  };
  overallCompletion: number;
  totalTasks: number;
  completedTasks: number;
  categories: Array<{
    name: string;
    totalItems: number;
    completedItems: number;
    completionPercent: number;
  }>;
  outstandingItems: Array<{
    id: string;
    title: string;
    category: string;
    status: string;
    priority: string;
    assignedTo: string | null;
    dueDate: string | null;
    isOverdue: boolean;
  }>;
  riskFlags: Array<{
    type: string;
    severity: string;
    message: string;
    count: number;
  }>;
  generatedAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  title: "Title", survey: "Survey", ESA: "Environmental", appraisal: "Appraisal",
  inspection: "Inspection", permits: "Permits", zoning: "Zoning",
  financial: "Financial", legal: "Legal", insurance: "Insurance", other: "Other",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-red-400",
  medium: "bg-amber-400",
  low: "bg-blue-400",
};

const STATUS_BADGES: Record<string, { color: string; label: string }> = {
  not_started: { color: "bg-gray-100 text-gray-700", label: "Not Started" },
  engaged: { color: "bg-yellow-100 text-yellow-700", label: "Engaged" },
  scheduled: { color: "bg-blue-100 text-blue-700", label: "Scheduled" },
  in_progress: { color: "bg-blue-100 text-blue-700", label: "In Progress" },
  completed: { color: "bg-green-100 text-green-700", label: "Completed" },
};

export default function DDStatusReport({ projectId }: DDStatusReportProps) {
  const { data: report, isLoading, error } = useQuery<StatusReportData>({
    queryKey: [`/api/dd/projects/${projectId}/status-report`],
    enabled: !!projectId,
  });

  function handlePrint() {
    window.print();
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
          <p className="text-sm text-gray-500 mt-2">Generating status report...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !report) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-500">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Unable to generate status report</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 print:space-y-2" id="dd-status-report">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-purple-600" />
              DD Status Report: {report.project.name}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">
              <Printer className="h-3.5 w-3.5 mr-1" />
              Export
            </Button>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
            <span>Generated: {format(new Date(report.generatedAt), "MMM d, yyyy h:mm a")}</span>
            {report.project.ddExpiration && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                DD Expires: {format(new Date(report.project.ddExpiration), "MMM d, yyyy")}
              </span>
            )}
            {report.project.closingDate && (
              <span>Closing: {format(new Date(report.project.closingDate), "MMM d, yyyy")}</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Overall progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Overall Completion</span>
              <span className="text-sm font-bold">{report.overallCompletion}%</span>
            </div>
            <Progress value={report.overallCompletion} className="h-3" />
            <p className="text-xs text-gray-500 mt-1">
              {report.completedTasks} of {report.totalTasks} items completed
            </p>
          </div>

          {/* Risk Flags */}
          {report.riskFlags.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-1 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Risk Flags
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {report.riskFlags.map((flag, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                      flag.severity === "critical" ? "bg-red-50 border-red-200" :
                      flag.severity === "high" ? "bg-orange-50 border-orange-200" :
                      flag.severity === "medium" ? "bg-amber-50 border-amber-200" :
                      "bg-blue-50 border-blue-200"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${SEVERITY_COLORS[flag.severity] || "bg-gray-400"}`} />
                    <span className="text-sm">{flag.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-500" />
            By Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {report.categories.map((cat) => (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">
                    {CATEGORY_LABELS[cat.name] || cat.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {cat.completedItems}/{cat.totalItems} ({cat.completionPercent}%)
                  </span>
                </div>
                <Progress
                  value={cat.completionPercent}
                  className="h-2"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Outstanding Items */}
      {report.outstandingItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Outstanding Items ({report.outstandingItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.outstandingItems.map((item) => (
                  <TableRow key={item.id} className={item.isOverdue ? "bg-red-50/50" : ""}>
                    <TableCell className="font-medium text-sm">
                      {item.isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500 inline mr-1" />}
                      {item.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[item.category] || item.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_BADGES[item.status]?.color || "bg-gray-100 text-gray-700"}`}>
                        {STATUS_BADGES[item.status]?.label || item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.priority === "high" || item.priority === "critical" ? "destructive" : "secondary"} className="text-xs">
                        {item.priority || "normal"}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-sm ${item.isOverdue ? "text-red-600 font-medium" : "text-gray-600"}`}>
                      {item.dueDate
                        ? format(new Date(item.dueDate), "MMM d, yyyy")
                        : <span className="text-gray-400">--</span>
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All done state */}
      {report.outstandingItems.length === 0 && report.totalTasks > 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <h3 className="text-lg font-semibold text-green-700">All items completed!</h3>
            <p className="text-sm text-gray-500 mt-1">All {report.totalTasks} due diligence items are done.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
