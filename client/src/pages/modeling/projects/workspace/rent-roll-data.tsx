import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Anchor,
  Link2,
  Unlink,
  ExternalLink,
  RefreshCcw,
  TrendingUp,
  DollarSign,
  Users,
  Building2,
  Ship,
  Plus,
  AlertTriangle,
  Loader2,
  BarChart3,
  ArrowRight,
  Edit2,
  Trash2,
  Download,
  FileSpreadsheet,
  Database
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

interface RentRollDataTabProps {
  projectId: string;
  projectName?: string;
}

interface RentRollConfig {
  id: string;
  dataSourceMode: 'standalone' | 'linked' | 'hybrid';
  linkedRraLocationId?: string;
  assumedOccupancyRate: string;
  assumedAnnualRentGrowth: string;
  lastSyncAt?: string;
}

interface RentRollUnit {
  id: string;
  unitNumber: string;
  storageType: string;
  status: string;
  length?: string;
  width?: string;
  monthlyRent: string;
  annualRent?: string;
  tenantName?: string;
  boatName?: string;
  boatType?: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  isMonthToMonth?: boolean;
  electricCharge?: string;
  waterCharge?: string;
  otherCharges?: string;
  dock?: string;
  section?: string;
  notes?: string;
}

interface RentRollMetrics {
  dataSourceMode: string;
  occupancyRate: number;
  totalUnits: number;
  occupiedUnits: number;
  totalAnnualRevenue: number;
  totalMonthlyRevenue: number;
  averageRentPerUnit: number;
  activeLeaseCount: number;
  expiringLeases90Days: number;
  unitsByType: Record<string, { count: number; totalRent: number }>;
  assumedOccupancyRate: number;
  assumedAnnualRentGrowth: number;
}

interface RraLocation {
  id: string;
  name: string;
  code?: string;
  totalSlips?: number;
}

interface LinkedRraLocation {
  id: string;
  linkId: string;
  name: string;
  code?: string;
  capacity?: number;
  totalUnits?: number;
  isPrimary: boolean;
  syncEnabled: boolean;
  lastSyncAt?: string;
}

const unitFormSchema = z.object({
  unitNumber: z.string().min(1, "Unit number is required"),
  storageType: z.string().default("Wet Slip"),
  status: z.string().default("occupied"),
  monthlyRent: z.string().default("0"),
  length: z.string().optional(),
  width: z.string().optional(),
  tenantName: z.string().optional(),
  boatType: z.string().optional(),
  dock: z.string().optional(),
  section: z.string().optional(),
  leaseStartDate: z.string().optional(),
  leaseEndDate: z.string().optional(),
  isMonthToMonth: z.boolean().optional(),
  electricCharge: z.string().optional(),
  waterCharge: z.string().optional(),
  otherCharges: z.string().optional(),
  notes: z.string().optional(),
});

type UnitFormValues = z.infer<typeof unitFormSchema>;

const storageTypes = [
  "Wet Slip",
  "Dry Storage", 
  "Dry Rack",
  "Dry Stack",
  "Mooring",
  "Trailer Storage",
  "Lift Storage",
  "Other"
];

const statusOptions = [
  { value: "occupied", label: "Occupied" },
  { value: "vacant", label: "Vacant" },
  { value: "reserved", label: "Reserved" },
  { value: "maintenance", label: "Maintenance" },
];

