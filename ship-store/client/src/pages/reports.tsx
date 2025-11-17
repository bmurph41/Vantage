import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { Scenario, Projection } from "@shared/schema";

export default function Reports() {
  const [timeRange, setTimeRange] = useState("7");
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: salesData } = useQuery({
    queryKey: ["/api/dashboard/sales-data", timeRange],
  });

  const { data: transactions } = useQuery({
    queryKey: ["/api/transactions/recent", "20"],
  });

  const { data: scenarios = [] } = useQuery<Scenario[]>({
    queryKey: ["/api/scenarios"],
  });

  const handleExportTransactions = async () => {
    try {
      const response = await fetch("/api/export/transactions");
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  const handleExportScenarioComparison = async () => {
    if (selectedScenarios.length < 2) {
      toast({
        title: "Selection Required",
        description: "Please select at least 2 scenarios to compare",
        variant: "destructive"
      });
      return;
    }

    try {
      const params = new URLSearchParams();
      selectedScenarios.forEach(id => params.append('scenarioIds', id));
      
      const response = await fetch(`/api/export/scenarios/compare?${params.toString()}`);
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scenario-comparison-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: `Comparison of ${selectedScenarios.length} scenarios downloaded`,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "Could not export scenario comparison",
        variant: "destructive"
      });
    }
  };

  const toggleScenario = (scenarioId: string) => {
    setSelectedScenarios(prev => 
      prev.includes(scenarioId)
        ? prev.filter(id => id !== scenarioId)
        : [...prev, scenarioId]
    );
  };

  // Sample report data
  const reportMetrics = {
    totalRevenue: 47832,
    avgDaily: 1594,
    peakDay: 2847,
    totalTransactions: 2384,
    avgOrderValue: 20.05,
    itemsPerTransaction: 2.3,
    stripePercent: 68,
    squarePercent: 28,
    cashPercent: 4,
  };

  const topProducts = [
    { rank: 1, name: "Coca Cola", category: "Beverages", unitsSold: 342, revenue: 1023.58, margin: 65 },
    { rank: 2, name: "Potato Chips", category: "Snacks", unitsSold: 298, revenue: 1040.02, margin: 72 },
    { rank: 3, name: "Energy Drink", category: "Beverages", unitsSold: 245, revenue: 1225.00, margin: 58 },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold" data-testid="reports-title">Reports & Analysis</h2>
        <p className="text-muted-foreground">Financial analytics, scenario comparisons, and export capabilities for PE firm analysis</p>
      </div>

      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sales" data-testid="tab-sales">Sales Reports</TabsTrigger>
          <TabsTrigger value="scenarios" data-testid="tab-scenarios">Scenario Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-48" data-testid="time-range-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="90">Last 3 Months</SelectItem>
                  <SelectItem value="365">This Year</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleExportTransactions} data-testid="export-report">
                <i className="fas fa-download mr-2"></i>
                Export to Excel
              </Button>
            </div>
          </div>

          {/* Report Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
            <CardTitle>Revenue Summary</CardTitle>
          </CardHeader>
              <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Revenue</span>
                <span className="font-bold" data-testid="total-revenue">${reportMetrics.totalRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Average Daily</span>
                <span className="font-medium" data-testid="avg-daily">${reportMetrics.avgDaily.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Peak Day</span>
                <span className="font-medium text-accent" data-testid="peak-day">${reportMetrics.peakDay.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
            </Card>

            <Card>
              <CardHeader>
            <CardTitle>Transaction Metrics</CardTitle>
          </CardHeader>
              <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Transactions</span>
                <span className="font-bold" data-testid="total-transactions">{reportMetrics.totalTransactions.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Order Value</span>
                <span className="font-medium" data-testid="avg-order-value">${reportMetrics.avgOrderValue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items per Transaction</span>
                <span className="font-medium" data-testid="items-per-transaction">{reportMetrics.itemsPerTransaction}</span>
              </div>
            </div>
          </CardContent>
            </Card>

            <Card>
              <CardHeader>
            <CardTitle>Payment Methods</CardTitle>
          </CardHeader>
              <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stripe (Card)</span>
                <span className="font-medium" data-testid="stripe-percent">{reportMetrics.stripePercent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Square (Mobile)</span>
                <span className="font-medium" data-testid="square-percent">{reportMetrics.squarePercent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cash</span>
                <span className="font-medium" data-testid="cash-percent">{reportMetrics.cashPercent}%</span>
              </div>
            </div>
          </CardContent>
            </Card>
          </div>

          {/* Detailed Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
            <CardTitle>Daily Sales Trend</CardTitle>
          </CardHeader>
              <CardContent>
            <div className="h-64 bg-muted/20 rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Daily sales trend chart would be rendered here</p>
            </div>
          </CardContent>
            </Card>

            <Card>
              <CardHeader>
            <CardTitle>Product Performance</CardTitle>
          </CardHeader>
              <CardContent>
            <div className="h-64 bg-muted/20 rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Product performance chart would be rendered here</p>
            </div>
          </CardContent>
            </Card>
          </div>

          {/* Top Products Table */}
          <Card>
            <CardHeader>
          <CardTitle>Top Performing Products</CardTitle>
        </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 font-medium text-muted-foreground">Rank</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Category</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Units Sold</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Revenue</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Margin</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product) => (
                  <tr key={product.rank} className="border-b border-border last:border-b-0" data-testid={`top-product-${product.rank}`}>
                    <td className="p-3 font-bold text-primary">#{product.rank}</td>
                    <td className="p-3 font-medium">{product.name}</td>
                    <td className="p-3 text-muted-foreground">{product.category}</td>
                    <td className="p-3">{product.unitsSold}</td>
                    <td className="p-3 font-medium">${product.revenue.toFixed(2)}</td>
                    <td className="p-3 text-accent">{product.margin}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scenarios" className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Compare Financial Scenarios</h3>
              <p className="text-sm text-muted-foreground">Select multiple scenarios to compare side-by-side and export to Excel for analysis</p>
            </div>
            <Button 
              onClick={handleExportScenarioComparison} 
              disabled={selectedScenarios.length < 2}
              data-testid="export-scenario-comparison"
            >
              <i className="fas fa-download mr-2"></i>
              Export Comparison ({selectedScenarios.length})
            </Button>
          </div>

          {scenarios.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <p className="text-muted-foreground">No scenarios available for comparison.</p>
                  <p className="text-sm text-muted-foreground mt-1">Create scenarios in the Financial Modeling tab first.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scenarios.map((scenario) => (
                <Card 
                  key={scenario.id}
                  className={`cursor-pointer transition-all ${
                    selectedScenarios.includes(scenario.id) 
                      ? 'border-primary border-2 bg-primary/5' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => toggleScenario(scenario.id)}
                  data-testid={`scenario-card-${scenario.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{scenario.name}</CardTitle>
                      <Checkbox 
                        checked={selectedScenarios.includes(scenario.id)}
                        onCheckedChange={() => toggleScenario(scenario.id)}
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`checkbox-${scenario.id}`}
                      />
                    </div>
                  </CardHeader>
                      <CardContent>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {scenario.description || 'No description'}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      Created {scenario.createdAt ? new Date(scenario.createdAt).toLocaleDateString() : 'N/A'}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {selectedScenarios.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Selected Scenarios ({selectedScenarios.length})</CardTitle>
              </CardHeader>
                  <CardContent>
                <div className="space-y-2">
                  {selectedScenarios.map((id) => {
                    const scenario = scenarios.find(s => s.id === id);
                    return scenario ? (
                      <div key={id} className="flex items-center justify-between p-2 bg-muted rounded" data-testid={`selected-${id}`}>
                        <span className="font-medium">{scenario.name}</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => toggleScenario(id)}
                          data-testid={`remove-${id}`}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : null;
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
