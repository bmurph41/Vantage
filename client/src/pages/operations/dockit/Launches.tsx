import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Calendar, Clock, Ship, Plus, Search, CheckCircle2, PlayCircle, CircleDashed, MoreHorizontal, Users, Timer, ArrowRight } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DockitAppShell, { LaunchFilters, defaultFilters } from "@/components/dockit/DockitAppShell";
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, isAfter, parseISO } from "date-fns";

function getTimeFrameStart(timeFrame: LaunchFilters['timeFrame']): Date | null {
  const now = new Date();
  switch (timeFrame) {
    case 'today': return startOfDay(now);
    case 'this_week': return startOfWeek(now, { weekStartsOn: 1 });
    case 'this_month': return startOfMonth(now);
    case 'this_quarter': return startOfQuarter(now);
    case 'this_year': return startOfYear(now);
    case 'all': return null;
    default: return startOfDay(now);
  }
}

interface Launch {
  id: string;
  customerId: string;
  boatId: string;
  scheduledDate: string;
  scheduledTime?: string;
  status: string;
  launchType: string;
  notes?: string;
  assignedEmployee?: string;
  marinaId?: string;
  marinaName?: string;
  customerName?: string;
  boatName?: string;
  completedAt?: string;
  startedAt?: string;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
}

interface Boat {
  id: string;
  name: string;
  customerId: string;
}

interface Employee {
  id: string;
  name: string;
}

const launchSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  boatId: z.string().min(1, "Boat is required"),
  scheduledDate: z.string().min(1, "Date is required"),
  scheduledTime: z.string().optional(),
  launchType: z.enum(["launch", "haul"]),
  assignedEmployee: z.string().optional(),
  notes: z.string().optional(),
});

type LaunchFormData = z.infer<typeof launchSchema>;

