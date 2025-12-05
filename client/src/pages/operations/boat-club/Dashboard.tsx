import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, DollarSign, Calendar, Ship,
  TrendingUp, Award, Loader, Plus,
  ArrowUpRight, Clock
} from "lucide-react";
import { Link } from "wouter";

interface ClubStats {
  totalMembers: number;
  activeMembers: number;
  pendingMembers: number;
  suspendedMembers: number;
  expiredMembers: number;
  monthlyRecurringRevenue: number;
  membersByTier: { tier: string; count: number }[];
  avgHoursUsed: number;
}

interface Membership {
  id: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  tier: string;
  status: string;
  monthlyFee: string;
  hoursIncluded?: number;
  hoursUsedThisMonth?: string;
  renewalDate?: string;
}

interface Booking {
  id: string;
  bookingNumber: string;
  membershipId: string;
  status: string;
  startDateTime: string;
  endDateTime: string;
  hoursBooked: string;
}

export default function BoatClubDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<ClubStats>({
    queryKey: ['/api/boat-club/memberships/stats'],
  });

  const { data: memberships = [], isLoading: membershipsLoading } = useQuery<Membership[]>({
    queryKey: ['/api/boat-club/memberships'],
  });

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ['/api/boat-club/bookings'],
  });

  const recentMembers = memberships.slice(0, 5);
  const upcomingBookings = bookings
    .filter(b => b.status === 'confirmed' || b.status === 'pending')
    .slice(0, 5);

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
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'suspended': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'expired': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'silver': return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200';
      case 'gold': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'platinum': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'unlimited': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
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
        title="Boat Club" 
        subtitle="Membership management and boat reservations"
      />

      <div className="flex justify-between items-center">
        <Tabs defaultValue="overview" className="w-full">
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="bookings">Bookings</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Link href="/operations/boat-club/members">
                <Button data-testid="btn-new-member">
                  <Plus className="h-4 w-4 mr-2" />
                  New Member
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
                      <p className="text-sm font-medium text-muted-foreground">Active Members</p>
                      <p className="text-2xl font-bold" data-testid="stat-active-members">{stats?.activeMembers || 0}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Monthly Revenue</p>
                      <p className="text-2xl font-bold" data-testid="stat-mrr">{formatCurrency(stats?.monthlyRecurringRevenue || 0)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Annual Revenue</p>
                      <p className="text-2xl font-bold" data-testid="stat-arr">{formatCurrency((stats?.monthlyRecurringRevenue || 0) * 12)}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Hours Used</p>
                      <p className="text-2xl font-bold" data-testid="stat-avg-hours">{(stats?.avgHoursUsed || 0).toFixed(1)}h</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <Clock className="h-6 w-6 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Membership by Tier</CardTitle>
                  <CardDescription>Distribution of active members across tiers</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats?.membersByTier?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No members yet</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {['bronze', 'silver', 'gold', 'platinum', 'unlimited'].map(tier => {
                        const tierData = stats?.membersByTier?.find(t => t.tier === tier);
                        return (
                          <div key={tier} className="text-center p-4 border rounded-lg">
                            <Badge className={`${getTierColor(tier)} mb-2`}>{tier}</Badge>
                            <p className="text-2xl font-bold">{tierData?.count || 0}</p>
                            <p className="text-xs text-muted-foreground">members</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Member Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Active</span>
                      <span className="font-bold text-green-600">{stats?.activeMembers || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Pending</span>
                      <span className="font-bold text-yellow-600">{stats?.pendingMembers || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Suspended</span>
                      <span className="font-bold text-orange-600">{stats?.suspendedMembers || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Expired</span>
                      <span className="font-bold text-red-600">{stats?.expiredMembers || 0}</span>
                    </div>
                    <div className="pt-2 border-t flex justify-between items-center">
                      <span className="text-sm font-medium">Total</span>
                      <span className="font-bold">{stats?.totalMembers || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Members</CardTitle>
                  <CardDescription>Newest club members</CardDescription>
                </CardHeader>
                <CardContent>
                  {membershipsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader className="h-6 w-6 animate-spin" />
                    </div>
                  ) : recentMembers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No members found</p>
                  ) : (
                    <div className="space-y-4">
                      {recentMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`member-${member.id}`}>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{member.firstName} {member.lastName}</span>
                              <Badge className={getTierColor(member.tier)}>{member.tier}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{member.memberNumber}</p>
                          </div>
                          <div className="text-right">
                            <Badge className={getStatusColor(member.status)}>{member.status}</Badge>
                            <p className="text-sm mt-1">{formatCurrency(parseFloat(member.monthlyFee))}/mo</p>
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
                    <Calendar className="h-5 w-5 text-blue-500" />
                    Upcoming Bookings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {upcomingBookings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Ship className="h-12 w-12 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No upcoming bookings</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {upcomingBookings.map((booking) => (
                        <div key={booking.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="space-y-1">
                            <span className="font-medium">{booking.bookingNumber}</span>
                            <p className="text-sm text-muted-foreground">{formatDate(booking.startDateTime)}</p>
                          </div>
                          <div className="text-right">
                            <Badge className={getStatusColor(booking.status)}>{booking.status}</Badge>
                            <p className="text-sm mt-1">{booking.hoursBooked}h</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="members">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>All Members</CardTitle>
                  <CardDescription>Manage your boat club membership</CardDescription>
                </div>
                <Link href="/operations/boat-club/members">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <Link href="/operations/boat-club/members">
                  <Button variant="outline" className="w-full">
                    View All Members
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bookings">
            <Card>
              <CardHeader>
                <CardTitle>Booking Calendar</CardTitle>
                <CardDescription>View and manage member boat reservations</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/operations/boat-club/bookings">
                  <Button variant="outline" className="w-full">
                    View Booking Calendar
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
