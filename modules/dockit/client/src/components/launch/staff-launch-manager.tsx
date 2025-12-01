import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Play, 
  CheckCircle, 
  RotateCcw, 
  Users, 
  Clock, 
  AlertTriangle, 
  ArrowRight,
  Zap,
  MapPin,
  User
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Launch, Customer, Boat } from "@shared/schema";

interface StaffLaunchManagerProps {
  className?: string;
}

interface LaunchWithDetails extends Launch {
  customerName?: string;
  boatInfo?: string;
  customerPhone?: string;
}

export default function StaffLaunchManager({ className }: StaffLaunchManagerProps) {
  const [selectedLaunch, setSelectedLaunch] = useState<string | null>(null);
  const [assignedStaff, setAssignedStaff] = useState("");
  const [priorityLevel, setPriorityLevel] = useState("normal");
  const queryClient = useQueryClient();

  // Get launch queue and other data
  const { data: queue = [], isLoading: queueLoading } = useQuery<Launch[]>({
    queryKey: ['/api/launches/queue'],
    refetchInterval: 5000, // Staff need more frequent updates
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  const { data: boats = [] } = useQuery<Boat[]>({
    queryKey: ['/api/boats'],
  });

  // Staff members for assignment (in production, this would come from an API)
  const staffMembers = [
    "Sarah (Dock Lead)",
    "Mike (Forklift)",
    "Tom (Forklift)",
    "Lisa (Dock Hand)",
    "Chris (Dock Hand)"
  ];

  // Enrich launches with customer/boat details
  const enrichedQueue: LaunchWithDetails[] = queue.map(launch => {
    const customer = customers.find(c => c.id === launch.customerId);
    const boat = boats.find(b => b.id === launch.boatId);
    
    return {
      ...launch,
      customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown Customer',
      customerPhone: customer?.phone || '',
      boatInfo: boat ? `${boat.year} ${boat.make} ${boat.model}` : 'Unknown Boat',
    };
  });

  // Group launches by status for tabs
  const checkedInLaunches = enrichedQueue.filter(l => l.status === 'checked_in');
  const queuedLaunches = enrichedQueue.filter(l => l.status === 'queued');
  const inProgressLaunches = enrichedQueue.filter(l => l.status === 'in_progress');

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ 
      launchId, 
      status, 
      staffAssigned, 
      priorityLevel 
    }: { 
      launchId: string; 
      status: string; 
      staffAssigned?: string;
      priorityLevel?: string;
    }) => {
      return apiRequest(`/api/launches/${launchId}/queue-status`, {
        method: 'PUT',
        body: JSON.stringify({
          status,
          staffAssigned,
          priorityLevel,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/launches'] });
      setSelectedLaunch(null);
      setAssignedStaff("");
      setPriorityLevel("normal");
    },
  });

  const handleStatusUpdate = (launchId: string, newStatus: string) => {
    updateStatusMutation.mutate({
      launchId,
      status: newStatus,
      staffAssigned: assignedStaff || undefined,
      priorityLevel: priorityLevel !== "normal" ? priorityLevel : undefined,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'checked_in':
        return 'bg-blue-50 border-blue-200';
      case 'queued':
        return 'bg-yellow-50 border-yellow-200';
      case 'in_progress':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case 'checked_in':
        return { status: 'queued', label: 'Add to Queue', icon: Users };
      case 'queued':
        return { status: 'in_progress', label: 'Start Launch', icon: Play };
      case 'in_progress':
        return { status: 'launched', label: 'Complete Launch', icon: CheckCircle };
      default:
        return null;
    }
  };

  const getPriorityBadge = (level: string | null) => {
    if (!level || level === 'normal') return null;
    
    const variants = {
      high: 'bg-orange-100 text-orange-800 border-orange-300',
      urgent: 'bg-red-100 text-red-800 border-red-300',
      low: 'bg-gray-100 text-gray-600 border-gray-300',
    };
    
    return (
      <Badge className={variants[level as keyof typeof variants] || variants.high}>
        {level.toUpperCase()}
      </Badge>
    );
  };

  const LaunchCard = ({ launch }: { launch: LaunchWithDetails }) => {
    const nextAction = getNextStatus(launch.status);
    const isSelected = selectedLaunch === launch.id;

    return (
      <Card 
        className={`transition-all duration-200 ${getStatusColor(launch.status)} ${
          isSelected ? 'ring-2 ring-chart-1 shadow-lg' : ''
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-2">
                <div className="font-medium text-lg">
                  {launch.customerName}
                </div>
                {getPriorityBadge(launch.priorityLevel)}
                {launch.queuePosition && (
                  <Badge variant="outline">
                    Position {launch.queuePosition}
                  </Badge>
                )}
              </div>
              
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex items-center space-x-2">
                  <MapPin size={12} />
                  <span>{launch.boatInfo}</span>
                </div>
                
                {launch.customerPhone && (
                  <div className="flex items-center space-x-2">
                    <User size={12} />
                    <span>{launch.customerPhone}</span>
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  <Clock size={12} />
                  <span>
                    Scheduled: {new Date(launch.scheduledTime.toString()).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                
                {launch.staffAssigned && (
                  <div className="flex items-center space-x-2">
                    <User size={12} />
                    <span className="font-medium">Assigned: {launch.staffAssigned}</span>
                  </div>
                )}
                
                {launch.estimatedWaitTime && (
                  <div className="flex items-center space-x-2">
                    <Clock size={12} />
                    <span>Est. wait: {launch.estimatedWaitTime} min</span>
                  </div>
                )}
              </div>

              {/* Fuel and supplies indicators */}
              <div className="flex items-center space-x-2 mt-2">
                {launch.fuelRequested && (
                  <Badge variant="outline" className="text-xs">
                    ⛽ Fuel: {launch.fuelAmount || 'Full'}
                  </Badge>
                )}
                {launch.suppliesRequested?.items?.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    🛒 {launch.suppliesRequested.items.length} items
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end space-y-2 ml-4">
              {nextAction && (
                <Button
                  onClick={() => setSelectedLaunch(isSelected ? null : launch.id)}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className="min-w-[120px]"
                  data-testid={`button-action-${launch.id}`}
                >
                  <nextAction.icon size={14} className="mr-2" />
                  {nextAction.label}
                </Button>
              )}
              
              {isSelected && (
                <div className="bg-white p-3 rounded-lg border shadow-lg min-w-[200px]">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Assign Staff</Label>
                      <Select value={assignedStaff} onValueChange={setAssignedStaff}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select staff..." />
                        </SelectTrigger>
                        <SelectContent>
                          {staffMembers.map((staff) => (
                            <SelectItem key={staff} value={staff}>
                              {staff}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label className="text-xs">Priority Level</Label>
                      <Select value={priorityLevel} onValueChange={setPriorityLevel}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low Priority</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High Priority</SelectItem>
                          <SelectItem value="urgent">🚨 Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleStatusUpdate(launch.id, nextAction.status)}
                        disabled={updateStatusMutation.isPending}
                        size="sm"
                        className="flex-1"
                      >
                        {updateStatusMutation.isPending ? "Updating..." : "Confirm"}
                      </Button>
                      <Button
                        onClick={() => setSelectedLaunch(null)}
                        variant="outline"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (queueLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="text-chart-1" size={24} />
            <div>
              <h3 className="text-lg font-semibold">Staff Launch Manager</h3>
              <p className="text-sm text-muted-foreground">SpeedyDock-style staff workflow</p>
            </div>
          </div>
          <div className="flex items-center space-x-4 text-sm">
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">{checkedInLaunches.length}</div>
              <div className="text-xs text-muted-foreground">Checked In</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-yellow-600">{queuedLaunches.length}</div>
              <div className="text-xs text-muted-foreground">Queued</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-600">{inProgressLaunches.length}</div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="queue" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="checkin" className="flex items-center space-x-2">
              <MapPin size={16} />
              <span>Check-ins ({checkedInLaunches.length})</span>
            </TabsTrigger>
            <TabsTrigger value="queue" className="flex items-center space-x-2">
              <Users size={16} />
              <span>Queue ({queuedLaunches.length})</span>
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center space-x-2">
              <Zap size={16} />
              <span>In Progress ({inProgressLaunches.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="checkin" className="space-y-4 mt-4">
            {checkedInLaunches.length === 0 ? (
              <Alert>
                <MapPin size={16} />
                <AlertDescription>
                  No customers have checked in yet. They'll appear here when they arrive and check in via the mobile app.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {checkedInLaunches.map((launch) => (
                  <LaunchCard key={launch.id} launch={launch} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="queue" className="space-y-4 mt-4">
            {queuedLaunches.length === 0 ? (
              <Alert>
                <Users size={16} />
                <AlertDescription>
                  No boats in queue. Check-ins will be added here after processing.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {queuedLaunches
                  .sort((a, b) => (a.queuePosition || 999) - (b.queuePosition || 999))
                  .map((launch, index) => (
                    <div key={launch.id} className="relative">
                      {index === 0 && (
                        <div className="absolute -top-2 -left-2 z-10">
                          <Badge className="bg-green-500 text-white animate-pulse">
                            NEXT UP
                          </Badge>
                        </div>
                      )}
                      <LaunchCard launch={launch} />
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="progress" className="space-y-4 mt-4">
            {inProgressLaunches.length === 0 ? (
              <Alert>
                <Zap size={16} />
                <AlertDescription>
                  No launches currently in progress. Active launches will appear here.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {inProgressLaunches.map((launch) => (
                  <LaunchCard key={launch.id} launch={launch} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Real-time status indicator */}
        <div className="flex items-center justify-center space-x-2 mt-6 pt-4 border-t border-border">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <p className="text-xs text-muted-foreground">
            Live updates • Auto-refresh every 5 seconds
          </p>
        </div>
      </CardContent>
    </Card>
  );
}