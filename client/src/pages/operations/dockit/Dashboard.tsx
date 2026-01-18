import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Anchor, Ship, Calendar, Clock, ChevronRight,
  DollarSign, BarChart3, CheckCircle2, PlayCircle, 
  PauseCircle, Timer, Users, ArrowUpDown
} from "lucide-react";
import DockitAppShell, { LaunchFilters, defaultFilters } from "@/components/dockit/DockitAppShell";
import { ContextIntegrationsPanel } from "@/components/integrations/ContextIntegrationsPanel";
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, endOfDay, endOfWeek, endOfMonth, endOfQuarter, endOfYear, isWithinInterval, parseISO } from "date-fns";

interface DashboardStats {
  todaysLaunches?: number;
  totalSlips?: number;
  occupiedSlips?: number;
  monthlyRevenue?: number;
  occupancyRate?: number;
  transientSlips?: number;
  transientOccupied?: number;
  transientRevenue?: number;
  launchesCompleted?: number;
  launchesInProgress?: number;
  launchesQueued?: number;
}

interface Launch {
  id: string;
  customerId: string;
  boatId: string;
  scheduledDate: string;
  scheduledTime?: string;
  status: string;
  launchType: string;
  customerName?: string;
  boatName?: string;
  assignedEmployee?: string;
  marinaName?: string;
}

interface TransientSlip {
  id: string;
  slipNumber: string;
  status: string;
  currentOccupant?: string;
  dailyRate?: number;
}

