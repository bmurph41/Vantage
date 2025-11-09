import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { NewSaleModal } from "@/components/fuel/new-sale-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TransactionsResponse } from "@/types/fuel-api";
import { CalendarIcon, Download, Filter, Search } from "lucide-react";

export default function Transactions() {
  const [isNewSaleModalOpen, setIsNewSaleModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  const { data: transactions = [], isLoading } = useQuery<TransactionsResponse>({
    queryKey: ['/api/operations/fuel-sales', { limit: 100 }],
  });

  const getPaymentMethodBadge = (method: string) => {
    const variants: Record<string, string> = {
      cash: "bg-green-100 text-green-800",
      check: "bg-yellow-100 text-yellow-800",
    };
    return variants[method] || "bg-gray-100 text-gray-800";
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      completed: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      failed: "bg-red-100 text-red-800",
      refunded: "bg-gray-100 text-gray-800",
    };
    return variants[status] || "bg-gray-100 text-gray-800";
  };

  const filteredTransactions = transactions?.filter((transaction) => {
    const matchesSearch = !searchTerm || 
      transaction.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.fuelType?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || statusFilter === 'all' || transaction.status === statusFilter;
    const matchesPayment = !paymentFilter || paymentFilter === 'all' || transaction.paymentMethod === paymentFilter;
    
    return matchesSearch && matchesStatus && matchesPayment;
  }) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      <Header 
        title="Sales Transactions"
        subtitle="Track and manage all fuel sales transactions"
      />

      <div className="p-6 space-y-6">
        {/* Actions */}
        <div className="flex justify-end">
          <Button 
            onClick={() => setIsNewSaleModalOpen(true)}
            data-testid="button-new-sale"
          >
            Record New Sale
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center" data-testid="filters-title">
              <Filter className="w-5 h-5 mr-2" />
              Filter Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search customers or fuel types..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>

              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger data-testid="select-payment-filter">
                  <SelectValue placeholder="All payment methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All payment methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex space-x-2">
                <Button variant="outline" size="sm" data-testid="button-date-filter">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  Date Range
                </Button>
                <Button variant="outline" size="sm" data-testid="button-export">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle data-testid="transactions-table-title">
              All Transactions ({filteredTransactions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date & Time</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Customer</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Fuel Type</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Gallons</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Price/Gal</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Total</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Payment</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTransactions.map((transaction, index) => (
                    <tr key={transaction.id} className="hover:bg-muted/30">
                      <td className="p-4 text-sm text-foreground" data-testid={`row-date-${index}`}>
                        <div>
                          <div className="font-medium">
                            {new Date(transaction.createdAt).toLocaleDateString()}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {new Date(transaction.createdAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-foreground" data-testid={`row-customer-${index}`}>
                        <div>
                          {transaction.customerName && (
                            <div className="font-medium">{transaction.customerName}</div>
                          )}
                          {transaction.customerEmail && (
                            <div className="text-muted-foreground text-xs">{transaction.customerEmail}</div>
                          )}
                          {!transaction.customerName && !transaction.customerEmail && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-foreground" data-testid={`row-fuel-${index}`}>
                        {transaction.fuelType?.name}
                      </td>
                      <td className="p-4 text-sm text-foreground" data-testid={`row-gallons-${index}`}>
                        {parseFloat(transaction.gallons).toFixed(1)}
                      </td>
                      <td className="p-4 text-sm text-foreground" data-testid={`row-price-${index}`}>
                        ${parseFloat(transaction.pricePerGallon).toFixed(3)}
                      </td>
                      <td className="p-4 text-sm font-medium text-foreground" data-testid={`row-total-${index}`}>
                        ${parseFloat(transaction.totalAmount).toFixed(2)}
                      </td>
                      <td className="p-4 text-sm">
                        <Badge className={getPaymentMethodBadge(transaction.paymentMethod)} data-testid={`row-payment-${index}`}>
                          {transaction.paymentMethod}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm">
                        <Badge className={getStatusBadge(transaction.status)} data-testid={`row-status-${index}`}>
                          {transaction.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm">
                        <Button variant="ghost" size="sm" data-testid={`button-view-${index}`}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <NewSaleModal 
        isOpen={isNewSaleModalOpen}
        onClose={() => setIsNewSaleModalOpen(false)}
      />
    </>
  );
}
