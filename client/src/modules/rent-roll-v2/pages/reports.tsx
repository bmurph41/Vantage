import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  FileText, 
  Download, 
  FileSpreadsheet, 
  Building2, 
  TrendingUp,
  Users,
  DollarSign,
  BarChart3,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Save,
  Play,
  Trash2,
  Bookmark
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import DashboardNav from "../components/navigation/DashboardNav";
import { useProjectContext } from "../contexts/ProjectContext";
import type { ReportData, ReportOptions, ReportFilters, SavedReport } from "@shared/schema";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function ReportsPage() {
  const { toast } = useToast();
  
  // Get project context - will have projectId when in project-specific view
  const { projectId: contextProjectId, isPortfolioScope, project } = useProjectContext();
  const isProjectScoped = !!contextProjectId;
  
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedStorageTypes, setSelectedStorageTypes] = useState<string[]>([]);
  
  // Reset selectedProjects when context changes to prevent stale selections
  useEffect(() => {
    if (contextProjectId) {
      // Entering project context - clear any prior selections
      setSelectedProjects([]);
    }
  }, [contextProjectId]);
  
  // When in project context, lock selectedProjects to that project
  const effectiveProjects = isProjectScoped && contextProjectId ? [contextProjectId] : selectedProjects;
  const [selectedYear, setSelectedYear] = useState<number | undefined>();
  const [includeAINarrative, setIncludeAINarrative] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    metrics: true,
    projects: true,
    storageTypes: true,
    leases: false,
    ai: true,
  });
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savedReportName, setSavedReportName] = useState("");
  const [displayedReport, setDisplayedReport] = useState<ReportData | null>(null);

  const { data: options, isLoading: optionsLoading } = useQuery<ReportOptions>({
    queryKey: ['/api/reports/options'],
  });

  const { data: savedReports, isLoading: savedReportsLoading } = useQuery<SavedReport[]>({
    queryKey: ['/api/saved-reports'],
  });

  const saveReportMutation = useMutation({
    mutationFn: async (data: { name: string; filters: ReportFilters; includeAiNarrative: boolean }) => {
      const response = await apiRequest('POST', '/api/saved-reports', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-reports'] });
      setSaveDialogOpen(false);
      setSavedReportName("");
      toast({
        title: "Report saved",
        description: "Your report configuration has been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save report",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/saved-reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-reports'] });
      toast({
        title: "Report deleted",
        description: "The saved report has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete report",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const runSavedReportMutation = useMutation<ReportData, Error, string>({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/saved-reports/${id}/run`);
      return response.json();
    },
    onSuccess: (data) => {
      setDisplayedReport(data);
    },
    onError: (error) => {
      toast({
        title: "Error running report",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateMutation = useMutation<ReportData, Error, { filters: ReportFilters; includeAI: boolean }>({
    mutationFn: async ({ filters, includeAI }) => {
      const response = await apiRequest('POST', '/api/reports/generate', { filters, includeAINarrative: includeAI });
      return response.json();
    },
    onSuccess: (data) => {
      setDisplayedReport(data);
    },
    onError: (error) => {
      toast({
        title: "Error generating report",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const exportExcelMutation = useMutation({
    mutationFn: async (filters: ReportFilters) => {
      const response = await fetch('/api/reports/export/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rent-roll-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: "Export successful",
        description: "Your Excel report has been downloaded.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Export failed",
        description: error.message || "Failed to export report",
        variant: "destructive",
      });
    },
  });

  const exportPdfMutation = useMutation({
    mutationFn: async (filters: ReportFilters) => {
      const response = await fetch('/api/reports/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('PDF export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rent-roll-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({
        title: "PDF Export successful",
        description: "Your PDF report has been downloaded.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "PDF Export failed",
        description: error.message || "Failed to export PDF report",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    const filters: ReportFilters = {};
    if (effectiveProjects.length > 0) filters.projectIds = effectiveProjects;
    if (selectedStorageTypes.length > 0) filters.storageTypes = selectedStorageTypes;
    if (selectedYear) filters.year = selectedYear;
    generateMutation.mutate({ filters, includeAI: includeAINarrative });
  };

  const handleExportExcel = () => {
    const filters: ReportFilters = {};
    if (effectiveProjects.length > 0) filters.projectIds = effectiveProjects;
    if (selectedStorageTypes.length > 0) filters.storageTypes = selectedStorageTypes;
    if (selectedYear) filters.year = selectedYear;
    exportExcelMutation.mutate(filters);
  };

  const handleExportPdf = () => {
    const filters: ReportFilters = {};
    if (effectiveProjects.length > 0) filters.projectIds = effectiveProjects;
    if (selectedStorageTypes.length > 0) filters.storageTypes = selectedStorageTypes;
    if (selectedYear) filters.year = selectedYear;
    exportPdfMutation.mutate(filters);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleProject = (projectId: string) => {
    setSelectedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const toggleStorageType = (type: string) => {
    setSelectedStorageTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSaveReport = () => {
    if (!savedReportName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the saved report.",
        variant: "destructive",
      });
      return;
    }
    const filters: ReportFilters = {};
    if (effectiveProjects.length > 0) filters.projectIds = effectiveProjects;
    if (selectedStorageTypes.length > 0) filters.storageTypes = selectedStorageTypes;
    if (selectedYear) filters.year = selectedYear;
    saveReportMutation.mutate({
      name: savedReportName.trim(),
      filters,
      includeAiNarrative: includeAINarrative,
    });
  };

  const loadSavedReport = (saved: SavedReport) => {
    const filters = saved.filters as ReportFilters;
    setSelectedProjects(filters.projectIds || []);
    setSelectedStorageTypes(filters.storageTypes || []);
    setSelectedYear(filters.year);
    setIncludeAINarrative(saved.includeAiNarrative ?? true);
  };

  const runSavedReport = (saved: SavedReport) => {
    loadSavedReport(saved);
    runSavedReportMutation.mutate(saved.id);
  };

  const report = displayedReport;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-4">
            <h1 className="text-3xl font-semibold text-foreground" data-testid="text-page-title">
              Rent Roll
            </h1>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-description">
              Key performance metrics and trends
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <DashboardNav />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Report Filters</CardTitle>
                <CardDescription>Configure your report parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="font-medium mb-2 block">Projects</Label>
                  {/* When in project context, show the project as a badge instead of selector */}
                  {isProjectScoped && project ? (
                    <div className="border rounded-md p-3">
                      <Badge variant="secondary" className="px-3 py-1.5" data-testid="badge-current-project">
                        <Building2 className="h-3 w-3 mr-2" />
                        {project.name}
                      </Badge>
                    </div>
                  ) : optionsLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <ScrollArea className="h-32 border rounded-md p-2">
                      {options?.projects.map(proj => (
                        <div key={proj.id} className="flex items-center space-x-2 py-1">
                          <Checkbox
                            id={`project-${proj.id}`}
                            checked={selectedProjects.includes(proj.id)}
                            onCheckedChange={() => toggleProject(proj.id)}
                            data-testid={`checkbox-project-${proj.id}`}
                          />
                          <Label htmlFor={`project-${proj.id}`} className="text-sm cursor-pointer flex-1">
                            {proj.name}
                            <Badge variant="outline" className="ml-2 text-xs">
                              {proj.type}
                            </Badge>
                          </Label>
                        </div>
                      ))}
                      {options?.projects.length === 0 && (
                        <p className="text-sm text-muted-foreground">No projects available</p>
                      )}
                    </ScrollArea>
                  )}
                  {!isProjectScoped && selectedProjects.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">All projects selected by default</p>
                  )}
                </div>

                <div>
                  <Label className="font-medium mb-2 block">Storage Types</Label>
                  {optionsLoading ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <ScrollArea className="h-32 border rounded-md p-2">
                      {options?.storageTypes.map(type => (
                        <div key={type} className="flex items-center space-x-2 py-1">
                          <Checkbox
                            id={`storage-${type}`}
                            checked={selectedStorageTypes.includes(type)}
                            onCheckedChange={() => toggleStorageType(type)}
                            data-testid={`checkbox-storage-${type}`}
                          />
                          <Label htmlFor={`storage-${type}`} className="text-sm cursor-pointer">
                            {type}
                          </Label>
                        </div>
                      ))}
                      {options?.storageTypes.length === 0 && (
                        <p className="text-sm text-muted-foreground">No storage types available</p>
                      )}
                    </ScrollArea>
                  )}
                  {selectedStorageTypes.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">All types selected by default</p>
                  )}
                </div>

                <div>
                  <Label className="font-medium mb-2 block">Year</Label>
                  <Select
                    value={selectedYear?.toString() || "all"}
                    onValueChange={(v) => setSelectedYear(v === "all" ? undefined : parseInt(v))}
                  >
                    <SelectTrigger data-testid="select-year">
                      <SelectValue placeholder="All years" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All years</SelectItem>
                      {options?.years.map(year => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ai-narrative"
                    checked={includeAINarrative}
                    onCheckedChange={(checked) => setIncludeAINarrative(!!checked)}
                    data-testid="checkbox-ai-narrative"
                  />
                  <Label htmlFor="ai-narrative" className="text-sm cursor-pointer flex items-center gap-1">
                    <Sparkles className="w-4 h-4" />
                    Include AI Summary
                  </Label>
                </div>

                <div className="flex flex-col gap-2 pt-4">
                  <Button 
                    onClick={handleGenerate} 
                    className="w-full"
                    disabled={generateMutation.isPending}
                    data-testid="button-generate-report"
                  >
                    {generateMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Generate Report
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleExportExcel} 
                    className="w-full"
                    disabled={exportExcelMutation.isPending || !report}
                    data-testid="button-export-excel"
                  >
                    {exportExcelMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Export to Excel
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleExportPdf} 
                    className="w-full"
                    disabled={exportPdfMutation.isPending || !report}
                    data-testid="button-export-pdf"
                  >
                    {exportPdfMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Exporting PDF...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        Export to PDF
                      </>
                    )}
                  </Button>
                  <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        data-testid="button-save-report"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        Save Configuration
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Save Report Configuration</DialogTitle>
                        <DialogDescription>
                          Save your current filter settings for quick access later.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Label htmlFor="report-name">Report Name</Label>
                        <Input
                          id="report-name"
                          value={savedReportName}
                          onChange={(e) => setSavedReportName(e.target.value)}
                          placeholder="e.g., Monthly Wet Slip Report"
                          data-testid="input-report-name"
                        />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleSaveReport}
                          disabled={saveReportMutation.isPending}
                          data-testid="button-confirm-save"
                        >
                          {saveReportMutation.isPending ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Save Report"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bookmark className="w-5 h-5" />
                  Saved Reports
                </CardTitle>
                <CardDescription>Quick access to saved configurations</CardDescription>
              </CardHeader>
              <CardContent>
                {savedReportsLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : savedReports && savedReports.length > 0 ? (
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {savedReports.map((saved) => (
                        <div 
                          key={saved.id} 
                          className="flex items-center justify-between p-2 rounded-md border hover-elevate"
                          data-testid={`saved-report-${saved.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{saved.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {saved.lastRunAt ? `Last run: ${new Date(saved.lastRunAt).toLocaleDateString()}` : 'Never run'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => runSavedReport(saved)}
                              disabled={runSavedReportMutation.isPending}
                              data-testid={`button-run-${saved.id}`}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteReportMutation.mutate(saved.id)}
                              disabled={deleteReportMutation.isPending}
                              data-testid={`button-delete-${saved.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No saved reports yet. Configure your filters and click "Save Configuration" to create one.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-4">
            {!report && !generateMutation.isPending && !runSavedReportMutation.isPending && (
              <Card className="p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <FileText className="w-16 h-16 text-muted-foreground/50" />
                  <div>
                    <h3 className="text-lg font-medium">No Report Generated</h3>
                    <p className="text-muted-foreground">
                      Configure your filters and click "Generate Report" to view analytics
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {(generateMutation.isPending || runSavedReportMutation.isPending) && (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            )}

            {report && (
              <>
                <Collapsible open={expandedSections.metrics} onOpenChange={() => toggleSection('metrics')}>
                  <Card>
                    <CardHeader className="pb-2">
                      <CollapsibleTrigger className="flex items-center justify-between w-full">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <TrendingUp className="w-5 h-5" />
                          Key Metrics
                        </CardTitle>
                        {expandedSections.metrics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </CollapsibleTrigger>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 rounded-lg bg-muted/50">
                            <div className="text-sm text-muted-foreground">Active Leases</div>
                            <div className="text-2xl font-bold" data-testid="text-active-leases">
                              {report.metrics.activeLeases}
                            </div>
                            <div className="text-xs text-muted-foreground">of {report.metrics.totalLeases} total</div>
                          </div>
                          <div className="p-4 rounded-lg bg-muted/50">
                            <div className="text-sm text-muted-foreground">Total Revenue</div>
                            <div className="text-2xl font-bold" data-testid="text-total-revenue">
                              {formatCurrency(report.metrics.totalRevenue)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Avg: {formatCurrency(report.metrics.averageLeaseValue)}
                            </div>
                          </div>
                          <div className="p-4 rounded-lg bg-muted/50">
                            <div className="text-sm text-muted-foreground">Occupancy Rate</div>
                            <div className="text-2xl font-bold" data-testid="text-occupancy-rate">
                              {formatPercent(report.metrics.occupancyRate)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {report.metrics.occupancyNumerator} / {report.metrics.occupancyDenominator}
                            </div>
                          </div>
                          <div className="p-4 rounded-lg bg-muted/50">
                            <div className="text-sm text-muted-foreground">Net Change (YTD)</div>
                            <div className={`text-2xl font-bold ${report.metrics.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-net-change">
                              {report.metrics.netChange >= 0 ? '+' : ''}{report.metrics.netChange}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {report.metrics.moveIns} in / {report.metrics.moveOuts} out
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                {report.aiNarrative && (
                  <Collapsible open={expandedSections.ai} onOpenChange={() => toggleSection('ai')}>
                    <Card className="border-primary/20 bg-primary/5">
                      <CardHeader className="pb-2">
                        <CollapsibleTrigger className="flex items-center justify-between w-full">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-primary" />
                            AI Executive Summary
                          </CardTitle>
                          {expandedSections.ai ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </CollapsibleTrigger>
                      </CardHeader>
                      <CollapsibleContent>
                        <CardContent>
                          <div className="prose prose-sm max-w-none dark:prose-invert" data-testid="text-ai-narrative">
                            {report.aiNarrative.split('\n\n').map((paragraph, i) => (
                              <p key={i} className="mb-3 text-muted-foreground">{paragraph}</p>
                            ))}
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )}

                <Collapsible open={expandedSections.projects} onOpenChange={() => toggleSection('projects')}>
                  <Card>
                    <CardHeader className="pb-2">
                      <CollapsibleTrigger className="flex items-center justify-between w-full">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Building2 className="w-5 h-5" />
                          Projects Breakdown
                        </CardTitle>
                        {expandedSections.projects ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </CollapsibleTrigger>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Project</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">Capacity</TableHead>
                              <TableHead className="text-right">Active Leases</TableHead>
                              <TableHead className="text-right">Revenue</TableHead>
                              <TableHead className="text-right">Occupancy</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {report.projectBreakdown.map(project => (
                              <TableRow key={project.projectId} data-testid={`row-project-${project.projectId}`}>
                                <TableCell className="font-medium">{project.projectName}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{project.projectType}</Badge>
                                </TableCell>
                                <TableCell className="text-right">{project.capacity || 'N/A'}</TableCell>
                                <TableCell className="text-right">{project.activeLeases}</TableCell>
                                <TableCell className="text-right">{formatCurrency(project.revenue)}</TableCell>
                                <TableCell className="text-right">{formatPercent(project.occupancyRate)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                <Collapsible open={expandedSections.storageTypes} onOpenChange={() => toggleSection('storageTypes')}>
                  <Card>
                    <CardHeader className="pb-2">
                      <CollapsibleTrigger className="flex items-center justify-between w-full">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <DollarSign className="w-5 h-5" />
                          Revenue by Storage Type
                        </CardTitle>
                        {expandedSections.storageTypes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </CollapsibleTrigger>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Storage Type</TableHead>
                              <TableHead className="text-right">Leases</TableHead>
                              <TableHead className="text-right">Revenue</TableHead>
                              <TableHead className="text-right">% of Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {report.storageTypeBreakdown.map(storage => (
                              <TableRow key={storage.storageType} data-testid={`row-storage-${storage.storageType}`}>
                                <TableCell className="font-medium">{storage.storageType}</TableCell>
                                <TableCell className="text-right">{storage.leaseCount}</TableCell>
                                <TableCell className="text-right">{formatCurrency(storage.revenue)}</TableCell>
                                <TableCell className="text-right">{formatPercent(storage.percentage)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                <Collapsible open={expandedSections.leases} onOpenChange={() => toggleSection('leases')}>
                  <Card>
                    <CardHeader className="pb-2">
                      <CollapsibleTrigger className="flex items-center justify-between w-full">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          Lease Details ({report.leaseDetails.length} leases)
                        </CardTitle>
                        {expandedSections.leases ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </CollapsibleTrigger>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent>
                        <ScrollArea className="h-96">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Tenant</TableHead>
                                <TableHead>Project</TableHead>
                                <TableHead>Storage Type</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Term</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {report.leaseDetails.slice(0, 100).map((lease, i) => (
                                <TableRow key={i} data-testid={`row-lease-${i}`}>
                                  <TableCell className="font-medium">{lease.tenantName}</TableCell>
                                  <TableCell>{lease.projectName}</TableCell>
                                  <TableCell>{lease.storageType || 'N/A'}</TableCell>
                                  <TableCell className="text-right">
                                    {lease.leaseAmount ? formatCurrency(lease.leaseAmount) : 'N/A'}
                                  </TableCell>
                                  <TableCell>{lease.contractTerm || 'N/A'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {report.leaseDetails.length > 100 && (
                            <p className="text-center text-sm text-muted-foreground py-4">
                              Showing first 100 of {report.leaseDetails.length} leases. Export to Excel for full list.
                            </p>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                <Card className="bg-muted/30">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Report generated: {new Date(report.generatedAt).toLocaleString()}</span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={exportExcelMutation.isPending} data-testid="button-export-footer-excel">
                          <FileSpreadsheet className="w-4 h-4 mr-1" />
                          Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exportPdfMutation.isPending} data-testid="button-export-footer-pdf">
                          <Download className="w-4 h-4 mr-1" />
                          PDF
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