export default function RentRollDataTab({ projectId, projectName }: RentRollDataTabProps) {
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<RentRollUnit | null>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importLocationId, setImportLocationId] = useState<string | null>(null);
  const [linkedLocationId, setLinkedLocationId] = useState<string | null>(null);

  const { data: config, isLoading: configLoading } = useQuery<RentRollConfig>({
    queryKey: ['/api/modeling-rent-roll/projects', projectId, 'config'],
  });

  const mode = (config?.dataSourceMode === 'linked' ? 'linked' : 'standalone') as 'standalone' | 'linked';

  const { data: units = [], isLoading: unitsLoading } = useQuery<RentRollUnit[]>({
    queryKey: ['/api/modeling-rent-roll/projects', projectId, 'units'],
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery<RentRollMetrics>({
    queryKey: ['/api/modeling-rent-roll/projects', projectId, 'metrics'],
  });

  const { data: availableRraLocations = [] } = useQuery<RraLocation[]>({
    queryKey: ['/api/modeling-rent-roll/available-rra-locations'],
  });

  const { data: linkedLocations = [], isLoading: locationsLoading } = useQuery<LinkedRraLocation[]>({
    queryKey: ['/api/rent-roll/modeling-projects', projectId, 'rra-locations'],
  });

  const effectiveLocationId = linkedLocationId || linkedLocations[0]?.id;

  const { data: linkedMetrics, isLoading: linkedMetricsLoading } = useQuery<RentRollMetrics>({
    queryKey: ['/api/rent-roll/locations', effectiveLocationId, 'metrics-for-modeling'],
    enabled: mode === 'linked' && !!effectiveLocationId,
  });

  const { data: linkedLeases = [] } = useQuery<any[]>({
    queryKey: ['/api/rent-roll/leases', { projectId: effectiveLocationId }],
    enabled: mode === 'linked' && !!effectiveLocationId,
  });

  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: {
      unitNumber: '',
      storageType: 'Wet Slip',
      status: 'occupied',
      monthlyRent: '0',
      isMonthToMonth: false,
    },
  });

  const createUnitMutation = useMutation({
    mutationFn: (data: UnitFormValues) =>
      apiRequest(`/api/modeling-rent-roll/projects/${projectId}/units`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling-rent-roll/projects', projectId, 'units'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling-rent-roll/projects', projectId, 'metrics'] });
      toast({ title: "Unit Added", description: "New rent roll unit has been added." });
      setIsAddUnitOpen(false);
      form.reset();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to add unit.", variant: "destructive" });
    }
  });

  const updateUnitMutation = useMutation({
    mutationFn: ({ unitId, data }: { unitId: string; data: Partial<UnitFormValues> }) =>
      apiRequest(`/api/modeling-rent-roll/projects/${projectId}/units/${unitId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling-rent-roll/projects', projectId, 'units'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling-rent-roll/projects', projectId, 'metrics'] });
      toast({ title: "Updated", description: "Unit has been updated." });
      setEditingUnit(null);
      form.reset();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update unit.", variant: "destructive" });
    }
  });

  const deleteUnitMutation = useMutation({
    mutationFn: (unitId: string) =>
      apiRequest(`/api/modeling-rent-roll/projects/${projectId}/units/${unitId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling-rent-roll/projects', projectId, 'units'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling-rent-roll/projects', projectId, 'metrics'] });
      toast({ title: "Deleted", description: "Unit has been removed." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to delete unit.", variant: "destructive" });
    }
  });

  const importFromRraMutation = useMutation({
    mutationFn: (rraLocationId: string) =>
      apiRequest(`/api/modeling-rent-roll/projects/${projectId}/import-from-rra/${rraLocationId}`, {
        method: 'POST',
        body: JSON.stringify({ clearExisting: true }),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling-rent-roll/projects', projectId, 'units'] });
      queryClient.invalidateQueries({ queryKey: ['/api/modeling-rent-roll/projects', projectId, 'metrics'] });
      toast({ 
        title: "Import Complete", 
        description: `Imported ${data.importedCount} units from ${data.sourceLocation}.` 
      });
      setIsImportDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Import Failed", description: err.message || "Failed to import.", variant: "destructive" });
    }
  });

  const linkMutation = useMutation({
    mutationFn: (rraLocationId: string) =>
      apiRequest('/api/rent-roll/modeling-links', {
        method: 'POST',
        body: JSON.stringify({ rraLocationId, modelingProjectId: projectId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/modeling-projects', projectId, 'rra-locations'] });
      toast({ title: "Linked", description: "RRA location linked to this modeling project." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to link.", variant: "destructive" });
    }
  });

  const syncMutation = useMutation({
    mutationFn: (linkId: string) =>
      apiRequest(`/api/rent-roll/modeling-links/${linkId}/sync`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/locations', effectiveLocationId, 'metrics-for-modeling'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/leases'] });
      toast({ title: "Synced", description: "RRA data synced to modeling assumptions." });
    }
  });

  const updateConfigMutation = useMutation({
    mutationFn: (data: { dataSourceMode: string }) =>
      apiRequest(`/api/modeling-rent-roll/projects/${projectId}/config`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/modeling-rent-roll/projects', projectId, 'config'] });
    }
  });

  const handleModeChange = (newMode: string) => {
    updateConfigMutation.mutate({ dataSourceMode: newMode });
  };

  const handleSubmit = (data: UnitFormValues) => {
    if (editingUnit) {
      updateUnitMutation.mutate({ unitId: editingUnit.id, data });
    } else {
      createUnitMutation.mutate(data);
    }
  };

  const openEditDialog = (unit: RentRollUnit) => {
    setEditingUnit(unit);
    form.reset({
      unitNumber: unit.unitNumber,
      storageType: unit.storageType,
      status: unit.status,
      monthlyRent: unit.monthlyRent,
      length: unit.length || '',
      width: unit.width || '',
      tenantName: unit.tenantName || '',
      boatType: unit.boatType || '',
      dock: unit.dock || '',
      section: unit.section || '',
      leaseStartDate: unit.leaseStartDate || '',
      leaseEndDate: unit.leaseEndDate || '',
      isMonthToMonth: unit.isMonthToMonth || false,
      electricCharge: unit.electricCharge || '',
      waterCharge: unit.waterCharge || '',
      otherCharges: unit.otherCharges || '',
      notes: unit.notes || '',
    });
  };

  if (configLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Anchor className="h-5 w-5" />
                Storage Rent Roll Data
              </CardTitle>
              <CardDescription>
                Enter rent roll data for property evaluation or link to existing portfolio data
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={mode} onValueChange={handleModeChange} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="standalone" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Standalone Entry
              </TabsTrigger>
              <TabsTrigger value="linked" className="gap-2">
                <Database className="h-4 w-4" />
                Link from Portfolio
              </TabsTrigger>
            </TabsList>

            <TabsContent value="standalone" className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Enter rent roll data manually for new properties you're evaluating. 
                  This data is specific to this modeling project and won't affect your portfolio.
                </p>
                <div className="flex gap-2">
                  <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={availableRraLocations.length === 0}>
                        <Download className="h-4 w-4 mr-2" />
                        Import from Portfolio
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Import from Portfolio</DialogTitle>
                        <DialogDescription>
                          Copy rent roll data from an existing portfolio location as a starting point.
                          This will replace any existing units in this project.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <Label>Select Portfolio Location</Label>
                        <Select
                          value={importLocationId || ''}
                          onValueChange={setImportLocationId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a location..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRraLocations.map((loc) => (
                              <SelectItem key={loc.id} value={loc.id}>
                                {loc.name} {loc.totalSlips ? `(${loc.totalSlips} slips)` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button 
                          onClick={() => importLocationId && importFromRraMutation.mutate(importLocationId)}
                          disabled={!importLocationId || importFromRraMutation.isPending}
                        >
                          {importFromRraMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Import
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isAddUnitOpen || !!editingUnit} onOpenChange={(open) => {
                    if (!open) {
                      setIsAddUnitOpen(false);
                      setEditingUnit(null);
                      form.reset();
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button onClick={() => setIsAddUnitOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Unit
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{editingUnit ? 'Edit Unit' : 'Add New Unit'}</DialogTitle>
                        <DialogDescription>
                          {editingUnit ? 'Update the unit details.' : 'Enter details for the new rent roll unit.'}
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="unitNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Unit Number *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="e.g., A-101" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="storageType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Storage Type</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {storageTypes.map((type) => (
                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="status"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Status</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {statusOptions.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="monthlyRent"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Monthly Rent ($)</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="length"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Length (ft)</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.1" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="width"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Width (ft)</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.1" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="dock"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Dock</FormLabel>
                                  <FormControl>
                                    <Input placeholder="e.g., A, B, C" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="section"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Section</FormLabel>
                                  <FormControl>
                                    <Input placeholder="e.g., North, South" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="tenantName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Tenant Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="boatType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Boat Type</FormLabel>
                                  <FormControl>
                                    <Input placeholder="e.g., Sailboat, Motor Yacht" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="electricCharge"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Electric Charge ($)</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="waterCharge"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Water Charge ($)</FormLabel>
                                  <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => {
                              setIsAddUnitOpen(false);
                              setEditingUnit(null);
                              form.reset();
                            }}>
                              Cancel
                            </Button>
                            <Button type="submit" disabled={createUnitMutation.isPending || updateUnitMutation.isPending}>
                              {(createUnitMutation.isPending || updateUnitMutation.isPending) && (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              )}
                              {editingUnit ? 'Update' : 'Add Unit'}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {metricsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : metrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Occupancy Rate</p>
                          <p className="text-2xl font-bold">{metrics.occupancyRate?.toFixed(1) || 0}%</p>
                        </div>
                        <div className={cn(
                          "p-2 rounded-full",
                          (metrics.occupancyRate || 0) >= 90 ? "bg-green-100 dark:bg-green-900" : 
                          (metrics.occupancyRate || 0) >= 70 ? "bg-yellow-100 dark:bg-yellow-900" : "bg-red-100 dark:bg-red-900"
                        )}>
                          <Ship className={cn(
                            "h-5 w-5",
                            (metrics.occupancyRate || 0) >= 90 ? "text-green-600" : 
                            (metrics.occupancyRate || 0) >= 70 ? "text-yellow-600" : "text-red-600"
                          )} />
                        </div>
                      </div>
                      <Progress value={metrics.occupancyRate || 0} className="h-2 mt-3" />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Occupied / Total Units</p>
                          <p className="text-2xl font-bold">{metrics.occupiedUnits || 0} / {metrics.totalUnits || 0}</p>
                        </div>
                        <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Annual Revenue</p>
                          <p className="text-2xl font-bold">{formatCurrency(metrics.totalAnnualRevenue || 0)}</p>
                        </div>
                        <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                          <DollarSign className="h-5 w-5 text-green-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Avg Rent/Unit</p>
                          <p className="text-2xl font-bold">{formatCurrency(metrics.averageRentPerUnit || 0)}</p>
                        </div>
                        <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900">
                          <BarChart3 className="h-5 w-5 text-purple-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Rent Roll Units</CardTitle>
                      <CardDescription>
                        {units.length} units entered for this property evaluation
                      </CardDescription>
                    </div>
                    {metrics?.expiringLeases90Days && metrics.expiringLeases90Days > 0 && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {metrics.expiringLeases90Days} expiring in 90 days
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {unitsLoading ? (
                    <Skeleton className="h-64" />
                  ) : units.length === 0 ? (
                    <div className="text-center py-12">
                      <Anchor className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <h3 className="font-semibold mb-2">No Units Entered</h3>
                      <p className="text-muted-foreground mb-4">
                        Add rent roll units to model this property's storage revenue.
                      </p>
                      <Button onClick={() => setIsAddUnitOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Unit
                      </Button>
                    </div>
                  ) : (
                    <div className="overflow-auto max-h-96">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Unit</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Dimensions</TableHead>
                            <TableHead>Monthly Rent</TableHead>
                            <TableHead>Tenant</TableHead>
                            <TableHead className="w-[80px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {units.map((unit) => (
                            <TableRow key={unit.id}>
                              <TableCell className="font-medium">{unit.unitNumber}</TableCell>
                              <TableCell>{unit.storageType}</TableCell>
                              <TableCell>
                                <Badge variant={unit.status === 'occupied' ? 'default' : 
                                  unit.status === 'vacant' ? 'secondary' : 'outline'}>
                                  {unit.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {unit.length && unit.width 
                                  ? `${unit.length}' x ${unit.width}'` 
                                  : unit.length ? `${unit.length}'` : '-'}
                              </TableCell>
                              <TableCell>{formatCurrency(parseFloat(unit.monthlyRent || '0'))}</TableCell>
                              <TableCell>{unit.tenantName || '-'}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8"
                                    onClick={() => openEditDialog(unit)}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => deleteUnitMutation.mutate(unit.id)}
                                    disabled={deleteUnitMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {units.length > 0 && metrics && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Apply to Modeling Assumptions
                    </CardTitle>
                    <CardDescription>
                      Use this rent roll data to update your modeling inputs
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Occupancy Rate</p>
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-semibold">{metrics.occupancyRate?.toFixed(1) || 0}%</p>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">→ Base case occupancy</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Total Units</p>
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-semibold">{metrics.totalUnits || 0}</p>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">→ Total storage units</p>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Annual Revenue</p>
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-semibold">{formatCurrency(metrics.totalAnnualRevenue || 0)}</p>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">→ Year 1 storage revenue</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="linked" className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Link to existing rent roll data from your Operations portfolio. 
                Use this when evaluating properties you already own.
              </p>

              {locationsLoading ? (
                <Skeleton className="h-32" />
              ) : linkedLocations.length === 0 ? (
                <div className="text-center py-8 border rounded-lg">
                  <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="font-semibold mb-2">No Portfolio Locations Linked</h3>
                  <p className="text-muted-foreground mb-4">
                    Link an RRA location from your Operations portfolio to import live data.
                  </p>
                  {availableRraLocations.length > 0 && (
                    <div className="space-y-2 max-w-md mx-auto">
                      {availableRraLocations.slice(0, 3).map((loc) => (
                        <div key={loc.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Anchor className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">{loc.name}</span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => linkMutation.mutate(loc.id)}
                            disabled={linkMutation.isPending}
                          >
                            {linkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
                            Link
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex gap-2 flex-wrap">
                    {linkedLocations.map((loc) => (
                      <Button
                        key={loc.id}
                        variant={linkedLocationId === loc.id || (!linkedLocationId && loc.id === linkedLocations[0]?.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => setLinkedLocationId(loc.id)}
                        className="gap-2"
                      >
                        <Ship className="h-4 w-4" />
                        {loc.name}
                        {loc.isPrimary && <Badge variant="secondary" className="ml-1">Primary</Badge>}
                      </Button>
                    ))}
                  </div>

                  {effectiveLocationId && (
                    <>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-5 w-5 text-blue-500" />
                          <div>
                            <p className="font-medium">{linkedLocations.find(l => l.id === effectiveLocationId)?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {linkedLocations.find(l => l.id === effectiveLocationId)?.syncEnabled ? 'Sync enabled' : 'Sync disabled'}
                              {linkedLocations.find(l => l.id === effectiveLocationId)?.lastSyncAt && 
                                ` • Last synced: ${new Date(linkedLocations.find(l => l.id === effectiveLocationId)?.lastSyncAt!).toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/operations/rent-roll/projects/${effectiveLocationId}`}>
                            <Button variant="outline" size="sm">
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Open RRA
                            </Button>
                          </Link>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              const link = linkedLocations.find(l => l.id === effectiveLocationId);
                              if (link?.linkId) syncMutation.mutate(link.linkId);
                            }}
                            disabled={syncMutation.isPending}
                          >
                            {syncMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
                            Sync Data
                          </Button>
                        </div>
                      </div>

                      {linkedMetricsLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
                        </div>
                      ) : linkedMetrics && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <Card>
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm text-muted-foreground">Occupancy Rate</p>
                                  <p className="text-2xl font-bold">{linkedMetrics.occupancyRate?.toFixed(1) || 0}%</p>
                                </div>
                                <div className={cn(
                                  "p-2 rounded-full",
                                  (linkedMetrics.occupancyRate || 0) >= 90 ? "bg-green-100 dark:bg-green-900" : 
                                  (linkedMetrics.occupancyRate || 0) >= 70 ? "bg-yellow-100 dark:bg-yellow-900" : "bg-red-100 dark:bg-red-900"
                                )}>
                                  <Ship className={cn(
                                    "h-5 w-5",
                                    (linkedMetrics.occupancyRate || 0) >= 90 ? "text-green-600" : 
                                    (linkedMetrics.occupancyRate || 0) >= 70 ? "text-yellow-600" : "text-red-600"
                                  )} />
                                </div>
                              </div>
                              <Progress value={linkedMetrics.occupancyRate || 0} className="h-2 mt-3" />
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm text-muted-foreground">Occupied / Total</p>
                                  <p className="text-2xl font-bold">{linkedMetrics.occupiedUnits || 0} / {linkedMetrics.totalUnits || 0}</p>
                                </div>
                                <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                                  <Users className="h-5 w-5 text-blue-600" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm text-muted-foreground">Annual Revenue</p>
                                  <p className="text-2xl font-bold">{formatCurrency(linkedMetrics.totalAnnualRevenue || 0)}</p>
                                </div>
                                <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                                  <DollarSign className="h-5 w-5 text-green-600" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm text-muted-foreground">Avg Rent/Unit</p>
                                  <p className="text-2xl font-bold">{formatCurrency(linkedMetrics.averageRentPerUnit || 0)}</p>
                                </div>
                                <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900">
                                  <BarChart3 className="h-5 w-5 text-purple-600" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle>Portfolio Leases</CardTitle>
                              <CardDescription>
                                {linkedLeases.length} active leases from linked portfolio location
                              </CardDescription>
                            </div>
                            {linkedMetrics?.expiringLeases90Days && linkedMetrics.expiringLeases90Days > 0 && (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {linkedMetrics.expiringLeases90Days} expiring in 90 days
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          {linkedLeases.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">No active leases found in portfolio</p>
                          ) : (
                            <div className="overflow-auto max-h-96">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Tenant</TableHead>
                                    <TableHead>Slip/Unit</TableHead>
                                    <TableHead>Monthly Rent</TableHead>
                                    <TableHead>Start Date</TableHead>
                                    <TableHead>End Date</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {linkedLeases.slice(0, 10).map((lease: any) => (
                                    <TableRow key={lease.id}>
                                      <TableCell className="font-medium">{lease.tenantName || 'Unknown'}</TableCell>
                                      <TableCell>{lease.slipNumber || lease.unitNumber || '-'}</TableCell>
                                      <TableCell>{formatCurrency(lease.monthlyRent || 0)}</TableCell>
                                      <TableCell>{lease.startDate ? new Date(lease.startDate).toLocaleDateString() : '-'}</TableCell>
                                      <TableCell>{lease.endDate ? new Date(lease.endDate).toLocaleDateString() : 'MTM'}</TableCell>
                                      <TableCell>
                                        <Badge variant={lease.status === 'active' ? 'default' : 'secondary'}>
                                          {lease.status}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                              {linkedLeases.length > 10 && (
                                <p className="text-sm text-muted-foreground text-center mt-4">
                                  Showing 10 of {linkedLeases.length} leases
                                </p>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {linkedMetrics && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <TrendingUp className="h-5 w-5" />
                              Apply Portfolio Data to Modeling
                            </CardTitle>
                            <CardDescription>
                              Use portfolio rent roll data to populate your modeling assumptions
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="p-4 border rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">Occupancy Rate</p>
                                <div className="flex items-center justify-between">
                                  <p className="text-lg font-semibold">{linkedMetrics.occupancyRate?.toFixed(1) || 0}%</p>
                                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">→ Base case occupancy</p>
                              </div>
                              <div className="p-4 border rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">Total Units</p>
                                <div className="flex items-center justify-between">
                                  <p className="text-lg font-semibold">{linkedMetrics.totalUnits || 0}</p>
                                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">→ Total storage units</p>
                              </div>
                              <div className="p-4 border rounded-lg">
                                <p className="text-sm text-muted-foreground mb-1">Annual Revenue</p>
                                <div className="flex items-center justify-between">
                                  <p className="text-lg font-semibold">{formatCurrency(linkedMetrics.totalAnnualRevenue || 0)}</p>
                                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">→ Year 1 storage revenue</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