export default function DockitLaunches() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [filters, setFilters] = useState<LaunchFilters>(defaultFilters);
  
  const handleFiltersChange = useCallback((newFilters: LaunchFilters) => {
    setFilters(newFilters);
  }, []);

  const { data: todaysLaunches = [], isLoading: launchesLoading } = useQuery<Launch[]>({
    queryKey: ["/dockit/api/launches/today"],
    retry: false,
  });

  const { data: queue = [] } = useQuery<Launch[]>({
    queryKey: ["/dockit/api/launches/queue"],
    retry: false,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/dockit/api/customers"],
    retry: false,
  });

  const { data: boats = [] } = useQuery<Boat[]>({
    queryKey: ["/dockit/api/boats"],
    retry: false,
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/dockit/api/employees"],
    retry: false,
  });

  const form = useForm<LaunchFormData>({
    resolver: zodResolver(launchSchema),
    defaultValues: {
      customerId: "",
      boatId: "",
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: "",
      launchType: "launch",
      assignedEmployee: "",
      notes: "",
    },
  });

  const selectedCustomerId = form.watch("customerId");
  const customerBoats = boats.filter(b => b.customerId === selectedCustomerId);

  const createLaunchMutation = useMutation({
    mutationFn: async (data: LaunchFormData) => {
      return apiRequest("/dockit/api/launches", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/dockit/api/launches"] });
      queryClient.invalidateQueries({ queryKey: ["/dockit/api/launches/today"] });
      queryClient.invalidateQueries({ queryKey: ["/dockit/api/launches/queue"] });
      setIsScheduleDialogOpen(false);
      form.reset();
      toast({
        title: "Launch scheduled",
        description: "The launch has been successfully scheduled.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule launch",
        variant: "destructive",
      });
    },
  });

  const updateLaunchStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest(`/dockit/api/launches/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/dockit/api/launches"] });
      queryClient.invalidateQueries({ queryKey: ["/dockit/api/launches/today"] });
      queryClient.invalidateQueries({ queryKey: ["/dockit/api/launches/queue"] });
      toast({
        title: "Status updated",
        description: "The launch status has been updated.",
      });
    },
  });

  const onSubmit = (data: LaunchFormData) => {
    createLaunchMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">In Progress</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const completedToday = todaysLaunches.filter(l => l.status === 'completed').length;
  const inProgress = todaysLaunches.filter(l => l.status === 'in_progress').length;
  const pending = todaysLaunches.filter(l => l.status === 'pending' || !l.status).length;

  return (
    <DockitAppShell 
      title="Launch Queue" 
      description="Manage boat launch and haul operations"
      filters={filters}
      onFiltersChange={handleFiltersChange}
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search launches..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search-launches"
            />
          </div>
          
          <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-schedule-launch">
                <Plus className="h-4 w-4 mr-2" />
                Schedule Launch
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Schedule Launch or Haul</DialogTitle>
                <DialogDescription>
                  Schedule a boat launch or haul-out for a customer.
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="launchType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-launch-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="launch">Launch</SelectItem>
                            <SelectItem value="haul">Haul-Out</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer</FormLabel>
                        <Select onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue("boatId", "");
                        }} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-customer">
                              <SelectValue placeholder="Select customer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customers.length === 0 ? (
                              <SelectItem value="_none" disabled>No customers available</SelectItem>
                            ) : (
                              customers.map((customer) => (
                                <SelectItem key={customer.id} value={customer.id}>
                                  {customer.firstName} {customer.lastName}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="boatId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Boat</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedCustomerId}>
                          <FormControl>
                            <SelectTrigger data-testid="select-boat">
                              <SelectValue placeholder={selectedCustomerId ? "Select boat" : "Select customer first"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customerBoats.length === 0 ? (
                              <SelectItem value="_none" disabled>No boats for this customer</SelectItem>
                            ) : (
                              customerBoats.map((boat) => (
                                <SelectItem key={boat.id} value={boat.id}>
                                  {boat.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="scheduledDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-launch-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="scheduledTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time (optional)</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} data-testid="input-launch-time" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="assignedEmployee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign Employee (optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-employee">
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">Unassigned</SelectItem>
                            {employees.map((emp) => (
                              <SelectItem key={emp.id} value={emp.name}>
                                {emp.name}
                              </SelectItem>
                            ))}
                            {employees.length === 0 && (
                              <>
                                <SelectItem value="John Smith">John Smith</SelectItem>
                                <SelectItem value="Mike Johnson">Mike Johnson</SelectItem>
                                <SelectItem value="Sarah Williams">Sarah Williams</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Any special instructions..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createLaunchMutation.isPending} data-testid="button-submit-launch">
                      {createLaunchMutation.isPending ? "Scheduling..." : "Schedule"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Launch Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed Today</p>
                  <p className="text-2xl font-bold">{completedToday}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <PlayCircle className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">{inProgress}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <CircleDashed className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Today's Queue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Today's Launch Queue
            </CardTitle>
            <CardDescription>
              {launchesLoading ? "Loading..." : `${todaysLaunches.length} launches scheduled for today`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {launchesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : todaysLaunches.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Ship className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No launches scheduled for today</p>
                <Button variant="link" className="mt-2" onClick={() => setIsScheduleDialogOpen(true)}>
                  Schedule the first launch
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {todaysLaunches.map((launch) => {
                  const customer = customers.find(c => c.id === launch.customerId);
                  const boat = boats.find(b => b.id === launch.boatId);
                  
                  return (
                    <div 
                      key={launch.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      data-testid={`launch-item-${launch.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${launch.launchType === 'haul' ? 'bg-orange-100' : 'bg-blue-100'}`}>
                          <Ship className={`h-5 w-5 ${launch.launchType === 'haul' ? 'text-orange-600' : 'text-blue-600'}`} />
                        </div>
                        <div>
                          <p className="font-medium">
                            {customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown Customer'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {boat?.name || 'Unknown Boat'} • {launch.launchType === 'haul' ? 'Haul-Out' : 'Launch'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {launch.scheduledTime || 'TBD'}
                          </div>
                          {getStatusBadge(launch.status)}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {launch.status !== 'in_progress' && launch.status !== 'completed' && (
                              <DropdownMenuItem onClick={() => updateLaunchStatus.mutate({ id: launch.id, status: 'in_progress' })}>
                                Start Launch
                              </DropdownMenuItem>
                            )}
                            {launch.status === 'in_progress' && (
                              <DropdownMenuItem onClick={() => updateLaunchStatus.mutate({ id: launch.id, status: 'completed' })}>
                                Mark Complete
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => updateLaunchStatus.mutate({ id: launch.id, status: 'cancelled' })} className="text-destructive">
                              Cancel
                            </DropdownMenuItem>
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
      </div>
    </DockitAppShell>
  );
}
