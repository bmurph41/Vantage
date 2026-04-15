import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  FileText,
  Play,
  Archive,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Download,
  Eye,
  FileSpreadsheet,
  FileDown,
  CalendarClock,
  Zap,
} from "lucide-react";
import DashboardNav from "../components/navigation/DashboardNav";

interface ReportPackage {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  packageType: string;
  status: string;
  projectId: string | null;
  projectName: string | null;
  periodStartDate: string;
  periodEndDate: string;
  asOfDate: string | null;
  snapshotId: string | null;
  createdAt: string;
  generatedAt: string | null;
}

interface ReportPackageSection {
  id: string;
  reportPackageId: string;
  sectionType: string;
  sectionOrder: number;
  title: string;
  isIncluded: boolean;
  customContent: string | null;
}

interface ReportPackageWithSections extends ReportPackage {
  sections: ReportPackageSection[];
}

interface MarinaLocation {
  id: string;
  name: string;
}

const PACKAGE_TYPES = [
  { value: "quarterly", label: "Quarterly Report" },
  { value: "annual", label: "Annual Report" },
  { value: "acquisition", label: "Acquisition Report" },
  { value: "disposition", label: "Disposition Report" },
  { value: "custom", label: "Custom Report" },
];

const REPORT_TYPES = [
  { value: "rent_roll_summary", label: "Rent Roll" },
  { value: "cash_flow_statement", label: "Cash Flow Statement" },
  { value: "occupancy_report", label: "Occupancy Summary" },
  { value: "lease_expiration_report", label: "Lease Expiry Schedule" },
  { value: "executive_summary", label: "Executive Summary" },
];

const FORMATS = [
  { value: "json", label: "JSON", icon: FileText },
  { value: "csv", label: "CSV", icon: FileSpreadsheet },
  { value: "excel", label: "Excel", icon: FileDown },
  { value: "pdf", label: "PDF", icon: FileDown },
];

