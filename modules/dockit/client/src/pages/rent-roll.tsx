import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/top-bar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, CreditCard, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Payment, Customer, Lease, Slip } from "@shared/schema";

interface PaymentWithDetails extends Payment {
  customerName: string;
  slipNumber?: string;
  leaseInfo?: string;
}

export default function RentRoll() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { toast } = useToast();

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ['/api/payments'],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  const { data: leases = [] } = useQuery<Lease[]>({
    queryKey: ['/api/leases'],
  });

  const { data: slips = [] } = useQuery<Slip[]>({
    queryKey: ['/api/slips'],
  });

  const { data: overduePayments = [] } = useQuery<Payment[]>({
    queryKey: ['/api/payments/overdue'],
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ paymentId, paymentMethod }: { paymentId: string; paymentMethod: string }) => {
      return apiRequest('PUT', `/api/payments/${paymentId}`, {
        status: 'paid',
        paymentMethod,
        paidDate: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payments/overdue'] });
      toast({
        title: "Payment Recorded",
        description: "Payment has been successfully recorded.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to record payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Enrich payments with customer and lease details
  const enrichedPayments: PaymentWithDetails[] = payments.map(payment => {
    const customer = customers.find(c => c.id === payment.customerId);
    const lease = leases.find(l => l.id === payment.leaseId);
    const slip = lease ? slips.find(s => s.id === lease.slipId) : null;
    
    return {
      ...payment,
      customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown Customer',
      slipNumber: slip?.number,
      leaseInfo: lease ? `${slip?.number || 'Unknown Slip'} - $${lease.monthlyRate}/mo` : undefined,
    };
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  // Filter payments
  const filteredPayments = enrichedPayments.filter(payment => {
    const matchesSearch = payment.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (payment.slipNumber && payment.slipNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === "all" || payment.status === filterStatus ||
                         (filterStatus === "overdue" && payment.status === "pending" && new Date(payment.dueDate) < new Date());
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (payment: Payment) => {
    if (payment.status === 'paid') {
      return <Badge className="bg-accent text-accent-foreground">Paid</Badge>;
    } else if (payment.status === 'pending' && new Date(payment.dueDate) < new Date()) {
      return <Badge variant="destructive">Overdue</Badge>;
    } else if (payment.status === 'pending') {
      return <Badge variant="secondary">Pending</Badge>;
    } else if (payment.status === 'cancelled') {
      return <Badge variant="outline">Cancelled</Badge>;
    }
    return <Badge variant="outline">{payment.status}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleMarkPaid = (paymentId: string) => {
    markPaidMutation.mutate({ paymentId, paymentMethod: 'cash' });
  };

  // Calculate summary statistics
  const totalRevenue = payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const pendingAmount = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const overdueAmount = overduePayments
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  if (paymentsLoading) {
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
              <h1 className="text-3xl font-bold">Rent Roll Management</h1>
              <p className="text-muted-foreground">Payment tracking, billing, and automated rent collection</p>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" data-testid="button-send-reminders">
                <AlertTriangle size={16} className="mr-2" />
                Send Reminders
              </Button>
              <Button data-testid="button-add-payment">
                <Plus size={16} className="mr-2" />
                Add Payment
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card data-testid="total-revenue">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-chart-1 rounded-lg flex items-center justify-center">
                    <CheckCircle className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Collected</p>
                    <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="pending-payments">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-chart-4 rounded-lg flex items-center justify-center">
                    <Clock className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold">${pendingAmount.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="overdue-payments">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-destructive rounded-lg flex items-center justify-center">
                    <AlertTriangle className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Overdue</p>
                    <p className="text-2xl font-bold">${overdueAmount.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="collection-rate">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                    <CreditCard className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Collection Rate</p>
                    <p className="text-2xl font-bold">
                      {payments.length > 0 
                        ? Math.round((payments.filter(p => p.status === 'paid').length / payments.length) * 100)
                        : 0}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Payment Management</h3>
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                      type="search"
                      placeholder="Search payments..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                      data-testid="search-payments"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-32" data-testid="filter-status">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {filteredPayments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CreditCard size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No payments found</p>
                  <p>Try adjusting your search terms or filters</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                      data-testid={`payment-${payment.id}`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <p className="font-medium">{formatDate(payment.dueDate.toString())}</p>
                          <p className="text-sm text-muted-foreground">Due Date</p>
                        </div>
                        <div className="border-r border-border h-12" />
                        <div>
                          <p className="font-medium text-lg">{payment.customerName}</p>
                          {payment.leaseInfo && (
                            <p className="text-sm text-muted-foreground">{payment.leaseInfo}</p>
                          )}
                          {payment.paymentMethod && payment.status === 'paid' && (
                            <p className="text-xs text-muted-foreground">
                              Paid via {payment.paymentMethod} on {payment.paidDate ? formatDate(payment.paidDate.toString()) : 'Unknown'}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-6">
                        <div className="text-center">
                          <p className="text-lg font-bold">${payment.amount}</p>
                          <p className="text-sm text-muted-foreground">Amount</p>
                        </div>
                        <div className="text-center">
                          {getStatusBadge(payment)}
                        </div>
                        {payment.status === 'pending' && (
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleMarkPaid(payment.id)}
                              disabled={markPaidMutation.isPending}
                              data-testid={`button-mark-paid-${payment.id}`}
                            >
                              {markPaidMutation.isPending ? "Processing..." : "Mark Paid"}
                            </Button>
                            <Button variant="outline" size="sm" data-testid={`button-send-reminder-${payment.id}`}>
                              Send Reminder
                            </Button>
                          </div>
                        )}
                        {payment.status === 'paid' && (
                          <Button variant="ghost" size="sm" data-testid={`button-view-receipt-${payment.id}`}>
                            View Receipt
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
