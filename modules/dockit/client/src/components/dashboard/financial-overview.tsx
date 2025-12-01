import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUp, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Payment } from "@shared/schema";

export default function FinancialOverview() {
  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ['/api/payments'],
  });

  const { data: overduePayments = [] } = useQuery<Payment[]>({
    queryKey: ['/api/payments/overdue'],
  });

  // Calculate financial metrics
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const monthlyRevenue = payments
    .filter(payment => {
      const paymentDate = new Date(payment.paidDate || payment.dueDate);
      return paymentDate.getMonth() === currentMonth && 
             paymentDate.getFullYear() === currentYear &&
             payment.status === 'paid';
    })
    .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

  const outstandingAmount = overduePayments
    .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

  // Generate chart bars (simplified representation)
  const chartBars = Array.from({ length: 9 }, (_, i) => ({
    height: Math.random() * 100 + 20,
    opacity: 0.2 + (i * 0.1),
  }));

  if (isLoading) {
    return (
      <Card data-testid="financial-overview">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Financial Overview</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div className="h-20 bg-muted rounded-lg" />
                <div className="h-20 bg-muted rounded-lg" />
              </div>
              <div className="md:col-span-2 h-64 bg-muted rounded-lg" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="financial-overview">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Financial Overview</h3>
          <div className="flex items-center space-x-2">
            <Select defaultValue="this-month">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="this-year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button data-testid="button-generate-report">
              Generate Report
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg" data-testid="total-revenue">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Revenue</span>
                <ArrowUp className="text-accent" size={16} />
              </div>
              <p className="text-2xl font-bold text-foreground">
                ${monthlyRevenue.toLocaleString()}
              </p>
              <p className="text-sm text-accent">+8.2% from last month</p>
            </div>

            <div className="p-4 bg-muted rounded-lg" data-testid="outstanding-payments">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Outstanding</span>
                <AlertTriangle className="text-chart-4" size={16} />
              </div>
              <p className="text-2xl font-bold text-foreground">
                ${outstandingAmount.toLocaleString()}
              </p>
              <p className="text-sm text-chart-4">{overduePayments.length} overdue accounts</p>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="chart-container rounded-lg p-6 text-white">
              <h4 className="text-lg font-semibold mb-4">Revenue Trend</h4>
              <div className="h-48 flex items-end justify-between space-x-2">
                {chartBars.map((bar, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-t w-8"
                    style={{ 
                      height: `${bar.height}%`,
                      opacity: bar.opacity 
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-sm mt-2 opacity-80">
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'].map(month => (
                  <span key={month}>{month}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