const SCHEDULE_OPTIONS = [
  { value: "none", label: "No schedule" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: Clock },
  generating: { label: "Generating", color: "bg-blue-100 text-blue-700", icon: Loader2 },
  ready: { label: "Ready", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  failed: { label: "Failed", color: "bg-red-100 text-red-700", icon: XCircle },
  archived: { label: "Archived", color: "bg-gray-200 text-gray-800", icon: Archive },
};

const packageFormSchema = z.object({
  name: z.string().min(1, "Package name is required"),
  description: z.string().optional(),
  packageType: z.string().min(1, "Report type is required"),
  projectId: z.string().optional(),
  periodStartDate: z.string().min(1, "Period start date is required"),
  periodEndDate: z.string().min(1, "Period end date is required"),
  asOfDate: z.string().optional(),
});
type PackageFormValues = z.infer<typeof packageFormSchema>;

const generateFormSchema = z.object({
  reportType: z.string().min(1, "Report type is required"),
  format: z.string().min(1, "Format is required"),
  projectId: z.string().optional(),
  asOfDate: z.string().optional(),
  schedule: z.string().optional(),
});
type GenerateFormValues = z.infer<typeof generateFormSchema>;

interface ScheduledReport {
  id: string;
  reportType: string;
  format: string;
  projectId: string | null;
  schedule: string;
  lastRun: string | null;
  nextRun: string | null;
}

export default function ReportPackagesPage() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<ReportPackageWithSections | null>(null);
  const [generatedResult, setGeneratedResult] = useState<Record<string, unknown> | null>(null);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);

  const getDefaultFormValues = useMemo(() => () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const quarterStart = format(new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1), "yyyy-MM-dd");
    const quarterEnd = format(new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3 + 3, 0), "yyyy-MM-dd");
    return {
      name: "",
      description: "",
      packageType: "quarterly",
      projectId: "",
      periodStartDate: quarterStart,
      periodEndDate: quarterEnd,
      asOfDate: today,
    };
  }, []);

  const packageForm = useForm<PackageFormValues>({
    resolver: zodResolver(packageFormSchema),
    defaultValues: getDefaultFormValues(),
  });

  const generateForm = useForm<GenerateFormValues>({
    resolver: zodResolver(generateFormSchema),
    defaultValues: {
      reportType: "rent_roll_summary",
      format: "json",
      projectId: "",
      asOfDate: format(new Date(), "yyyy-MM-dd"),
      schedule: "none",
    },
  });

  useEffect(() => {
    if (createDialogOpen) {
      packageForm.reset(getDefaultFormValues(), { keepDefaultValues: false });
    }
  }, [createDialogOpen, getDefaultFormValues]);

  const { data: packages, isLoading: packagesLoading } = useQuery<ReportPackage[]>({
    queryKey: ["/api/report-packages"],
  });

  const { data: projects } = useQuery<MarinaLocation[]>({
    queryKey: ["/api/marina-locations"],
  });

  const createPackageMutation = useMutation({
    mutationFn: async (data: PackageFormValues) => {
      return apiRequest("POST", "/api/report-packages", {
        ...data,
        projectId: data.projectId && data.projectId !== "all" ? data.projectId : null,
        asOfDate: data.asOfDate || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-packages"] });
      setCreateDialogOpen(false);
      packageForm.reset(getDefaultFormValues(), { keepDefaultValues: false });
      toast({ title: "Report package created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create report package", variant: "destructive" });
    },
  });

  const deletePackageMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/report-packages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-packages"] });
      toast({ title: "Report package deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete report package", variant: "destructive" });
    },
  });

  const generatePackageMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/report-packages/${id}/generate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-packages"] });
      toast({ title: "Report generation started" });
    },
    onError: () => {
      toast({ title: "Failed to generate report", variant: "destructive" });
    },
  });

  const archivePackageMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/report-packages/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-packages"] });
      toast({ title: "Report package archived" });
    },
    onError: () => {
      toast({ title: "Failed to archive report package", variant: "destructive" });
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: async ({ packageId, sectionId, data }: { packageId: string; sectionId: string; data: Partial<ReportPackageSection> }) => {
      return apiRequest("PUT", `/api/report-packages/${packageId}/sections/${sectionId}`, data);
    },
    onSuccess: () => {
      if (selectedPackage) fetchPackageDetails(selectedPackage.id);
      toast({ title: "Section updated" });
    },
    onError: () => {
      toast({ title: "Failed to update section", variant: "destructive" });
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: async (data: GenerateFormValues) => {
      const body: Record<string, string | null | undefined> = {
        reportType: data.reportType,
        format: data.format,
        projectId: data.projectId && data.projectId !== "all" ? data.projectId : undefined,
        asOfDate: data.asOfDate || undefined,
      };
      const resp = await apiRequest("POST", "/api/rent-roll/reports/generate", body);
      // JSON format returns metadata preview; file formats trigger a download
      if (data.format === "json") {
        return resp.json() as Promise<Record<string, unknown>>;
      }
      const blob = await resp.blob();
      const ext = data.format === "pdf" ? "pdf" : data.format === "csv" ? "csv" : "xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.reportType}_${data.asOfDate || "report"}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { downloaded: true, format: data.format } as Record<string, unknown>;
    },
    onSuccess: (result: Record<string, unknown>) => {
      if (!result.downloaded) setGeneratedResult(result);
      // If user chose a schedule, register it client-side for display
      const schedule = generateForm.getValues("schedule");
      if (schedule && schedule !== "none") {
        const now = new Date();
        const nextRun = new Date(now);
        if (schedule === "daily") nextRun.setDate(now.getDate() + 1);
        else if (schedule === "weekly") nextRun.setDate(now.getDate() + 7);
        else if (schedule === "monthly") nextRun.setMonth(now.getMonth() + 1);
        else if (schedule === "quarterly") nextRun.setMonth(now.getMonth() + 3);
        setScheduledReports(prev => [
          ...prev.filter(r => r.schedule !== schedule),
          {
            id: crypto.randomUUID(),
            reportType: generateForm.getValues("reportType"),
            format: generateForm.getValues("format"),
            projectId: generateForm.getValues("projectId") || null,
            schedule,
            lastRun: now.toISOString(),
            nextRun: nextRun.toISOString(),
          },
        ]);
      }
      toast({ title: "Report generated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to generate report", variant: "destructive" });
    },
  });

  const fetchPackageDetails = async (id: string) => {
    try {
      const response = await fetch(`/api/report-packages/${id}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch");
      const data: ReportPackageWithSections = await response.json();
      setSelectedPackage(data);
      setDetailDialogOpen(true);
    } catch {
      toast({ title: "Failed to load package details", variant: "destructive" });
    }
  };

  const onCreateSubmit = (values: PackageFormValues) => createPackageMutation.mutate(values);
  const onGenerateSubmit = (values: GenerateFormValues) => generateReportMutation.mutate(values);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-4">
            <h1 className="text-3xl font-semibold text-foreground">Rent Roll</h1>
            <p className="text-sm text-muted-foreground mt-1">Key performance metrics and trends</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <DashboardNav />
            <Button size="default" onClick={() => setCreateDialogOpen(true)} data-testid="button-create-package">
              <Plus className="mr-2 h-4 w-4" />
              Create Package
            </Button>
          </div>
        </div>
      </div>

      {/* Create Package Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) packageForm.reset(getDefaultFormValues(), { keepDefaultValues: false });
      }}>
        <DialogContent className="max-w-lg">
          <Form {...packageForm}>
            <form onSubmit={packageForm.handleSubmit(onCreateSubmit)}>
              <DialogHeader>
                <DialogTitle>Create Report Package</DialogTitle>
                <DialogDescription>Create a new investor report package with customizable sections</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <FormField control={packageForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Package Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Q4 2024 Investor Report" {...field} data-testid="input-package-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={packageForm.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Report description..." {...field} data-testid="input-package-description" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={packageForm.control} name="packageType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Report Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-package-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PACKAGE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={packageForm.control} name="projectId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "all"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-project"><SelectValue placeholder="All projects" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all">All Projects</SelectItem>
                        {projects?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={packageForm.control} name="periodStartDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period Start</FormLabel>
                      <FormControl><Input type="date" {...field} data-testid="input-period-start" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={packageForm.control} name="periodEndDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period End</FormLabel>
                      <FormControl><Input type="date" {...field} data-testid="input-period-end" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={packageForm.control} name="asOfDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>As-Of Date (Optional)</FormLabel>
                    <FormControl><Input type="date" {...field} data-testid="input-as-of-date" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createPackageMutation.isPending} data-testid="button-save-package">
                  {createPackageMutation.isPending ? "Creating..." : "Create Package"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Generate Report Panel ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Generate Report
            </CardTitle>
            <CardDescription>
              Instantly export a rent roll or cash flow report in your preferred format
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...generateForm}>
              <form onSubmit={generateForm.handleSubmit(onGenerateSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Report type */}
                  <FormField control={generateForm.control} name="reportType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Report Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-generate-report-type"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REPORT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Format selector */}
                  <FormField control={generateForm.control} name="format" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Export Format</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-generate-format"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {FORMATS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* Project filter */}
                  <FormField control={generateForm.control} name="projectId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "all"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-generate-project"><SelectValue placeholder="All projects" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">All Projects</SelectItem>
                          {projects?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  {/* As-of date */}
                  <FormField control={generateForm.control} name="asOfDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>As-Of Date</FormLabel>
                      <FormControl><Input type="date" {...field} data-testid="input-generate-as-of-date" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Schedule toggle */}
                <div className="flex items-end gap-4">
                  <FormField control={generateForm.control} name="schedule" render={({ field }) => (
                    <FormItem className="flex-1 max-w-xs">
                      <FormLabel>Recurring Schedule</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger data-testid="select-generate-schedule"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SCHEDULE_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" disabled={generateReportMutation.isPending} data-testid="button-generate-report">
                    {generateReportMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Generate
                  </Button>
                </div>

                {/* Inline result preview */}
                {generatedResult && (
                  <div className="mt-4 rounded-md border bg-muted/40 p-4 text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-foreground">Report ready</p>
                      <Button variant="outline" size="sm" onClick={() => setGeneratedResult(null)}>Dismiss</Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {typeof generatedResult.totalLeases === "number" && (
                        <div><p className="text-muted-foreground text-xs">Total Leases</p><p className="font-semibold">{generatedResult.totalLeases}</p></div>
                      )}
                      {typeof generatedResult.activeLeases === "number" && (
                        <div><p className="text-muted-foreground text-xs">Active</p><p className="font-semibold">{generatedResult.activeLeases}</p></div>
                      )}
                      {typeof generatedResult.totalRevenue === "number" && (
                        <div><p className="text-muted-foreground text-xs">Revenue</p><p className="font-semibold">${(generatedResult.totalRevenue as number).toLocaleString()}</p></div>
                      )}
                      {typeof generatedResult.occupancyRate === "number" && (
                        <div><p className="text-muted-foreground text-xs">Occupancy</p><p className="font-semibold">{generatedResult.occupancyRate}%</p></div>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* ── Scheduled Reports ── */}
        {scheduledReports.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                Scheduled Reports
              </CardTitle>
              <CardDescription>Reports configured to run automatically on a recurring basis</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report Type</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledReports.map(sr => (
                    <TableRow key={sr.id}>
                      <TableCell className="font-medium">
                        {REPORT_TYPES.find(t => t.value === sr.reportType)?.label || sr.reportType}
                      </TableCell>
                      <TableCell><Badge variant="outline">{sr.format.toUpperCase()}</Badge></TableCell>
                      <TableCell className="capitalize">{sr.schedule}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sr.lastRun ? format(new Date(sr.lastRun), "MM/dd/yyyy HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sr.nextRun ? format(new Date(sr.nextRun), "MM/dd/yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setScheduledReports(prev => prev.filter(r => r.id !== sr.id))}
                          data-testid={`button-remove-schedule-${sr.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* ── Report Packages ── */}
        <Card>
          <CardHeader>
            <CardTitle>Report Packages</CardTitle>
            <CardDescription>Manage your investor report packages and their generation status</CardDescription>
          </CardHeader>
          <CardContent>
            {packagesLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : !packages?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No report packages yet</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first investor report package to get started</p>
                <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-package">
                  <Plus className="mr-2 h-4 w-4" />Create Package
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.map(pkg => {
                    const statusConfig = STATUS_CONFIG[pkg.status] || STATUS_CONFIG.draft;
                    const StatusIcon = statusConfig.icon;
                    const isDraft = pkg.status === "draft";
                    const isReady = pkg.status === "ready";
                    const isGenerating = pkg.status === "generating";
                    return (
                      <TableRow key={pkg.id} data-testid={`row-package-${pkg.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{pkg.name}</p>
                            {pkg.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{pkg.description}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {PACKAGE_TYPES.find(t => t.value === pkg.packageType)?.label || pkg.packageType}
                          </Badge>
                        </TableCell>
                        <TableCell>{pkg.projectName || <span className="text-muted-foreground">All Projects</span>}</TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(pkg.periodStartDate), "MM/dd/yyyy")} – {format(new Date(pkg.periodEndDate), "MM/dd/yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusConfig.color}>
                            <StatusIcon className={`mr-1 h-3 w-3 ${isGenerating ? "animate-spin" : ""}`} />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(pkg.createdAt), "MM/dd/yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => fetchPackageDetails(pkg.id)} data-testid={`button-view-package-${pkg.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {isDraft && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => generatePackageMutation.mutate(pkg.id)} disabled={generatePackageMutation.isPending} data-testid={`button-generate-package-${pkg.id}`}>
                                  <Play className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => deletePackageMutation.mutate(pkg.id)} disabled={deletePackageMutation.isPending} data-testid={`button-delete-package-${pkg.id}`}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {isReady && (
                              <>
                                <Button variant="ghost" size="icon" data-testid={`button-download-package-${pkg.id}`}>
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => archivePackageMutation.mutate(pkg.id)} disabled={archivePackageMutation.isPending} data-testid={`button-archive-package-${pkg.id}`}>
                                  <Archive className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Package Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedPackage?.name}</DialogTitle>
            <DialogDescription>Configure report sections and settings</DialogDescription>
          </DialogHeader>
          {selectedPackage && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Type:</span>{" "}
                  <Badge variant="outline">{PACKAGE_TYPES.find(t => t.value === selectedPackage.packageType)?.label}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <Badge variant="outline" className={STATUS_CONFIG[selectedPackage.status]?.color}>
                    {STATUS_CONFIG[selectedPackage.status]?.label}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Period:</span>{" "}
                  {format(new Date(selectedPackage.periodStartDate), "MM/dd/yyyy")} – {format(new Date(selectedPackage.periodEndDate), "MM/dd/yyyy")}
                </div>
                {selectedPackage.asOfDate && (
                  <div>
                    <span className="text-muted-foreground">As-Of Date:</span>{" "}
                    {format(new Date(selectedPackage.asOfDate), "MM/dd/yyyy")}
                  </div>
                )}
              </div>
              {selectedPackage.sections && selectedPackage.sections.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Sections</h4>
                  <div className="space-y-2">
                    {selectedPackage.sections
                      .sort((a, b) => a.sectionOrder - b.sectionOrder)
                      .map(section => (
                        <div key={section.id} className="flex items-center justify-between p-3 border rounded-md">
                          <div>
                            <p className="font-medium text-sm">{section.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">{section.sectionType.replace(/_/g, " ")}</p>
                          </div>
                          <Switch
                            checked={section.isIncluded}
                            onCheckedChange={(checked) => updateSectionMutation.mutate({
                              packageId: selectedPackage.id,
                              sectionId: section.id,
                              data: { isIncluded: checked },
                            })}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
