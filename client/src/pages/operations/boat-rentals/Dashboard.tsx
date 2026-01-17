import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Anchor, DollarSign, Calendar, Ship,
  Clock, CheckCircle2, Loader, Plus,
  ArrowUpRight, Users
} from "lucide-react";
import { Link } from "wouter";
import { ContextIntegrationsPanel } from "@/components/integrations/ContextIntegrationsPanel";

interface RentalStats {
  totalRentals: number;
  pendingRentals: number;
  confirmedRentals: number;
  activeRentals: number;
  completedRentals: number;
  cancelledRentals: number;
  totalRevenue: number;
  avgRentalValue: number;
  fleetSize: number;
  availableBoats: number;
  utilizationRate: number;
}

interface Rental {
  id: string;
  rentalNumber: string;
  customerName: string;
  status: string;
  startDateTime: string;
  endDateTime: string;
  totalAmount: string;
  pricingType: string;
  boatId: string;
}

interface FleetBoat {
  id: string;
  name: string;
  make?: string;
  model?: string;
  status: string;
  hourlyRate?: string;
  fullDayRate?: string;
}

export default function BoatRentalsDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<RentalStats>({
    queryKey: ['/api/boat-rentals/rentals/stats'],
  });

  const { data: rentals = [], isLoading: rentalsLoading } = useQuery<Rental[]>({
    queryKey: ['/api/boat-rentals/rentals'],
  });

  const { data: fleet = [] } = useQuery<FleetBoat[]>({
    queryKey: ['/api/boat-rentals/fleet'],
  });

  const upcomingRentals = rentals
    .filter(r => r.status === 'confirmed' || r.status === 'pending')
    .slice(0, 5);
  
  const activeRentals = rentals.filter(r => r.status === 'checked_out');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'confirmed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'checked_out': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'returned': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getBoatStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'reserved': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'rented': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'maintenance': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header 
        title="Boat Rentals" 
        subtitle="Fleet management and rental reservations"
      />

      <div className="flex justify-between items-center">
        <Tabs defaultValue="overview" className="w-full">
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="fleet">Fleet</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Link href="/operations/boat-rentals/reservations">
                <Button data-testid="btn-new-rental">
                  <Plus className="h-4 w-4 mr-2" />
                  New Rental
                </Button>
              </Link>
            </div>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Rentals</p>
                      <p className="text-2xl font-bold" data-testid="stat-total-rentals">{stats?.totalRentals || 0}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active Rentals</p>
                      <p className="text-2xl font-bold" data-testid="stat-active-rentals">{stats?.activeRentals || 0}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Ship className="h-6 w-6 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                      <p className="text-2xl font-bold" data-testid="stat-total-revenue">{formatCurrency(stats?.totalRevenue || 0)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Fleet Utilization</p>
                      <p className="text-2xl font-bold" data-testid="stat-utilization">{(stats?.utilizationRate || 0).toFixed(0)}%</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <Anchor className="h-6 w-6 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Reservations</CardTitle>
                  <CardDescription>Confirmed and pending rentals</CardDescription>
                </CardHeader>
                <CardContent>
                  {rentalsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader className="h-6 w-6 animate-spin" />
                    </div>
                  ) : upcomingRentals.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No upcoming rentals</p>
                  ) : (
                    <div className="space-y-4">
                      {upcomingRentals.map((rental) => (
                        <div key={rental.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`rental-${rental.id}`}>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{rental.rentalNumber}</span>
                              <Badge className={getStatusColor(rental.status)}>{rental.status.replace('_', ' ')}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{rental.customerName}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(rental.startDateTime)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(parseFloat(rental.totalAmount))}</p>
                            <p className="text-xs text-muted-foreground">{rental.pricingType}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ship className="h-5 w-5 text-green-500" />
                    Currently Out
                  </CardTitle>
                  <CardDescription>Boats currently checked out</CardDescription>
                </CardHeader>
                <CardContent>
                  {activeRentals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Anchor className="h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">All boats are docked</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeRentals.slice(0, 5).map((rental) => (
                        <div key={rental.id} className="flex items-center justify-between p-3 border border-green-200 dark:border-green-900 rounded-lg bg-green-50 dark:bg-green-950">
                          <div className="space-y-1">
                            <span className="font-medium">{rental.rentalNumber}</span>
                            <p className="text-sm">{rental.customerName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">Return by:</p>
                            <p className="text-xs">{formatDate(rental.endDateTime)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="fleet">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Fleet Overview</CardTitle>
                  <CardDescription>{stats?.fleetSize || 0} boats total, {stats?.availableBoats || 0} available</CardDescription>
                </div>
                <Link href="/operations/boat-rentals/fleet">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Boat
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {fleet.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No boats in fleet</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {fleet.slice(0, 6).map((boat) => (
                      <div key={boat.id} className="p-4 border rounded-lg" data-testid={`fleet-boat-${boat.id}`}>
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium">{boat.name}</h4>
                          <Badge className={getBoatStatusColor(boat.status)}>{boat.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{boat.make} {boat.model}</p>
                        <div className="mt-2 pt-2 border-t">
                          <div className="flex justify-between text-sm">
                            <span>Hourly: {boat.hourlyRate ? formatCurrency(parseFloat(boat.hourlyRate)) : '-'}</span>
                            <span>Day: {boat.fullDayRate ? formatCurrency(parseFloat(boat.fullDayRate)) : '-'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-6">
                  <Link href="/operations/boat-rentals/fleet">
                    <Button variant="outline" className="w-full">
                      View All Fleet
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar">
            <Card>
              <CardHeader>
                <CardTitle>Rental Calendar</CardTitle>
                <CardDescription>View all reservations on the calendar</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-8">
                  View the full calendar with all bookings and availability.
                </p>
                <Link href="/operations/boat-rentals/calendar">
                  <Button variant="outline" className="w-full">
                    Open Calendar View
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations">
            <ContextIntegrationsPanel contextKey="boatRentals" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
