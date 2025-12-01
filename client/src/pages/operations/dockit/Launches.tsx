import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Ship, Plus, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import DockitAppShell from "@/components/dockit/DockitAppShell";

export default function DockitLaunches() {
  const { data: launches, isLoading } = useQuery({
    queryKey: ["/dockit/api/launches/today"],
    retry: false,
  });

  const { data: queue } = useQuery({
    queryKey: ["/dockit/api/launches/queue"],
    retry: false,
  });

  return (
    <DockitAppShell title="Launch Schedule" description="Manage boat launches and haul-outs">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search launches..." className="pl-9" data-testid="input-search-launches" />
            </div>
            <Button variant="outline" size="icon" data-testid="button-filter-launches">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
          <Button data-testid="button-schedule-launch">
            <Plus className="h-4 w-4 mr-2" />
            Schedule Launch
          </Button>
        </div>

        {/* Today's Queue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Today's Launch Queue
            </CardTitle>
            <CardDescription>
              {isLoading ? "Loading..." : `${Array.isArray(launches) ? launches.length : 0} launches scheduled`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : !launches || (Array.isArray(launches) && launches.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Ship className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No launches scheduled for today</p>
                <Button variant="link" className="mt-2" data-testid="button-schedule-first-launch">
                  Schedule the first launch
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {Array.isArray(launches) && launches.map((launch: any, index: number) => (
                  <div 
                    key={launch.id || index} 
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    data-testid={`launch-item-${index}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Ship className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{launch.customerName || 'Unknown Customer'}</p>
                        <p className="text-sm text-muted-foreground">
                          {launch.boatName || 'Unknown Boat'} - Slip {launch.slipNumber || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3" />
                          {launch.scheduledTime || 'TBD'}
                        </div>
                        <Badge variant={launch.status === 'completed' ? 'default' : 'secondary'}>
                          {launch.status || 'pending'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Launch Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Ship className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed Today</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Calendar className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{Array.isArray(queue) ? queue.length : 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DockitAppShell>
  );
}
