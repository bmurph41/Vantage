import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import {
  Fuel, Plus, Download, Trash2, Edit, Calendar, DollarSign,
  Droplet, TrendingUp, Filter, X, Calculator
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { FuelSale } from "@shared/schema";
import FuelSaleDialog from "@/components/operations/FuelSaleDialog";
import { GlobalControlsBar } from "@/components/operations/GlobalControlsBar";
import { KpiRow } from "@/components/operations/KpiRow";
import { UseInValuatorModal } from "@/components/operations/UseInValuatorModal";

type FuelSaleWithUser = FuelSale & {
  processedByUser?: {
    id: string;
    name: string;
    email: string;
  };
};

type FuelSalesStats = {
  totalSales: number;
  totalRevenue: number;
  totalGallons: number;
  byFuelType: Record<string, { count: number; gallons: number; revenue: number }>;
  byPaymentMethod: Record<string, number>;
};

const fuelTypeLabels: Record<string, string> = {
  diesel: "Diesel",
  regular_gas: "Regular Gas",
  premium_gas: "Premium Gas",
  ethanol_free: "Ethanol Free",
};

const paymentMethodLabels: Record<string, string> = {
  cash: "Cash",
  credit_card: "Credit Card",
  debit_card: "Debit Card",
  account_charge: "Account Charge",
  check: "Check",
};

export default function FuelSales() {
  const { toast } = useToast();
  const [selectedSale, setSelectedSale] = useState<FuelSaleWithUser | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [fuelTypeFilter, setFuelTypeFilter] = useState<string>("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("");
  
  const [selectedMarinaId, setSelectedMarinaId] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState("ttm");
  const [showUseInValuator, setShowUseInValuator] = useState(false);

  // Fetch all fuel sales with optional marina filter
  const { data: sales = [], isLoading } = useQuery<FuelSaleWithUser[]>({
    queryKey: ["/api/operations/fuel-sales", selectedMarinaId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedMarinaId) params.set("marinaId", selectedMarinaId);
      const res = await fetch(`/api/operations/fuel-sales?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch fuel sales");
      return res.json();
    },
  });

  // Fetch stats
  const { data: stats } = useQuery<FuelSalesStats>({
    queryKey: ["/api/operations/fuel-sales/stats/summary", dateRange],
    enabled: !!dateRange.start && !!dateRange.end,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/operations/fuel-sales/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete fuel sale");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/fuel-sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations/fuel-sales/stats/summary"] });
      toast({
        title: "Success",
        description: "Fuel sale deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete fuel sale",
        variant: "destructive",
      });
    },
  });

  // Filter sales
  const filteredSales = sales.filter((sale) => {
    if (fuelTypeFilter && sale.fuelType !== fuelTypeFilter) return false;
    if (paymentMethodFilter && sale.paymentMethod !== paymentMethodFilter) return false;
    return true;
  });

  const handleEdit = (sale: FuelSaleWithUser) => {
    setSelectedSale(sale);
    setShowDialog(true);
  };

  const handleAdd = () => {
    setSelectedSale(null);
    setShowDialog(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this fuel sale?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      "Date",
      "Fuel Type",
      "Gallons",
      "Price/Gal",
      "Total",
      "Customer",
      "Boat",
      "Slip",
      "Payment Method",
      "Processed By",
    ];
    
    const rows = filteredSales.map(sale => [
      format(new Date(sale.transactionDate), "yyyy-MM-dd HH:mm"),
      fuelTypeLabels[sale.fuelType],
      sale.quantityGallons,
      sale.pricePerGallon,
      sale.totalAmount,
      sale.customerName || "",
      sale.boatName || "",
      sale.slipNumber || "",
      sale.paymentMethod ? paymentMethodLabels[sale.paymentMethod] : "",
      sale.processedByUser?.name || "",
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fuel-sales-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate quick stats from current view
  const quickStats = {
    totalSales: filteredSales.length,
    totalRevenue: filteredSales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0),
    totalGallons: filteredSales.reduce((sum, sale) => sum + Number(sale.quantityGallons), 0),
    avgPricePerGallon: filteredSales.length > 0
      ? filteredSales.reduce((sum, sale) => sum + Number(sale.pricePerGallon), 0) / filteredSales.length
      : 0,
  };

  // KPI metrics for the KpiRow component
  const kpiMetrics = [
    {
      label: "Total Sales",
      value: quickStats.totalSales,
      format: "number" as const,
    },
    {
      label: "Total Revenue",
      value: quickStats.totalRevenue,
      format: "currency" as const,
    },
    {
      label: "Total Gallons",
      value: quickStats.totalGallons,
      format: "gallons" as const,
    },
    {
      label: "Avg Price/Gal",
      value: quickStats.avgPricePerGallon,
      format: "currency" as const,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Global Controls Bar */}
      <GlobalControlsBar
        selectedMarinaId={selectedMarinaId}
        onMarinaChange={(id) => setSelectedMarinaId(id === "all" ? null : id)}
        timeframe={selectedTimeframe}
        onTimeframeChange={setSelectedTimeframe}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Fuel className="h-8 w-8 text-blue-600" />
            Fuel Sales
          </h1>
          <p className="text-gray-500 mt-1">Track and manage fuel sales transactions</p>
        </div>
        <div className="flex gap-2">
          {selectedMarinaId && (
            <Button 
              variant="outline" 
              onClick={() => setShowUseInValuator(true)}
              data-testid="button-use-in-valuator"
            >
              <Calculator className="mr-2 h-4 w-4" />
              Use in Financial Model
            </Button>
          )}
          <Button onClick={handleExportCSV} variant="outline" data-testid="button-export-csv">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={handleAdd} data-testid="button-add-fuel-sale">
            <Plus className="mr-2 h-4 w-4" />
            Add Fuel Sale
          </Button>
        </div>
      </div>

      {/* Stats KPI Row */}
      <KpiRow kpis={kpiMetrics} />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Fuel Type</label>
              <Select value={fuelTypeFilter} onValueChange={setFuelTypeFilter}>
                <SelectTrigger data-testid="select-fuel-type">
                  <SelectValue placeholder="All fuel types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All fuel types</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="regular_gas">Regular Gas</SelectItem>
                  <SelectItem value="premium_gas">Premium Gas</SelectItem>
                  <SelectItem value="ethanol_free">Ethanol Free</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Payment Method</label>
              <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                <SelectTrigger data-testid="select-payment-method">
                  <SelectValue placeholder="All payment methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All payment methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="debit_card">Debit Card</SelectItem>
                  <SelectItem value="account_charge">Account Charge</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFuelTypeFilter("");
                  setPaymentMethodFilter("");
                }}
                data-testid="button-clear-filters"
              >
                <X className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>
            Showing {filteredSales.length} of {sales.length} transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Fuel className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No fuel sales recorded yet</p>
              <Button className="mt-4" onClick={handleAdd} data-testid="button-add-first-sale">
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Sale
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Fuel Type</TableHead>
                    <TableHead className="text-right">Gallons</TableHead>
                    <TableHead className="text-right">Price/Gal</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Processed By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id} data-testid={`row-fuel-sale-${sale.id}`}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(sale.transactionDate), "MMM dd, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{fuelTypeLabels[sale.fuelType]}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(sale.quantityGallons).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${Number(sale.pricePerGallon).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        ${Number(sale.totalAmount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {sale.customerName && <div className="font-medium">{sale.customerName}</div>}
                          {sale.boatName && <div className="text-muted-foreground">{sale.boatName}</div>}
                          {sale.slipNumber && <div className="text-xs text-muted-foreground">Slip {sale.slipNumber}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {sale.paymentMethod && (
                          <Badge variant="secondary">
                            {paymentMethodLabels[sale.paymentMethod]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {sale.processedByUser?.name || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(sale)}
                            data-testid={`button-edit-${sale.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(sale.id)}
                            data-testid={`button-delete-${sale.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
          )}
        </CardContent>
      </Card>

      {/* Fuel Sale Dialog */}
      <FuelSaleDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        fuelSale={selectedSale}
      />

      {/* Use in Valuator Modal */}
      {selectedMarinaId && (
        <UseInValuatorModal
          open={showUseInValuator}
          onOpenChange={setShowUseInValuator}
          marinaId={selectedMarinaId}
          module="FUEL"
        />
      )}
    </div>
  );
}
