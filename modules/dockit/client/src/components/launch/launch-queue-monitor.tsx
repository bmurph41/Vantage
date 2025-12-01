import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, MapPin, Users, Zap, AlertTriangle } from "lucide-react";
import type { Launch, Customer, Boat } from "@shared/schema";

interface LaunchQueueMonitorProps {
  className?: string;
  showFullQueue?: boolean;
  maxDisplay?: number;
}

interface QueuedLaunchWithDetails extends Launch {
  customerName?: string;
  boatInfo?: string;
}

export default function LaunchQueueMonitor({ 
  className, 
  showFullQueue = false, 
  maxDisplay = 6 
}: LaunchQueueMonitorProps) {
  // Get current launch queue
  const { data: queue = [], isLoading } = useQuery<Launch[]>({
    queryKey: ['/api/launches/queue'],
    refetchInterval: 10000, // Refresh every 10 seconds like SpeedyDock
  });

  // Get customer and boat data for enrichment
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  const { data: boats = [] } = useQuery<Boat[]>({
    queryKey: ['/api/boats'],
  });

  // Enrich queue with customer and boat details
  const enrichedQueue: QueuedLaunchWithDetails[] = queue.map(launch => {
    const customer = customers.find(c => c.id === launch.customerId);
    const boat = boats.find(b => b.id === launch.boatId);
    
    return {
      ...launch,
      customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown Customer',
      boatInfo: boat ? `${boat.year} ${boat.make} ${boat.model}` : 'Unknown Boat',
    };
  });

  // Display limited queue for compact view
  const displayQueue = showFullQueue ? enrichedQueue : enrichedQueue.slice(0, maxDisplay);

  const getStatusInfo = (launch: Launch) => {
    switch (launch.status) {
      case 'checked_in':
        return {
          color: 'bg-blue-500',
          textColor: 'text-blue-700',
          bgColor: 'bg-blue-50',
          text: 'Just Checked In',
          icon: MapPin,
        };
      case 'queued':
        return {
          color: 'bg-yellow-500',
          textColor: 'text-yellow-700',
          bgColor: 'bg-yellow-50',
          text: `Position ${launch.queuePosition || 'TBD'}`,
          icon: Users,
        };
      case 'in_progress':
        return {
          color: 'bg-green-500',
          textColor: 'text-green-700',
          bgColor: 'bg-green-50',
          text: 'Being Prepared',
          icon: Zap,
        };
      default:
        return {
          color: 'bg-gray-500',
          textColor: 'text-gray-700',
          bgColor: 'bg-gray-50',
          text: launch.status,
          icon: AlertTriangle,
        };
    }
  };

  const getAverageWaitTime = () => {
    const waitTimes = enrichedQueue
      .filter(l => l.estimatedWaitTime && l.estimatedWaitTime > 0)
      .map(l => l.estimatedWaitTime || 0);
    
    if (waitTimes.length === 0) return 'N/A';
    
    const average = waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length;
    return `${Math.round(average)} min`;
  };

  const getQueueProgress = (queuePosition: number | null) => {
    if (!queuePosition) return 0;
    const totalInQueue = enrichedQueue.filter(l => l.status === 'queued').length;
    if (totalInQueue === 0) return 100;
    return Math.max(5, ((totalInQueue - queuePosition + 1) / totalInQueue) * 100);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="animate-pulse">
            <div className="h-6 bg-muted rounded w-48 mb-2" />
            <div className="h-4 bg-muted rounded w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse p-4 border border-border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-muted rounded-full" />
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded w-32" />
                      <div className="h-3 bg-muted rounded w-24" />
                    </div>
                  </div>
                  <div className="h-6 bg-muted rounded w-20" />
                </div>
              </div>
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
            <Clock className="text-chart-1" size={24} />
            <div>
              <h3 className="text-lg font-semibold">Live Launch Queue</h3>
              <p className="text-sm text-muted-foreground">SpeedyDock-style queue monitor</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-chart-1">{enrichedQueue.length}</div>
            <div className="text-xs text-muted-foreground">in queue</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Queue Stats */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
          <div className="text-center">
            <div className="text-lg font-semibold">
              {enrichedQueue.filter(l => l.status === 'queued').length}
            </div>
            <div className="text-xs text-muted-foreground">Queued</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">
              {enrichedQueue.filter(l => l.status === 'in_progress').length}
            </div>
            <div className="text-xs text-muted-foreground">In Progress</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">{getAverageWaitTime()}</div>
            <div className="text-xs text-muted-foreground">Avg Wait</div>
          </div>
        </div>

        {/* Queue List */}
        {displayQueue.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">Queue is empty</p>
            <p className="text-sm">No boats currently waiting for launch</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayQueue.map((launch, index) => {
              const statusInfo = getStatusInfo(launch);
              const StatusIcon = statusInfo.icon;
              const isNext = index === 0 && launch.status === 'queued';
              
              return (
                <div
                  key={launch.id}
                  className={`relative flex items-center justify-between p-4 border rounded-lg transition-all duration-300 ${
                    isNext 
                      ? 'border-green-200 bg-green-50 shadow-md' 
                      : 'border-border hover:bg-muted/50'
                  }`}
                  data-testid={`queue-item-${launch.id}`}
                >
                  {isNext && (
                    <div className="absolute -top-2 -right-2">
                      <Badge className="bg-green-500 text-white shadow-lg animate-pulse">
                        NEXT
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 ${statusInfo.color} rounded-full`} />
                      <StatusIcon size={16} className={statusInfo.textColor} />
                    </div>
                    
                    <div>
                      <p className="font-medium">{launch.customerName}</p>
                      <p className="text-sm text-muted-foreground">{launch.boatInfo}</p>
                      {launch.scheduledTime && (
                        <p className="text-xs text-muted-foreground">
                          Scheduled: {new Date(launch.scheduledTime.toString()).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <Badge 
                        variant="outline" 
                        className={`${statusInfo.textColor} border-current`}
                      >
                        {statusInfo.text}
                      </Badge>
                      
                      {launch.estimatedWaitTime && launch.status === 'queued' && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-muted-foreground">
                            Est. wait: {launch.estimatedWaitTime}min
                          </p>
                          {launch.queuePosition && (
                            <Progress
                              value={getQueueProgress(launch.queuePosition)}
                              className="h-1 w-16"
                            />
                          )}
                        </div>
                      )}
                      
                      {launch.status === 'checked_in' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {launch.checkedInAt && (
                            <>Checked in: {new Date(launch.checkedInAt.toString()).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}</>
                          )}
                        </p>
                      )}
                    </div>

                    {launch.priorityLevel && launch.priorityLevel !== 'normal' && (
                      <Badge 
                        variant={launch.priorityLevel === 'high' || launch.priorityLevel === 'urgent' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {launch.priorityLevel.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Show more indicator */}
            {!showFullQueue && enrichedQueue.length > maxDisplay && (
              <div className="text-center py-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  +{enrichedQueue.length - maxDisplay} more boats in queue
                </p>
              </div>
            )}
          </div>
        )}

        {/* Real-time indicator */}
        <div className="flex items-center justify-center space-x-2 pt-4 border-t border-border">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <p className="text-xs text-muted-foreground">
            Live updates • Last updated: {new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}