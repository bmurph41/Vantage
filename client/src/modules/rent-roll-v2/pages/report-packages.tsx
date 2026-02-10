import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  Eye
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

const PACKAGE_TYPES = [
  { value: "quarterly", label: "Quarterly Report" },
  { value: "annual", label: "Annual Report" },
  { value: "acquisition", label: "Acquisition Report" },
  { value: "disposition", label: "Disposition Report" },
  { value: "custom", label: "Custom Report" },
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

export default function ReportPackagesPage() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<ReportPackageWithSections | null>(null);

  const getDefaultFormValues = useMemo(() => () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const quarterStart = format(new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1), 'yyyy-MM-dd');
    const quarterEnd = format(new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3 + 3, 0), 'yyyy-MM-dd');
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

  const form = useForm<PackageFormValues>({
    resolver: zodResolver(packageFormSchema),
    defaultValues: getDefaultFormValues(),
  });

  useEffect(() => {
    if (createDialogOpen) {
      form.reset(getDefaultFormValues(), { keepDefaultValues: false });
    }
  }, [createDialogOpen, getDefaultFormValues]);

  const { data: packages, isLoading: packagesLoading } = useQuery<ReportPackage[]>({
    queryKey: ['/api/report-packages'],
  });

  const { data: projects } = useQuery<any[]>({
    queryKey: ['/api/marina-locations'],
  });

  const createPackageMutation = useMutation({
    mutationFn: async (data: PackageFormValues) => {
      return apiRequest('POST', '/api/report-packages', {
        ...data,
        projectId: data.projectId || null,
        asOfDate: data.asOfDate || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/report-packages'] });
      setCreateDialogOpen(false);
      form.reset(getDefaultFormValues(), { keepDefaultValues: false });
      toast({ title: "Report package created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create report package", variant: "destructive" });
    },
  });

  const deletePackageMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/report-packages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/report-packages'] });
      toast({ title: "Report package deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete report package", variant: "destructive" });
    },
  });

  const generatePackageMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/report-packages/${id}/generate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/report-packages'] });
      toast({ title: "Report generation started" });
    },
    onError: () => {
      toast({ title: "Failed to generate report", variant: "destructive" });
    },
  });

  const archivePackageMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/report-packages/${id}/archive`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/report-packages'] });
      toast({ title: "Report package archived" });
    },
    onError: () => {
      toast({ title: "Failed to archive report package", variant: "destructive" });
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: async ({ packageId, sectionId, data }: { packageId: string; sectionId: string; data: Partial<ReportPackageSection> }) => {
      return apiRequest('PUT', `/api/report-packages/${packageId}/sections/${sectionId}`, data);
    },
    onSuccess: () => {
      if (selectedPackage) {
        fetchPackageDetails(selectedPackage.id);
      }
      toast({ title: "Section updated" });
    },
    onError: () => {
      toast({ title: "Failed to update section", variant: "destructive" });
    },
  });

  const fetchPackageDetails = async (id: string) => {
    try {
      const response = await fetch(`/api/report-packages/${id}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setSelectedPackage(data);
      setDetailDialogOpen(true);
    } catch (error) {
      toast({ title: "Failed to load package details", variant: "destructive" });
    }
  };

  const onSubmit = (values: PackageFormValues) => {
    createPackageMutation.mutate(values);
  };

  const handleSectionToggle = (section: ReportPackageSection, isIncluded: boolean) => {
    if (!selectedPackage) return;
    updateSectionMutation.mutate({
      packageId: selectedPackage.id,
      sectionId: section.id,
      data: { isIncluded },
    });
  };

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
            <Button size="default" data-testid="button-create-package" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Package
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) form.reset(getDefaultFormValues(), { keepDefaultValues: false });
      }}>
            <DialogContent className="max-w-lg">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <DialogHeader>
                    <DialogTitle>Create Report Package</DialogTitle>
                    <DialogDescription>
                      Create a new investor report package with customizable sections
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Package Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Q4 2024 Investor Report" {...field} data-testid="input-package-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Report description..." {...field} data-testid="input-package-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="packageType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Report Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-package-type">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PACKAGE_TYPES.map(type => (
                                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="projectId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-project">
                                <SelectValue placeholder="All projects" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="">All Projects</SelectItem>
                              {projects?.map(project => (
                                <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="periodStartDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Period Start</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-period-start" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="periodEndDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Period End</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} data-testid="input-period-end" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="asOfDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>As-Of Date (Optional)</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-as-of-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createPackageMutation.isPending} data-testid="button-save-package">
                      {createPackageMutation.isPending ? 'Creating...' : 'Create Package'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
        </DialogContent>
      </Dialog>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Report Packages</CardTitle>
            <CardDescription>Manage your investor report packages and their generation status</CardDescription>
          </CardHeader>
          <CardContent>
            {packagesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !packages?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No report packages yet</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first investor report package to get started</p>
                <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-package">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Package
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
                    const isDraft = pkg.status === 'draft';
                    const isReady = pkg.status === 'ready';
                    const isGenerating = pkg.status === 'generating';

                    return (
                      <TableRow key={pkg.id} data-testid={`row-package-${pkg.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{pkg.name}</p>
                            {pkg.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{pkg.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {PACKAGE_TYPES.find(t => t.value === pkg.packageType)?.label || pkg.packageType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {pkg.projectName || <span className="text-muted-foreground">All Projects</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(pkg.periodStartDate), 'MMM d, yyyy')} - {format(new Date(pkg.periodEndDate), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusConfig.color}>
                            <StatusIcon className={`mr-1 h-3 w-3 ${isGenerating ? 'animate-spin' : ''}`} />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(pkg.createdAt), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => fetchPackageDetails(pkg.id)}
                              data-testid={`button-view-package-${pkg.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {isDraft && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => generatePackageMutation.mutate(pkg.id)}
                                  disabled={generatePackageMutation.isPending}
                                  data-testid={`button-generate-package-${pkg.id}`}
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deletePackageMutation.mutate(pkg.id)}
                                  disabled={deletePackageMutation.isPending}
                                  data-testid={`button-delete-package-${pkg.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {isReady && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  data-testid={`button-download-package-${pkg.id}`}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => archivePackageMutation.mutate(pkg.id)}
                                  disabled={archivePackageMutation.isPending}
                                  data-testid={`button-archive-package-${pkg.id}`}
                                >
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

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedPackage?.name}</DialogTitle>
            <DialogDescription>
              Configure report sections and settings
            </DialogDescription>
          </DialogHeader>
          {selectedPackage && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Type:</span>{' '}
                  <Badge variant="outline">{PACKAGE_TYPES.find(t => t.value === selectedPackage.packageType)?.label}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{' '}
                  <Badge variant="outline" className={STATUS_CONFIG[selectedPackage.status]?.color}>
                    {STATUS_CONFIG[selectedPackage.status]?.label}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Period:</span>{' '}
                  {format(new Date(selectedPackage.periodStartDate), 'MMM d, yyyy')} - {format(new Date(selectedPackage.periodEndDate), 'MMM d, yyyy')}
                </div>
                <div>
                  <span className="text-muted-foreground">Project:</span>{' '}
                  {selectedPackage.projectName || 'All Projects'}
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Report Sections</h4>
                <div className="space-y-2">
                  {selectedPackage.sections?.sort((a, b) => a.sectionOrder - b.sectionOrder).map(section => (
                    <div
                      key={section.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`section-row-${section.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground w-6">{section.sectionOrder}.</span>
                        <span className={section.isIncluded ? '' : 'text-muted-foreground line-through'}>
                          {section.title}
                        </span>
                      </div>
                      <Switch
                        checked={section.isIncluded}
                        onCheckedChange={(checked) => handleSectionToggle(section, checked)}
                        disabled={selectedPackage.status !== 'draft' || updateSectionMutation.isPending}
                        data-testid={`switch-section-${section.id}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
            {selectedPackage?.status === 'draft' && (
              <Button 
                onClick={() => {
                  generatePackageMutation.mutate(selectedPackage.id);
                  setDetailDialogOpen(false);
                }}
                disabled={generatePackageMutation.isPending}
                data-testid="button-generate-from-detail"
              >
                <Play className="mr-2 h-4 w-4" />
                Generate Report
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
