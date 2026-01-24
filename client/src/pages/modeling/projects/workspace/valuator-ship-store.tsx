import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import {
  ShoppingCart, Plus, Trash2, DollarSign,
  TrendingUp, Package, Upload, Building2
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

interface ValuatorShipStoreTabProps {
  projectId: string;
  projectName?: string;
}

interface ShipStoreSale {
  id: string;
  txnDate: string;
  category: string;
  grossSales: string;
  cogs: string;
  txnCount: number;
  source: string;
  notes?: string;
}

interface ShipStoreSummary {
  byCategory: Array<{
    category: string;
    totalRevenue: string;
    totalCogs: string;
    transactionCount: number;
  }>;
  totals: {
    totalRevenue: number;
    totalCogs: number;
    grossMargin: number;
    marginPercent: string;
    transactionCount: number;
  };
}

const categoryLabels: Record<string, string> = {
  PARTS: "Parts & Accessories",
  APPAREL: "Apparel",
  SNACKS: "Snacks & Beverages",
  FISHING: "Fishing Supplies",
  SUPPLIES: "Marine Supplies",
  GENERAL: "General Merchandise",
};

export default function ValuatorShipStoreTab({ projectId, projectName }: ValuatorShipStoreTabProps) {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
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

  const { data: sales = [], isLoading } = useQuery<ShipStoreSale[]>({
    queryKey: ["/api/operations-context/projects", projectId, "ops/ship-store", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const res = await fetch(`/api/operations-context/projects/${projectId}/ops/ship-store?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch sales");
      const data = await res.json();
      return data.data || [];
    },
  });

  const { data: summary } = useQuery<ShipStoreSummary>({
    queryKey: ["/api/operations-context/projects", projectId, "ops/ship-store/summary", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      const res = await fetch(`/api/operations-context/projects/${projectId}/ops/ship-store/summary?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch summary");
      const data = await res.json();
      return data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<ShipStoreSale>) => {
      return apiRequest(`/api/operations-context/projects/${projectId}/ops/ship-store`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/projects", projectId] });
      toast({ title: "Success", description: "Sale added" });
      setShowAddDialog(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add sale", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (saleId: string) => {
      return apiRequest(`/api/operations-context/projects/${projectId}/ops/ship-store/${saleId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations-context/projects", projectId] });
      toast({ title: "Success", description: "Sale deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete sale", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      txnDate: formData.get("txnDate") as string,
      category: formData.get("category") as string,
      grossSales: formData.get("grossSales") as string,
      cogs: formData.get("cogs") as string,
      qty: parseInt(formData.get("qty") as string) || 1,
      notes: formData.get("notes") as string,
    };
    createMutation.mutate(data);
  };

  const kpis = [
    {
      label: "Total Revenue",
      value: formatCurrency(summary?.totals?.totalRevenue || 0),
      icon: DollarSign,
      trend: "+8%",
      trendUp: true,
    },
    {
      label: "Gross Margin",
      value: formatCurrency(summary?.totals?.grossMargin || 0),
      icon: TrendingUp,
      subLabel: `${summary?.totals?.marginPercent || 0}%`,
    },
    {
      label: "Categories",
      value: (summary?.byCategory?.length || 0).toString(),
      icon: Package,
    },
    {
      label: "Transactions",
      value: (summary?.totals?.transactionCount || 0).toString(),
      icon: ShoppingCart,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Ship Store (Modeling)
          </h3>
          <p className="text-sm text-muted-foreground">
            Enter ship store sales data for your valuation model
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
            Add Sale
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
          <CardTitle>Sales</CardTitle>
          <CardDescription>
            {sales.length} sales in selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No ship store sales yet</p>
              <p className="text-sm">Add sales to build your ship store model</p>
              <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Sale
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">COGS</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => {
                  const revenue = parseFloat(sale.grossSales || "0");
                  const cogs = parseFloat(sale.cogs || "0");
                  const margin = revenue - cogs;
                  return (
                    <TableRow key={sale.id}>
                      <TableCell>{format(new Date(sale.txnDate), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {categoryLabels[sale.category] || sale.category}
                        </Badge>
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
                          {sale.source}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(sale.id)}
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
            <DialogTitle>Add Ship Store Sale</DialogTitle>
            <DialogDescription>
              Enter ship store data for {projectName || "this project"}
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
                  <Label htmlFor="category">Category</Label>
                  <Select name="category" defaultValue="SUPPLIES">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PARTS">Parts & Accessories</SelectItem>
                      <SelectItem value="APPAREL">Apparel</SelectItem>
                      <SelectItem value="SNACKS">Snacks & Beverages</SelectItem>
                      <SelectItem value="FISHING">Fishing Supplies</SelectItem>
                      <SelectItem value="SUPPLIES">Marine Supplies</SelectItem>
                      <SelectItem value="GENERAL">General Merchandise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
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
                <div className="space-y-2">
                  <Label htmlFor="qty">Quantity</Label>
                  <Input
                    id="qty"
                    name="qty"
                    type="number"
                    defaultValue="1"
                    min="1"
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
                {createMutation.isPending ? "Adding..." : "Add Sale"}
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
