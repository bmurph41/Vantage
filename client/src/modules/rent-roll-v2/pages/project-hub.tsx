import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Building2, 
  TrendingUp, 
  Users, 
  Calendar,
  Check,
  ChevronRight,
  DollarSign,
  Pencil,
  Plus,
  Loader2,
  AlertTriangle,
  GitMerge,
  Trash2,
  FileEdit,
  X
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import DashboardNav from "../components/navigation/DashboardNav";
import { createLocation } from "../lib/locationApi";

const STORAGE_TYPES = [
  "Wet Slip",
  "Lift Slip",
  "Mooring",
  "Jet Ski",
  "Dry Rack - Indoor",
  "Dry Rack - Outdoor",
  "Houseboat",
  "Liveaboard",
  "Land Storage",
  "Boat on Trailer",
  "Trailer Only",
] as const;

const storageTypeConfigSchema = z.object({
  storageType: z.string(),
  unitCount: z.number().min(0).nullable(),
  targetOccupancy: z.string().optional(),
});

const addProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  projectType: z.enum(["OWNED", "DEAL"]),
  description: z.string().optional(),
  status: z.string().optional(),
  operationType: z.enum(["ANNUAL", "SEASONAL"]).default("ANNUAL"),
  storageTypeConfigs: z.array(storageTypeConfigSchema).default([]),
  includeInExecutive: z.boolean().default(true),
  dealId: z.string().optional(),
  propertyId: z.string().optional(),
});

type LinkType = 'deal' | 'property' | 'new';

interface CrmDeal {
  id: string;
  title: string;
  marinaName: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
}

interface CrmProperty {
  id: string;
  title: string;
  city: string | null;
  state: string | null;
  address: string | null;
  wetSlips: number | null;
  drySlips: number | null;
  totalCapacity: number | null;
}

interface ProjectHubMetrics {
  locationId: string;
  name: string;
  code: string | null;
  description: string | null;
  projectType: "OWNED" | "DEAL";
  status: string | null;
  targetNOI: string | null;
  capacity: number | null;
  activeLeaseCount: number;
  totalLeaseCount: number;
  occupancyRate: number;
  monthlyRevenue: string;
  trailing12MonthRevenue: string;
  nextExpirationDate: string | null;
  upcomingExpirations: number;
  includeInExecutive: boolean;
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingProject?: {
    id: string;
    name: string;
    projectType: string;
  };
  canModify?: boolean;
}

