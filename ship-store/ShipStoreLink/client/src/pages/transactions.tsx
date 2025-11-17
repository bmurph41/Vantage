import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function Transactions() {
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 20;

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["/api/transactions", limit, (currentPage - 1) * limit],
  });

  const { data: transactionCount } = useQuery({
    queryKey: ["/api/transactions/count"],
  });

  const totalPages = Math.ceil((transactionCount?.count || 0) / limit);

  const filteredTransactions = transactions?.filter((transaction: any) => {
    const matchesPaymentMethod = !paymentMethodFilter || transaction.paymentMethod === paymentMethodFilter;
    const matchesSearch = !searchTerm || 
      transaction.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.items.some((item: any) => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesMinAmount = !minAmount || Number(transaction.total) >= Number(minAmount);
    const matchesMaxAmount = !maxAmount || Number(transaction.total) <= Number(maxAmount);
    
    return matchesPaymentMethod && matchesSearch && matchesMinAmount && matchesMaxAmount;
  }) || [];

  const generateReceipt = (transaction: any) => {
    const receiptData = {
      id: transaction.id,
      date: new Date(transaction.createdAt).toLocaleDateString(),
      time: new Date(transaction.createdAt).toLocaleTimeString(),
      items: transaction.items,
      subtotal: Number(transaction.subtotal),
      tax: Number(transaction.tax),
      total: Number(transaction.total),
      paymentMethod: transaction.paymentMethod,
    };

    // In a real application, this would generate and download a PDF receipt
    console.log("Receipt data:", receiptData);
    alert("Receipt generated! Check console for details.");
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="transactions-title">Transaction History</h2>
          <p className="text-muted-foreground">Complete record of all store transactions</p>
        </div>
        <div className="flex space-x-2">
          <Input
            type="date"
            className="w-40"
            data-testid="start-date"
          />
          <Input
            type="date"
            className="w-40"
            data-testid="end-date"
          />
          <Button data-testid="filter-dates">
            Filter
          </Button>
        </div>
      </div>

      {/* Transaction Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Payment Method:</label>
              <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                <SelectTrigger className="w-32" data-testid="payment-method-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Amount Range:</label>
              <Input
                type="number"
                placeholder="Min"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-20"
                data-testid="min-amount"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="number"
                placeholder="Max"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-20"
                data-testid="max-amount"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Search transaction..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48"
                data-testid="search-transactions"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 font-medium text-muted-foreground">Transaction ID</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Date & Time</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Items</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Subtotal</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Tax</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Total</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Payment</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-muted-foreground">
                      Loading transactions...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-muted-foreground">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction: any) => (
                    <tr 
                      key={transaction.id} 
                      className="border-b border-border last:border-b-0 hover:bg-muted/20"
                      data-testid={`transaction-row-${transaction.id.slice(-8)}`}
                    >
                      <td className="p-3 font-mono text-sm">#{transaction.id.slice(-8)}</td>
                      <td className="p-3 text-sm">
                        {new Date(transaction.createdAt).toLocaleDateString()} {new Date(transaction.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="p-3">
                        <div className="text-sm">{transaction.items.length} items</div>
                        <div className="text-xs text-muted-foreground">
                          {transaction.items.slice(0, 2).map((item: any) => item.name).join(", ")}
                          {transaction.items.length > 2 && "..."}
                        </div>
                      </td>
                      <td className="p-3 text-sm">${Number(transaction.subtotal).toFixed(2)}</td>
                      <td className="p-3 text-sm">${Number(transaction.tax).toFixed(2)}</td>
                      <td className="p-3 font-medium">${Number(transaction.total).toFixed(2)}</td>
                      <td className="p-3">
                        <Badge 
                          variant={transaction.paymentMethod === "stripe" ? "default" : "secondary"}
                          className="capitalize"
                        >
                          {transaction.paymentMethod}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge 
                          variant={transaction.status === "completed" ? "default" : "destructive"}
                          className="capitalize"
                        >
                          {transaction.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generateReceipt(transaction)}
                            data-testid={`receipt-${transaction.id.slice(-8)}`}
                          >
                            Receipt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={transaction.status === "refunded"}
                            data-testid={`refund-${transaction.id.slice(-8)}`}
                          >
                            Refund
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * limit) + 1}-{Math.min(currentPage * limit, transactionCount?.count || 0)} of {transactionCount?.count || 0} transactions
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                data-testid="prev-page"
              >
                Previous
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + 1;
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    data-testid={`page-${page}`}
                  >
                    {page}
                  </Button>
                );
              })}
              {totalPages > 5 && (
                <>
                  <span className="px-3 py-2 text-muted-foreground text-sm">...</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                    data-testid={`page-${totalPages}`}
                  >
                    {totalPages}
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                data-testid="next-page"
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
