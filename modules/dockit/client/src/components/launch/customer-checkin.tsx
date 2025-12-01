import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { MapPin, Clock, CheckCircle, AlertCircle, Navigation } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Launch } from "@shared/schema";

interface CustomerCheckInProps {
  customerId?: string;
  className?: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export default function CustomerCheckIn({ customerId, className }: CustomerCheckInProps) {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationError, setLocationError] = useState<string>("");
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const queryClient = useQueryClient();

  // Get customer's upcoming launches using the correct endpoint
  const { data: launches = [], isLoading } = useQuery<Launch[]>({
    queryKey: ['/api/customers', customerId, 'launches'],
    queryFn: async () => {
      if (!customerId) return [];
      const response = await fetch(`/api/customers/${customerId}/launches?status=scheduled`);
      if (!response.ok) {
        throw new Error('Failed to fetch customer launches');
      }
      return response.json();
    },
    enabled: !!customerId,
  });

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async ({ launchId, location }: { launchId: string; location: LocationData }) => {
      return apiRequest(`/api/launches/${launchId}/checkin`, {
        method: 'POST',
        body: JSON.stringify({
          customerLocation: location,
          timestamp: Date.now(),
        }),
      });
    },
    onSuccess: () => {
      // Invalidate the customer-specific launches query
      queryClient.invalidateQueries({ queryKey: ['/api/customers', customerId, 'launches'] });
      // Also invalidate general launch queries in case they're used elsewhere
      queryClient.invalidateQueries({ queryKey: ['/api/launches'] });
    },
  });

  // Get current location using GPS (SpeedyDock style)
  const getCurrentLocation = () => {
    setIsGettingLocation(true);
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("Location services not supported by this browser");
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const locationData: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
        };
        setLocation(locationData);
        setIsGettingLocation(false);
      },
      (error) => {
        let errorMessage = "Unable to get your location";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied. Please enable location services and try again.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out.";
            break;
        }
        setLocationError(errorMessage);
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // Cache location for 1 minute
      }
    );
  };

  // Handle check-in for a specific launch
  const handleCheckIn = (launch: Launch) => {
    if (!location) {
      getCurrentLocation();
      return;
    }

    checkInMutation.mutate({
      launchId: launch.id,
      location,
    });
  };

  // Auto-get location on mount if we have launches
  useEffect(() => {
    if (launches.length > 0 && !location && !locationError) {
      getCurrentLocation();
    }
  }, [launches.length, location, locationError]);

  const getTimeUntilLaunch = (scheduledTime: string) => {
    const now = new Date();
    const launchTime = new Date(scheduledTime);
    const diffMinutes = Math.ceil((launchTime.getTime() - now.getTime()) / 60000);
    
    if (diffMinutes < 0) return "Launch time passed";
    if (diffMinutes < 60) return `${diffMinutes} minutes`;
    return `${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}m`;
  };

  const getStatusInfo = (launch: Launch) => {
    switch (launch.status) {
      case 'scheduled':
        return {
          color: 'bg-chart-1',
          text: 'Ready to Check In',
          canCheckIn: true,
        };
      case 'checked_in':
        return {
          color: 'bg-chart-4',
          text: 'Checked In - Entering Queue',
          canCheckIn: false,
        };
      case 'queued':
        return {
          color: 'bg-chart-2',
          text: `Queue Position: ${launch.queuePosition || 'TBD'}`,
          canCheckIn: false,
        };
      case 'in_progress':
        return {
          color: 'bg-chart-3',
          text: 'Being Prepared for Launch',
          canCheckIn: false,
        };
      case 'launched':
        return {
          color: 'bg-accent',
          text: 'Launched - Enjoy your day!',
          canCheckIn: false,
        };
      default:
        return {
          color: 'bg-muted',
          text: launch.status,
          canCheckIn: false,
        };
    }
  };

  if (!customerId) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <AlertCircle size={48} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Please log in to check in for your launches</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-12 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (launches.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <Clock size={48} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No upcoming launches scheduled</p>
          <p className="text-sm text-muted-foreground mt-2">
            Schedule a launch to use mobile check-in
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center space-x-3">
          <MapPin className="text-chart-1" size={24} />
          <div>
            <h3 className="text-lg font-semibold">Quick Check-In</h3>
            <p className="text-sm text-muted-foreground">SpeedyDock-style arrival check-in</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Location Status */}
        {locationError && (
          <Alert>
            <AlertCircle size={16} />
            <AlertDescription>
              {locationError}
              <Button 
                variant="link" 
                size="sm" 
                onClick={getCurrentLocation}
                className="ml-2 h-auto p-0"
                data-testid="retry-location"
              >
                Try Again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isGettingLocation && (
          <Alert>
            <Navigation size={16} className="animate-spin" />
            <AlertDescription>
              Getting your location... Make sure location services are enabled.
            </AlertDescription>
          </Alert>
        )}

        {location && !locationError && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle size={16} className="text-green-600" />
            <AlertDescription className="text-green-800">
              Location acquired - Ready for check-in!
              <span className="block text-xs text-green-600 mt-1">
                Accuracy: ±{Math.round(location.accuracy)}m
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Launches List */}
        <div className="space-y-3">
          {launches.slice(0, 3).map((launch) => {
            const statusInfo = getStatusInfo(launch);
            const timeUntil = getTimeUntilLaunch(launch.scheduledTime.toString());

            return (
              <div
                key={launch.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg"
                data-testid={`checkin-launch-${launch.id}`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 ${statusInfo.color} rounded-full`} />
                  <div>
                    <p className="font-medium">
                      {new Date(launch.scheduledTime.toString()).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">{timeUntil}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <Badge variant="secondary" className="text-xs">
                      {statusInfo.text}
                    </Badge>
                    {launch.estimatedWaitTime && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Est. wait: {launch.estimatedWaitTime}min
                      </p>
                    )}
                  </div>
                  
                  {statusInfo.canCheckIn && (
                    <Button
                      onClick={() => handleCheckIn(launch)}
                      disabled={!location || checkInMutation.isPending}
                      size="sm"
                      data-testid={`button-checkin-${launch.id}`}
                    >
                      {!location ? "Enable Location" : "Check In"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Queue Progress */}
        {launches.some(l => l.status === 'queued' && l.queuePosition) && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Queue Progress</span>
              <span className="text-xs text-muted-foreground">
                Position {launches.find(l => l.status === 'queued')?.queuePosition || 0}
              </span>
            </div>
            <Progress 
              value={Math.max(10, 100 - ((launches.find(l => l.status === 'queued')?.queuePosition || 1) * 10))} 
              className="h-2" 
            />
            <p className="text-xs text-muted-foreground mt-2">
              Estimated wait: {launches.find(l => l.status === 'queued')?.estimatedWaitTime || 'Calculating...'}
              {typeof launches.find(l => l.status === 'queued')?.estimatedWaitTime === 'number' ? ' minutes' : ''}
            </p>
          </div>
        )}

        {/* Help Text */}
        <div className="text-xs text-muted-foreground border-t border-border pt-4">
          <p>• Check in when you arrive at the marina</p>
          <p>• You'll be added to the launch queue automatically</p>
          <p>• Get real-time updates on your position and wait time</p>
        </div>
      </CardContent>
    </Card>
  );
}