export default function ProjectHub() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectHubMetrics | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateCheckResult["existingProject"] | null>(null);
  const [pendingProjectData, setPendingProjectData] = useState<z.infer<typeof addProjectSchema> | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [canModifyDuplicate, setCanModifyDuplicate] = useState(false);

  const [addDialogStep, setAddDialogStep] = useState<1 | 2 | 3>(1);
  const [linkType, setLinkType] = useState<LinkType>('new');
  const [selectedDeal, setSelectedDeal] = useState<CrmDeal | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<CrmProperty | null>(null);
  const [dealSearch, setDealSearch] = useState('');
  const [propertySearch, setPropertySearch] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectHubMetrics | null>(null);

  const form = useForm<z.infer<typeof addProjectSchema>>({
    resolver: zodResolver(addProjectSchema),
    defaultValues: {
      name: "",
      projectType: "OWNED",
      description: "",
      status: "",
      operationType: "ANNUAL",
      storageTypeConfigs: [],
      includeInExecutive: true,
    },
  });

  const { data: projects, isLoading } = useQuery<ProjectHubMetrics[]>({
    queryKey: ['/api/rent-roll/project-hub-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/rent-roll/project-hub-metrics');
      if (!response.ok) throw new Error('Failed to fetch project hub metrics');
      return response.json();
    },
  });

  const { data: dealsSearchResults = [], isLoading: isSearchingDeals } = useQuery<CrmDeal[]>({
    queryKey: [`/api/rent-roll/crm/deals/search?search=${encodeURIComponent(dealSearch)}&limit=20`],
    enabled: addDialogOpen && linkType === 'deal',
  });

  const { data: propertiesSearchResults = [], isLoading: isSearchingProperties } = useQuery<CrmProperty[]>({
    queryKey: [`/api/rent-roll/crm/properties/search?search=${encodeURIComponent(propertySearch)}&limit=20`],
    enabled: addDialogOpen && linkType === 'property',
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ locationId, name, code }: { locationId: string; name: string; code?: string | null }) => {
      return await apiRequest("PUT", `/api/rent-roll/locations/${locationId}`, { name, code });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/project-hub-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/included-projects'] });
      toast({
        title: "Success",
        description: "Project details updated successfully",
      });
      setEditDialogOpen(false);
      setEditingProject(null);
      setEditName("");
      setEditCode("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update project name",
        variant: "destructive",
      });
    },
  });

  const handleEditClick = (project: ProjectHubMetrics, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingProject(project);
    setEditName(project.name);
    setEditCode(project.code || "");
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (editingProject && editName.trim()) {
      updateProjectMutation.mutate({
        locationId: editingProject.locationId,
        name: editName.trim(),
        code: editCode.trim() || null,
      });
    }
  };

  const toggleExecutiveMutation = useMutation({
    mutationFn: async ({ locationId, includeInExecutive }: { locationId: string; includeInExecutive: boolean }) => {
      return await apiRequest("PUT", `/api/rent-roll/locations/${locationId}`, { includeInExecutive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/project-hub-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/included-projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/executive-dashboard/metrics'] });
      toast({
        title: "Success",
        description: "Executive summary settings updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const handleToggleExecutive = (project: ProjectHubMetrics, checked: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleExecutiveMutation.mutate({
      locationId: project.locationId,
      includeInExecutive: checked,
    });
  };

  const createProjectMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addProjectSchema>) => {
      const response = await apiRequest("POST", "/api/rent-roll/locations", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/project-hub-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/included-projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/executive-dashboard/metrics'] });
      toast({
        title: "Success",
        description: "Rent roll created successfully",
      });
      setAddDialogOpen(false);
      setDuplicateDialogOpen(false);
      setPendingProjectData(null);
      setDuplicateInfo(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create rent roll",
        variant: "destructive",
      });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (locationId: string) => {
      return await apiRequest("DELETE", `/api/rent-roll/locations/${locationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/project-hub-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/included-projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/executive-dashboard/metrics'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete project",
        variant: "destructive",
      });
    },
  });

  const checkDuplicateName = async (name: string): Promise<DuplicateCheckResult> => {
    const response = await apiRequest("POST", "/api/rent-roll/locations/check-duplicate", { name });
    return response.json();
  };

  const handleAddProject = async (data: z.infer<typeof addProjectSchema>) => {
    const cleanedData = {
      ...data,
      description: data.description?.trim() || undefined,
      status: data.status?.trim() || undefined,
    };
    createProjectMutation.mutate(cleanedData);
  };

  const handleDuplicateRename = () => {
    setDuplicateDialogOpen(false);
    if (pendingProjectData) {
      form.setValue("name", pendingProjectData.name);
      form.setValue("projectType", pendingProjectData.projectType);
    }
    setAddDialogOpen(true);
  };

  const handleDuplicateReplace = async () => {
    if (!duplicateInfo || !pendingProjectData) return;
    
    setIsReplacing(true);
    try {
      await apiRequest("POST", "/api/rent-roll/locations", pendingProjectData);
      
      await deleteProjectMutation.mutateAsync(duplicateInfo.id);
      
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/project-hub-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/locations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/included-projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/executive-dashboard/metrics'] });
      
      toast({
        title: "Success",
        description: "Project replaced successfully",
      });
      
      setDuplicateDialogOpen(false);
      setPendingProjectData(null);
      setDuplicateInfo(null);
      form.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to replace project",
        variant: "destructive",
      });
    } finally {
      setIsReplacing(false);
    }
  };

  const handleDuplicateMerge = () => {
    if (!duplicateInfo) return;
    const projectId = duplicateInfo.id;
    setDuplicateDialogOpen(false);
    setPendingProjectData(null);
    setDuplicateInfo(null);
    navigate(`/rent-roll/${projectId}`);
  };

  const handleDuplicateCancel = () => {
    setDuplicateDialogOpen(false);
    setPendingProjectData(null);
    setDuplicateInfo(null);
    setCanModifyDuplicate(false);
    form.reset();
  };

  const handleDeleteClick = (project: ProjectHubMetrics, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProjectMutation.mutateAsync(projectToDelete.locationId);
      toast({
        title: "Success",
        description: "Project and all associated data have been removed",
      });
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    } catch (error) {
      // Error toast is handled in mutation
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setProjectToDelete(null);
  };

  const isStep3Valid = () => {
    const status = form.watch("status");
    const operationType = form.watch("operationType");
    const storageTypeConfigs = form.watch("storageTypeConfigs") || [];

    if (!status || !operationType) {
      return false;
    }

    if (storageTypeConfigs.length === 0) {
      return false;
    }

    for (const config of storageTypeConfigs) {
      if (config.unitCount === null || config.unitCount === undefined || config.unitCount < 0) {
        return false;
      }
      if (!config.targetOccupancy || config.targetOccupancy.trim() === "") {
        return false;
      }
    }

    return true;
  };

  useEffect(() => {
    if (!addDialogOpen) {
      form.reset();
      setAddDialogStep(1);
      setLinkType('new');
      setSelectedDeal(null);
      setSelectedProperty(null);
      setDealSearch('');
      setPropertySearch('');
    }
  }, [addDialogOpen]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <div className="mb-4">
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <DashboardNav />
              <Skeleton className="h-10 w-36" />
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeProjects = projects?.filter(p => p.projectType === "OWNED") || [];
  const dealProjects = projects?.filter(p => p.projectType === "DEAL") || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-4">
            <h1 className="text-3xl font-semibold text-foreground" data-testid="text-page-title">
              Rent Roll Projects
            </h1>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-description">
              Key performance metrics and trends
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <DashboardNav />
            <Button
              onClick={() => setAddDialogOpen(true)}
              data-testid="button-add-rent-roll"
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Rent Roll
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8" data-testid="page-project-hub">
        {activeProjects.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-semibold" data-testid="text-section-active">My Marinas</h2>
            <Badge variant="secondary" data-testid="badge-active-count">{activeProjects.length}</Badge>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {activeProjects.map((project) => (
              <Link key={project.locationId} href={`/rent-roll/projects/${project.locationId}`}>
                <Card 
                  className="hover-elevate active-elevate-2 cursor-pointer transition-all h-full relative"
                  data-testid={`card-project-${project.locationId}`}
                >
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => handleDeleteClick(project, e)}
                    data-testid={`button-delete-${project.locationId}`}
                    className="h-6 w-6 absolute top-2 right-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <CardHeader className="space-y-1 pb-3 pr-10">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl truncate" data-testid={`text-project-name-${project.locationId}`}>
                          {project.name}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => handleEditClick(project, e)}
                          data-testid={`button-edit-${project.locationId}`}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                    {project.status && (
                      <Badge variant="outline" className="w-fit" data-testid={`badge-status-${project.locationId}`}>
                        {project.status}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          <span>Occupancy</span>
                        </div>
                        <div className="font-semibold" data-testid={`text-occupancy-${project.locationId}`}>
                          {project.capacity 
                            ? `${project.activeLeaseCount}/${project.capacity} (${formatPercent(project.occupancyRate)})`
                            : `${project.activeLeaseCount} leases`
                          }
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span>MRR</span>
                        </div>
                        <div className="font-semibold" data-testid={`text-mrr-${project.locationId}`}>
                          {formatCurrency(project.monthlyRevenue)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span>T12 Revenue</span>
                        </div>
                        <div className="font-semibold" data-testid={`text-t12-${project.locationId}`}>
                          {formatCurrency(project.trailing12MonthRevenue)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Expirations</span>
                        </div>
                        <div className="font-semibold" data-testid={`text-expirations-${project.locationId}`}>
                          {project.upcomingExpirations > 0 
                            ? `${project.upcomingExpirations} in 90d` 
                            : "None"
                          }
                        </div>
                      </div>
                    </div>
                    <div 
                      className="pt-3 border-t flex items-center gap-2"
                      onClick={(e) => e.preventDefault()}
                    >
                      <Checkbox
                        id={`exec-${project.locationId}`}
                        checked={project.includeInExecutive}
                        onCheckedChange={(checked) => handleToggleExecutive(project, checked as boolean, event as any)}
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`checkbox-executive-${project.locationId}`}
                      />
                      <label
                        htmlFor={`exec-${project.locationId}`}
                        className="text-sm cursor-pointer select-none"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`label-executive-${project.locationId}`}
                      >
                        Include in Executive Summary
                      </label>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {dealProjects.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-semibold" data-testid="text-section-deals">Deals Under Evaluation</h2>
            <Badge variant="secondary" data-testid="badge-deals-count">{dealProjects.length}</Badge>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {dealProjects.map((project) => (
              <Link key={project.locationId} href={`/rent-roll/projects/${project.locationId}`}>
                <Card 
                  className="hover-elevate active-elevate-2 cursor-pointer transition-all h-full border-dashed relative"
                  data-testid={`card-project-${project.locationId}`}
                >
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => handleDeleteClick(project, e)}
                    data-testid={`button-delete-${project.locationId}`}
                    className="h-6 w-6 absolute top-2 right-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <CardHeader className="space-y-1 pb-3 pr-10">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl truncate" data-testid={`text-project-name-${project.locationId}`}>
                          {project.name}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => handleEditClick(project, e)}
                          data-testid={`button-edit-${project.locationId}`}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                    {project.status && (
                      <Badge variant="outline" className="w-fit" data-testid={`badge-status-${project.locationId}`}>
                        {project.status}
                      </Badge>
                    )}
                    {project.targetNOI && (
                      <div className="text-sm text-muted-foreground" data-testid={`text-target-noi-${project.locationId}`}>
                        Target NOI: {formatCurrency(project.targetNOI)}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          <span>Occupancy</span>
                        </div>
                        <div className="font-semibold" data-testid={`text-occupancy-${project.locationId}`}>
                          {project.capacity 
                            ? `${project.activeLeaseCount}/${project.capacity} (${formatPercent(project.occupancyRate)})`
                            : `${project.activeLeaseCount} leases`
                          }
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span>MRR</span>
                        </div>
                        <div className="font-semibold" data-testid={`text-mrr-${project.locationId}`}>
                          {formatCurrency(project.monthlyRevenue)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span>T12 Revenue</span>
                        </div>
                        <div className="font-semibold" data-testid={`text-t12-${project.locationId}`}>
                          {formatCurrency(project.trailing12MonthRevenue)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Expirations</span>
                        </div>
                        <div className="font-semibold" data-testid={`text-expirations-${project.locationId}`}>
                          {project.upcomingExpirations > 0 
                            ? `${project.upcomingExpirations} in 90d` 
                            : "None"
                          }
                        </div>
                      </div>
                    </div>
                    <div 
                      className="pt-3 border-t flex items-center gap-2"
                      onClick={(e) => e.preventDefault()}
                    >
                      <Checkbox
                        id={`exec-${project.locationId}`}
                        checked={project.includeInExecutive}
                        onCheckedChange={(checked) => handleToggleExecutive(project, checked as boolean, event as any)}
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`checkbox-executive-${project.locationId}`}
                      />
                      <label
                        htmlFor={`exec-${project.locationId}`}
                        className="text-sm cursor-pointer select-none"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`label-executive-${project.locationId}`}
                      >
                        Include in Executive Summary
                      </label>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {projects && projects.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-state">No Projects Found</h3>
            <p className="text-muted-foreground" data-testid="text-empty-description">
              Create a new marina location to get started
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-project">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">Edit Project Details</DialogTitle>
            <DialogDescription data-testid="text-dialog-description">
              Update the name and code for this project. These will be displayed throughout the application.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g., Project 1 - Test Marina"
                data-testid="input-project-name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editName.trim()) {
                    handleSaveEdit();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-code">Project Code (Optional)</Label>
              <Input
                id="project-code"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                placeholder="e.g., A, B, C1"
                data-testid="input-project-code"
                className="max-w-[200px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editName.trim()) {
                    handleSaveEdit();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              data-testid="button-cancel"
              disabled={updateProjectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editName.trim() || updateProjectMutation.isPending}
              data-testid="button-save"
            >
              {updateProjectMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent data-testid="dialog-add-rent-roll" className="sm:max-w-xl">
          <DialogHeader className="pb-2">
            <DialogTitle data-testid="text-dialog-title" className="text-xl">
              {addDialogStep === 1 && "Add New Rent Roll"}
              {addDialogStep === 2 && "Select Project Type"}
              {addDialogStep === 3 && "Project Details"}
            </DialogTitle>
            <DialogDescription data-testid="text-dialog-description">
              {addDialogStep === 1 && "Link to an existing deal, property, or create a new entry"}
              {addDialogStep === 2 && "Choose how this project will be used"}
              {addDialogStep === 3 && "Complete the project configuration"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center justify-center gap-3 py-3">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                    step < addDialogStep
                      ? "bg-primary text-primary-foreground"
                      : step === addDialogStep
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step < addDialogStep ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    step
                  )}
                </div>
                {step < 3 && (
                  <div className={`h-0.5 w-8 transition-colors ${step < addDialogStep ? "bg-primary" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddProject)} className="space-y-4 py-4">
              {addDialogStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div
                      className={`cursor-pointer rounded-xl border-2 p-4 transition-all hover:shadow-md ${
                        linkType === 'deal'
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-muted hover:border-primary/50"
                      }`}
                      onClick={() => {
                        setLinkType('deal');
                        setSelectedProperty(null);
                        setSelectedDeal(null);
                        form.setValue('name', '');
                        form.setValue('dealId', undefined);
                        form.setValue('propertyId', undefined);
                      }}
                      data-testid="link-type-deal"
                    >
                      <div className="flex flex-col items-center gap-2 text-center">
                        <div className={`rounded-full p-2 ${linkType === 'deal' ? "bg-primary/10" : "bg-muted"}`}>
                          <TrendingUp className={`h-5 w-5 ${linkType === 'deal' ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div className="font-medium text-sm">Link to Deal</div>
                      </div>
                    </div>
                    <div
                      className={`cursor-pointer rounded-xl border-2 p-4 transition-all hover:shadow-md ${
                        linkType === 'property'
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-muted hover:border-primary/50"
                      }`}
                      onClick={() => {
                        setLinkType('property');
                        setSelectedDeal(null);
                        setSelectedProperty(null);
                        form.setValue('name', '');
                        form.setValue('dealId', undefined);
                        form.setValue('propertyId', undefined);
                      }}
                      data-testid="link-type-property"
                    >
                      <div className="flex flex-col items-center gap-2 text-center">
                        <div className={`rounded-full p-2 ${linkType === 'property' ? "bg-primary/10" : "bg-muted"}`}>
                          <Building2 className={`h-5 w-5 ${linkType === 'property' ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div className="font-medium text-sm">Link to Property</div>
                      </div>
                    </div>
                    <div
                      className={`cursor-pointer rounded-xl border-2 p-4 transition-all hover:shadow-md ${
                        linkType === 'new'
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-muted hover:border-primary/50"
                      }`}
                      onClick={() => {
                        setLinkType('new');
                        setSelectedDeal(null);
                        setSelectedProperty(null);
                        form.setValue('name', '');
                        form.setValue('dealId', undefined);
                        form.setValue('propertyId', undefined);
                      }}
                      data-testid="link-type-new"
                    >
                      <div className="flex flex-col items-center gap-2 text-center">
                        <div className={`rounded-full p-2 ${linkType === 'new' ? "bg-primary/10" : "bg-muted"}`}>
                          <Plus className={`h-5 w-5 ${linkType === 'new' ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                        <div className="font-medium text-sm">New Entry</div>
                      </div>
                    </div>
                  </div>

                  {linkType === 'deal' && (
                    <div className="space-y-3 pt-2">
                      <Label className="text-sm font-medium">Search Deals</Label>
                      <Input
                        placeholder="Type to search deals..."
                        value={dealSearch}
                        onChange={(e) => setDealSearch(e.target.value)}
                        className="h-10"
                        autoFocus
                      />
                      <div className="max-h-48 overflow-y-auto border rounded-lg">
                        {isSearchingDeals ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span className="text-sm text-muted-foreground">Searching...</span>
                          </div>
                        ) : dealsSearchResults.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            {dealSearch ? 'No deals found' : 'Enter a search term'}
                          </div>
                        ) : (
                          dealsSearchResults.map((deal) => (
                            <div
                              key={deal.id}
                              className={`p-3 border-b last:border-b-0 cursor-pointer transition-colors ${
                                selectedDeal?.id === deal.id ? 'bg-primary/10' : 'hover:bg-muted/50'
                              }`}
                              onClick={() => {
                                setSelectedDeal(deal);
                                form.setValue('name', deal.marinaName || deal.title);
                                form.setValue('dealId', deal.id);
                              }}
                            >
                              <div className="font-medium text-sm">{deal.title}</div>
                              {deal.marinaName && deal.marinaName !== deal.title && (
                                <div className="text-xs text-muted-foreground">{deal.marinaName}</div>
                              )}
                              {(deal.city || deal.state) && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {[deal.city, deal.state].filter(Boolean).join(', ')}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                      {selectedDeal && (
                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Selected: {selectedDeal.title}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {linkType === 'property' && (
                    <div className="space-y-3 pt-2">
                      <Label className="text-sm font-medium">Search Properties</Label>
                      <Input
                        placeholder="Type to search properties..."
                        value={propertySearch}
                        onChange={(e) => setPropertySearch(e.target.value)}
                        className="h-10"
                        autoFocus
                      />
                      <div className="max-h-48 overflow-y-auto border rounded-lg">
                        {isSearchingProperties ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span className="text-sm text-muted-foreground">Searching...</span>
                          </div>
                        ) : propertiesSearchResults.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            {propertySearch ? 'No properties found' : 'Enter a search term'}
                          </div>
                        ) : (
                          propertiesSearchResults.map((property) => (
                            <div
                              key={property.id}
                              className={`p-3 border-b last:border-b-0 cursor-pointer transition-colors ${
                                selectedProperty?.id === property.id ? 'bg-primary/10' : 'hover:bg-muted/50'
                              }`}
                              onClick={() => {
                                setSelectedProperty(property);
                                form.setValue('name', property.title);
                                form.setValue('propertyId', property.id);
                              }}
                            >
                              <div className="font-medium text-sm">{property.title}</div>
                              {(property.city || property.state) && (
                                <div className="text-xs text-muted-foreground">
                                  {[property.city, property.state].filter(Boolean).join(', ')}
                                </div>
                              )}
                              {property.totalCapacity && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  Capacity: {property.totalCapacity} slips
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                      {selectedProperty && (
                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Selected: {selectedProperty.title}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {linkType === 'new' && (
                    <div className="pt-2">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium">Project Name *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., Marina A - Downtown Location"
                                data-testid="input-project-name"
                                autoFocus
                                className="h-10"
                                {...field}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground mt-1">
                              A new property entry will be created in your CRM
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              )}

              {addDialogStep === 2 && (
                <FormField
                  control={form.control}
                  name="projectType"
                  render={({ field }) => (
                    <FormItem className="space-y-4 py-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div
                          className={`cursor-pointer rounded-xl border-2 p-6 transition-all hover:shadow-md ${
                            field.value === "OWNED"
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-muted hover:border-primary/50"
                          }`}
                          onClick={() => field.onChange("OWNED")}
                          data-testid="select-type-owned"
                        >
                          <div className="flex flex-col items-center gap-3 text-center">
                            <div className={`rounded-full p-3 ${field.value === "OWNED" ? "bg-primary/10" : "bg-muted"}`}>
                              <Building2 className={`h-8 w-8 ${field.value === "OWNED" ? "text-primary" : "text-muted-foreground"}`} />
                            </div>
                            <div>
                              <div className="font-semibold text-base">My Marina</div>
                              <div className="text-xs text-muted-foreground mt-1">Actively managed property in your portfolio</div>
                            </div>
                          </div>
                        </div>
                        <div
                          className={`cursor-pointer rounded-xl border-2 p-6 transition-all hover:shadow-md ${
                            field.value === "DEAL"
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-muted hover:border-primary/50"
                          }`}
                          onClick={() => field.onChange("DEAL")}
                          data-testid="select-type-deal"
                        >
                          <div className="flex flex-col items-center gap-3 text-center">
                            <div className={`rounded-full p-3 ${field.value === "DEAL" ? "bg-primary/10" : "bg-muted"}`}>
                              <TrendingUp className={`h-8 w-8 ${field.value === "DEAL" ? "text-primary" : "text-muted-foreground"}`} />
                            </div>
                            <div>
                              <div className="font-semibold text-base">Deal Pipeline</div>
                              <div className="text-xs text-muted-foreground mt-1">Property under evaluation or acquisition</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {addDialogStep === 3 && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Brief description of the marina"
                            data-testid="input-project-description"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status *</FormLabel>
                          <Select value={field.value || ""} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-project-status">
                                <SelectValue placeholder="Select status..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Operating">Operating</SelectItem>
                              <SelectItem value="Analyzing">Analyzing</SelectItem>
                              <SelectItem value="Under LOI">Under LOI</SelectItem>
                              <SelectItem value="Due Diligence">Due Diligence</SelectItem>
                              <SelectItem value="Closed">Closed</SelectItem>
                              <SelectItem value="On Hold">On Hold</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="operationType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Operation Type *</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-operation-type">
                                <SelectValue placeholder="Select type..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ANNUAL">Year-Round</SelectItem>
                              <SelectItem value="SEASONAL">Seasonal</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <FormLabel>Storage Types *</FormLabel>
                      <p className="text-xs text-muted-foreground mt-1">Select storage types and set capacity details</p>
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {STORAGE_TYPES.map((storageType) => {
                        const configs = form.watch("storageTypeConfigs") || [];
                        const existingConfig = configs.find((c) => c.storageType === storageType);
                        const isSelected = !!existingConfig;

                        const toggleStorageType = () => {
                          const currentConfigs = form.getValues("storageTypeConfigs") || [];
                          if (isSelected) {
                            form.setValue(
                              "storageTypeConfigs",
                              currentConfigs.filter((c) => c.storageType !== storageType)
                            );
                          } else {
                            form.setValue("storageTypeConfigs", [
                              ...currentConfigs,
                              { storageType, unitCount: null, targetOccupancy: "" },
                            ]);
                          }
                        };

                        const updateConfig = (field: "unitCount" | "targetOccupancy", value: string) => {
                          const currentConfigs = form.getValues("storageTypeConfigs") || [];
                          const updatedConfigs = currentConfigs.map((c) => {
                            if (c.storageType === storageType) {
                              if (field === "unitCount") {
                                return { ...c, unitCount: value === "" ? null : parseInt(value) };
                              } else {
                                const numericValue = value.replace(/[^0-9]/g, "");
                                const formatted = numericValue ? `${numericValue}%` : "";
                                return { ...c, targetOccupancy: formatted };
                              }
                            }
                            return c;
                          });
                          form.setValue("storageTypeConfigs", updatedConfigs);
                        };

                        return (
                          <div
                            key={storageType}
                            className={`rounded-lg border p-3 transition-colors ${
                              isSelected ? "border-primary bg-primary/5" : "border-muted"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={toggleStorageType}
                                data-testid={`checkbox-storage-${storageType.toLowerCase().replace(/\s+/g, "-")}`}
                              />
                              <span className="font-medium text-sm flex-1">{storageType}</span>
                              {isSelected && (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    placeholder="Capacity"
                                    className="w-20 h-8 text-xs text-center placeholder:text-xs"
                                    value={existingConfig?.unitCount ?? ""}
                                    onChange={(e) => updateConfig("unitCount", e.target.value)}
                                    data-testid={`input-units-${storageType.toLowerCase().replace(/\s+/g, "-")}`}
                                  />
                                  <Input
                                    type="text"
                                    placeholder="Occ. %"
                                    className="w-16 h-8 text-xs text-center placeholder:text-xs"
                                    value={existingConfig?.targetOccupancy ?? ""}
                                    onChange={(e) => updateConfig("targetOccupancy", e.target.value)}
                                    data-testid={`input-occupancy-${storageType.toLowerCase().replace(/\s+/g, "-")}`}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="includeInExecutive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-include-executive"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="cursor-pointer">
                            Include in Executive Dashboard
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Show this project in executive-level analytics and reports
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t">
                {addDialogStep === 1 && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setAddDialogOpen(false)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        if (linkType === 'deal') {
                          if (selectedDeal) {
                            form.setValue('dealId', selectedDeal.id);
                            form.setValue('propertyId', undefined);
                            setAddDialogStep(2);
                          }
                        } else if (linkType === 'property') {
                          if (selectedProperty) {
                            form.setValue('propertyId', selectedProperty.id);
                            form.setValue('dealId', undefined);
                            setAddDialogStep(2);
                          }
                        } else {
                          const name = form.getValues("name");
                          if (name.trim()) {
                            form.setValue('dealId', undefined);
                            form.setValue('propertyId', undefined);
                            setAddDialogStep(2);
                          } else {
                            form.setError("name", { message: "Project name is required" });
                          }
                        }
                      }}
                      disabled={
                        (linkType === 'deal' && !selectedDeal) ||
                        (linkType === 'property' && !selectedProperty) ||
                        (linkType === 'new' && !form.watch("name").trim())
                      }
                      data-testid="button-next-step"
                      className="gap-1"
                    >
                      Continue
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}

                {addDialogStep === 2 && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setAddDialogStep(1);
                        setSelectedDeal(null);
                        setSelectedProperty(null);
                        form.setValue('name', '');
                        form.setValue('dealId', undefined);
                        form.setValue('propertyId', undefined);
                      }}
                      data-testid="button-back"
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setAddDialogStep(3)}
                      data-testid="button-next-step"
                      className="gap-1"
                    >
                      Continue
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}

                {addDialogStep === 3 && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setAddDialogStep(2)}
                      data-testid="button-back"
                      disabled={createProjectMutation.isPending}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={createProjectMutation.isPending || isCheckingDuplicate || !isStep3Valid()}
                      data-testid="button-create"
                      className="gap-1"
                    >
                      {(createProjectMutation.isPending || isCheckingDuplicate) && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isCheckingDuplicate ? "Checking..." : createProjectMutation.isPending ? "Creating..." : "Create Project"}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Duplicate Project Warning Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent data-testid="dialog-duplicate-warning" className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <DialogTitle data-testid="text-duplicate-title">
                Project Already Exists
              </DialogTitle>
            </div>
            <DialogDescription data-testid="text-duplicate-description" className="text-left">
              A project named <strong>"{duplicateInfo?.name}"</strong> already exists.
              {canModifyDuplicate 
                ? " What would you like to do?"
                : " This project belongs to another organization. You can only choose a different name."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={handleDuplicateRename}
              data-testid="button-duplicate-rename"
            >
              <FileEdit className="h-5 w-5 text-muted-foreground" />
              <div className="text-left">
                <div className="font-medium">Rename</div>
                <div className="text-sm text-muted-foreground">Choose a different name for the new project</div>
              </div>
            </Button>
            
            {canModifyDuplicate && (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3"
                  onClick={handleDuplicateMerge}
                  data-testid="button-duplicate-merge"
                >
                  <GitMerge className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <div className="font-medium">Add to Existing</div>
                    <div className="text-sm text-muted-foreground">Open the existing project and import data there</div>
                  </div>
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3 border-destructive/50 hover:bg-destructive/5"
                  onClick={handleDuplicateReplace}
                  disabled={isReplacing}
                  data-testid="button-duplicate-replace"
                >
                  <Trash2 className="h-5 w-5 text-destructive" />
                  <div className="text-left">
                    <div className="font-medium text-destructive">Replace</div>
                    <div className="text-sm text-muted-foreground">Delete the existing project and create a new one</div>
                  </div>
                  {isReplacing && (
                    <Loader2 className="ml-auto h-4 w-4 animate-spin" />
                  )}
                </Button>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={handleDuplicateCancel}
              disabled={isReplacing}
              data-testid="button-duplicate-cancel"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{projectToDelete?.name}</strong>? 
              This will permanently delete the project and erase all associated data including leases, tenants, cash flows, and snapshots. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Project"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
