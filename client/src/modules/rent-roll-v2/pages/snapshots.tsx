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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { 
  Camera,
  Trash2,
  Lock,
  Eye,
  GitCompare,
  CheckCircle2,
  Clock,
  Building2
} from "lucide-react";
import DashboardNav from "../components/navigation/DashboardNav";

interface Snapshot {
  id: string;
  organizationId: string;
  projectId: string | null;
  name: string;
  description: string | null;
  snapshotDate: string;
  status: string;
  createdBy: string | null;
  createdAt: string;
  finalizedAt: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: Clock },
  finalized: { label: "Finalized", color: "bg-green-100 text-green-700", icon: Lock },
};

const snapshotFormSchema = z.object({
  name: z.string().min(1, "Snapshot name is required"),
  description: z.string().optional(),
  projectId: z.string().optional(),
  snapshotDate: z.string().min(1, "Snapshot date is required"),
});

type SnapshotFormValues = z.infer<typeof snapshotFormSchema>;

export default function SnapshotsPage() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("all");

  const getDefaultFormValues = useMemo(() => () => ({
    name: "",
    description: "",
    projectId: "",
    snapshotDate: format(new Date(), 'yyyy-MM-dd'),
  }), []);

  const form = useForm<SnapshotFormValues>({
    resolver: zodResolver(snapshotFormSchema),
    defaultValues: getDefaultFormValues(),
  });

  useEffect(() => {
    if (createDialogOpen) {
      form.reset(getDefaultFormValues(), { keepDefaultValues: false });
    }
  }, [createDialogOpen, getDefaultFormValues]);

  const { data: snapshots, isLoading: snapshotsLoading } = useQuery<Snapshot[]>({
    queryKey: ['/api/snapshots', selectedProject !== 'all' ? selectedProject : undefined].filter(Boolean),
    queryFn: async () => {
      const url = selectedProject !== 'all' 
        ? `/api/snapshots?projectId=${selectedProject}` 
        : '/api/snapshots';
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch snapshots');
      return response.json();
    },
  });

  const { data: projects } = useQuery<any[]>({
    queryKey: ['/api/marina-locations'],
  });

  const createSnapshotMutation = useMutation({
    mutationFn: async (data: SnapshotFormValues) => {
      return apiRequest('POST', '/api/snapshots', {
        ...data,
        projectId: data.projectId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/snapshots'] });
      setCreateDialogOpen(false);
      form.reset(getDefaultFormValues(), { keepDefaultValues: false });
      toast({ title: "Snapshot created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create snapshot", variant: "destructive" });
    },
  });

  const finalizeSnapshotMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('POST', `/api/snapshots/${id}/finalize`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/snapshots'] });
      toast({ title: "Snapshot finalized" });
    },
    onError: () => {
      toast({ title: "Failed to finalize snapshot", variant: "destructive" });
    },
  });

  const deleteSnapshotMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/snapshots/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/snapshots'] });
      toast({ title: "Snapshot deleted" });
    },
    onError: (error: any) => {
      const message = error.message?.includes('finalized') 
        ? "Cannot delete finalized snapshots" 
        : "Failed to delete snapshot";
      toast({ title: message, variant: "destructive" });
    },
  });

  const onSubmit = (values: SnapshotFormValues) => {
    createSnapshotMutation.mutate(values);
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
            <Button size="default" data-testid="button-create-snapshot" onClick={() => setCreateDialogOpen(true)}>
              <Camera className="mr-2 h-4 w-4" />
              Create Snapshot
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) {
          form.reset(getDefaultFormValues(), { keepDefaultValues: false });
        }
      }}>
            <DialogContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <DialogHeader>
                    <DialogTitle>Create Snapshot</DialogTitle>
                    <DialogDescription>
                      Capture a point-in-time copy of your rent roll data
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Snapshot Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Q4 2024 Year-End" {...field} data-testid="input-snapshot-name" />
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
                            <Textarea placeholder="Snapshot description..." {...field} data-testid="input-snapshot-description" />
                          </FormControl>
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
                    <FormField
                      control={form.control}
                      name="snapshotDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Snapshot Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-snapshot-date" />
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
                    <Button type="submit" disabled={createSnapshotMutation.isPending} data-testid="button-save-snapshot">
                      {createSnapshotMutation.isPending ? 'Creating...' : 'Create Snapshot'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
        </DialogContent>
      </Dialog>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[200px]" data-testid="select-filter-project">
              <SelectValue placeholder="Filter by project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects?.map(project => (
                <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Snapshot History</CardTitle>
            <CardDescription>View and manage your data snapshots</CardDescription>
          </CardHeader>
          <CardContent>
            {snapshotsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !snapshots?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Camera className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No snapshots yet</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first snapshot to capture a point-in-time view</p>
                <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-snapshot">
                  <Camera className="mr-2 h-4 w-4" />
                  Create Snapshot
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Snapshot Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map(snapshot => {
                    const statusConfig = STATUS_CONFIG[snapshot.status] || STATUS_CONFIG.draft;
                    const StatusIcon = statusConfig.icon;
                    const isDraft = snapshot.status === 'draft';

                    return (
                      <TableRow key={snapshot.id} data-testid={`row-snapshot-${snapshot.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{snapshot.name}</p>
                            {snapshot.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{snapshot.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {snapshot.projectId ? (
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span>{projects?.find(p => p.id === snapshot.projectId)?.name || 'Unknown'}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">All Projects</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(snapshot.snapshotDate), 'MM/dd/yyyy')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusConfig.color}>
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(snapshot.createdAt), 'MMM d, yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`button-view-snapshot-${snapshot.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`button-compare-snapshot-${snapshot.id}`}
                            >
                              <GitCompare className="h-4 w-4" />
                            </Button>
                            {isDraft && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => finalizeSnapshotMutation.mutate(snapshot.id)}
                                  disabled={finalizeSnapshotMutation.isPending}
                                  title="Finalize snapshot"
                                  data-testid={`button-finalize-snapshot-${snapshot.id}`}
                                >
                                  <Lock className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteSnapshotMutation.mutate(snapshot.id)}
                                  disabled={deleteSnapshotMutation.isPending}
                                  data-testid={`button-delete-snapshot-${snapshot.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
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

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What are Snapshots?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Snapshots capture your rent roll data at a specific point in time, allowing you to:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Create audit-ready reports for specific dates</li>
                <li>Compare changes between time periods</li>
                <li>Generate investor reports with historical accuracy</li>
                <li>Maintain compliance with reporting requirements</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Snapshot Status</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-gray-100 text-gray-700">
                  <Clock className="mr-1 h-3 w-3" />
                  Draft
                </Badge>
                <span className="text-muted-foreground">Can be edited or deleted</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-green-100 text-green-700">
                  <Lock className="mr-1 h-3 w-3" />
                  Finalized
                </Badge>
                <span className="text-muted-foreground">Locked for audit purposes</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