// Helper function to get time frame interval (start and end dates)
function getTimeFrameInterval(timeFrame: LaunchFilters['timeFrame']): { start: Date; end: Date } | null {
  const now = new Date();
  switch (timeFrame) {
    case 'today': 
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'this_week': 
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'this_month': 
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'this_quarter': 
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'this_year': 
      return { start: startOfYear(now), end: endOfYear(now) };
    case 'all': 
      return null;
    default: 
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

export default function DockitDashboard() {
  const [filters, setFilters] = useState<LaunchFilters>(defaultFilters);
  
  const handleFiltersChange = useCallback((newFilters: LaunchFilters) => {
    setFilters(newFilters);
  }, []);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/dockit/api/dashboard/stats"],
    retry: false,
  });

  const { data: todaysLaunches = [], isLoading: launchesLoading } = useQuery<Launch[]>({
    queryKey: ["/dockit/api/launches/today"],
    retry: false,
  });

  const { data: allLaunches = [] } = useQuery<Launch[]>({
    queryKey: ["/dockit/api/launches"],
    retry: false,
  });

  const { data: transientSlips = [] } = useQuery<TransientSlip[]>({
    queryKey: ["/dockit/api/slips", { type: "transient" }],
    retry: false,
  });

  // Apply filters to launches
  const filteredLaunches = useMemo(() => {
    let result = [...allLaunches];
    
    // Filter by marina
    if (filters.marinas.length > 0) {
      result = result.filter(l => 
        l.marinaName && filters.marinas.some(m => 
          l.marinaName?.toLowerCase().includes(m.toLowerCase()) || 
          String((l as any).marinaId) === m
        )
      );
    }
    
    // Filter by time frame (inclusive interval)
    const interval = getTimeFrameInterval(filters.timeFrame);
    if (interval) {
      result = result.filter(l => {
        const launchDate = l.scheduledDate ? parseISO(l.scheduledDate) : new Date();
        return isWithinInterval(launchDate, interval);
      });
    }
    
    // Filter by customer
    if (filters.customerId) {
      result = result.filter(l => l.customerId === filters.customerId);
    }
    
    return result;
  }, [allLaunches, filters]);

  // Apply filters to today's launches 
  const filteredTodaysLaunches = useMemo(() => {
    let result = [...todaysLaunches];
    
    if (filters.marinas.length > 0) {
      result = result.filter(l => 
        l.marinaName && filters.marinas.some(m => 
          l.marinaName?.toLowerCase().includes(m.toLowerCase()) || 
          String((l as any).marinaId) === m
        )
      );
    }
    
    if (filters.customerId) {
      result = result.filter(l => l.customerId === filters.customerId);
    }
    
    return result;
  }, [todaysLaunches, filters]);

  // Categorize launches by status
  const queuedLaunches = filteredLaunches.filter(l => l.status === 'scheduled' || l.status === 'queued');
  const inProgressLaunches = filteredLaunches.filter(l => l.status === 'in_progress' || l.status === 'staging');
  const completedToday = filteredTodaysLaunches.filter(l => l.status === 'completed');

  const StatCard = ({ title, value, subtitle, icon: Icon, trend, isLoading, variant = "default" }: {
    title: string;
    value: string | number;
    subtitle: string;
    icon: any;
    trend?: { value: number; positive: boolean };
    isLoading: boolean;
    variant?: "default" | "success" | "warning" | "info";
  }) => {
    const variants = {
      default: "",
      success: "border-green-200 bg-green-50",
      warning: "border-orange-200 bg-orange-50", 
      info: "border-blue-200 bg-blue-50"
    };
    
    return (
      <Card className={variants[variant]}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-24 mb-1" />
          ) : (
            <div className="text-2xl font-bold">{value}</div>
          )}
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {trend && (
              <span className={trend.positive ? "text-green-600" : "text-red-600"}>
                {trend.positive ? "+" : ""}{trend.value}%
              </span>
            )}
            {subtitle}
          </p>
        </CardContent>
      </Card>
    );
  };

  const LaunchQueueItem = ({ launch, showActions = false }: { launch: Launch; showActions?: boolean }) => (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${launch.launchType === 'launch' ? 'bg-blue-100' : 'bg-orange-100'}`}>
          <Ship className={`h-4 w-4 ${launch.launchType === 'launch' ? 'text-blue-600' : 'text-orange-600'}`} />
        </div>
        <div>
          <p className="font-medium text-sm">
            {launch.launchType === 'launch' ? 'Launch' : 'Haul'} - {launch.scheduledTime || 'TBD'}
          </p>
          <p className="text-xs text-muted-foreground">
            {launch.boatName || `Boat #${launch.boatId}`}
            {launch.customerName && ` • ${launch.customerName}`}
          </p>
          {launch.assignedEmployee && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> {launch.assignedEmployee}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={
          launch.status === 'completed' ? 'default' : 
          launch.status === 'in_progress' ? 'secondary' : 
          'outline'
        }>
          {launch.status === 'in_progress' ? 'In Progress' : launch.status}
        </Badge>
        {showActions && (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <DockitAppShell 
      title="Launch Control" 
      description="Real-time boat launch and haul operations"
      filters={filters}
      onFiltersChange={handleFiltersChange}
    >
      <div className="space-y-6">
        {/* Stats Grid - Transient Focus */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Active Queue"
            value={queuedLaunches.length}
            subtitle="Boats waiting"
            icon={Timer}
            isLoading={launchesLoading}
            variant="info"
          />
          
          <StatCard
            title="In Progress"
            value={inProgressLaunches.length}
            subtitle="Currently staging"
            icon={PlayCircle}
            isLoading={launchesLoading}
            variant="warning"
          />
          
          <StatCard
            title="Completed Today"
            value={completedToday.length}
            subtitle={`of ${todaysLaunches.length} scheduled`}
            icon={CheckCircle2}
            isLoading={launchesLoading}
            variant="success"
          />
          
          <StatCard
            title="Transient Occupancy"
            value={statsLoading ? "..." : `${stats?.transientOccupied || 0}/${stats?.transientSlips || stats?.totalSlips || 0}`}
            subtitle={`${stats?.occupancyRate ? Math.round(stats.occupancyRate) : 0}% filled`}
            icon={Anchor}
            isLoading={statsLoading}
          />
        </div>

        {/* Revenue Card */}
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Transient Revenue (This Month)</p>
                <p className="text-2xl font-bold text-green-700">
                  ${((stats?.transientRevenue || stats?.monthlyRevenue || 0) / 100).toLocaleString()}
                </p>
              </div>
            </div>
            <Link href="/operations/dockit/slips">
              <Button variant="outline" size="sm" className="border-green-300 text-green-700 hover:bg-green-100">
                View Transient Slips
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Launch Queue Tabs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Ship className="h-5 w-5" />
                  Launch Queue
                </CardTitle>
                <CardDescription>Real-time boat launch and haul operations</CardDescription>
              </div>
              <Link href="/operations/dockit/launches">
                <Button size="sm" data-testid="button-manage-queue">
                  <Calendar className="h-4 w-4 mr-2" />
                  Manage Queue
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="active" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="active" className="flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  Active ({queuedLaunches.length})
                </TabsTrigger>
                <TabsTrigger value="staging" className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4" />
                  Staging ({inProgressLaunches.length})
                </TabsTrigger>
                <TabsTrigger value="completed" className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Completed ({completedToday.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="active" className="mt-4">
                {launchesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : queuedLaunches.length > 0 ? (
                  <div className="space-y-2">
                    {queuedLaunches.slice(0, 5).map((launch) => (
                      <LaunchQueueItem key={launch.id} launch={launch} showActions />
                    ))}
                    {queuedLaunches.length > 5 && (
                      <Button variant="ghost" size="sm" className="w-full mt-2">
                        View all {queuedLaunches.length} in queue
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg text-muted-foreground">
                    <div className="text-center">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Queue is empty</p>
                      <Link href="/operations/dockit/launches">
                        <Button variant="link" size="sm" className="mt-2">
                          Schedule a launch <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="staging" className="mt-4">
                {inProgressLaunches.length > 0 ? (
                  <div className="space-y-2">
                    {inProgressLaunches.map((launch) => (
                      <LaunchQueueItem key={launch.id} launch={launch} />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg text-muted-foreground">
                    <div className="text-center">
                      <PauseCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No boats currently staging</p>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="completed" className="mt-4">
                {completedToday.length > 0 ? (
                  <div className="space-y-2">
                    {completedToday.map((launch) => (
                      <LaunchQueueItem key={launch.id} launch={launch} />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg text-muted-foreground">
                    <div className="text-center">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No completed launches today</p>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Transient Slip Snapshot */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Anchor className="h-5 w-5" />
                  Transient Slips
                </CardTitle>
                <CardDescription>Current availability and occupancy</CardDescription>
              </div>
              <Link href="/operations/dockit/slips">
                <Button variant="outline" size="sm">
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
              {transientSlips.slice(0, 12).map((slip) => (
                <div 
                  key={slip.id}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    slip.status === 'available' 
                      ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                      : slip.status === 'occupied'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <p className="font-medium text-sm">{slip.slipNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {slip.status === 'occupied' ? slip.currentOccupant || 'Occupied' : slip.status}
                  </p>
                </div>
              ))}
            </div>
            {transientSlips.length === 0 && (
              <div className="flex items-center justify-center h-24 border-2 border-dashed rounded-lg text-muted-foreground">
                <p className="text-sm">No transient slips configured</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Integrations Panel */}
        <ContextIntegrationsPanel 
          contextKey="dockit"
          title="Dockit Integrations"
          description="Connect launch and scheduling software to sync data with MarinaMatch."
        />
      </div>
    </DockitAppShell>
  );
}
