import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/top-bar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Clock, Ship } from "lucide-react";
import LaunchModal from "@/components/modals/launch-modal";
import type { Launch, Customer, Boat } from "@shared/schema";

interface LaunchWithDetails extends Launch {
  customerName: string;
  boatInfo: string;
}

export default function LaunchScheduling() {
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);

  const { data: launches = [], isLoading } = useQuery<Launch[]>({
    queryKey: ['/api/launches'],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  const { data: boats = [] } = useQuery<Boat[]>({
    queryKey: ['/api/boats'],
  });

  // Enrich launches with customer and boat details
  const enrichedLaunches: LaunchWithDetails[] = launches.map(launch => {
    const customer = customers.find(c => c.id === launch.customerId);
    const boat = boats.find(b => b.id === launch.boatId);
    
    return {
      ...launch,
      customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown Customer',
      boatInfo: boat ? `${boat.year} ${boat.make} ${boat.model}` : 'Unknown Boat',
    };
  }).sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="default">Scheduled</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">In Progress</Badge>;
      case 'launched':
        return <Badge className="bg-accent text-accent-foreground">Launched</Badge>;
      case 'retrieved':
        return <Badge variant="outline">Retrieved</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <TopBar />
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-64" />
              <div className="grid gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-24 bg-muted rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <TopBar />
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Launch Scheduling</h1>
              <p className="text-muted-foreground">Manage boat launch schedules and operations</p>
            </div>
            <Button onClick={() => setIsLaunchModalOpen(true)} data-testid="button-schedule-launch">
              <Plus size={16} className="mr-2" />
              Schedule Launch
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card data-testid="scheduled-launches">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-chart-1 rounded-lg flex items-center justify-center">
                    <Calendar className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Scheduled Today</p>
                    <p className="text-2xl font-bold">
                      {enrichedLaunches.filter(l => {
                        const today = new Date().toDateString();
                        return new Date(l.scheduledTime).toDateString() === today && l.status === 'scheduled';
                      }).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="in-progress-launches">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-chart-4 rounded-lg flex items-center justify-center">
                    <Clock className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">In Progress</p>
                    <p className="text-2xl font-bold">
                      {enrichedLaunches.filter(l => l.status === 'in_progress').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="launched-boats">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                    <Ship className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Currently Out</p>
                    <p className="text-2xl font-bold">
                      {enrichedLaunches.filter(l => l.status === 'launched').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">All Launch Schedules</h3>
                <div className="text-sm text-muted-foreground">
                  {enrichedLaunches.length} total launches
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {enrichedLaunches.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No launches scheduled</p>
                  <p>Click "Schedule Launch" to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {enrichedLaunches.map((launch) => {
                    const { date, time } = formatDateTime(launch.scheduledTime.toString());
                    return (
                      <div
                        key={launch.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                        data-testid={`launch-${launch.id}`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="flex flex-col items-center">
                            <p className="text-sm font-medium">{date}</p>
                            <p className="text-lg font-bold">{time}</p>
                          </div>
                          <div className="border-r border-border h-12" />
                          <div>
                            <p className="font-medium">{launch.customerName}</p>
                            <p className="text-sm text-muted-foreground">{launch.boatInfo}</p>
                            {launch.notes && (
                              <p className="text-xs text-muted-foreground mt-1">{launch.notes}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          {getStatusBadge(launch.status)}
                          {launch.status === 'scheduled' && (
                            <Button variant="secondary" size="sm">
                              Start Launch
                            </Button>
                          )}
                          {launch.status === 'in_progress' && (
                            <Button variant="outline" size="sm">
                              Complete
                            </Button>
                          )}
                          {launch.status === 'launched' && (
                            <Button variant="outline" size="sm">
                              Retrieve
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <LaunchModal 
        isOpen={isLaunchModalOpen}
        onClose={() => setIsLaunchModalOpen(false)}
      />
    </div>
  );
}
