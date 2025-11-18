import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuickBooksExportDialog } from "@/components/fuel/quickbooks-export-dialog";
import type { TransactionsResponse, InventoryResponse, DeliveriesResponse } from "@/types/fuel-api";
import { AssetSelector } from "@/components/AssetSelector";
import { 
  FileText, 
  Download, 
  Filter,
  DollarSign,
  Fuel,
  BarChart3,
  Package
} from "lucide-react";

export default function Reports() {
  const [reportType, setReportType] = useState("transactions");
  const [dateRange, setDateRange] = useState("30");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showQuickBooksDialog, setShowQuickBooksDialog] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const transactionsKey = selectedAssetId
    ? ['/api/operations/fuel-sales', selectedAssetId]
    : ['/api/operations/fuel-sales'];

  const { data: transactions, isLoading: transactionsLoading } = useQuery<TransactionsResponse>({
    queryKey: transactionsKey,
    queryFn: async () => {
      const url = selectedAssetId
        ? `/api/operations/fuel-sales?assetId=${selectedAssetId}`
        : '/api/operations/fuel-sales';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return response.json();
    },
  });

  const inventoryKey = selectedAssetId
    ? ['/api/operations/fuel-inventory', selectedAssetId]
    : ['/api/operations/fuel-inventory'];

  const { data: inventory } = useQuery<InventoryResponse>({
    queryKey: inventoryKey,
    queryFn: async () => {
      const url = selectedAssetId
        ? `/api/operations/fuel-inventory?assetId=${selectedAssetId}`
        : '/api/operations/fuel-inventory';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch inventory');
      return response.json();
    },
  });

  const deliveriesKey = selectedAssetId
    ? ['/api/operations/fuel-deliveries', selectedAssetId]
    : ['/api/operations/fuel-deliveries'];

  const { data: deliveries } = useQuery<DeliveriesResponse>({
    queryKey: deliveriesKey,
    queryFn: async () => {
      const url = selectedAssetId
        ? `/api/operations/fuel-deliveries?assetId=${selectedAssetId}`
        : '/api/operations/fuel-deliveries';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch deliveries');
      return response.json();
    },
  });

  // Calculate the effective date range for filtering
  const getDateRangeBounds = () => {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    if (dateRange === "custom") {
      if (!startDate || !endDate) {
        return null;
      }
      start = new Date(startDate + "T00:00:00");
      end = new Date(endDate + "T23:59:59");
      
      // Validate that start is before end
      if (start > end) {
        return null;
      }
    } else if (dateRange === "all") {
      return null; // No filtering
    } else {
      const days = parseInt(dateRange);
      start = new Date(now);
      // Subtract (days - 1) to get exactly N days inclusive
      // e.g., "Last 7 Days" on Nov 10 = Nov 4-10 (7 days total)
      start.setDate(start.getDate() - (days - 1));
      start.setHours(0, 0, 0, 0);
    }

    return { start, end };
  };

  const dateRangeBounds = getDateRangeBounds();

  // Filter transactions by date range (use transactionDate consistently)
  const filteredTransactions = transactions?.filter(tx => {
    if (!dateRangeBounds) return true;
    const txDate = new Date(tx.transactionDate || tx.createdAt);
    return txDate >= dateRangeBounds.start && txDate <= dateRangeBounds.end;
  }) || [];

  // Filter deliveries by date range
  const filteredDeliveries = deliveries?.filter(delivery => {
    if (!dateRangeBounds) return true;
    const deliveryDate = new Date(delivery.deliveryDate);
    return deliveryDate >= dateRangeBounds.start && deliveryDate <= dateRangeBounds.end;
  }) || [];

  // Calculate summary statistics based on filtered data
  const totalRevenue = filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.totalAmount), 0);
  const totalGallons = filteredTransactions.reduce((sum, tx) => sum + parseFloat(tx.gallons), 0);
  const avgPricePerGallon = totalGallons > 0 ? totalRevenue / totalGallons : 0;
  const totalTransactions = filteredTransactions.length;

  const exportReport = () => {
    const csvContent = generateCSVContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `fuel-sales-${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateCSVContent = () => {
    let headers = '';
    let rows = '';

    switch (reportType) {
      case "transactions":
        headers = 'Date,Time,Customer Name,Fuel Type,Gallons,Price Per Gallon,Total Amount,Payment Method,Status\n';
        rows = filteredTransactions.map((tx) => {
          const txDate = new Date(tx.transactionDate || tx.createdAt);
          return `${txDate.toLocaleDateString()},${txDate.toLocaleTimeString()},"${tx.customerName || ''}","${tx.fuelType?.name}",${tx.gallons},${tx.pricePerGallon},${tx.totalAmount},${tx.paymentMethod},${tx.status}`;
        }).join('\n');
        break;
      case "inventory":
        headers = 'Fuel Type,Current Level,Capacity,Reorder Point,Reorder Quantity,Last Updated\n';
        rows = inventory?.map((item) => 
          `"${item.fuelType.name}",${item.currentLevel},${item.capacity},${item.reorderPoint},${item.reorderQuantity},${new Date(item.lastUpdated).toLocaleDateString()}`
        ).join('\n') || '';
        break;
      case "deliveries":
        headers = 'Date,Fuel Type,Quantity,Cost,Cost Per Gallon,Supplier,Invoice Number\n';
        rows = filteredDeliveries.map((delivery) => 
          `${new Date(delivery.deliveryDate).toLocaleDateString()},"${delivery.fuelType.name}",${delivery.quantity},${delivery.cost},${(parseFloat(delivery.cost) / parseFloat(delivery.quantity)).toFixed(3)},"${delivery.supplier}","${delivery.invoiceNumber || ''}"`
        ).join('\n');
        break;
      case "summary":
        headers = 'Metric,Value\n';
        rows = `Total Revenue,$${totalRevenue.toLocaleString()}\n`;
        rows += `Total Gallons Sold,${totalGallons.toLocaleString()}\n`;
        rows += `Average Price Per Gallon,$${avgPricePerGallon.toFixed(3)}\n`;
        rows += `Total Transactions,${totalTransactions}\n`;
        break;
      default:
        headers = 'No data available\n';
        rows = '';
    }

    return headers + rows;
  };

  if (transactionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      <Header 
        title="Fuel Sales Reports"
        subtitle="Generate and export detailed sales and inventory reports"
      />

      <div className="px-6 pt-4 border-b border-border">
        <div className="flex justify-end pb-4">
          <AssetSelector 
            value={selectedAssetId} 
            onChange={setSelectedAssetId}
            className="w-[280px]"
          />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Report Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center" data-testid="report-config-title">
              <Filter className="w-5 h-5 mr-2" />
              Report Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Report Type</label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger data-testid="select-report-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transactions">Transaction Details</SelectItem>
                    <SelectItem value="inventory">Inventory Report</SelectItem>
                    <SelectItem value="deliveries">Delivery History</SelectItem>
                    <SelectItem value="summary">Summary Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Date Range</label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger data-testid="select-date-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 Days</SelectItem>
                    <SelectItem value="30">Last 30 Days</SelectItem>
                    <SelectItem value="90">Last 90 Days</SelectItem>
                    <SelectItem value="365">Last Year</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dateRange === "custom" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Start Date</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">End Date</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      data-testid="input-end-date"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowQuickBooksDialog(true)} 
                data-testid="button-export-quickbooks"
              >
                <Download className="w-4 h-4 mr-2" />
                Export to QuickBooks
              </Button>
              <Button onClick={exportReport} data-testid="button-export-report">
                <Download className="w-4 h-4 mr-2" />
                Export to CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Report Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="summary-total-revenue">
                    ${totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Total Gallons</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="summary-total-gallons">
                    {totalGallons.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <Fuel className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Avg Price/Gal</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="summary-avg-price">
                    ${avgPricePerGallon.toFixed(3)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Transactions</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="summary-transactions">
                    {totalTransactions}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center" data-testid="report-preview-title">
                <FileText className="w-5 h-5 mr-2" />
                Report Preview
              </div>
              <span className="text-sm text-muted-foreground font-normal">
                Showing {reportType === "transactions" ? filteredTransactions.length : reportType === "inventory" ? inventory?.length || 0 : filteredDeliveries.length} records
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reportType === "transactions" && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Customer</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Fuel Type</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Gallons</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Total</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTransactions.slice(0, 50).map((tx, index) => {
                      const txDate = new Date(tx.transactionDate || tx.createdAt);
                      return (
                        <tr key={tx.id} className="hover:bg-muted/30" data-testid={`tx-row-${index}`}>
                          <td className="p-4 text-sm">{txDate.toLocaleDateString()}</td>
                          <td className="p-4 text-sm">{tx.customerName || '—'}</td>
                          <td className="p-4 text-sm">{tx.fuelType?.name}</td>
                          <td className="p-4 text-sm">{parseFloat(tx.gallons).toFixed(1)}</td>
                          <td className="p-4 text-sm">${parseFloat(tx.totalAmount).toFixed(2)}</td>
                          <td className="p-4 text-sm">{tx.paymentMethod}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {reportType === "inventory" && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Fuel Type</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Current Level</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Capacity</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">% Full</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Reorder Point</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {inventory?.map((item, index) => (
                      <tr key={item.id} className="hover:bg-muted/30" data-testid={`inv-row-${index}`}>
                        <td className="p-4 text-sm">{item.fuelType.name}</td>
                        <td className="p-4 text-sm">{parseFloat(item.currentLevel).toLocaleString()} gal</td>
                        <td className="p-4 text-sm">{parseFloat(item.capacity).toLocaleString()} gal</td>
                        <td className="p-4 text-sm">{((parseFloat(item.currentLevel) / parseFloat(item.capacity)) * 100).toFixed(1)}%</td>
                        <td className="p-4 text-sm">{parseFloat(item.reorderPoint).toLocaleString()} gal</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {reportType === "deliveries" && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Fuel Type</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Quantity</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Cost</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Supplier</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Invoice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredDeliveries.map((delivery, index) => (
                      <tr key={delivery.id} className="hover:bg-muted/30" data-testid={`delivery-row-${index}`}>
                        <td className="p-4 text-sm">{new Date(delivery.deliveryDate).toLocaleDateString()}</td>
                        <td className="p-4 text-sm">{delivery.fuelType.name}</td>
                        <td className="p-4 text-sm">{parseFloat(delivery.quantity).toLocaleString()} gal</td>
                        <td className="p-4 text-sm">${parseFloat(delivery.cost).toLocaleString()}</td>
                        <td className="p-4 text-sm">{delivery.supplier}</td>
                        <td className="p-4 text-sm">{delivery.invoiceNumber || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {reportType === "summary" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-6 bg-muted/20 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Gallons Sold</p>
                    <p className="text-2xl font-bold">{totalGallons.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Average Price Per Gallon</p>
                    <p className="text-2xl font-bold">${avgPricePerGallon.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Transactions</p>
                    <p className="text-2xl font-bold">{totalTransactions}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <QuickBooksExportDialog 
        open={showQuickBooksDialog} 
        onOpenChange={setShowQuickBooksDialog} 
      />
    </>
  );
}
