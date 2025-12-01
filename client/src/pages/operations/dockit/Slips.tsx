import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Anchor, Plus, Search, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DockitAppShell, { LaunchFilters, defaultFilters } from "@/components/dockit/DockitAppShell";

interface Slip {
  id: string;
  number: string;
  section?: string;
  type?: string;
  slipType?: string;
  maxLength?: string;
  maxBeam?: string;
  maxDraft?: string;
  monthlyRate?: string;
  dailyRate?: string;
  status?: string;
  utilities?: string[];
  currentBoatId?: string;
  currentOccupant?: string;
  checkInDate?: string;
  checkOutDate?: string;
}

interface Lease {
  id: string;
  slipId: string;
  customerId: string;
  startDate: string;
  endDate?: string;
  monthlyRate: string;
  status: string;
}

const slipSchema = z.object({
  number: z.string().min(1, "Slip number is required"),
  section: z.string().optional(),
  type: z.string().optional(),
  slipType: z.string().default("transient"),
  maxLength: z.string().optional(),
  maxBeam: z.string().optional(),
  maxDraft: z.string().optional(),
  dailyRate: z.string().optional(),
});

type SlipFormData = z.infer<typeof slipSchema>;

export default function DockitSlips() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [filters, setFilters] = useState<LaunchFilters>(defaultFilters);
  
  const handleFiltersChange = useCallback((newFilters: LaunchFilters) => {
    setFilters(newFilters);
  }, []);

  const { data: slips = [], isLoading: slipsLoading } = useQuery<Slip[]>({
    queryKey: ["/dockit/api/slips"],
    retry: false,
  });

  const { data: leases = [], isLoading: leasesLoading } = useQuery<Lease[]>({
    queryKey: ["/dockit/api/leases/active"],
    retry: false,
  });

  const form = useForm<SlipFormData>({
    resolver: zodResolver(slipSchema),
    defaultValues: {
      number: "",
      section: "",
      type: "standard",
      slipType: "transient",
      maxLength: "",
      maxBeam: "",
      maxDraft: "",
      dailyRate: "",
    },
  });

  const createSlipMutation = useMutation({
    mutationFn: async (data: SlipFormData) => {
      return apiRequest("/dockit/api/slips", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/dockit/api/slips"] });
      queryClient.invalidateQueries({ queryKey: ["/dockit/api/dashboard/stats"] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({
        title: "Slip added",
        description: "The slip has been successfully added.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add slip",
        variant: "destructive",
      });
    },
  });

  const deleteSlipMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/dockit/api/slips/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/dockit/api/slips"] });
      queryClient.invalidateQueries({ queryKey: ["/dockit/api/dashboard/stats"] });
      toast({
        title: "Slip deleted",
        description: "The slip has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete slip",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SlipFormData) => {
    createSlipMutation.mutate(data);
  };

  const filteredSlips = slips.filter((slip) => {
    const searchLower = search.toLowerCase();
    return (
      slip.number?.toLowerCase().includes(searchLower) ||
      slip.section?.toLowerCase().includes(searchLower)
    );
  });

  const occupiedCount = slips.filter(s => s.status === 'occupied' || s.currentBoatId).length;
  const availableCount = slips.length - occupiedCount;
  const occupancyRate = slips.length > 0 ? Math.round((occupiedCount / slips.length) * 100) : 0;

  const getStatusBadge = (slip: Slip) => {
    if (slip.status === 'occupied' || slip.currentBoatId) {
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Occupied</Badge>;
    }
    if (slip.status === 'maintenance') {
      return <Badge variant="destructive">Maintenance</Badge>;
    }
    return <Badge variant="secondary">Available</Badge>;
  };

  return (
    <DockitAppShell 
      title="Transient Slips" 
      description="Manage transient slip availability and short-term stays"
      filters={filters}
      onFiltersChange={handleFiltersChange}
    >
      <Tabs defaultValue="slips" className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <TabsList>
            <TabsTrigger value="slips" data-testid="tab-slips">Slips</TabsTrigger>
            <TabsTrigger value="leases" data-testid="tab-leases">Active Leases</TabsTrigger>
          </TabsList>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-slip">
                <Plus className="h-4 w-4 mr-2" />
                Add Slip
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Slip</DialogTitle>
                <DialogDescription>
                  Configure a new slip in your marina.
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Slip Number *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., A-1" data-testid="input-slip-number" />
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
                            <Input {...field} placeholder="e.g., Dock A" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="covered">Covered</SelectItem>
                            <SelectItem value="end">End Slip</SelectItem>
                            <SelectItem value="premium">Premium</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="maxLength"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Length (ft)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" placeholder="40" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="maxBeam"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Beam (ft)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" placeholder="14" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="maxDraft"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Draft (ft)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" placeholder="6" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="dailyRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Daily Rate ($)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="75" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createSlipMutation.isPending} data-testid="button-submit-slip">
                      {createSlipMutation.isPending ? "Adding..." : "Add Slip"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <TabsContent value="slips" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Anchor className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{slips.length}</p>
                    <p className="text-sm text-muted-foreground">Total Slips</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Anchor className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{availableCount}</p>
                    <p className="text-sm text-muted-foreground">Available</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Anchor className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{occupancyRate}%</p>
                    <p className="text-sm text-muted-foreground">Occupancy Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Slips Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search slips..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-slips"
            />
          </div>

          {/* Slips Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Anchor className="h-5 w-5" />
                All Slips
              </CardTitle>
              <CardDescription>
                {slipsLoading ? "Loading..." : `${filteredSlips.length} slips`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {slipsLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : filteredSlips.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <Anchor className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No slips configured</p>
                  <Button variant="link" className="mt-2" onClick={() => setIsAddDialogOpen(true)}>
                    Add your first slip
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredSlips.map((slip) => (
                    <div 
                      key={slip.id} 
                      className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      data-testid={`slip-item-${slip.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Slip {slip.number}</span>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(slip)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => deleteSlipMutation.mutate(slip.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {slip.section && <p>Section: {slip.section}</p>}
                        <p>Size: {slip.maxLength || 'N/A'}' x {slip.maxBeam || 'N/A'}'</p>
                        {slip.dailyRate && <p className="font-medium text-foreground">${slip.dailyRate}/day</p>}
                        {slip.currentOccupant && (
                          <p className="text-blue-600">{slip.currentOccupant}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leases" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Leases</CardTitle>
              <CardDescription>
                {leasesLoading ? "Loading..." : `${leases.length} active lease agreements`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leasesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : leases.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <Anchor className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No active leases</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Leases will appear here when customers rent slips
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leases.map((lease) => {
                    const slip = slips.find(s => s.id === lease.slipId);
                    return (
                      <div 
                        key={lease.id} 
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`lease-item-${lease.id}`}
                      >
                        <div>
                          <p className="font-medium">Slip {slip?.number || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">
                            ${lease.monthlyRate}/month
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">
                            {lease.endDate ? new Date(lease.endDate).toLocaleDateString() : 'Ongoing'}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>View Details</DropdownMenuItem>
                              <DropdownMenuItem>Renew Lease</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">End Lease</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DockitAppShell>
  );
}
