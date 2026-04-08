import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FolderKanban, 
  Plus, 
  Search, 
  Building2,
  MapPin,
  Calendar,
  Users,
  DollarSign,
  ChevronRight,
  MoreVertical,
  Trash2,
  Edit,
  Eye,
  Settings,
  Sun,
  Snowflake,
  Anchor,
  X
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";

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
  "Carport",
  "RV Site",
  "Other"
] as const;

type StorageMixItem = {
  type: string;
  capacity: number;
};

function generateProjectCode(name: string, existingCodes: string[]): string {
  if (!name) return "";
  const words = name.trim().split(/\s+/);
  const initials = words
    .map(word => word.charAt(0).toUpperCase())
    .filter(char => /[A-Z]/.test(char))
    .slice(0, 3)
    .join("");
  if (!initials) return "";
  
  const prefix = `${initials}-`;
  const existingNumbers = existingCodes
    .filter(code => code && code.startsWith(prefix))
    .map(code => {
      const numPart = code.slice(prefix.length);
      return parseInt(numPart, 10);
    })
    .filter(n => !isNaN(n));
  
  const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  return `${initials}-${String(nextNum).padStart(3, '0')}`;
}

type RRAProject = {
  id: string;
  name: string;
  code?: string;
  description: string | null;
  status: string;
  projectType: string;
  seasonType: string;
  capacity?: number;
  isActive: boolean;
  targetNOI?: string;
  includeInExecutive: boolean;
  seasonStartDate?: string;
  seasonEndDate?: string;
  winterStartDate?: string;
  winterEndDate?: string;
  budgetedRevenue?: string;
  budgetedOccupancy?: string;
  budgetedExpenses?: string;
  budgetYear?: number;
  storageMix?: StorageMixItem[];
  baseRent1Label?: string;
  baseRent2Label?: string;
  baseRent3Label?: string;
  charge1Label?: string;
  charge2Label?: string;
  charge3Label?: string;
  locationCount: number;
  totalUnits: number;
  occupiedUnits: number;
  totalGrossRent: number;
  tenantCount: number;
};

const storageMixSchema = z.array(z.object({
  type: z.string(),
  capacity: z.number().min(0),
}));

const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  code: z.string().optional(),
  description: z.string().optional(),
  projectType: z.string().default("OWNED"),
  seasonType: z.string().default("ANNUAL"),
  storageMix: storageMixSchema.default([]),
  targetNOI: z.string().optional(),
  includeInExecutive: z.boolean().default(true),
  seasonStartDate: z.string().optional(),
  seasonEndDate: z.string().optional(),
  winterStartDate: z.string().optional(),
  winterEndDate: z.string().optional(),
  budgetedRevenue: z.string().optional(),
  budgetedOccupancy: z.string().optional(),
  budgetedExpenses: z.string().optional(),
  budgetYear: z.string().optional(),
  baseRent1Label: z.string().default("Base Rent 1"),
  baseRent2Label: z.string().default("Base Rent 2"),
  baseRent3Label: z.string().default("Base Rent 3"),
  charge1Label: z.string().default("Charge 1"),
  charge2Label: z.string().default("Charge 2"),
  charge3Label: z.string().default("Charge 3"),
});

type ProjectFormData = z.infer<typeof projectFormSchema>;

