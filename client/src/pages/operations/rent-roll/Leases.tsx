import { useState, useMemo } from "react";
import { FileImportDrawer } from "@/components/rent-roll/FileImportDrawer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { 
  FileText, 
  Plus, 
  Search, 
  Users,
  Calendar,
  DollarSign,
  MoreVertical,
  Trash2,
  Edit,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Upload,
  Filter,
  X,
  Building2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";

type RRALease = {
  id: string;
  tenantId: string;
  tenantName?: string;
  locationId: string | null;
  locationName?: string;
  storageLocationId: string | null;
  storageLocationName?: string;
  leaseType: string;
  leaseStatus: string;
  startDate: string | null;
  endDate: string | null;
  baseRent: string | null;
  rentPeriod: string;
  discountType: string | null;
  discountValue: string | null;
  effectiveRent: string | null;
  notes: string | null;
  isActive: boolean;
  storageType: string | null;
  vessel: {
    name: string | null;
    length: string | null;
    beam: string | null;
    type: string | null;
  } | null;
  createdAt: string;
};

type RRATenant = {
  id: string;
  displayName: string;
  entityType: string;
  email?: string;
  phone?: string;
};

type RRALocation = {
  id: string;
  name: string;
  status: string;
};

const leaseFormSchema = z.object({
  tenantId: z.string().min(1, "Tenant is required"),
  locationId: z.string().optional(),
  leaseType: z.string().min(1, "Lease type is required"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  baseRent: z.string().optional(),
  rentPeriod: z.string().default("month"),
  discountType: z.string().optional(),
  discountValue: z.string().optional(),
  storageType: z.string().optional(),
  vesselName: z.string().optional(),
  vesselLength: z.string().optional(),
  vesselBeam: z.string().optional(),
  vesselType: z.string().optional(),
  notes: z.string().optional(),
});

type LeaseFormData = z.infer<typeof leaseFormSchema>;

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

function LeaseFormDrawer({
  open,
  onOpenChange,
  editLease,
  onSuccess
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editLease?: RRALease | null;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  
  const { data: tenants } = useQuery<RRATenant[]>({
    queryKey: ['/api/rent-roll/tenants'],
    enabled: open,
  });

  const { data: locations } = useQuery<RRALocation[]>({
    queryKey: ['/api/rent-roll/locations'],
    enabled: open,
  });

  const form = useForm<LeaseFormData>({
    resolver: zodResolver(leaseFormSchema),
    defaultValues: {
      tenantId: editLease?.tenantId || "",
      locationId: editLease?.locationId || "",
      leaseType: editLease?.leaseType || "slip",
      startDate: editLease?.startDate || "",
      endDate: editLease?.endDate || "",
      baseRent: editLease?.baseRent || "",
      rentPeriod: editLease?.rentPeriod || "month",
      discountType: editLease?.discountType || "",
      discountValue: editLease?.discountValue || "",
      storageType: editLease?.storageType || "",
      vesselName: editLease?.vessel?.name || "",
      vesselLength: editLease?.vessel?.length || "",
      vesselBeam: editLease?.vessel?.beam || "",
      vesselType: editLease?.vessel?.type || "",
      notes: editLease?.notes || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: LeaseFormData) => {
      const payload = {
        ...data,
        vessel: {
          name: data.vesselName || null,
          length: data.vesselLength || null,
          beam: data.vesselBeam || null,
          type: data.vesselType || null,
        },
      };
      if (editLease) {
        const res = await apiRequest('PATCH', `/api/rent-roll/leases/${editLease.id}`, payload);
        return res.json();
      }
      const res = await apiRequest('POST', '/api/rent-roll/leases', payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: editLease ? "Lease updated successfully" : "Lease created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/leases'] });
      form.reset();
      onOpenChange(false);
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: editLease ? "Failed to update lease" : "Failed to create lease",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LeaseFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editLease ? "Edit Lease" : "Create New Lease"}</SheetTitle>
          <SheetDescription>
            {editLease ? "Update the lease details below." : "Fill in the details to create a new lease."}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Basic Information</h3>
              
              <FormField
                control={form.control}
                name="tenantId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tenant *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-tenant">
                          <SelectValue placeholder="Select a tenant" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tenants?.map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>
                            {tenant.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project/Location</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-location">
                          <SelectValue placeholder="Select a location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations?.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
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
                  name="leaseType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lease Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-lease-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="slip">Slip</SelectItem>
                          <SelectItem value="dry_storage">Dry Storage</SelectItem>
                          <SelectItem value="mooring">Mooring</SelectItem>
                          <SelectItem value="trailer">Trailer</SelectItem>
                          <SelectItem value="commercial">Commercial</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
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
                          <SelectTrigger data-testid="select-storage-type">
                            <SelectValue placeholder="Select storage" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="wet_slip">Wet Slip</SelectItem>
                          <SelectItem value="dry_stack">Dry Stack</SelectItem>
                          <SelectItem value="covered">Covered</SelectItem>
                          <SelectItem value="uncovered">Uncovered</SelectItem>
                          <SelectItem value="indoor">Indoor</SelectItem>
                          <SelectItem value="outdoor">Outdoor</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Lease Terms</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-end-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="baseRent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Rent</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          {...field} 
                          data-testid="input-base-rent" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rentPeriod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rent Period</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-rent-period">
                            <SelectValue placeholder="Select period" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="day">Per Day</SelectItem>
                          <SelectItem value="week">Per Week</SelectItem>
                          <SelectItem value="month">Per Month</SelectItem>
                          <SelectItem value="season">Per Season</SelectItem>
                          <SelectItem value="year">Per Year</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="discountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-discount-type">
                            <SelectValue placeholder="Select discount" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="fixed">Fixed Amount</SelectItem>
                          <SelectItem value="prepay">Prepay Discount</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="discountValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Value</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          {...field} 
                          data-testid="input-discount-value" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Vessel Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vesselName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vessel Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Sea Breeze" {...field} data-testid="input-vessel-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vesselType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vessel Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-vessel-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="sailboat">Sailboat</SelectItem>
                          <SelectItem value="powerboat">Powerboat</SelectItem>
                          <SelectItem value="yacht">Yacht</SelectItem>
                          <SelectItem value="catamaran">Catamaran</SelectItem>
                          <SelectItem value="jet_ski">Jet Ski</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vesselLength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Length (ft)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="0.0" {...field} data-testid="input-vessel-length" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vesselBeam"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Beam (ft)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="0.0" {...field} data-testid="input-vessel-beam" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes about this lease..."
                      {...field}
                      data-testid="input-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="btn-submit-lease">
                {createMutation.isPending ? "Saving..." : editLease ? "Update Lease" : "Create Lease"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

function LeasesTable({
  leases,
  selectedIds,
  onSelectIds,
  onEdit,
  onDelete,
  sortConfig,
  onSort
}: {
  leases: RRALease[];
  selectedIds: Set<string>;
  onSelectIds: (ids: Set<string>) => void;
  onEdit: (lease: RRALease) => void;
  onDelete: (ids: string[]) => void;
  sortConfig: SortConfig;
  onSort: (key: string) => void;
}) {
  const allSelected = leases.length > 0 && selectedIds.size === leases.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < leases.length;

  const toggleAll = () => {
    if (allSelected) {
      onSelectIds(new Set());
    } else {
      onSelectIds(new Set(leases.map(l => l.id)));
    }
  };

  const toggleOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    onSelectIds(newSet);
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="h-4 w-4" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="h-4 w-4" /> 
      : <ArrowDown className="h-4 w-4" />;
  };

  const getStatusBadge = (lease: RRALease) => {
    if (!lease.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    if (lease.endDate && new Date(lease.endDate) < new Date()) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (lease.endDate) {
      const daysUntilExpiry = Math.ceil((new Date(lease.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry <= 30) {
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Expiring Soon</Badge>;
      }
    }
    return <Badge variant="default" className="bg-green-500">Active</Badge>;
  };

  const formatLeaseType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox 
                checked={allSelected}
                ref={(el) => {
                  if (el) (el as any).indeterminate = someSelected;
                }}
                onCheckedChange={toggleAll}
                data-testid="checkbox-select-all"
              />
            </TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" onClick={() => onSort('tenantName')} className="gap-1">
                Tenant {getSortIcon('tenantName')}
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" onClick={() => onSort('locationName')} className="gap-1">
                Location {getSortIcon('locationName')}
              </Button>
            </TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" onClick={() => onSort('startDate')} className="gap-1">
                Start Date {getSortIcon('startDate')}
              </Button>
            </TableHead>
            <TableHead>
              <Button variant="ghost" size="sm" onClick={() => onSort('endDate')} className="gap-1">
                End Date {getSortIcon('endDate')}
              </Button>
            </TableHead>
            <TableHead className="text-right">
              <Button variant="ghost" size="sm" onClick={() => onSort('baseRent')} className="gap-1">
                Rent {getSortIcon('baseRent')}
              </Button>
            </TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leases.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                No leases found. Create your first lease to get started.
              </TableCell>
            </TableRow>
          ) : (
            leases.map((lease) => (
              <TableRow 
                key={lease.id} 
                className={cn(selectedIds.has(lease.id) && "bg-muted/50")}
                data-testid={`lease-row-${lease.id}`}
              >
                <TableCell>
                  <Checkbox 
                    checked={selectedIds.has(lease.id)}
                    onCheckedChange={() => toggleOne(lease.id)}
                    data-testid={`checkbox-lease-${lease.id}`}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{lease.tenantName || 'Unknown'}</span>
                    {lease.vessel?.name && (
                      <span className="text-xs text-muted-foreground">{lease.vessel.name}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{lease.locationName || 'Unassigned'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{formatLeaseType(lease.leaseType)}</Badge>
                </TableCell>
                <TableCell>{getStatusBadge(lease)}</TableCell>
                <TableCell>
                  {lease.startDate ? new Date(lease.startDate).toLocaleDateString() : '-'}
                </TableCell>
                <TableCell>
                  {lease.endDate ? new Date(lease.endDate).toLocaleDateString() : 'Month-to-Month'}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {lease.baseRent 
                    ? `${formatCurrency(parseFloat(lease.baseRent))}/${lease.rentPeriod}`
                    : '-'}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`btn-lease-menu-${lease.id}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(lease)} data-testid={`menu-edit-${lease.id}`}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Lease
                      </DropdownMenuItem>
                      <DropdownMenuItem data-testid={`menu-view-${lease.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => onDelete([lease.id])}
                        data-testid={`menu-delete-${lease.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function RentRollLeases() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [importDrawerOpen, setImportDrawerOpen] = useState(false);
  const [editingLease, setEditingLease] = useState<RRALease | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'tenantName', direction: 'asc' });
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { toast } = useToast();

  const { data: leases, isLoading, error } = useQuery<RRALease[]>({
    queryKey: ['/api/rent-roll/leases'],
    staleTime: 30 * 1000,
  });

  const { data: locations } = useQuery<RRALocation[]>({
    queryKey: ['/api/rent-roll/locations'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest('DELETE', `/api/rent-roll/leases/${id}`)));
    },
    onSuccess: (_, ids) => {
      toast({ title: `${ids.length} lease(s) deleted` });
      queryClient.invalidateQueries({ queryKey: ['/api/rent-roll/leases'] });
      setSelectedIds(new Set());
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete lease(s)",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleEdit = (lease: RRALease) => {
    setEditingLease(lease);
    setFormDrawerOpen(true);
  };

  const handleDelete = (ids: string[]) => {
    if (confirm(`Are you sure you want to delete ${ids.length} lease(s)?`)) {
      deleteMutation.mutate(ids);
    }
  };

  const filteredAndSortedLeases = useMemo(() => {
    let result = (leases || []).filter((lease) => {
      const matchesSearch = 
        (lease.tenantName?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (lease.locationName?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (lease.vessel?.name?.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = statusFilter === "all" || 
        (statusFilter === "active" && lease.isActive) ||
        (statusFilter === "inactive" && !lease.isActive) ||
        (statusFilter === "expiring" && lease.endDate && 
          new Date(lease.endDate) > new Date() && 
          new Date(lease.endDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
      
      const matchesType = typeFilter === "all" || lease.leaseType === typeFilter;
      const matchesLocation = locationFilter === "all" || lease.locationId === locationFilter;

      return matchesSearch && matchesStatus && matchesType && matchesLocation;
    });

    result.sort((a, b) => {
      const aVal = (a as any)[sortConfig.key] || '';
      const bVal = (b as any)[sortConfig.key] || '';
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [leases, searchQuery, statusFilter, typeFilter, locationFilter, sortConfig]);

  const paginatedLeases = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSortedLeases.slice(start, start + pageSize);
  }, [filteredAndSortedLeases, page]);

  const totalPages = Math.ceil(filteredAndSortedLeases.length / pageSize);

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setLocationFilter("all");
  };

  const hasActiveFilters = searchQuery || statusFilter !== "all" || typeFilter !== "all" || locationFilter !== "all";

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-rent-roll-leases">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="heading-rent-roll-leases">
            Lease Management
          </h1>
          <p className="text-muted-foreground" data-testid="description-rent-roll-leases">
            View, create, and manage all marina leases across your portfolio.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="btn-export-leases">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={() => setImportDrawerOpen(true)} data-testid="btn-import-leases">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={() => { setEditingLease(null); setFormDrawerOpen(true); }} data-testid="btn-create-lease">
            <Plus className="h-4 w-4 mr-2" />
            New Lease
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by tenant, location, vessel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-leases"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="expiring">Expiring Soon</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-type-filter">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="slip">Slip</SelectItem>
                <SelectItem value="dry_storage">Dry Storage</SelectItem>
                <SelectItem value="mooring">Mooring</SelectItem>
                <SelectItem value="trailer">Trailer</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
              </SelectContent>
            </Select>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-location-filter">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations?.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="btn-clear-filters">
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-4 p-3 bg-muted rounded-lg mb-4">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => handleDelete(Array.from(selectedIds))}
                data-testid="btn-bulk-delete"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Selected
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Cancel
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Failed to load leases. Please try again.
            </div>
          ) : (
            <>
              <LeasesTable
                leases={paginatedLeases}
                selectedIds={selectedIds}
                onSelectIds={setSelectedIds}
                onEdit={handleEdit}
                onDelete={handleDelete}
                sortConfig={sortConfig}
                onSort={handleSort}
              />

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredAndSortedLeases.length)} of {filteredAndSortedLeases.length} leases
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      data-testid="btn-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="text-sm">Page {page} of {totalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      data-testid="btn-next-page"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <LeaseFormDrawer
        open={formDrawerOpen}
        onOpenChange={setFormDrawerOpen}
        editLease={editingLease}
        onSuccess={() => { setEditingLease(null); }}
      />

      <FileImportDrawer
        open={importDrawerOpen}
        onOpenChange={setImportDrawerOpen}
        onSuccess={() => {}}
      />
    </div>
  );
}
