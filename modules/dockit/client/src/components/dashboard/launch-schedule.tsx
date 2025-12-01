import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Clock } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { Launch, Customer, Boat } from "@shared/schema";

interface LaunchWithDetails extends Launch {
  customerName?: string;
  boatInfo?: string;
}

interface LaunchScheduleProps {
  onScheduleClick: () => void;
}

export default function LaunchSchedule({ onScheduleClick }: LaunchScheduleProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  
  const { data: launches = [], isLoading } = useQuery<LaunchWithDetails[]>({
    queryKey: ['/api/launches/upcoming'],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  const { data: boats = [] } = useQuery<Boat[]>({
    queryKey: ['/api/boats'],
  });

  // Mutation for updating launch status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ launchId, status }: { launchId: string; status: string }) => {
      setLaunchingId(launchId);
      return apiRequest('PUT', `/api/launches/${launchId}/queue-status`, { status });
    },
    onSuccess: () => {
      setLaunchingId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/launches/upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['/api/launches'] });
      toast({
        title: "Launch Updated",
        description: "Launch status has been updated successfully.",
      });
    },
    onError: () => {
      setLaunchingId(null);
      toast({
        title: "Error",
        description: "Failed to update launch status. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handler for launching a boat (changing status from scheduled to in_progress)
  const handleLaunchBoat = (launchId: string) => {
    updateStatusMutation.mutate({ launchId, status: 'in_progress' });
  };

  // Handler for viewing full schedule
  const handleViewFullSchedule = () => {
    setLocation('/launch-scheduling');
  };

  // Enrich launches with customer and boat details
  const enrichedLaunches = launches.slice(0, 6).map(launch => {
    const customer = customers.find(c => c.id === launch.customerId);
    const boat = boats.find(b => b.id === launch.boatId);
    
    return {
      ...launch,
      customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown Customer',
      boatInfo: boat ? `${boat.year} ${boat.make} ${boat.model}` : 'Unknown Boat',
    };
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-accent';
      case 'in_progress':
        return 'bg-chart-4';
      case 'launched':
        return 'bg-chart-3';
      case 'cancelled':
        return 'bg-destructive';
      default:
        return 'bg-muted';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'Ready for Launch';
      case 'in_progress':
        return 'In Progress';
      case 'launched':
        return 'Launched';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  return (
    <Card className="lg:col-span-2" data-testid="launch-schedule">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Launch Schedule - SpeedyDock Integration</h3>
          <Button onClick={onScheduleClick} data-testid="button-schedule-launch">
            <Plus size={16} className="mr-2" />
            Schedule Launch
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-muted rounded-lg animate-pulse">
                <div className="flex items-center space-x-4">
                  <div className="w-3 h-3 bg-muted-foreground rounded-full" />
                  <div className="space-y-1">
                    <div className="h-4 bg-muted-foreground rounded w-32" />
                    <div className="h-3 bg-muted-foreground rounded w-48" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : enrichedLaunches.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p>No upcoming launches scheduled</p>
            <Button variant="outline" onClick={onScheduleClick} className="mt-4">
              Schedule First Launch
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {enrichedLaunches.map((launch) => (
              <div
                key={launch.id}
                className="flex items-center justify-between p-4 bg-muted rounded-lg"
                data-testid={`launch-item-${launch.id}`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-3 h-3 ${getStatusColor(launch.status)} rounded-full`} />
                  <div>
                    <p className="font-medium">{launch.customerName}</p>
                    <p className="text-sm text-muted-foreground">{launch.boatInfo}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {new Date(launch.scheduledTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getStatusText(launch.status)}
                    </p>
                  </div>
                  {launch.status === 'scheduled' && (
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      onClick={() => handleLaunchBoat(launch.id)}
                      disabled={launchingId === launch.id}
                      data-testid={`button-launch-${launch.id}`}
                    >
                      {launchingId === launch.id ? 'Launching...' : 'Launch'}
                    </Button>
                  )}
                  {launch.status === 'in_progress' && (
                    <Button size="sm" variant="outline" disabled>
                      <Clock size={14} className="mr-1" />
                      In Progress
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Next 6 hours: {launches.length} scheduled launches
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleViewFullSchedule}
                  data-testid="button-view-full-schedule"
                >
                  View Full Schedule
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