function ProjectCard({ project, onDelete, onEdit }: { project: RRAProject; onDelete: (id: string) => void; onEdit: (project: RRAProject) => void }) {
  const occupancyRate = project.totalUnits > 0 
    ? ((project.occupiedUnits / project.totalUnits) * 100).toFixed(1)
    : '0';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-600 border-green-200';
      case 'draft': return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
      case 'archived': return 'bg-gray-500/10 text-gray-600 border-gray-200';
      default: return 'bg-blue-500/10 text-blue-600 border-blue-200';
    }
  };

  const getProjectTypeLabel = (type: string) => {
    switch (type) {
      case 'OWNED': return 'Owned';
      case 'UNDERWRITING': return 'Underwriting';
      case 'DEVELOPMENT': return 'Development';
      case 'DEAL': return 'Deal';
      default: return type;
    }
  };

  const getSeasonTypeIcon = (type: string) => {
    return type === 'SEASONAL' ? <Sun className="h-3 w-3" /> : <Calendar className="h-3 w-3" />;
  };

  return (
    <Card className="hover:shadow-md transition-shadow" data-testid={`project-card-${project.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FolderKanban className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{project.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {project.code && (
                  <span className="text-xs text-muted-foreground font-mono">{project.code}</span>
                )}
                <Badge variant="outline" className="text-xs">
                  {getProjectTypeLabel(project.projectType)}
                </Badge>
                <Badge variant="secondary" className="text-xs flex items-center gap-1">
                  {getSeasonTypeIcon(project.seasonType)}
                  {project.seasonType === 'SEASONAL' ? 'Seasonal' : 'Annual'}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(project.status || 'active')} variant="outline">
              {project.status || 'active'}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`btn-project-menu-${project.id}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <Link href={`/operations/rent-roll/projects/${project.id}`}>
                  <DropdownMenuItem data-testid={`menu-view-${project.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuItem onClick={() => onEdit(project)} data-testid={`menu-edit-${project.id}`}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Project
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => onDelete(project.id)}
                  data-testid={`menu-delete-${project.id}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {project.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {project.description}
          </p>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              <span className="font-medium">{project.capacity || project.totalUnits || 0}</span> slips
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              <span className="font-medium">{project.occupiedUnits || 0}</span> occupied
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              <span className="font-medium">{project.tenantCount || 0}</span> tenants
            </span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {formatCurrency(project.totalGrossRent || 0)}/mo
            </span>
          </div>
        </div>

        {project.targetNOI && (
          <div className="flex items-center gap-2 mb-4 p-2 bg-muted/50 rounded-lg">
            <span className="text-xs text-muted-foreground">Target NOI:</span>
            <span className="text-sm font-medium">{formatCurrency(parseFloat(project.targetNOI))}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm">
            <span className="text-muted-foreground">Occupancy: </span>
            <span className="font-medium">{occupancyRate}%</span>
          </div>
          <Link href={`/operations/rent-roll/projects/${project.id}`}>
            <Button variant="ghost" size="sm" data-testid={`btn-view-project-${project.id}`}>
              Open
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function LocationFormDrawer({ 
  open, 
  onOpenChange,
  editProject,
  onSuccess,
  existingCodes
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProject?: RRAProject | null;
  onSuccess: () => void;
  existingCodes: string[];
}) {
  const { toast } = useToast();
  
  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: editProject?.name || "",
      code: editProject?.code || "",
      description: editProject?.description || "",
      projectType: editProject?.projectType || "OWNED",
      seasonType: editProject?.seasonType || "ANNUAL",
      storageMix: editProject?.storageMix || [],
      targetNOI: editProject?.targetNOI || "",
      includeInExecutive: editProject?.includeInExecutive ?? true,
      seasonStartDate: editProject?.seasonStartDate || "",
      seasonEndDate: editProject?.seasonEndDate || "",
      winterStartDate: editProject?.winterStartDate || "",
      winterEndDate: editProject?.winterEndDate || "",
      budgetedRevenue: editProject?.budgetedRevenue || "",
      budgetedOccupancy: editProject?.budgetedOccupancy || "",
      budgetedExpenses: editProject?.budgetedExpenses || "",
      budgetYear: editProject?.budgetYear?.toString() || new Date().getFullYear().toString(),
      baseRent1Label: editProject?.baseRent1Label || "Base Rent 1",
      baseRent2Label: editProject?.baseRent2Label || "Base Rent 2",
      baseRent3Label: editProject?.baseRent3Label || "Base Rent 3",
      charge1Label: editProject?.charge1Label || "Charge 1",
      charge2Label: editProject?.charge2Label || "Charge 2",
      charge3Label: editProject?.charge3Label || "Charge 3",
    },
  });

  const seasonType = form.watch("seasonType");
  const storageMix = form.watch("storageMix");
  const projectName = form.watch("name");
  const summerEndDate = form.watch("seasonEndDate");
  const summerStartDate = form.watch("seasonStartDate");

  // Reset form when editProject changes (switching between create/edit or different projects)
  useEffect(() => {
    if (open) {
      form.reset({
        name: editProject?.name || "",
        code: editProject?.code || "",
        description: editProject?.description || "",
        projectType: editProject?.projectType || "OWNED",
        seasonType: editProject?.seasonType || "ANNUAL",
        storageMix: editProject?.storageMix || [],
        targetNOI: editProject?.targetNOI || "",
        includeInExecutive: editProject?.includeInExecutive ?? true,
        seasonStartDate: editProject?.seasonStartDate || "",
        seasonEndDate: editProject?.seasonEndDate || "",
        winterStartDate: editProject?.winterStartDate || "",
        winterEndDate: editProject?.winterEndDate || "",
        budgetedRevenue: editProject?.budgetedRevenue || "",
        budgetedOccupancy: editProject?.budgetedOccupancy || "",
        budgetedExpenses: editProject?.budgetedExpenses || "",
        budgetYear: editProject?.budgetYear?.toString() || new Date().getFullYear().toString(),
        baseRent1Label: editProject?.baseRent1Label || "Base Rent 1",
        baseRent2Label: editProject?.baseRent2Label || "Base Rent 2",
        baseRent3Label: editProject?.baseRent3Label || "Base Rent 3",
        charge1Label: editProject?.charge1Label || "Charge 1",
        charge2Label: editProject?.charge2Label || "Charge 2",
        charge3Label: editProject?.charge3Label || "Charge 3",
      });
    }
  }, [open, editProject]);

  useEffect(() => {
    if (!editProject && projectName && !form.getValues("code")) {
      const generatedCode = generateProjectCode(projectName, existingCodes);
      if (generatedCode) {
        form.setValue("code", generatedCode);
      }
    }
  }, [projectName, editProject, existingCodes]);

  useEffect(() => {
    if (summerEndDate && summerStartDate) {
      const endDate = new Date(summerEndDate);
      const startDate = new Date(summerStartDate);
      
      const winterStart = new Date(endDate);
      winterStart.setDate(winterStart.getDate() + 1);
      
      const winterEnd = new Date(startDate);
      winterEnd.setDate(winterEnd.getDate() - 1);
      if (winterEnd <= winterStart) {
        winterEnd.setFullYear(winterEnd.getFullYear() + 1);
      }
      
      form.setValue("winterStartDate", winterStart.toISOString().split('T')[0]);
      form.setValue("winterEndDate", winterEnd.toISOString().split('T')[0]);
    }
  }, [summerEndDate, summerStartDate]);

  const totalCapacity = storageMix.reduce((sum, item) => sum + (item.capacity || 0), 0);

  const addStorageType = (type: string) => {
    const current = form.getValues("storageMix");
    if (!current.find(item => item.type === type)) {
      form.setValue("storageMix", [...current, { type, capacity: 0 }]);
    }
  };

  const removeStorageType = (type: string) => {
    const current = form.getValues("storageMix");
    form.setValue("storageMix", current.filter(item => item.type !== type));
  };

  const updateStorageCapacity = (type: string, capacity: number) => {
    const current = form.getValues("storageMix");
    form.setValue("storageMix", current.map(item => 
      item.type === type ? { ...item, capacity } : item
    ));
  };

  const saveMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const totalCap = data.storageMix.reduce((sum, item) => sum + (item.capacity || 0), 0);
      const payload = {
        ...data,
        capacity: totalCap || null,
        storageMix: data.storageMix,
        budgetYear: data.budgetYear ? parseInt(data.budgetYear) : null,
        targetNOI: data.targetNOI || null,
        budgetedRevenue: data.budgetedRevenue || null,
        budgetedExpenses: data.budgetedExpenses || null,
        budgetedOccupancy: data.budgetedOccupancy || null,
        status: editProject?.status || 'active',
      };
      if (editProject) {
        const res = await apiRequest('PATCH', `/api/rent-roll/projects/${editProject.id}`, payload);
        return res.json();
      }
      const res = await apiRequest('POST', '/api/rent-roll/projects', payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: editProject ? "Project updated successfully" : "Project created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/projects'] });
      form.reset();
      onOpenChange(false);
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: editProject ? "Failed to update project" : "Failed to create project",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProjectFormData) => {
    saveMutation.mutate(data);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[650px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editProject ? "Edit Marina Project" : "Create Marina Project"}</SheetTitle>
          <SheetDescription>
            {editProject 
              ? "Update the project details including seasons, capacity, and budget information." 
              : "Create a new rent roll project to organize and analyze lease data."
            }
          </SheetDescription>
        </SheetHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="storage">Storage</TabsTrigger>
                <TabsTrigger value="seasons">Seasons</TabsTrigger>
                <TabsTrigger value="labels">Labels</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Marina Bay" {...field} data-testid="input-project-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Code</FormLabel>
                      <FormControl>
                        <Input placeholder="Auto-generated from name" {...field} data-testid="input-project-code" />
                      </FormControl>
                      <FormDescription>Auto-generated. Edit if needed.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Brief description of this marina project..."
                          {...field}
                          data-testid="input-project-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="projectType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-project-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="OWNED">Owned</SelectItem>
                            <SelectItem value="UNDERWRITING">Underwriting</SelectItem>
                            <SelectItem value="DEVELOPMENT">Development</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="seasonType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Season Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-season-type">
                              <SelectValue placeholder="Select season type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ANNUAL">Annual (Year-Round)</SelectItem>
                            <SelectItem value="SEASONAL">Seasonal</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <FormLabel>Include in Executive Dashboard</FormLabel>
                    <FormDescription>
                      Show this project in portfolio-wide analytics and summaries
                    </FormDescription>
                  </div>
                  <FormField
                    control={form.control}
                    name="includeInExecutive"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-include-executive"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="seasons" className="space-y-4 mt-4">
                {seasonType === 'SEASONAL' ? (
                  <>
                    <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Sun className="h-5 w-5 text-blue-600" />
                        <h3 className="font-medium text-blue-900 dark:text-blue-100">Summer Season</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="seasonStartDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-season-start" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="seasonEndDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-season-end" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Snowflake className="h-5 w-5 text-slate-600" />
                        <h3 className="font-medium text-slate-900 dark:text-slate-100">Winter Season</h3>
                        <span className="text-xs text-muted-foreground">(Auto-calculated from Summer)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="winterStartDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-winter-start" className="bg-muted/50" readOnly />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="winterEndDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-winter-end" className="bg-muted/50" readOnly />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Season dates are only available for seasonal projects.</p>
                    <p className="text-sm mt-2">Change the project to "Seasonal" type to configure seasons.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="storage" className="space-y-4 mt-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Anchor className="h-5 w-5 text-primary" />
                    <h3 className="font-medium">Storage Types</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Select the storage types available at this marina and specify capacity for each.
                  </p>
                  
                  <div className="space-y-3">
                    {STORAGE_TYPES.map((type) => {
                      const isSelected = storageMix.some(item => item.type === type);
                      const currentCapacity = storageMix.find(item => item.type === type)?.capacity || 0;
                      
                      return (
                        <div key={type} className="flex items-center gap-3">
                          <Checkbox
                            id={`storage-${type}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                addStorageType(type);
                              } else {
                                removeStorageType(type);
                              }
                            }}
                          />
                          <label 
                            htmlFor={`storage-${type}`}
                            className="flex-1 text-sm font-medium cursor-pointer"
                          >
                            {type}
                          </label>
                          {isSelected && (
                            <Input
                              type="number"
                              min="0"
                              value={currentCapacity || ""}
                              onChange={(e) => updateStorageCapacity(type, parseInt(e.target.value) || 0)}
                              className="w-24 h-8"
                              placeholder="Qty"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Total Capacity</p>
                      <p className="text-sm text-muted-foreground">Sum of all storage types</p>
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      {totalCapacity.toLocaleString()}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="labels" className="space-y-4 mt-4">
                <div className="p-4 bg-muted/50 rounded-lg mb-4">
                  <p className="text-sm text-muted-foreground">
                    Customize the labels for rent and charge columns used in this project's rent roll.
                    These labels will appear in reports and exports.
                  </p>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Base Rent Labels
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="baseRent1Label"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rent Column 1</FormLabel>
                          <FormControl>
                            <Input placeholder="Base Rent 1" {...field} data-testid="input-rent-label-1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="baseRent2Label"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rent Column 2</FormLabel>
                          <FormControl>
                            <Input placeholder="Base Rent 2" {...field} data-testid="input-rent-label-2" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="baseRent3Label"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rent Column 3</FormLabel>
                          <FormControl>
                            <Input placeholder="Base Rent 3" {...field} data-testid="input-rent-label-3" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Charge Labels
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="charge1Label"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Charge Column 1</FormLabel>
                          <FormControl>
                            <Input placeholder="Charge 1" {...field} data-testid="input-charge-label-1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="charge2Label"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Charge Column 2</FormLabel>
                          <FormControl>
                            <Input placeholder="Charge 2" {...field} data-testid="input-charge-label-2" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="charge3Label"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Charge Column 3</FormLabel>
                          <FormControl>
                            <Input placeholder="Charge 3" {...field} data-testid="input-charge-label-3" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="btn-submit-project">
                {saveMutation.isPending ? "Saving..." : editProject ? "Update Project" : "Create Project"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

export default function RentRollProjects() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<RRAProject | null>(null);
  const { toast } = useToast();

  const { data: projects, isLoading, error } = useQuery<RRAProject[]>({
    queryKey: ['/api/rent-roll/projects'],
    staleTime: 30 * 1000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/rent-roll/projects/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Project deleted" });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/projects'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete project",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (project: RRAProject) => {
    setEditingProject(project);
    setFormDrawerOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredProjects = (projects || []).filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.description?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (project.code?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    const matchesType = typeFilter === "all" || project.projectType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-rent-roll-projects">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="heading-rent-roll-projects">
            Marina Projects
          </h1>
          <p className="text-muted-foreground" data-testid="description-rent-roll-projects">
            Manage and analyze rent rolls organized by marina or acquisition project.
          </p>
        </div>
        <Button 
          onClick={() => { setEditingProject(null); setFormDrawerOpen(true); }} 
          data-testid="btn-create-project"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-projects"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-type-filter">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="OWNED">Owned</SelectItem>
            <SelectItem value="UNDERWRITING">Underwriting</SelectItem>
            <SelectItem value="DEVELOPMENT">Development</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="py-8 text-center">
            <p className="text-destructive">Failed to load projects. Please try again.</p>
          </CardContent>
        </Card>
      ) : filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderKanban className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery || statusFilter !== "all" || typeFilter !== "all" ? "No matching projects" : "No projects yet"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || statusFilter !== "all" || typeFilter !== "all"
                ? "Try adjusting your search or filter criteria."
                : "Create your first marina project to get started."}
            </p>
            {!searchQuery && statusFilter === "all" && typeFilter === "all" && (
              <Button onClick={() => setFormDrawerOpen(true)} data-testid="btn-create-first-project">
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard 
              key={project.id} 
              project={project} 
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      <LocationFormDrawer 
        open={formDrawerOpen}
        onOpenChange={setFormDrawerOpen}
        editProject={editingProject}
        onSuccess={() => { setEditingProject(null); }}
        existingCodes={(projects || []).map(p => p.code).filter((c): c is string => !!c)}
      />
    </div>
  );
}
