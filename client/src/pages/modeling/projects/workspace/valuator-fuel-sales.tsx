import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import {
  Fuel, Plus, Trash2, Edit, DollarSign,
  Droplet, TrendingUp, Download, Upload, Building2
} from "lucide-react";
import ImportFromActualsModal from "@/components/operations/ImportFromActualsModal";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";

interface ValuatorFuelSalesTabProps {
  projectId: string;
  projectName?: string;
}

interface FuelTransaction {
  id: string;
  txnDate: string;
  fuelType: string;
  gallons: string;
  grossSales: string;
  cogs: string;
  source: string;
  notes?: string;
}

interface FuelSummary {
  byFuelType: Array<{
    fuelType: string;
    totalGallons: string;
    totalRevenue: string;
    totalCogs: string;
    transactionCount: number;
  }>;
  totals: {
    totalGallons: number;
    totalRevenue: number;
    totalCogs: number;
    grossMargin: number;
    marginPercent: string;
    transactionCount: number;
  };
}

const fuelTypeLabels: Record<string, string> = {
  DIESEL: "Diesel",
  GAS_87: "Regular (87)",
  GAS_89: "Mid-Grade (89)",
  GAS_93: "Premium (93)",
  NON_ETHANOL: "Non-Ethanol",
};

export default function ValuatorFuelSalesTab({ projectId, projectName }: ValuatorFuelSalesTabProps) {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FuelTransaction | null>(null);
  const [timeframe, setTimeframe] = useState("12m");
  
  const getDateRange = () => {
    const end = new Date();
    const start = subMonths(end, timeframe === "12m" ? 12 : timeframe === "6m" ? 6 : 3);
    return {
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
    };
  };
  
  const dateRange = getDateRange();

  const { data: transactions = [], isLoading } = useQuery<FuelTransaction[]>({
    queryKey: ["/api/ops/projects", projectId, "ops/fuel", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const res = await fetch(`/api/ops/projects/${projectId}/ops/fuel?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch fuel transactions");
      const data = await res.json();
      return data.data || [];
    },
  });

  const { data: summary } = useQuery<FuelSummary>({
    queryKey: ["/api/ops/projects", projectId, "ops/fuel/summary", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const res = await fetch(`/api/ops/projects/${projectId}/ops/fuel/summary?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch summary");
      const data = await res.json();
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<FuelTransaction>) => {
      return apiRequest(`/api/ops/projects/${projectId}/ops/fuel`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/projects", projectId] });
      toast({ title: "Success", description: "Fuel transaction added" });
      setShowAddDialog(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add transaction", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (txnId: string) => {
      return apiRequest(`/api/ops/projects/${projectId}/ops/fuel/${txnId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ops/projects", projectId] });
      toast({ title: "Success", description: "Transaction deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete transaction", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      txnDate: formData.get("txnDate") as string,
      fuelType: formData.get("fuelType") as string,
      gallons: formData.get("gallons") as string,
      grossSales: formData.get("grossSales") as string,
      cogs: formData.get("cogs") as string,
      notes: formData.get("notes") as string,
    };
    createMutation.mutate(data);
  };

  const kpis = [
    {
      label: "Total Revenue",
      value: formatCurrency(summary?.totals?.totalRevenue || 0),
      icon: DollarSign,
      trend: "+12%",
      trendUp: true,
    },
    {
      label: "Total Gallons",
      value: `${(summary?.totals?.totalGallons || 0).toLocaleString()} gal`,
      icon: Droplet,
    },
    {
      label: "Gross Margin",
      value: formatCurrency(summary?.totals?.grossMargin || 0),
      icon: TrendingUp,
      subLabel: `${summary?.totals?.marginPercent || 0}%`,
    },
    {
      label: "Transactions",
      value: (summary?.totals?.transactionCount || 0).toString(),
      icon: Fuel,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Fuel className="h-5 w-5" />
            Fuel Sales (Modeling)
          </h3>
          <p className="text-sm text-muted-foreground">
            Enter fuel sales data for your valuation model
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">Last 3 Months</SelectItem>
              <SelectItem value="6m">Last 6 Months</SelectItem>
              <SelectItem value="12m">Last 12 Months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
            <Building2 className="h-4 w-4 mr-2" />
            Import from Actuals
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  {kpi.subLabel && (
                    <p className="text-xs text-muted-foreground">{kpi.subLabel}</p>
                  )}
                </div>
                <kpi.icon className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>
            {transactions.length} transactions in selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Fuel className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No fuel transactions yet</p>
              <p className="text-sm">Add transactions to build your fuel sales model</p>
              <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Transaction
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Fuel Type</TableHead>
                  <TableHead className="text-right">Gallons</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => {
                  const revenue = parseFloat(txn.grossSales || "0");
                  const cogs = parseFloat(txn.cogs || "0");
                  const margin = revenue - cogs;
                  return (
                    <TableRow key={txn.id}>
                      <TableCell>{format(new Date(txn.txnDate), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {fuelTypeLabels[txn.fuelType] || txn.fuelType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {parseFloat(txn.gallons).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(cogs)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span className={margin >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatCurrency(margin)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {txn.source}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(txn.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Fuel Transaction</DialogTitle>
            <DialogDescription>
              Enter fuel sales data for {projectName || "this project"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="txnDate">Date</Label>
                  <Input
                    id="txnDate"
                    name="txnDate"
                    type="date"
                    defaultValue={format(new Date(), "yyyy-MM-dd")}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fuelType">Fuel Type</Label>
                  <Select name="fuelType" defaultValue="DIESEL">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DIESEL">Diesel</SelectItem>
                      <SelectItem value="GAS_87">Regular (87)</SelectItem>
                      <SelectItem value="GAS_89">Mid-Grade (89)</SelectItem>
                      <SelectItem value="GAS_93">Premium (93)</SelectItem>
                      <SelectItem value="NON_ETHANOL">Non-Ethanol</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gallons">Gallons</Label>
                  <Input
                    id="gallons"
                    name="gallons"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grossSales">Revenue ($)</Label>
                  <Input
                    id="grossSales"
                    name="grossSales"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cogs">COGS ($)</Label>
                  <Input
                    id="cogs"
                    name="cogs"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input id="notes" name="notes" placeholder="Additional notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Adding..." : "Add Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ImportFromActualsModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        projectId={projectId}
        projectName={projectName}
      />
    </div>
  );
}
