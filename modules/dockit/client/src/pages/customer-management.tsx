import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/top-bar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Users, Ship, CreditCard } from "lucide-react";
import type { Customer, Boat, Lease, Payment } from "@shared/schema";

export default function CustomerManagement() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  const { data: boats = [] } = useQuery<Boat[]>({
    queryKey: ['/api/boats'],
  });

  const { data: leases = [] } = useQuery<Lease[]>({
    queryKey: ['/api/leases'],
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ['/api/payments'],
  });

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer => {
    const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
    const email = customer.email.toLowerCase();
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || email.includes(search);
  });

  // Get customer statistics
  const getCustomerStats = (customerId: string) => {
    const customerBoats = boats.filter(boat => boat.customerId === customerId);
    const customerLeases = leases.filter(lease => lease.customerId === customerId);
    const customerPayments = payments.filter(payment => payment.customerId === customerId);
    const overduePayments = customerPayments.filter(payment => 
      payment.status === 'pending' && new Date(payment.dueDate) < new Date()
    );

    return {
      boatsCount: customerBoats.length,
      activeLeasesCount: customerLeases.filter(lease => lease.status === 'active').length,
      overduePaymentsCount: overduePayments.length,
      totalOwed: overduePayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0),
    };
  };

  const getPaymentStatusBadge = (overdueCount: number) => {
    if (overdueCount === 0) {
      return <Badge className="bg-accent text-accent-foreground">Current</Badge>;
    } else if (overdueCount <= 2) {
      return <Badge variant="secondary">Behind</Badge>;
    } else {
      return <Badge variant="destructive">Overdue</Badge>;
    }
  };

  if (customersLoading) {
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
                  <div key={i} className="h-32 bg-muted rounded-lg" />
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
              <h1 className="text-3xl font-bold">Customer Management</h1>
              <p className="text-muted-foreground">Manage customer profiles, boats, and lease information</p>
            </div>
            <Button data-testid="button-add-customer">
              <Plus size={16} className="mr-2" />
              Add Customer
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card data-testid="total-customers">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-chart-1 rounded-lg flex items-center justify-center">
                    <Users className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Customers</p>
                    <p className="text-2xl font-bold">{customers.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="total-boats">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-chart-2 rounded-lg flex items-center justify-center">
                    <Ship className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Boats</p>
                    <p className="text-2xl font-bold">{boats.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="active-leases">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-chart-3 rounded-lg flex items-center justify-center">
                    <CreditCard className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Leases</p>
                    <p className="text-2xl font-bold">
                      {leases.filter(lease => lease.status === 'active').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Customer Directory</h3>
                <div className="relative w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input
                    type="search"
                    placeholder="Search customers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="search-customers"
                  />
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {searchTerm ? (
                    <div>
                      <Search size={48} className="mx-auto mb-4 opacity-50" />
                      <p className="text-lg">No customers found</p>
                      <p>Try adjusting your search terms</p>
                    </div>
                  ) : (
                    <div>
                      <Users size={48} className="mx-auto mb-4 opacity-50" />
                      <p className="text-lg">No customers yet</p>
                      <p>Click "Add Customer" to get started</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredCustomers.map((customer) => {
                    const stats = getCustomerStats(customer.id);
                    return (
                      <div
                        key={customer.id}
                        className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                        data-testid={`customer-${customer.id}`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                            <span className="text-lg font-medium">
                              {customer.firstName[0]}{customer.lastName[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-lg">
                              {customer.firstName} {customer.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">{customer.email}</p>
                            {customer.phone && (
                              <p className="text-sm text-muted-foreground">{customer.phone}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-6">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Boats</p>
                            <p className="font-medium">{stats.boatsCount}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Active Leases</p>
                            <p className="font-medium">{stats.activeLeasesCount}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Payment Status</p>
                            {getPaymentStatusBadge(stats.overduePaymentsCount)}
                          </div>
                          {stats.totalOwed > 0 && (
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground">Owed</p>
                              <p className="font-medium text-destructive">
                                ${stats.totalOwed.toLocaleString()}
                              </p>
                            </div>
                          )}
                          <Button variant="outline" size="sm" data-testid={`button-view-${customer.id}`}>
                            View Details
                          </Button>
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
    </div>
  );
}
